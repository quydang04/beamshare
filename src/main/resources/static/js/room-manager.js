// Room Management System
// Handles room codes, QR code generation, and room functionality

// Room code display update
function updateRoomCodeDisplay() {
    if (roomCodeElement) {
        roomCodeElement.textContent = currentRoomCode;
    }
    if (roomCodeDialogElement) {
        roomCodeDialogElement.textContent = currentRoomCode;
    }
}

// QR Code generation for main canvas (if exists)
function generateQRCode() {
    const canvas = document.getElementById('room-qr-code');
    if (!canvas) return;

    generateQRCodeForCanvas(canvas, currentRoomCode);
}

// QR Code generation for dialog canvas
function generateQRCodeDialog() {
    const canvas = document.getElementById('room-qr-code-dialog');
    if (!canvas) return;

    generateQRCodeForCanvas(canvas, currentRoomCode);
}

// Generic QR Code generation function
function generateQRCodeForCanvas(canvas, roomCode) {
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
        const qr = qrcode(0, 'M');
        const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
        qr.addData(url);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const cellSize = canvas.width / moduleCount;

        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
            }
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code Error', canvas.width / 2, canvas.height / 2);
    }
}

// Room management functions
function createRoom() {
    currentRoomCode = generateRoomCode();
    updateRoomCodeDisplay();
    generateQRCode();
    generateQRCodeDialog();
    showNotification(`Room created: ${currentRoomCode}`, 'success');
}

function refreshRoom() {
    currentRoomCode = generateRoomCode();
    updateRoomCodeDisplay();
    generateQRCode();
    generateQRCodeDialog();
    showNotification(t('newRoomGenerated'), 'success');
}

function copyRoomCode() {
    if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode).then(() => {
            showNotification(t('roomCodeCopied'), 'success');
        }).catch(err => {
            console.error('Failed to copy room code:', err);
            showNotification('Failed to copy room code', 'error');
        });
    }
}

function copyRoomUrl() {
    if (currentRoomCode) {
        const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Room URL copied!', 'success');
        }).catch(err => {
            console.error('Failed to copy room URL:', err);
            showNotification('Failed to copy room URL', 'error');
        });
    }
}

function shareRoom() {
    if (!currentRoomCode) return;

    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
    const shareData = {
        title: 'Join my PairDrop room',
        text: `Join my file sharing room with code: ${currentRoomCode}`,
        url: url
    };

    if (navigator.share) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            // Fallback to copying URL
            copyRoomUrl();
        });
    } else {
        // Fallback to copying URL
        copyRoomUrl();
    }
}



function leaveRoom() {
    if (!currentRoomCode) return;

    const oldRoomCode = currentRoomCode;

    // Send leave request to server via WebSocket
    if (typeof sendWebSocketMessage === 'function') {
        sendWebSocketMessage({
            type: 'leave-public-room'
        });
    }

    // Create new room
    createRoom();

    showNotification(`Left room ${oldRoomCode}`, 'info');
}

function createPublicRoom() {
    // Send create request to server via WebSocket
    if (typeof sendWebSocketMessage === 'function') {
        sendWebSocketMessage({
            type: 'create-public-room'
        });

        showNotification('Creating new room...', 'info');
    } else {
        console.error('WebSocket not available for room creation');
        showNotification('Connection error - cannot create room', 'error');
    }
}

// Room member management
function addRoomMember(peerId, deviceInfo) {
    roomMembers.add(peerId);
    console.log(`Member ${peerId} joined room ${currentRoomCode}`);
    
    // Update UI to show room members if needed
    updateRoomMembersList();
}

function removeRoomMember(peerId) {
    roomMembers.delete(peerId);
    console.log(`Member ${peerId} left room ${currentRoomCode}`);
    
    // Update UI
    updateRoomMembersList();
}

function updateRoomMembersList() {
    // This could update a room members list in the UI
    // For now, we'll just log the count
    console.log(`Room ${currentRoomCode} has ${roomMembers.size} members`);
}

// Room persistence
function saveRoomToStorage() {
    if (currentRoomCode) {
        localStorage.setItem('current_room_code', currentRoomCode);
    }
}

function loadRoomFromStorage() {
    const savedRoom = localStorage.getItem('current_room_code');
    if (savedRoom) {
        currentRoomCode = savedRoom;
        updateRoomCodeDisplay();
        generateQRCode();
        generateQRCodeDialog();
        return savedRoom;
    }
    return null;
}

function clearRoomFromStorage() {
    localStorage.removeItem('current_room_code');
}

// Room URL handling
function handleRoomFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl) {
        const roomCode = roomFromUrl.toUpperCase();
        if (roomCode.length === 5) {
            // Just show a notification that room joining is not available
            showNotification(`Room code ${roomCode} detected in URL, but join functionality is disabled`, 'info');
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            return true;
        }
    }
    return false;
}

// Server response handlers for public rooms
function handlePublicRoomCreated(roomId) {
    currentRoomCode = roomId;
    updateRoomCodeDisplay();
    generateQRCode();
    generateQRCodeDialog();
    saveRoomToStorage();

    showNotification(`Room created: ${roomId}`, 'success');
    console.log(`Successfully created public room: ${roomId}`);
}



function handlePublicRoomLeft() {
    showNotification('Left public room', 'info');
    console.log('Successfully left public room');
}



// Initialize room system
function initializeRoom() {
    // Try to load room from URL first
    if (handleRoomFromURL()) {
        return;
    }

    // Try to load saved room
    if (loadRoomFromStorage()) {
        console.log(`Restored room: ${currentRoomCode}`);
        return;
    }

    // Create new room
    createRoom();
}

// Export to global scope
window.updateRoomCodeDisplay = updateRoomCodeDisplay;
window.generateQRCode = generateQRCode;
window.generateQRCodeDialog = generateQRCodeDialog;
window.generateQRCodeForCanvas = generateQRCodeForCanvas;
window.createRoom = createRoom;
window.refreshRoom = refreshRoom;
window.copyRoomCode = copyRoomCode;
window.copyRoomUrl = copyRoomUrl;
window.shareRoom = shareRoom;

window.leaveRoom = leaveRoom;
window.createPublicRoom = createPublicRoom;
window.addRoomMember = addRoomMember;
window.removeRoomMember = removeRoomMember;
window.updateRoomMembersList = updateRoomMembersList;
window.saveRoomToStorage = saveRoomToStorage;
window.loadRoomFromStorage = loadRoomFromStorage;
window.clearRoomFromStorage = clearRoomFromStorage;
window.handleRoomFromURL = handleRoomFromURL;
window.initializeRoom = initializeRoom;
window.handlePublicRoomCreated = handlePublicRoomCreated;

window.handlePublicRoomLeft = handlePublicRoomLeft;

