package com.beamshare.model;

import com.beamshare.util.DeviceInfoHelper;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.regex.Pattern;

public class Peer {
    private static final Pattern PRIVATE_IPV4_PATTERN = 
        Pattern.compile("^(10)\\.(.*)\\.(.*)\\.(.*)|^(172)\\.(1[6-9]|2[0-9]|3[0-1])\\.(.*)\\.(.*)$|^(192)\\.(168)\\.(.*)\\.(.*)|^127\\.(.*)\\.(.*)\\.(.*)$");
    
    private static final Pattern PRIVATE_IPV6_PATTERN =
        Pattern.compile("^fe[c-f][0-f]|^fc[0-f]{2}|^fd[0-f]{2}|^fe80|^100");
    
    private static final Pattern UUID_PATTERN = 
        Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    private final String id;
    private final WebSocketSession session;
    private final String ip;
    private final DeviceInfoHelper.DeviceInfo deviceInfo;
    private final List<String> roomSecrets;
    private String pairKey;
    private String publicRoomId;
    private int requestRate;
    private String peerJSId;

    public Peer(WebSocketSession session) {
        this.session = session;
        this.ip = extractIP(session);
        this.id = generatePeerId(session);
        this.deviceInfo = DeviceInfoHelper.getDeviceInfo(
            getUserAgent(session)
        );
        this.roomSecrets = new ArrayList<>();
        this.requestRate = 0;
    }

    public boolean rateLimitReached() {
        if (requestRate >= 10) {
            return true;
        }
        requestRate++;
        // Schedule rate limit reset after 10 seconds
        Timer timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                requestRate = Math.max(0, requestRate - 1);
            }
        }, 10000);
        return false;
    }

    private String extractIP(WebSocketSession session) {
        String ip = null;
        
        // Check various headers for real IP
        if (session.getHandshakeHeaders().containsKey("cf-connecting-ip")) {
            ip = session.getHandshakeHeaders().getFirst("cf-connecting-ip");
        } else if (session.getHandshakeHeaders().containsKey("x-forwarded-for")) {
            ip = session.getHandshakeHeaders().getFirst("x-forwarded-for");
            if (ip != null && ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
        } else if (session.getRemoteAddress() != null) {
            ip = session.getRemoteAddress().getAddress().getHostAddress();
        }

        if (ip == null) {
            ip = "127.0.0.1";
        }

        // Remove IPv4-mapped IPv6 prefix
        if (ip.startsWith("::ffff:")) {
            ip = ip.substring(7);
        }

        // Normalize private IPs to localhost for local network discovery
        if ("::1".equals(ip) || isPrivateIP(ip)) {
            ip = "127.0.0.1";
        }

        return ip;
    }

    private boolean isPrivateIP(String ip) {
        if (ip.contains(":")) {
            // IPv6
            String[] parts = ip.split(":");
            if (parts.length > 0) {
                String firstWord = Arrays.stream(parts)
                    .filter(part -> !part.isEmpty())
                    .findFirst()
                    .orElse("");
                return PRIVATE_IPV6_PATTERN.matcher(firstWord.toLowerCase()).find();
            }
        } else {
            // IPv4
            return PRIVATE_IPV4_PATTERN.matcher(ip).matches();
        }
        return false;
    }

    private String generatePeerId(WebSocketSession session) {
        String peerId = session.getUri() != null ? 
            getQueryParam(session.getUri().getQuery(), "peer_id") : null;
        String peerIdHash = session.getUri() != null ? 
            getQueryParam(session.getUri().getQuery(), "peer_id_hash") : null;

        if (peerId != null && isValidUuid(peerId) && 
            isPeerIdHashValid(peerId, peerIdHash)) {
            return peerId;
        } else {
            return UUID.randomUUID().toString();
        }
    }

    private String getQueryParam(String query, String paramName) {
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] keyValue = param.split("=", 2);
            if (keyValue.length == 2 && paramName.equals(keyValue[0])) {
                return keyValue[1];
            }
        }
        return null;
    }

    private static boolean isValidUuid(String uuid) {
        return uuid != null && UUID_PATTERN.matcher(uuid.toLowerCase()).matches();
    }

    private boolean isPeerIdHashValid(String peerId, String peerIdHash) {
        return peerIdHash != null && peerIdHash.equals(DeviceInfoHelper.hashCode(peerId));
    }

    private String getUserAgent(WebSocketSession session) {
        return session.getHandshakeHeaders().getFirst("user-agent");
    }

    public Map<String, Object> getInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("id", id);
        info.put("name", deviceInfo);
        info.put("rtcSupported", true);
        if (peerJSId != null) {
            info.put("peerJSId", peerJSId);
        }
        return info;
    }

    public void addRoomSecret(String roomSecret) {
        if (!roomSecrets.contains(roomSecret)) {
            roomSecrets.add(roomSecret);
        }
    }

    public void removeRoomSecret(String roomSecret) {
        roomSecrets.remove(roomSecret);
    }

    // Getters and setters
    public String getId() { return id; }
    public WebSocketSession getSession() { return session; }
    public String getIp() { return ip; }
    public DeviceInfoHelper.DeviceInfo getDeviceInfo() { return deviceInfo; }
    public List<String> getRoomSecrets() { return roomSecrets; }
    public String getPairKey() { return pairKey; }
    public void setPairKey(String pairKey) { this.pairKey = pairKey; }
    public String getPublicRoomId() { return publicRoomId; }
    public void setPublicRoomId(String publicRoomId) { this.publicRoomId = publicRoomId; }
    public String getPeerJSId() { return peerJSId; }
    public void setPeerJSId(String peerJSId) { this.peerJSId = peerJSId; }
}