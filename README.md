# Docker Container Manager

A web-based Docker container management platform that provides an app store-like experience for discovering, deploying, and managing containerized applications. Similar to Unraid's Docker functionality but designed as a self-hosted solution.

## Features

- **App Store Experience**: Browse and deploy containers like installing apps
- **Container Management**: Web-based interface for container lifecycle operations
- **Real-time Monitoring**: Live metrics and log streaming with WebSocket support
- **Configuration Management**: Backup and restore container configurations
- **Plugin System**: Extensible architecture for custom functionality
- **Security**: JWT-based authentication with role-based access control
- **Modern Stack**: TypeScript, Express.js, Socket.io, and SQLite

## Project Structure

```
docker-container-manager/
├── src/                          # Source code
│   ├── api/                      # API Gateway and routing
│   ├── modules/                  # Core business logic modules
│   │   ├── containers/           # Container management
│   │   ├── appstore/             # App store functionality
│   │   ├── monitoring/           # Metrics and monitoring
│   │   ├── config/               # Configuration management
│   │   └── auth/                 # Authentication module
│   ├── services/                 # Shared services
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   └── plugins/                  # Plugin system
├── data/                         # Runtime data storage
│   ├── config/                   # Configuration files
│   ├── logs/                     # Application logs
│   └── backups/                  # Configuration backups
└── tests/                        # Test files
```

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with modular routing
- **Docker Integration**: dockerode library for Docker API communication
- **Database**: SQLite for configuration storage
- **Real-time**: Socket.io for WebSocket communication
- **Authentication**: JWT with bcryptjs for password hashing
- **Validation**: Joi for schema validation
- **Logging**: Winston for structured logging

### Development Tools
- **TypeScript**: Type safety and modern JavaScript features
- **ESLint**: Code linting with TypeScript rules
- **Jest**: Unit and integration testing
- **Playwright**: End-to-end testing
- **ts-node-dev**: Development server with hot reload

## Development Setup

### Prerequisites
- Node.js 18+ 
- Docker Engine installed and running
- Linux-based system (recommended)

### Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd docker-container-manager
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   The server will start on `http://localhost:3001` with hot reload enabled.

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint code analysis
- `npm run lint:fix` - Fix ESLint issues automatically

### Testing
- `npm test` - Run unit and integration tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run end-to-end tests with Playwright

### Production
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

## Testing Strategy

The project uses a comprehensive testing approach with Jest and Playwright:

### Test Configuration
- **Framework**: Jest with ts-jest preset for TypeScript support
- **Environment**: Node.js test environment for backend testing
- **Test Files**: `*.test.ts` or `*.spec.ts` patterns
- **Coverage**: Comprehensive coverage reporting with text, lcov, and HTML formats
- **Path Mapping**: `@/*` aliases for clean imports in tests
- **Setup**: Automated test environment setup with shared utilities

### Test Types
- **Unit Tests**: Co-located with source files, testing individual functions and classes
- **Integration Tests**: Testing module interactions and API endpoints
- **E2E Tests**: Playwright for browser automation and user workflow testing
- **Coverage Target**: Minimum 80% code coverage for core modules

### Test Utilities
- **Mock Services**: Docker API mocks and test fixtures in `src/test-utils/`
- **Setup Files**: Automated test environment configuration
- **Coverage Reports**: Generated in `coverage/` directory with multiple formats

## Configuration

### Environment Variables

The application uses environment variables for configuration. Copy `.env.example` to `.env` and adjust values:

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `DATABASE_PATH` - SQLite database file path
- `DOCKER_SOCKET_PATH` - Docker daemon socket path
- `JWT_SECRET` - Secret key for JWT token signing
- `LOG_LEVEL` - Logging level (error/warn/info/debug)

### TypeScript Configuration

The project uses strict TypeScript configuration with:
- Path mapping for clean imports (`@/modules/*`, `@/types/*`)
- Strict type checking enabled
- Source maps and declarations generated
- ES2020 target with CommonJS modules

### Jest Testing Configuration

The Jest setup includes:
- **ts-jest preset**: TypeScript compilation and execution
- **Node.js environment**: Backend-focused testing environment
- **Path mapping**: `@/*` aliases matching TypeScript configuration
- **Coverage collection**: Excludes test files and type definitions
- **Multiple reporters**: Text, LCOV, and HTML coverage formats
- **Test setup**: Automated environment configuration with shared utilities

## API Endpoints

The REST API will provide the following endpoints (implementation in progress):

### Container Management
- `GET /api/containers` - List all containers
- `POST /api/containers` - Create new container
- `GET /api/containers/:id` - Get container details
- `PUT /api/containers/:id` - Update container configuration
- `DELETE /api/containers/:id` - Remove container
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container
- `POST /api/containers/:id/restart` - Restart container

### App Store
- `GET /api/apps` - Browse available applications
- `GET /api/apps/search` - Search applications
- `GET /api/apps/:id` - Get application details
- `POST /api/apps/:id/deploy` - Deploy application

### Monitoring
- `GET /api/containers/:id/logs` - Get container logs
- `GET /api/containers/:id/stats` - Get container metrics
- `WebSocket /api/ws` - Real-time updates

## Docker Service Implementation

The Docker service layer provides a robust wrapper around the dockerode library with the following features:

### Key Features
- **Connection Management**: Automatic retry logic with exponential backoff
- **Error Handling**: Custom error types for Docker connection and operation failures
- **Health Monitoring**: Comprehensive health checks with Docker daemon status
- **Image Management**: Pull, list, and remove Docker images
- **Container Listing**: Retrieve all containers with status mapping, port configurations, and volume mounts
- **Service Interface**: Implements standardized service interface for lifecycle management

### Docker Service API

```typescript
interface DockerService {
  // Container Operations
  listContainers(): Promise<Container[]>;           // ✅ Implemented
  createContainer(config: ContainerConfig): Promise<Container>;  // To be implemented
  startContainer(id: string): Promise<void>;        // To be implemented
  stopContainer(id: string): Promise<void>;         // To be implemented
  restartContainer(id: string): Promise<void>;      // To be implemented
  removeContainer(id: string): Promise<void>;       // To be implemented
  
  // Image Operations (implemented)
  pullImage(image: string, tag?: string): Promise<void>;
  listImages(): Promise<Array<{ id: string; tags: string[]; size: number }>>;
  removeImage(id: string): Promise<void>;
  
  // System Operations (implemented)
  getDockerInfo(): Promise<any>;
  ping(): Promise<boolean>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }>;
}
```

### Type Definitions
The Docker service uses comprehensive TypeScript interfaces:
- **ContainerConfig**: Complete container configuration with ports, volumes, resources, health checks, and security options
- **Container**: Runtime container data with status and statistics
- **ContainerStats**: Real-time metrics including CPU, memory, network, and disk usage
- **PortMapping**: Port configuration with protocol and optional descriptions
- **VolumeMapping**: Volume mount configuration with access modes and descriptions
- **NetworkConfig**: Network configuration with driver options
- **ResourceLimits**: CPU, memory, disk, and process limits with ulimits support
- **HealthCheck**: Container health monitoring configuration
- **SecurityOptions**: Security settings including privileges and capabilities
- **LogOptions**: Flexible log retrieval options with filtering and streaming
- **ServiceInterface**: Standardized lifecycle management for all services

### Testing Coverage
The Docker service includes comprehensive unit tests covering:
- **Initialization**: Service startup and Docker daemon connection
- **Health Monitoring**: Ping operations and health check functionality
- **Image Management**: Pull, list, and remove operations with error handling
- **Error Scenarios**: Connection failures, operation timeouts, and retry logic
- **Edge Cases**: Missing image tags, network failures, and malformed responses

### Error Handling
- **DockerConnectionError**: Thrown when Docker daemon connection fails
- **DockerOperationError**: Thrown when Docker operations fail
- **Retry Logic**: Automatic retry with configurable attempts and timeout
- **Health Checks**: Comprehensive system status monitoring

## Project Status

This project is currently in development. The following foundation tasks are completed:

- ✅ **Project Structure**: Modular directory layout with proper separation of concerns
- ✅ **Package Configuration**: Complete package.json with all required dependencies
- ✅ **TypeScript Setup**: Strict TypeScript configuration with path mapping
- ✅ **ESLint Configuration**: Code quality rules and TypeScript integration
- ✅ **Jest Testing Framework**: Comprehensive test setup with coverage reporting
- ✅ **Core Type Definitions**: TypeScript interfaces for containers, apps, and API
- ✅ **Service Layer Foundation**: Base services for Docker, database, and WebSocket
- ✅ **Module Structure**: Organized modules for containers, app store, monitoring, auth, and config
- ✅ **Docker API Integration**: Complete Docker service with connection management and health checks
- 🔄 **Core Implementation**: Business logic and API endpoints (in progress)

### Current Implementation Status
- **Foundation**: Complete project scaffolding and configuration
- **Types & Interfaces**: Core data models and service contracts defined
- **Testing Infrastructure**: Jest configuration with mocks and utilities
- **Module Skeleton**: Basic structure for all core modules
- **Docker Service**: Complete Docker API integration with connection management, error handling, health checks, and container listing
- **Container Operations**: Container listing functionality implemented with status mapping and port/volume extraction
- **Next Steps**: Container CRUD operations (create, start, stop, remove) and API endpoints

See the [tasks.md](.kiro/specs/docker-container-manager/tasks.md) file for detailed implementation progress.

## Contributing

1. Follow the established project structure in `src/`
2. Write tests for new functionality
3. Use TypeScript strict mode
4. Follow ESLint rules
5. Update documentation for API changes

## License

MIT