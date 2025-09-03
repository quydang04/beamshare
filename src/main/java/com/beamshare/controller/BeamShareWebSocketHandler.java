package com.beamshare.controller;

import com.beamshare.model.Peer;
import com.beamshare.util.DeviceInfoHelper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class BeamShareWebSocketHandler implements WebSocketHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(BeamShareWebSocketHandler.class);
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);
    
    // Store client connections (equivalent to Node.js maps)
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> rooms = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> roomSecrets = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> publicRooms = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> keepAliveTimers = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> persistentConnections = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> connectionHistory = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Peer peer = new Peer(session);
        peers.put(peer.getId(), peer);
        
        logger.info("Peer {} connected from IP: {}", peer.getId(), peer.getIp());
        logger.info("Device: {} ({})", peer.getDeviceInfo().getDisplayName(), peer.getDeviceInfo().getDeviceName());
        
        // Initialize keep-alive
        keepAlive(peer);
        
        // Send peer information to client
        Map<String, Object> message = new HashMap<>();
        message.put("type", "display-name");
        message.put("peerId", peer.getId());
        message.put("displayName", peer.getDeviceInfo().getDisplayName());
        message.put("deviceName", peer.getDeviceInfo().getDeviceName());
        message.put("peerIdHash", getMD5Hash(peer.getId()).substring(0, 8));
        
        sendMessage(peer, message);
        
        // Store connection history for persistence
        Map<String, Object> history = new HashMap<>();
        history.put("deviceInfo", peer.getDeviceInfo());
        history.put("rooms", new HashSet<>());
        history.put("lastConnected", System.currentTimeMillis());
        history.put("ip", peer.getIp());
        connectionHistory.put(peer.getId(), history);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        String peerId = findPeerIdBySession(session);
        if (peerId == null) {
            logger.warn("Received message from unknown session");
            return;
        }
        
        Peer peer = peers.get(peerId);
        if (peer == null) {
            logger.warn("Peer {} not found", peerId);
            return;
        }
        
        try {
            JsonNode msg = objectMapper.readTree(message.getPayload().toString());
            logger.info("Received message from {}: {}", peer.getId(), msg.get("type"));
            handleMessage(peer, msg);
        } catch (Exception e) {
            logger.error("Error parsing message: {}", e.getMessage());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String peerId = findPeerIdBySession(session);
        if (peerId != null) {
            logger.error("WebSocket error for peer {}: {}", peerId, exception.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        String peerId = findPeerIdBySession(session);
        if (peerId != null) {
            Peer peer = peers.get(peerId);
            if (peer != null) {
                handleDisconnect(peer);
            }
        }
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    private String findPeerIdBySession(WebSocketSession session) {
        return peers.entrySet().stream()
            .filter(entry -> entry.getValue().getSession().equals(session))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);
    }

    private void handleMessage(Peer peer, JsonNode message) {
        String type = message.get("type").asText();
        
        switch (type) {
            case "disconnect":
                handleDisconnect(peer);
                break;
            case "pong":
                setKeepAliveTimerToNow(peer);
                break;
            case "join-ip-room":
                joinIpRoom(peer);
                break;
            case "device-info":
                // Legacy support - device info is now set during connection
                sendPeersList(peer);
                break;
            case "discovery-request":
            case "request-devices":
                sendPeersList(peer);
                break;
            case "peerjs-id-update":
                handlePeerJSIdUpdate(peer, message);
                break;
            case "heartbeat":
                handleHeartbeat(peer, message);
                break;
            case "connection-established":
                handleConnectionEstablished(peer, message);
                break;
            case "connection-lost":
                handleConnectionLost(peer, message);
                break;
            case "request-persistent-peers":
                sendPersistentPeers(peer);
                break;
            case "create-public-room":
                handleCreatePublicRoom(peer);
                break;
            case "leave-public-room":
                handleLeavePublicRoom(peer);
                break;
            default:
                // Relay WebRTC signaling messages
                if (message.has("to")) {
                    String targetId = message.get("to").asText();
                    if (peers.containsKey(targetId)) {
                        Peer targetPeer = peers.get(targetId);
                        Map<String, Object> relayMessage = objectMapper.convertValue(message, Map.class);
                        relayMessage.put("from", peer.getId());
                        sendMessage(targetPeer, relayMessage);
                    } else {
                        logger.warn("Message to unknown peer {}", targetId);
                    }
                }
                break;
        }
    }

    private void handlePeerJSIdUpdate(Peer peer, JsonNode message) {
        String peerJSId = message.get("peerJSId").asText();
        logger.info("Updating PeerJS ID for peer {} to {}", peer.getId(), peerJSId);
        
        peer.setPeerJSId(peerJSId);
        
        // Notify all other peers in the same rooms about the PeerJS ID update
        for (Map.Entry<String, Set<String>> roomEntry : rooms.entrySet()) {
            String roomId = roomEntry.getKey();
            Set<String> room = roomEntry.getValue();
            
            if (room.contains(peer.getId())) {
                String roomType = roomId.startsWith("ip:") ? "ip" : 
                                roomId.startsWith("public:") ? "public" : "unknown";
                
                // Notify other peers in this room
                for (String otherPeerId : room) {
                    if (!otherPeerId.equals(peer.getId())) {
                        Peer otherPeer = peers.get(otherPeerId);
                        if (otherPeer != null) {
                            Map<String, Object> updateMessage = new HashMap<>();
                            updateMessage.put("type", "peerjs-id-updated");
                            updateMessage.put("peerId", peer.getId());
                            updateMessage.put("peerJSId", peerJSId);
                            updateMessage.put("roomType", roomType);
                            updateMessage.put("roomId", roomId);
                            sendMessage(otherPeer, updateMessage);
                        }
                    }
                }
            }
        }
    }

    private void handleHeartbeat(Peer peer, JsonNode message) {
        // Update persistent connection info
        Map<String, Object> connInfo = persistentConnections.computeIfAbsent(peer.getId(), k -> {
            Map<String, Object> info = new HashMap<>();
            info.put("lastSeen", System.currentTimeMillis());
            info.put("reconnectCount", 0);
            info.put("persistentPeers", new HashSet<String>());
            return info;
        });
        connInfo.put("lastSeen", System.currentTimeMillis());

        // Send heartbeat response
        Map<String, Object> response = new HashMap<>();
        response.put("type", "heartbeat-response");
        response.put("timestamp", System.currentTimeMillis());
        sendMessage(peer, response);
    }

    private void handleConnectionEstablished(Peer peer, JsonNode message) {
        String targetPeerId = message.get("targetPeerId").asText();
        logger.info("Connection established between {} and {}", peer.getId(), targetPeerId);

        // Update persistent connections
        Map<String, Object> connInfo = persistentConnections.computeIfAbsent(peer.getId(), k -> {
            Map<String, Object> info = new HashMap<>();
            info.put("lastSeen", System.currentTimeMillis());
            info.put("reconnectCount", 0);
            info.put("persistentPeers", new HashSet<String>());
            return info;
        });
        
        @SuppressWarnings("unchecked")
        Set<String> persistentPeers = (Set<String>) connInfo.get("persistentPeers");
        persistentPeers.add(targetPeerId);

        // Notify the target peer about the established connection
        if (peers.containsKey(targetPeerId)) {
            Peer targetPeer = peers.get(targetPeerId);
            Map<String, Object> notification = new HashMap<>();
            notification.put("type", "connection-established-notification");
            notification.put("fromPeerId", peer.getId());
            notification.put("timestamp", System.currentTimeMillis());
            sendMessage(targetPeer, notification);
        }
    }

    private void handleConnectionLost(Peer peer, JsonNode message) {
        String targetPeerId = message.get("targetPeerId").asText();
        logger.info("Connection lost between {} and {}", peer.getId(), targetPeerId);

        // Update persistent connections
        if (persistentConnections.containsKey(peer.getId())) {
            Map<String, Object> connInfo = persistentConnections.get(peer.getId());
            @SuppressWarnings("unchecked")
            Set<String> persistentPeers = (Set<String>) connInfo.get("persistentPeers");
            persistentPeers.remove(targetPeerId);
        }

        // Notify the target peer about the lost connection
        if (peers.containsKey(targetPeerId)) {
            Peer targetPeer = peers.get(targetPeerId);
            Map<String, Object> notification = new HashMap<>();
            notification.put("type", "connection-lost-notification");
            notification.put("fromPeerId", peer.getId());
            notification.put("timestamp", System.currentTimeMillis());
            sendMessage(targetPeer, notification);
        }
    }

    private void sendPersistentPeers(Peer peer) {
        List<Map<String, Object>> persistentPeersList = new ArrayList<>();

        if (persistentConnections.containsKey(peer.getId())) {
            Map<String, Object> connInfo = persistentConnections.get(peer.getId());
            @SuppressWarnings("unchecked")
            Set<String> persistentPeerIds = (Set<String>) connInfo.get("persistentPeers");

            for (String persistentPeerId : persistentPeerIds) {
                Map<String, Object> history = connectionHistory.get(persistentPeerId);
                if (history != null) {
                    Map<String, Object> peerInfo = new HashMap<>();
                    peerInfo.put("peerId", persistentPeerId);
                    peerInfo.put("deviceInfo", history.get("deviceInfo"));
                    peerInfo.put("lastConnected", history.get("lastConnected"));
                    peerInfo.put("isOnline", peers.containsKey(persistentPeerId));
                    persistentPeersList.add(peerInfo);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("type", "persistent-peers");
        response.put("peers", persistentPeersList);
        sendMessage(peer, response);
    }

    private void handleDisconnect(Peer peer) {
        cancelKeepAlive(peer);
        leaveAllRooms(peer, true);

        // Update connection history
        if (connectionHistory.containsKey(peer.getId())) {
            Map<String, Object> history = connectionHistory.get(peer.getId());
            history.put("lastConnected", System.currentTimeMillis());
        }

        // Keep persistent connection info but mark as offline
        if (persistentConnections.containsKey(peer.getId())) {
            Map<String, Object> connInfo = persistentConnections.get(peer.getId());
            connInfo.put("lastSeen", System.currentTimeMillis());

            // Notify persistent peers about disconnection
            @SuppressWarnings("unchecked")
            Set<String> persistentPeerIds = (Set<String>) connInfo.get("persistentPeers");
            for (String persistentPeerId : persistentPeerIds) {
                if (peers.containsKey(persistentPeerId)) {
                    Peer persistentPeer = peers.get(persistentPeerId);
                    Map<String, Object> notification = new HashMap<>();
                    notification.put("type", "persistent-peer-offline");
                    notification.put("peerId", peer.getId());
                    notification.put("deviceInfo", peer.getDeviceInfo());
                    notification.put("timestamp", System.currentTimeMillis());
                    sendMessage(persistentPeer, notification);
                }
            }
        }

        peers.remove(peer.getId());
        logger.info("Peer {} disconnected", peer.getId());
    }

    // Room management functions
    private void joinIpRoom(Peer peer) {
        String roomId = "ip:" + peer.getIp();
        joinRoom(peer, "ip", roomId);
    }

    private void joinRoom(Peer peer, String roomType, String roomId) {
        // If room doesn't exist, create it
        rooms.computeIfAbsent(roomId, k -> new HashSet<>());
        Set<String> room = rooms.get(roomId);

        // Get existing peers in room before adding new peer
        List<Map<String, Object>> existingPeers = new ArrayList<>();
        for (String otherPeerId : room) {
            if (!otherPeerId.equals(peer.getId())) {
                Peer otherPeer = peers.get(otherPeerId);
                if (otherPeer != null) {
                    existingPeers.add(otherPeer.getInfo());
                }
            }
        }

        // Add peer to room first
        room.add(peer.getId());

        // Send existing peers to new peer
        if (!existingPeers.isEmpty()) {
            logger.info("Sending {} existing peers to new peer {}", existingPeers.size(), peer.getId());
            Map<String, Object> message = new HashMap<>();
            message.put("type", "peers");
            message.put("peers", existingPeers);
            message.put("roomType", roomType);
            message.put("roomId", roomId);
            sendMessage(peer, message);
        }

        // Notify existing peers about new peer
        for (String otherPeerId : room) {
            if (!otherPeerId.equals(peer.getId())) {
                Peer otherPeer = peers.get(otherPeerId);
                if (otherPeer != null) {
                    logger.info("Notifying peer {} about new peer {}", otherPeerId, peer.getId());
                    Map<String, Object> notification = new HashMap<>();
                    notification.put("type", "peer-joined");
                    notification.put("peer", peer.getInfo());
                    notification.put("roomType", roomType);
                    notification.put("roomId", roomId);
                    sendMessage(otherPeer, notification);
                }
            }
        }

        logger.info("Peer {} joined {} room: {}", peer.getId(), roomType, roomId);
    }

    private void leaveAllRooms(Peer peer, boolean disconnect) {
        Iterator<Map.Entry<String, Set<String>>> iterator = rooms.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Set<String>> entry = iterator.next();
            String roomId = entry.getKey();
            Set<String> room = entry.getValue();
            
            if (room.contains(peer.getId())) {
                room.remove(peer.getId());

                // Delete room if empty
                if (room.isEmpty()) {
                    iterator.remove();
                    continue;
                }

                // Notify other peers that this peer left
                String roomType = roomId.startsWith("ip:") ? "ip" : 
                                roomId.startsWith("public:") ? "public" : "unknown";
                for (String otherPeerId : room) {
                    Peer otherPeer = peers.get(otherPeerId);
                    if (otherPeer != null) {
                        Map<String, Object> notification = new HashMap<>();
                        notification.put("type", "peer-left");
                        notification.put("peerId", peer.getId());
                        notification.put("roomType", roomType);
                        notification.put("roomId", roomId);
                        notification.put("disconnect", disconnect);
                        sendMessage(otherPeer, notification);
                    }
                }
            }
        }

        // Also leave public rooms
        leavePublicRoom(peer, disconnect);
    }

    private void sendPeersList(Peer peer) {
        // Find all rooms this peer is in and send peers list
        for (Map.Entry<String, Set<String>> entry : rooms.entrySet()) {
            String roomId = entry.getKey();
            Set<String> room = entry.getValue();
            
            if (room.contains(peer.getId())) {
                String roomType = roomId.startsWith("ip:") ? "ip" : 
                                roomId.startsWith("public:") ? "public" : "unknown";

                // Get other peers in this room
                List<Map<String, Object>> otherPeers = new ArrayList<>();
                for (String otherPeerId : room) {
                    if (!otherPeerId.equals(peer.getId())) {
                        Peer otherPeer = peers.get(otherPeerId);
                        if (otherPeer != null) {
                            otherPeers.add(otherPeer.getInfo());
                        }
                    }
                }

                // Send peers list to requesting peer
                Map<String, Object> message = new HashMap<>();
                message.put("type", "peers");
                message.put("peers", otherPeers);
                message.put("roomType", roomType);
                message.put("roomId", roomId);
                sendMessage(peer, message);
            }
        }
    }

    // Public room management functions
    private void handleCreatePublicRoom(Peer peer) {
        // Generate a 5-character room code
        String publicRoomId;
        do {
            publicRoomId = DeviceInfoHelper.generateRandomString(5, true).toUpperCase();
        } while (publicRooms.containsKey(publicRoomId));

        // Leave current public room if any
        leavePublicRoom(peer, false);

        // Set the public room ID for this peer
        peer.setPublicRoomId(publicRoomId);

        // Create the room and add the peer
        Set<String> room = new HashSet<>();
        room.add(peer.getId());
        publicRooms.put(publicRoomId, room);

        logger.info("Peer {} created public room: {}", peer.getId(), publicRoomId);

        // Send confirmation to the peer
        Map<String, Object> response = new HashMap<>();
        response.put("type", "public-room-created");
        response.put("roomId", publicRoomId);
        sendMessage(peer, response);

        // Join the room using the standard room system
        joinRoom(peer, "public", "public:" + publicRoomId);
    }

    private void handleLeavePublicRoom(Peer peer) {
        if (peer.getPublicRoomId() == null) {
            return;
        }

        leavePublicRoom(peer, false);

        Map<String, Object> response = new HashMap<>();
        response.put("type", "public-room-left");
        sendMessage(peer, response);
    }

    private void leavePublicRoom(Peer peer, boolean disconnect) {
        if (peer.getPublicRoomId() == null) {
            return;
        }

        String roomCode = peer.getPublicRoomId();
        Set<String> room = publicRooms.get(roomCode);

        if (room != null) {
            room.remove(peer.getId());

            // Delete room if empty
            if (room.isEmpty()) {
                publicRooms.remove(roomCode);
                logger.info("Public room {} deleted (empty)", roomCode);
            }

            logger.info("Peer {} left public room: {}", peer.getId(), roomCode);
        }

        // Leave the standard room system as well
        String standardRoomId = "public:" + roomCode;
        if (rooms.containsKey(standardRoomId)) {
            Set<String> standardRoom = rooms.get(standardRoomId);
            if (standardRoom.contains(peer.getId())) {
                standardRoom.remove(peer.getId());

                // Delete room if empty
                if (standardRoom.isEmpty()) {
                    rooms.remove(standardRoomId);
                } else {
                    // Notify other peers that this peer left
                    for (String otherPeerId : standardRoom) {
                        Peer otherPeer = peers.get(otherPeerId);
                        if (otherPeer != null) {
                            Map<String, Object> notification = new HashMap<>();
                            notification.put("type", "peer-left");
                            notification.put("peerId", peer.getId());
                            notification.put("roomType", "public");
                            notification.put("roomId", standardRoomId);
                            notification.put("disconnect", disconnect);
                            sendMessage(otherPeer, notification);
                        }
                    }
                }
            }
        }

        peer.setPublicRoomId(null);
    }

    // Utility functions
    private void sendMessage(Peer peer, Map<String, Object> message) {
        if (peer == null || peer.getSession() == null || !peer.getSession().isOpen()) {
            logger.debug("Cannot send message to peer {}: session not ready", peer != null ? peer.getId() : "null");
            return;
        }
        
        try {
            String messageType = (String) message.get("type");
            logger.debug("Sending message to peer {}: {}", peer.getId(), messageType);
            String jsonMessage = objectMapper.writeValueAsString(message);
            peer.getSession().sendMessage(new TextMessage(jsonMessage));
        } catch (IOException e) {
            logger.error("Error sending message to peer {}: {}", peer.getId(), e.getMessage());
        }
    }

    // Keep-alive functions
    private void keepAlive(Peer peer) {
        cancelKeepAlive(peer);
        int timeout = 1000; // 1 second

        Map<String, Object> timerInfo = keepAliveTimers.computeIfAbsent(peer.getId(), k -> {
            Map<String, Object> info = new HashMap<>();
            info.put("lastBeat", System.currentTimeMillis());
            return info;
        });

        if (System.currentTimeMillis() - (Long) timerInfo.get("lastBeat") > 5 * timeout) {
            // Disconnect peer if unresponsive for 5s
            handleDisconnect(peer);
            return;
        }

        Map<String, Object> pingMessage = new HashMap<>();
        pingMessage.put("type", "ping");
        sendMessage(peer, pingMessage);

        // Schedule next keep-alive
        scheduler.schedule(() -> keepAlive(peer), timeout, TimeUnit.MILLISECONDS);
    }

    private void cancelKeepAlive(Peer peer) {
        keepAliveTimers.remove(peer.getId());
    }

    private void setKeepAliveTimerToNow(Peer peer) {
        Map<String, Object> timerInfo = keepAliveTimers.get(peer.getId());
        if (timerInfo != null) {
            timerInfo.put("lastBeat", System.currentTimeMillis());
        }
    }

    private String getMD5Hash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hash = md.digest(input.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            return input; // Fallback
        }
    }
}