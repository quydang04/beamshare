// PeerJS Server
// Signaling server for WebRTC connections

import { PeerServer } from 'peer';

const peerServer = PeerServer({
    port: 9000,
    path: '/myapp',
    allow_discovery: true
});

peerServer.on('connection', (client) => {
    console.log(`PeerJS client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`PeerJS client disconnected: ${client.getId()}`);
});

console.log('PeerJS Server đang chạy trên cổng 9000');
console.log('Path: /myapp');
