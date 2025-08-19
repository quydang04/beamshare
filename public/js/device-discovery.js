// Device Discovery System
// Handles nearby device discovery and signaling server communication
// Based on PairDrop's approach using WebSocket for peer management

// Device Discovery Functions
function startDeviceDiscovery() {
    console.log('Starting device discovery...');

    // Connect to signaling server
    connectToSignalingServer();

    // Start periodic cleanup of old devices
    discoveryInterval = setInterval(() => {
        cleanupOldDevices();
        // No need to manually request devices - server will send updates
    }, DISCOVERY_INTERVAL);

    // Join IP room for local network discovery
    setTimeout(() => {
        joinIPRoom();
    }, 1000);
}

function stopDeviceDiscovery() {
    if (discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
    }

    if (signalingSocket) {
        signalingSocket.close();
        signalingSocket = null;
    }
}

function connectToSignalingServer() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to signaling server:', wsUrl);

    signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = () => {
        console.log('Connected to signaling server');
        updateDiscoveryStatus();

        // Send device info to server (will be updated with PeerJS ID later)
        const currentDeviceInfo = window.deviceInfo || getDeviceInfo();
        signalingSocket.send(JSON.stringify({
            type: 'device-info',
            deviceInfo: currentDeviceInfo
        }));

        // Join IP room for local network discovery
        setTimeout(() => {
            joinIPRoom();
        }, 100);
    };

    signalingSocket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleSignalingMessage(message);
        } catch (error) {
            console.error('Error parsing signaling message:', error);
        }
    };

    signalingSocket.onclose = () => {
        console.log('Disconnected from signaling server');
        signalingSocket = null;

        // Clear all nearby devices when disconnected
        nearbyDevices.clear();
        updateDeviceGrid();
        updateDiscoveryStatus();

        // Try to reconnect after 3 seconds
        setTimeout(() => {
            if (!signalingSocket || signalingSocket.readyState === WebSocket.CLOSED) {
                connectToSignalingServer();
            }
        }, 3000);
    };

    signalingSocket.onerror = (error) => {
        console.error('Signaling server error:', error);
    };
}

function joinIPRoom() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'join-ip-room'
        }));
        console.log('Joined IP room for local network discovery');
    }
}

function updateServerWithPeerID(peerId) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        const currentDeviceInfo = window.deviceInfo || getDeviceInfo();
        signalingSocket.send(JSON.stringify({
            type: 'device-info',
            deviceInfo: currentDeviceInfo,
            peerId: peerId
        }));
        console.log('Updated server with PeerJS ID:', peerId);
    }
}

function handleSignalingMessage(message) {
    switch (message.type) {
        case 'peers':
            // Handle peers list from server (PairDrop style)
            updatePeersList(message);
            break;

        case 'peer-joined':
            console.log('New peer joined:', message.peer.id);
            addPeerToNearbyDevices(message.peer, message.roomType);
            break;

        case 'peer-left':
            console.log('Peer left:', message.peerId);
            // Mark as offline but keep in list for a while
            const deviceInfo = nearbyDevices.get(message.peerId);
            if (deviceInfo) {
                deviceInfo.offline = true;
                deviceInfo.lastSeen = Date.now();
            }
            // Remove from connections if connected
            if (connections && connections.has(message.peerId)) {
                connections.delete(message.peerId);
            }
            updateDeviceGrid();
            updateConnectedDevicesDisplay();
            break;

        case 'peer-info-updated':
            console.log('Peer info updated:', message.peer.id, message.peer.name);
            // Update the device info in nearby devices
            const existingDevice = nearbyDevices.get(message.peer.id);
            if (existingDevice) {
                existingDevice.name = message.peer.name || message.peer.displayName || 'Unknown Device';
                existingDevice.type = message.peer.deviceType || message.peer.type || 'desktop';
                existingDevice.browser = message.peer.browser || 'Browser';
                existingDevice.lastSeen = Date.now();
                updateDeviceGrid();
                console.log('Updated device info for:', message.peer.id);
            }
            break;

        case 'display-name':
            // Store server peer ID but don't use it for PeerJS
            const serverPeerId = message.peerId;
            console.log('Received server peer ID:', serverPeerId);

            // Initialize PeerJS without specific ID (let it generate UUID)
            if (typeof initializePeer === 'function') {
                initializePeer(); // No ID parameter - let PeerJS generate UUID
            }
            break;

        // Legacy support for old message types
        case 'nearby-devices':
        case 'device-list-updated':
            updateNearbyDevices(message.devices);
            break;
    }
}

function updatePeersList(message) {
    // Clear existing nearby devices
    nearbyDevices.clear();

    // Process peers from different room types
    if (message.peers) {
        Object.keys(message.peers).forEach(roomType => {
            const roomPeers = message.peers[roomType];
            if (Array.isArray(roomPeers)) {
                roomPeers.forEach(peer => {
                    addPeerToNearbyDevices(peer, roomType);
                });
            }
        });
    }

    updateDeviceGrid();
    console.log(`Found ${nearbyDevices.size} nearby devices`);
}

function addPeerToNearbyDevices(peer, roomType) {
    if (!peer || !peer.id || peer.id === myId) {
        return;
    }

    const deviceInfo = {
        name: peer.name || peer.displayName || 'Unknown Device',
        type: peer.deviceType || peer.type || 'desktop',
        browser: peer.browser || 'Browser',
        roomType: roomType,
        lastSeen: Date.now(),
        offline: false // Mark as online
    };

    nearbyDevices.set(peer.id, deviceInfo);
    lastSeen.set(peer.id, Date.now());

    console.log('Added nearby device:', peer.id, deviceInfo);
}

function updateNearbyDevices(devices) {
    const now = Date.now();

    // Clear old devices
    nearbyDevices.clear();

    // Add new devices (legacy support)
    if (Array.isArray(devices)) {
        devices.forEach(({ peerId, deviceInfo }) => {
            if (peerId !== myId && !connections.has(peerId)) {
                nearbyDevices.set(peerId, deviceInfo);
                lastSeen.set(peerId, now);
            }
        });
    }

    updateDeviceGrid();
    console.log(`Found ${nearbyDevices.size} nearby devices`);
}

function requestNearbyDevices() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'request-devices'
        }));
    }
}

function cleanupOldDevices() {
    const now = Date.now();
    let removedCount = 0;

    // Remove devices that haven't been seen for too long
    for (const [peerId, lastSeenTime] of lastSeen.entries()) {
        const deviceInfo = nearbyDevices.get(peerId);

        // For offline devices, wait longer before removing
        const timeout = deviceInfo?.offline ? DEVICE_TIMEOUT * 3 : DEVICE_TIMEOUT;

        if (now - lastSeenTime > timeout) {
            nearbyDevices.delete(peerId);
            lastSeen.delete(peerId);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} old devices`);
        updateDeviceGrid();
    }
}

function updateDiscoveryStatus() {
    if (!discoveryStatus || !discoveryProgress) return;

    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        discoveryStatus.textContent = t('lookingForDevices');
        discoveryProgress.style.display = 'block';
    } else if (signalingSocket && signalingSocket.readyState === WebSocket.CONNECTING) {
        discoveryStatus.textContent = t('connectingToDiscovery');
        discoveryProgress.style.display = 'block';
    } else {
        discoveryStatus.textContent = t('discoveryUnavailable');
        discoveryProgress.style.display = 'none';
    }
}

function createDeviceCard(peerId, deviceInfo, isConnected = false) {
    const deviceCard = document.createElement('div');
    deviceCard.className = 'device-item';
    deviceCard.dataset.peerId = peerId;

    // Different styling for connected vs nearby devices
    if (isConnected) {
        deviceCard.style.border = '2px solid #4caf50';
        deviceCard.style.background = 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)';
        deviceCard.classList.add('connected-device-item');
    }

    const avatar = document.createElement('div');
    avatar.className = 'device-avatar';

    // Set icon based on device type
    const iconName = deviceInfo.type === 'mobile' ? 'smartphone' : 'computer';
    avatar.innerHTML = `<mdui-icon name="${iconName}"></mdui-icon>`;

    // Add connection status indicator
    if (isConnected) {
        avatar.style.border = '3px solid #4caf50';
        avatar.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.3)';
        avatar.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
    }

    const name = document.createElement('div');
    name.className = 'device-name';
    name.textContent = deviceInfo.name || 'Unknown Device';

    const status = document.createElement('div');
    status.className = 'device-status';

    let connectionText, statusColor;
    if (isConnected) {
        connectionText = 'Connected';
        statusColor = '#4caf50';
    } else if (deviceInfo.offline) {
        connectionText = 'Offline';
        statusColor = '#999';
    } else {
        connectionText = 'Available';
        statusColor = '#666';
    }

    // Create more detailed status information
    const browserInfo = deviceInfo.browser || 'Browser';
    const deviceTypeInfo = deviceInfo.type || 'desktop';
    const osInfo = deviceInfo.os ? ` • ${deviceInfo.os}` : '';
    const modelInfo = deviceInfo.model && deviceInfo.model !== deviceInfo.name ? ` • ${deviceInfo.model}` : '';

    status.innerHTML = `
        <div style="color: ${statusColor}; font-weight: 500; margin-bottom: 2px;">
            ${connectionText}
        </div>
        <div style="font-size: 0.8rem; color: #888; line-height: 1.2;">
            ${browserInfo} • ${deviceTypeInfo}${osInfo}${modelInfo}
        </div>
    `;

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; align-items: center; justify-content: center;';

    if (isConnected) {
        // When connected, spread buttons across the width
        actions.style.justifyContent = 'space-between';
        actions.innerHTML = `
            <mdui-button variant="outlined" onclick="event.stopPropagation(); sendFilesToDevice('${peerId}')" style="--mdui-color-primary: #2196f3;">
                <mdui-icon slot="icon" name="send"></mdui-icon>
                Send Files
            </mdui-button>
            <mdui-button variant="filled" onclick="event.stopPropagation(); disconnectPeer('${peerId}')" style="--mdui-color-primary: #f44336; background-color: #f44336; color: white;">
                <mdui-icon slot="icon" name="link_off"></mdui-icon>
                Disconnect
            </mdui-button>
        `;
    } else if (deviceInfo.offline) {
        // Center the offline button
        actions.style.justifyContent = 'center';
        actions.innerHTML = `
            <mdui-button variant="outlined" disabled style="--mdui-color-primary: #999; color: #999;">
                <mdui-icon slot="icon" name="cloud_off"></mdui-icon>
                Offline
            </mdui-button>
        `;
    } else {
        // Center the connect button
        actions.style.justifyContent = 'center';
        actions.innerHTML = `
            <mdui-button variant="filled" onclick="event.stopPropagation(); connectToNearbyDevice('${peerId}')" style="--mdui-color-primary: #2196f3; background-color: #2196f3; color: white;">
                <mdui-icon slot="icon" name="link"></mdui-icon>
                Connect
            </mdui-button>
        `;
    }

    deviceCard.appendChild(avatar);
    deviceCard.appendChild(name);
    deviceCard.appendChild(status);
    deviceCard.appendChild(actions);

    return deviceCard;
}

function updateDeviceGrid() {
    deviceGrid.innerHTML = '';

    // Show all nearby devices (both connected and not connected)
    const totalNearbyDevices = Array.from(nearbyDevices.keys()).filter(peerId =>
        peerId !== myId
    ).length;

    if (totalNearbyDevices === 0) {
        noDevicesElement.style.display = 'block';
        deviceGrid.style.display = 'none';
        updateDiscoveryStatus();
    } else {
        noDevicesElement.style.display = 'none';
        deviceGrid.style.display = 'grid';

        // Show all nearby devices with appropriate connection status
        nearbyDevices.forEach((deviceInfo, peerId) => {
            if (peerId !== myId) {
                const isConnected = connections.has(peerId);
                const deviceCard = createDeviceCard(peerId, deviceInfo, isConnected);
                deviceGrid.appendChild(deviceCard);
            }
        });
    }
}

// Export to global scope
window.startDeviceDiscovery = startDeviceDiscovery;
window.stopDeviceDiscovery = stopDeviceDiscovery;
window.connectToSignalingServer = connectToSignalingServer;
window.handleSignalingMessage = handleSignalingMessage;
window.updateNearbyDevices = updateNearbyDevices;
window.requestNearbyDevices = requestNearbyDevices;
window.cleanupOldDevices = cleanupOldDevices;
window.updateDiscoveryStatus = updateDiscoveryStatus;
window.createDeviceCard = createDeviceCard;
window.updateDeviceGrid = updateDeviceGrid;
