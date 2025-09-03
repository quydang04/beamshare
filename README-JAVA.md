# BeamShare - Java Version

BeamShare has been successfully converted from Node.js to Java using Spring Boot. This provides better compatibility with Java ecosystems and leverages Java's robust enterprise features.

## Quick Start

### Prerequisites
- Java 17 or higher
- Maven 3.6+ 

### Running the Application

```bash
# Using Maven
mvn spring-boot:run

# Or build and run the JAR
mvn clean package
java -jar target/beamshare-1.0.0.jar
```

The application will start on port 3000 by default.

### Access the Application
- Local access: http://localhost:3000
- Network access: http://[your-ip]:3000

## Architecture

### Backend (Java Spring Boot)
- **Spring Boot 3.2.0** - Main application framework
- **Spring WebSocket** - WebSocket support for real-time communication
- **Jackson** - JSON processing
- **Maven** - Build and dependency management

### Frontend (Unchanged)
- **Material Design UI (MDUI)** - Modern Material Design interface
- **PeerJS** - WebRTC P2P connections
- **JavaScript modules** - Modular frontend architecture

## Key Features
- ✅ P2P file transfer using WebRTC
- ✅ Device discovery on local networks
- ✅ Public room sharing with QR codes
- ✅ Real-time peer management
- ✅ Cross-platform compatibility
- ✅ Material Design interface
- ✅ Multi-language support (English/Vietnamese)

## Java Implementation Details

### Main Components

1. **BeamShareApplication.java** - Spring Boot main class with startup logging
2. **BeamShareWebSocketHandler.java** - WebSocket handler for peer communication
3. **Peer.java** - Peer model with device info and connection management
4. **DeviceInfoHelper.java** - Utility for device detection and naming
5. **WebSocketConfig.java** - WebSocket endpoint configuration

### WebSocket Endpoint
- **Path**: `/ws`
- **Protocol**: WebSocket upgrade from HTTP
- **Message Format**: JSON

### Configuration
- **Port**: 3000 (configurable via `server.port`)
- **Static Files**: Served from `src/main/resources/static/`
- **CORS**: Enabled for development

## Development

### Project Structure
```
src/
├── main/
│   ├── java/com/beamshare/
│   │   ├── BeamShareApplication.java
│   │   ├── config/
│   │   │   └── WebSocketConfig.java
│   │   ├── controller/
│   │   │   └── BeamShareWebSocketHandler.java
│   │   ├── model/
│   │   │   └── Peer.java
│   │   └── util/
│   │       └── DeviceInfoHelper.java
│   └── resources/
│       ├── application.properties
│       └── static/ (frontend files)
└── test/java/com/beamshare/
```

### Building
```bash
# Compile only
mvn clean compile

# Run tests
mvn test

# Package JAR
mvn clean package
```

### Configuration Options
Edit `src/main/resources/application.properties`:

```properties
# Server port
server.port=3000

# Server address (0.0.0.0 for all interfaces)
server.address=0.0.0.0

# Static resource caching
spring.web.resources.cache.period=3600

# WebSocket compression
spring.websocket.compression.enabled=true

# Logging levels
logging.level.com.beamshare=INFO
logging.level.org.springframework.web.socket=DEBUG
```

## Migration from Node.js

This Java version maintains full compatibility with the original Node.js implementation:

- ✅ Same WebSocket message protocol
- ✅ Same frontend code (HTML/CSS/JS)
- ✅ Same feature set and functionality
- ✅ Same UI/UX experience
- ✅ Same network protocols and peer discovery

### Key Benefits of Java Version
- **Enterprise Ready**: Better integration with Java-based enterprise systems
- **Performance**: JVM optimizations and garbage collection
- **Tooling**: Rich IDE support and debugging tools
- **Ecosystem**: Access to extensive Java libraries and frameworks
- **Scalability**: Spring Boot's built-in clustering and scaling features
- **Deployment**: Easy deployment to Java application servers

## Deployment

### Docker (Optional)
```dockerfile
FROM openjdk:17-jdk-slim
COPY target/beamshare-1.0.0.jar app.jar
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

### Environment Variables
- `PORT` - Server port (default: 3000)
- `SPRING_PROFILES_ACTIVE` - Spring profile to activate

## License
Same as original implementation