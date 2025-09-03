package com.beamshare;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Collections;

@SpringBootApplication
public class BeamShareApplication {
    
    private static final Logger logger = LoggerFactory.getLogger(BeamShareApplication.class);
    
    private final Environment environment;
    
    public BeamShareApplication(Environment environment) {
        this.environment = environment;
    }
    
    public static void main(String[] args) {
        SpringApplication.run(BeamShareApplication.class, args);
    }
    
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        String port = environment.getProperty("server.port", "3000");
        logger.info("BeamShare Server running on port {}", port);
        logger.info("Local access: http://localhost:{}", port);
        
        // Get local IP addresses for mobile access
        try {
            Collections.list(NetworkInterface.getNetworkInterfaces()).stream()
                .flatMap(ni -> Collections.list(ni.getInetAddresses()).stream())
                .filter(addr -> !addr.isLoopbackAddress() && addr.getAddress().length == 4)
                .forEach(addr -> logger.info("Network access: http://{}:{}", addr.getHostAddress(), port));
        } catch (SocketException e) {
            logger.warn("Could not enumerate network interfaces: {}", e.getMessage());
        }
        
        logger.info("Device discovery improved with PairDrop-style peer management");
    }
}