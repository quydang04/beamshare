package com.beamshare;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    "server.port=0" // Use random port for tests
})
class BeamShareApplicationTests {

    @Test
    void contextLoads() {
        // Test that the Spring Boot application context loads successfully
        // This verifies all beans are properly configured
    }

    @Test
    void applicationStarts() {
        // If this test runs, it means the application started successfully
        // This is a basic smoke test for the Java conversion
    }
}