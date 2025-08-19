import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Phục vụ các tệp tĩnh từ thư mục 'public'
app.use(express.static(join(__dirname, '../public')));

// Lưu trữ các kết nối client (PairDrop style)
const clients = new Map(); // Map: peerId -> { ws, deviceInfo, ip, rooms }
const rooms = new Map(); // Map: roomId -> Set of peerIds
const ipRooms = new Map(); // Map: ip -> roomId

wss.on('connection', (ws, req) => {
  const id = Math.random().toString(36).substring(2, 15); // Tạo ID ngẫu nhiên cho client
  const clientIP = getClientIP(req);

  // Initialize client data
  const clientData = {
    ws: ws,
    deviceInfo: null,
    ip: clientIP,
    rooms: new Set()
  };

  clients.set(id, clientData);
  console.log(`Client ${id} connected from IP: ${clientIP}`);

  // Gửi ID của client cho chính nó (PairDrop style)
  ws.send(JSON.stringify({
    type: 'display-name',
    peerId: id,
    displayName: id
  }));

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    console.log(`Received message from ${id}:`, msg);

    switch (msg.type) {
      case 'device-info':
        // Store device information and PeerJS ID
        clientData.deviceInfo = msg.deviceInfo;
        if (msg.peerId) {
          // Update client ID to use PeerJS ID
          clientData.peerId = msg.peerId;
        }
        // Send peers list to this client
        sendPeersList(id);
        // Notify other peers in same rooms
        notifyPeersInRooms(id, 'peer-joined');
        break;

      case 'device-info-update':
        // Update device information and notify other peers
        const oldDeviceInfo = clientData.deviceInfo;
        clientData.deviceInfo = msg.deviceInfo;
        console.log(`Device info updated for ${id}:`, msg.deviceInfo);

        // Notify other peers in same rooms about the update
        notifyPeersInRooms(id, 'peer-info-updated');
        break;

      case 'join-ip-room':
        // Join IP-based room for local network discovery
        joinIPRoom(id, clientIP);
        break;

      case 'discovery-request':
      case 'request-devices':
        // Send peers list (legacy support)
        sendPeersList(id);
        break;

      default:
        // Chuyển tiếp thông điệp báo hiệu WebRTC giữa các client
        if (msg.to && clients.has(msg.to)) {
          const targetClient = clients.get(msg.to);
          // Thêm thông tin người gửi vào thông điệp
          msg.from = id;
          targetClient.ws.send(JSON.stringify(msg));
        } else {
          console.warn(`Message to unknown client ${msg.to}`);
        }
        break;
    }
  });

  ws.on('close', () => {
    // Remove from all rooms
    if (clientData.rooms) {
      clientData.rooms.forEach(roomId => {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(id);
          if (room.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    }

    // Remove from IP room mapping
    if (ipRooms.get(clientIP) && rooms.get(ipRooms.get(clientIP))) {
      const ipRoom = rooms.get(ipRooms.get(clientIP));
      ipRoom.delete(id);
    }

    clients.delete(id);
    console.log(`Client ${id} disconnected`);

    // Notify other peers in same rooms
    notifyPeersInRooms(id, 'peer-left');
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${id}:`, error);
  });
});

// Helper functions for PairDrop-style peer management

function getClientIP(req) {
  return req.headers['x-forwarded-for'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

function joinIPRoom(peerId, ip) {
  const roomId = `ip:${ip}`;

  // Get or create room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId);
  room.add(peerId);

  // Update client's rooms
  const client = clients.get(peerId);
  if (client) {
    client.rooms.add(roomId);
  }

  // Update IP room mapping
  ipRooms.set(ip, roomId);

  console.log(`Peer ${peerId} joined IP room: ${roomId}`);

  // Send updated peers list to this client
  sendPeersList(peerId);

  // Notify other peers in the room
  notifyPeersInRoom(roomId, peerId, 'peer-joined');
}

function sendPeersList(peerId) {
  const client = clients.get(peerId);
  if (!client || client.ws.readyState !== client.ws.OPEN) {
    return;
  }

  const peersByRoom = {};

  // Get peers from all rooms this client is in
  client.rooms.forEach(roomId => {
    const room = rooms.get(roomId);
    if (room) {
      const roomType = roomId.startsWith('ip:') ? 'ip' : 'public';
      if (!peersByRoom[roomType]) {
        peersByRoom[roomType] = [];
      }

      room.forEach(otherPeerId => {
        if (otherPeerId !== peerId) {
          const otherClient = clients.get(otherPeerId);
          if (otherClient && otherClient.deviceInfo) {
            // Use PeerJS ID if available, otherwise use server ID
            const displayId = otherClient.peerId || otherPeerId;
            peersByRoom[roomType].push({
              id: displayId,
              name: otherClient.deviceInfo.name || 'Unknown Device',
              displayName: otherClient.deviceInfo.name || 'Unknown Device',
              deviceType: otherClient.deviceInfo.type || 'desktop',
              type: otherClient.deviceInfo.type || 'desktop'
            });
          }
        }
      });
    }
  });

  client.ws.send(JSON.stringify({
    type: 'peers',
    peers: peersByRoom
  }));
}

function notifyPeersInRoom(roomId, excludePeerId, messageType) {
  const room = rooms.get(roomId);
  if (!room) return;

  const excludeClient = clients.get(excludePeerId);
  const peerData = excludeClient ? {
    id: excludeClient.peerId || excludePeerId, // Use PeerJS ID if available
    name: excludeClient.deviceInfo?.name || 'Unknown Device',
    displayName: excludeClient.deviceInfo?.name || 'Unknown Device',
    deviceType: excludeClient.deviceInfo?.type || 'desktop',
    type: excludeClient.deviceInfo?.type || 'desktop',
    browser: excludeClient.deviceInfo?.browser || 'Browser'
  } : { id: excludePeerId };

  room.forEach(peerId => {
    if (peerId !== excludePeerId) {
      const client = clients.get(peerId);
      if (client && client.ws.readyState === client.ws.OPEN) {
        if (messageType === 'peer-joined') {
          client.ws.send(JSON.stringify({
            type: 'peer-joined',
            peer: peerData,
            roomType: roomId.startsWith('ip:') ? 'ip' : 'public'
          }));
        } else if (messageType === 'peer-left') {
          client.ws.send(JSON.stringify({
            type: 'peer-left',
            peerId: excludeClient?.peerId || excludePeerId
          }));
        } else if (messageType === 'peer-info-updated') {
          client.ws.send(JSON.stringify({
            type: 'peer-info-updated',
            peer: peerData,
            roomType: roomId.startsWith('ip:') ? 'ip' : 'public'
          }));
        }
      }
    }
  });
}

function notifyPeersInRooms(peerId, messageType) {
  const client = clients.get(peerId);
  if (!client) return;

  client.rooms.forEach(roomId => {
    notifyPeersInRoom(roomId, peerId, messageType);
  });
}

// Legacy function for backward compatibility
function broadcastDeviceList() {
  clients.forEach((client, peerId) => {
    if (client.deviceInfo) {
      sendPeersList(peerId);
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
  console.log(`Truy cập: http://localhost:${PORT}`);
});
