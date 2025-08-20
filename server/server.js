import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import crypto from 'crypto';

import Peer from './peer.js';
import { getClientIP, generateRandomString } from './helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from 'public' directory
app.use(express.static(join(__dirname, '../public')));

// Store client connections (PairDrop style with persistence)
const peers = new Map(); // Map: peerId -> Peer instance
const rooms = new Map(); // Map: roomId -> Set of peerIds
const roomSecrets = new Map(); // Map: pairKey -> { roomSecret, creator }
const publicRooms = new Map(); // Map: publicRoomId -> Set of peerIds
const keepAliveTimers = new Map(); // Map: peerId -> timer info
const persistentConnections = new Map(); // Map: peerId -> { lastSeen, reconnectCount, persistentPeers }
const connectionHistory = new Map(); // Map: peerId -> { deviceInfo, rooms, lastConnected }

wss.on('connection', (ws, req) => {
  const peer = new Peer(ws, req);
  peers.set(peer.id, peer);

  console.log(`Peer ${peer.id} connected from IP: ${peer.ip}`);
  console.log(`Device: ${peer.deviceInfo.displayName} (${peer.deviceInfo.deviceName})`);

  // Initialize keep-alive
  keepAlive(peer);

  // Send peer information to client
  sendMessage(peer, {
    type: 'display-name',
    peerId: peer.id,
    displayName: peer.deviceInfo.displayName,
    deviceName: peer.deviceInfo.deviceName,
    peerIdHash: crypto.createHash('md5').update(peer.id).digest('hex').substring(0, 8)
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      console.log(`Received message from ${peer.id}:`, msg);
      handleMessage(peer, msg);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    handleDisconnect(peer);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for peer ${peer.id}:`, error);
  });

  // Store connection history for persistence
  connectionHistory.set(peer.id, {
    deviceInfo: peer.deviceInfo,
    rooms: new Set(),
    lastConnected: Date.now(),
    ip: peer.ip
  });
});

// Message handling functions
function handleMessage(peer, message) {
  switch (message.type) {
    case 'disconnect':
      handleDisconnect(peer);
      break;
    case 'pong':
      setKeepAliveTimerToNow(peer);
      break;
    case 'join-ip-room':
      joinIpRoom(peer);
      break;
    case 'device-info':
      // Legacy support - device info is now set during connection
      sendPeersList(peer);
      break;
    case 'discovery-request':
    case 'request-devices':
      sendPeersList(peer);
      break;
    case 'peerjs-id-update':
      handlePeerJSIdUpdate(peer, message);
      break;
    case 'heartbeat':
      handleHeartbeat(peer, message);
      break;
    case 'connection-established':
      handleConnectionEstablished(peer, message);
      break;
    case 'connection-lost':
      handleConnectionLost(peer, message);
      break;
    case 'request-persistent-peers':
      sendPersistentPeers(peer);
      break;
    case 'create-public-room':
      handleCreatePublicRoom(peer);
      break;

    case 'leave-public-room':
      handleLeavePublicRoom(peer);
      break;
    default:
      // Relay WebRTC signaling messages
      if (message.to && peers.has(message.to)) {
        const targetPeer = peers.get(message.to);
        message.from = peer.id;
        sendMessage(targetPeer, message);
      } else {
        console.warn(`Message to unknown peer ${message.to}`);
      }
      break;
  }
}

function handlePeerJSIdUpdate(peer, message) {
  console.log(`Updating PeerJS ID for peer ${peer.id} to ${message.peerJSId}`);

  // Store the PeerJS ID in the peer object
  peer.peerJSId = message.peerJSId;

  // Notify all other peers in the same rooms about the PeerJS ID update
  for (const [roomId, room] of rooms.entries()) {
    if (room.has(peer.id)) {
      const roomType = roomId.startsWith('ip:') ? 'ip' : roomId.startsWith('public:') ? 'public' : 'unknown';

      // Notify other peers in this room
      for (const otherPeerId of room) {
        if (otherPeerId !== peer.id) {
          const otherPeer = peers.get(otherPeerId);
          if (otherPeer) {
            sendMessage(otherPeer, {
              type: 'peerjs-id-updated',
              peerId: peer.id,
              peerJSId: message.peerJSId,
              roomType: roomType,
              roomId: roomId
            });
          }
        }
      }
    }
  }
}

// Handle heartbeat messages for persistent connections
function handleHeartbeat(peer, message) {
  // Update persistent connection info
  if (persistentConnections.has(peer.id)) {
    const connInfo = persistentConnections.get(peer.id);
    connInfo.lastSeen = Date.now();
  } else {
    persistentConnections.set(peer.id, {
      lastSeen: Date.now(),
      reconnectCount: 0,
      persistentPeers: new Set()
    });
  }

  // Send heartbeat response
  sendMessage(peer, {
    type: 'heartbeat-response',
    timestamp: Date.now()
  });
}

// Handle connection established notification
function handleConnectionEstablished(peer, message) {
  console.log(`Connection established between ${peer.id} and ${message.targetPeerId}`);

  // Update persistent connections
  if (!persistentConnections.has(peer.id)) {
    persistentConnections.set(peer.id, {
      lastSeen: Date.now(),
      reconnectCount: 0,
      persistentPeers: new Set()
    });
  }

  const connInfo = persistentConnections.get(peer.id);
  connInfo.persistentPeers.add(message.targetPeerId);

  // Notify the target peer about the established connection
  if (peers.has(message.targetPeerId)) {
    const targetPeer = peers.get(message.targetPeerId);
    sendMessage(targetPeer, {
      type: 'connection-established-notification',
      fromPeerId: peer.id,
      timestamp: Date.now()
    });
  }
}

// Handle connection lost notification
function handleConnectionLost(peer, message) {
  console.log(`Connection lost between ${peer.id} and ${message.targetPeerId}`);

  // Update persistent connections
  if (persistentConnections.has(peer.id)) {
    const connInfo = persistentConnections.get(peer.id);
    connInfo.persistentPeers.delete(message.targetPeerId);
  }

  // Notify the target peer about the lost connection
  if (peers.has(message.targetPeerId)) {
    const targetPeer = peers.get(message.targetPeerId);
    sendMessage(targetPeer, {
      type: 'connection-lost-notification',
      fromPeerId: peer.id,
      timestamp: Date.now()
    });
  }
}

// Send persistent peers list to a peer
function sendPersistentPeers(peer) {
  const persistentPeersList = [];

  if (persistentConnections.has(peer.id)) {
    const connInfo = persistentConnections.get(peer.id);

    for (const persistentPeerId of connInfo.persistentPeers) {
      const history = connectionHistory.get(persistentPeerId);
      if (history) {
        persistentPeersList.push({
          peerId: persistentPeerId,
          deviceInfo: history.deviceInfo,
          lastConnected: history.lastConnected,
          isOnline: peers.has(persistentPeerId)
        });
      }
    }
  }

  sendMessage(peer, {
    type: 'persistent-peers',
    peers: persistentPeersList
  });
}

function handleDisconnect(peer) {
  cancelKeepAlive(peer);
  leaveAllRooms(peer, true);

  // Update connection history
  if (connectionHistory.has(peer.id)) {
    const history = connectionHistory.get(peer.id);
    history.lastConnected = Date.now();
  }

  // Keep persistent connection info but mark as offline
  if (persistentConnections.has(peer.id)) {
    const connInfo = persistentConnections.get(peer.id);
    connInfo.lastSeen = Date.now();

    // Notify persistent peers about disconnection
    for (const persistentPeerId of connInfo.persistentPeers) {
      if (peers.has(persistentPeerId)) {
        const persistentPeer = peers.get(persistentPeerId);
        sendMessage(persistentPeer, {
          type: 'persistent-peer-offline',
          peerId: peer.id,
          deviceInfo: peer.deviceInfo,
          timestamp: Date.now()
        });
      }
    }
  }

  peers.delete(peer.id);

  if (peer.socket) {
    peer.socket.terminate();
  }

  console.log(`Peer ${peer.id} disconnected`);
}

// Room management functions
function joinIpRoom(peer) {
  const roomId = `ip:${peer.ip}`;
  joinRoom(peer, 'ip', roomId);
}

function joinRoom(peer, roomType, roomId) {
  // If room doesn't exist, create it
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId);

  // Get existing peers in room before adding new peer
  const existingPeers = [];
  for (const otherPeerId of room) {
    if (otherPeerId !== peer.id) {
      const otherPeer = peers.get(otherPeerId);
      if (otherPeer) {
        existingPeers.push(otherPeer.getInfo());
      }
    }
  }

  // Add peer to room first
  room.add(peer.id);

  // Send existing peers to new peer
  if (existingPeers.length > 0) {
    console.log(`Sending ${existingPeers.length} existing peers to new peer ${peer.id}`);
    sendMessage(peer, {
      type: 'peers',
      peers: existingPeers,
      roomType: roomType,
      roomId: roomId
    });
  }

  // Notify existing peers about new peer
  for (const otherPeerId of room) {
    if (otherPeerId !== peer.id) {
      const otherPeer = peers.get(otherPeerId);
      if (otherPeer) {
        console.log(`Notifying peer ${otherPeerId} about new peer ${peer.id}`);
        sendMessage(otherPeer, {
          type: 'peer-joined',
          peer: peer.getInfo(),
          roomType: roomType,
          roomId: roomId
        });
      }
    }
  }

  console.log(`Peer ${peer.id} joined ${roomType} room: ${roomId}`);
}

function leaveAllRooms(peer, disconnect = false) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.has(peer.id)) {
      room.delete(peer.id);

      // Delete room if empty
      if (room.size === 0) {
        rooms.delete(roomId);
        continue;
      }

      // Notify other peers that this peer left
      const roomType = roomId.startsWith('ip:') ? 'ip' : roomId.startsWith('public:') ? 'public' : 'unknown';
      for (const otherPeerId of room) {
        const otherPeer = peers.get(otherPeerId);
        if (otherPeer) {
          sendMessage(otherPeer, {
            type: 'peer-left',
            peerId: peer.id,
            roomType: roomType,
            roomId: roomId,
            disconnect: disconnect
          });
        }
      }
    }
  }

  // Also leave public rooms
  leavePublicRoom(peer, disconnect);
}

function sendPeersList(peer) {
  // Find all rooms this peer is in and send peers list
  for (const [roomId, room] of rooms.entries()) {
    if (room.has(peer.id)) {
      const roomType = roomId.startsWith('ip:') ? 'ip' : roomId.startsWith('public:') ? 'public' : 'unknown';

      // Get other peers in this room
      const otherPeers = [];
      for (const otherPeerId of room) {
        if (otherPeerId !== peer.id) {
          const otherPeer = peers.get(otherPeerId);
          if (otherPeer) {
            otherPeers.push(otherPeer.getInfo());
          }
        }
      }

      // Send peers list to requesting peer
      sendMessage(peer, {
        type: 'peers',
        peers: otherPeers,
        roomType: roomType,
        roomId: roomId
      });
    }
  }
}

// Public room management functions
function handleCreatePublicRoom(peer) {
  // Generate a 5-character room code
  let publicRoomId;
  do {
    publicRoomId = generateRandomString(5).toUpperCase();
  } while (publicRooms.has(publicRoomId));

  // Leave current public room if any
  leavePublicRoom(peer);

  // Set the public room ID for this peer
  peer.publicRoomId = publicRoomId;

  // Create the room and add the peer
  publicRooms.set(publicRoomId, new Set([peer.id]));

  console.log(`Peer ${peer.id} created public room: ${publicRoomId}`);

  // Send confirmation to the peer
  sendMessage(peer, {
    type: 'public-room-created',
    roomId: publicRoomId
  });

  // Join the room using the standard room system
  joinRoom(peer, 'public', `public:${publicRoomId}`);
}



function handleLeavePublicRoom(peer) {
  if (!peer.publicRoomId) {
    return;
  }

  leavePublicRoom(peer, false);

  sendMessage(peer, {
    type: 'public-room-left'
  });
}

function leavePublicRoom(peer, disconnect = false) {
  if (!peer.publicRoomId) {
    return;
  }

  const roomCode = peer.publicRoomId;
  const room = publicRooms.get(roomCode);

  if (room) {
    room.delete(peer.id);

    // Delete room if empty
    if (room.size === 0) {
      publicRooms.delete(roomCode);
      console.log(`Public room ${roomCode} deleted (empty)`);
    }

    console.log(`Peer ${peer.id} left public room: ${roomCode}`);
  }

  // Leave the standard room system as well
  const standardRoomId = `public:${roomCode}`;
  if (rooms.has(standardRoomId)) {
    const standardRoom = rooms.get(standardRoomId);
    if (standardRoom.has(peer.id)) {
      standardRoom.delete(peer.id);

      // Delete room if empty
      if (standardRoom.size === 0) {
        rooms.delete(standardRoomId);
      } else {
        // Notify other peers that this peer left
        for (const otherPeerId of standardRoom) {
          const otherPeer = peers.get(otherPeerId);
          if (otherPeer) {
            sendMessage(otherPeer, {
              type: 'peer-left',
              peerId: peer.id,
              roomType: 'public',
              roomId: standardRoomId,
              disconnect: disconnect
            });
          }
        }
      }
    }
  }

  peer.publicRoomId = null;
}

// Utility functions
function sendMessage(peer, message) {
  if (!peer || !peer.socket || peer.socket.readyState !== peer.socket.OPEN) {
    console.log(`Cannot send message to peer ${peer?.id}: socket not ready`);
    return;
  }
  console.log(`Sending message to peer ${peer.id}:`, message.type);
  peer.socket.send(JSON.stringify(message));
}

// Keep-alive functions
function keepAlive(peer) {
  cancelKeepAlive(peer);
  const timeout = 1000;

  if (!keepAliveTimers.has(peer.id)) {
    keepAliveTimers.set(peer.id, {
      timer: 0,
      lastBeat: Date.now()
    });
  }

  const timerInfo = keepAliveTimers.get(peer.id);
  if (Date.now() - timerInfo.lastBeat > 5 * timeout) {
    // Disconnect peer if unresponsive for 5s
    handleDisconnect(peer);
    return;
  }

  sendMessage(peer, { type: 'ping' });

  timerInfo.timer = setTimeout(() => keepAlive(peer), timeout);
}

function cancelKeepAlive(peer) {
  const timerInfo = keepAliveTimers.get(peer.id);
  if (timerInfo?.timer) {
    clearTimeout(timerInfo.timer);
  }
  keepAliveTimers.delete(peer.id);
}

function setKeepAliveTimerToNow(peer) {
  const timerInfo = keepAliveTimers.get(peer.id);
  if (timerInfo) {
    timerInfo.lastBeat = Date.now();
  }
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

server.listen(PORT, HOST, () => {
  console.log(`Simple AirDrop Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);

  // Get local IP addresses for mobile access
  const networkInterfaces = os.networkInterfaces();
  const localIPs = [];

  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIPs.push(iface.address);
      }
    });
  });

  if (localIPs.length > 0) {
    console.log(`Network access:`);
    localIPs.forEach(ip => {
      console.log(`  http://${ip}:${PORT}`);
    });
  }

  console.log('\nDevice discovery improved with PairDrop-style peer management');
});
