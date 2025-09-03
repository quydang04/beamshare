package com.beamshare.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Random;

public class DeviceInfoHelper {
    
    private static final String[] COLORS = {
        "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Cyan", 
        "Magenta", "Lime", "Indigo", "Violet", "Turquoise", "Gold", "Silver", "Coral"
    };
    
    private static final String[] ANIMALS = {
        "Cat", "Dog", "Lion", "Tiger", "Bear", "Wolf", "Fox", "Rabbit", 
        "Eagle", "Dolphin", "Elephant", "Giraffe", "Panda", "Koala", "Penguin", "Owl"
    };

    public static class DeviceInfo {
        private final String displayName;
        private final String deviceName;
        private final String type;
        private final String browser;
        private final String os;

        public DeviceInfo(String displayName, String deviceName, String type, String browser, String os) {
            this.displayName = displayName;
            this.deviceName = deviceName;
            this.type = type;
            this.browser = browser;
            this.os = os;
        }

        // Getters
        public String getDisplayName() { return displayName; }
        public String getDeviceName() { return deviceName; }
        public String getType() { return type; }
        public String getBrowser() { return browser; }
        public String getOs() { return os; }

        @Override
        public String toString() {
            return displayName;
        }
    }

    public static DeviceInfo getDeviceInfo(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) {
            return new DeviceInfo("Unknown Device", "Unknown Device", "desktop", "Unknown", "Unknown");
        }

        String ua = userAgent.toLowerCase();
        
        // Detect OS
        String os = "Unknown";
        if (ua.contains("windows")) os = "Windows";
        else if (ua.contains("mac os")) os = "macOS";
        else if (ua.contains("linux")) os = "Linux";
        else if (ua.contains("android")) os = "Android";
        else if (ua.contains("iphone") || ua.contains("ipad")) os = "iOS";

        // Detect browser
        String browser = "Unknown";
        if (ua.contains("chrome") && !ua.contains("edg")) browser = "Chrome";
        else if (ua.contains("firefox")) browser = "Firefox";
        else if (ua.contains("safari") && !ua.contains("chrome")) browser = "Safari";
        else if (ua.contains("edg")) browser = "Edge";
        else if (ua.contains("opera")) browser = "Opera";

        // Detect device type
        String type = "desktop";
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            type = "mobile";
        } else if (ua.contains("tablet") || ua.contains("ipad")) {
            type = "tablet";
        }

        // Generate device name
        String deviceName = "";
        if (!"Unknown".equals(os)) {
            deviceName = os.replace("Mac OS", "Mac") + " ";
        }
        deviceName += browser;

        // Generate display name using color + animal combination
        String seed = userAgent + System.currentTimeMillis();
        int hash = Math.abs(stringHashCode(seed));
        int colorIndex = hash % COLORS.length;
        int animalIndex = (hash / COLORS.length) % ANIMALS.length;
        String displayName = COLORS[colorIndex] + " " + ANIMALS[animalIndex];

        return new DeviceInfo(displayName, deviceName, type, browser, os);
    }

    public static int stringHashCode(String str) {
        if (str == null || str.isEmpty()) return 0;
        
        int hash = 0;
        for (int i = 0; i < str.length(); i++) {
            char ch = str.charAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    public static String hashCode(String str) {
        return String.valueOf(stringHashCode(str));
    }

    public static String generateRandomString(int length) {
        return generateRandomString(length, false);
    }

    public static String generateRandomString(int length, boolean alphanumeric) {
        String chars = alphanumeric ? 
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" :
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
        
        Random random = new Random();
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < length; i++) {
            result.append(chars.charAt(random.nextInt(chars.length())));
        }
        return result.toString();
    }

    public static String getClientIP(String forwardedFor, String cfConnectingIp, String remoteAddr) {
        if (cfConnectingIp != null && !cfConnectingIp.isEmpty()) {
            return cfConnectingIp;
        }
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return forwardedFor.split(",")[0].trim();
        }
        return remoteAddr != null ? remoteAddr : "127.0.0.1";
    }
}