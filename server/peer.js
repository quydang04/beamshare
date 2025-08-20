import crypto from "crypto";
import { getDeviceInfo, hashCode } from "./helper.js";

export default class Peer {
    constructor(socket, request) {
        // Set socket
        this.socket = socket;

        // Set remote IP
        this._setIP(request);

        // Set peer ID
        this._setPeerId(request);

        // Set device information
        this._setDeviceInfo(request);

        // Initialize peer state
        this.roomSecrets = [];
        this.pairKey = null;
        this.publicRoomId = null;
        this.requestRate = 0;
    }

    rateLimitReached() {
        // Rate limit implementation: max 10 attempts every 10s
        if (this.requestRate >= 10) {
            return true;
        }
        this.requestRate += 1;
        setTimeout(() => this.requestRate -= 1, 10000);
        return false;
    }

    _setIP(request) {
        // Extract IP from various headers (CloudFlare, proxy, etc.)
        if (request.headers['cf-connecting-ip']) {
            this.ip = request.headers['cf-connecting-ip'].split(/\s*,\s*/)[0];
        }
        else if (request.headers['x-forwarded-for']) {
            this.ip = request.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        }
        else {
            this.ip = request.socket.remoteAddress ?? '';
        }

        // Remove IPv4-mapped IPv6 prefix
        if (this.ip.substring(0, 7) === "::ffff:") {
            this.ip = this.ip.substring(7);
        }

        // Normalize private IPs to localhost for local network discovery
        if (this.ip === '::1' || this.ipIsPrivate(this.ip)) {
            this.ip = '127.0.0.1';
        }

        console.log(`Peer IP: ${this.ip}`);
    }

    ipIsPrivate(ip) {
        // Check if IP is private (IPv4)
        if (!ip.includes(":")) {
            return /^(10)\.(.*)\.(.*)\.(.*)$/.test(ip) || 
                   /^(172)\.(1[6-9]|2[0-9]|3[0-1])\.(.*)\.(.*)$/.test(ip) || 
                   /^(192)\.(168)\.(.*)\.(.*)$/.test(ip);
        }

        // Check if IP is private (IPv6)
        const firstWord = ip.split(":").find(el => !!el);
        if (!firstWord) return false;

        return /^fe[c-f][0-f]$/.test(firstWord) ||
               /^fc[0-f]{2}$/.test(firstWord) ||
               /^fd[0-f]{2}$/.test(firstWord) ||
               firstWord === "fe80" ||
               firstWord === "100";
    }

    _setPeerId(request) {
        const searchParams = new URL(request.url, "http://server").searchParams;
        let peerId = searchParams.get('peer_id');
        let peerIdHash = searchParams.get('peer_id_hash');
        
        if (peerId && Peer.isValidUuid(peerId) && this.isPeerIdHashValid(peerId, peerIdHash)) {
            this.id = peerId;
        } else {
            this.id = crypto.randomUUID();
        }
    }

    _setDeviceInfo(request) {
        this.deviceInfo = getDeviceInfo(request.headers['user-agent']);
        console.log(`Device info for ${this.id}:`, this.deviceInfo);
    }

    getInfo() {
        return {
            id: this.id,
            name: this.deviceInfo,
            rtcSupported: true, // Assume WebRTC is supported by default
            peerJSId: this.peerJSId || null // Include PeerJS ID if available
        };
    }

    static isValidUuid(uuid) {
        return /^([0-9]|[a-f]){8}-(([0-9]|[a-f]){4}-){3}([0-9]|[a-f]){12}$/.test(uuid);
    }

    isPeerIdHashValid(peerId, peerIdHash) {
        return peerIdHash === hashCode(peerId);
    }

    addRoomSecret(roomSecret) {
        if (!this.roomSecrets.includes(roomSecret)) {
            this.roomSecrets.push(roomSecret);
        }
    }

    removeRoomSecret(roomSecret) {
        const index = this.roomSecrets.indexOf(roomSecret);
        if (index > -1) {
            this.roomSecrets.splice(index, 1);
        }
    }
}
