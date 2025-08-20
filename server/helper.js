// Helper functions for device detection and utilities

// Simple hash function for peer ID validation
export function hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

// Parse user agent to extract device information
export function getDeviceInfo(userAgent) {
    if (!userAgent) {
        return {
            displayName: 'Unknown Device',
            deviceName: 'Unknown Device',
            type: 'desktop',
            browser: 'Unknown',
            os: 'Unknown'
        };
    }

    // Simple user agent parsing (basic implementation)
    const ua = userAgent.toLowerCase();
    
    // Detect OS
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edg')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // Detect device type
    let type = 'desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        type = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        type = 'tablet';
    }

    // Generate device name
    let deviceName = '';
    if (os !== 'Unknown') {
        deviceName = os.replace('Mac OS', 'Mac') + ' ';
    }
    deviceName += browser;

    // Generate display name (simple color + animal combination)
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan', 'Magenta', 'Lime', 'Indigo', 'Violet', 'Turquoise', 'Gold', 'Silver', 'Coral'];
    const animals = ['Cat', 'Dog', 'Lion', 'Tiger', 'Bear', 'Wolf', 'Fox', 'Rabbit', 'Eagle', 'Dolphin', 'Elephant', 'Giraffe', 'Panda', 'Koala', 'Penguin', 'Owl'];

    // Use a combination of user agent and current time for more uniqueness
    const seed = userAgent + Date.now().toString();
    const hash = Math.abs(hashCode(seed));
    const colorIndex = hash % colors.length;
    const animalIndex = Math.floor(hash / colors.length) % animals.length;
    const displayName = `${colors[colorIndex]} ${animals[animalIndex]}`;

    return {
        displayName,
        deviceName,
        type,
        browser,
        os
    };
}

// Generate random string for room codes
export function generateRandomString(length, alphanumeric = false) {
    const chars = alphanumeric ? 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' :
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get client IP from request
export function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['cf-connecting-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '127.0.0.1';
}
