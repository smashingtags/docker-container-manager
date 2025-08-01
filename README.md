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
- **TypeScript Strict Mode**: All tests comply with strict null checking and type safety

### Test Types
- **Unit Tests**: Co-located with source files, testing individual functions and classes
- **Integration Tests**: Testing module interactions and API endpoints with real file system operations
- **E2E Tests**: Playwright for browser automation and user workflow testing
- **Coverage Target**: Minimum 80% code coverage for core modules

### Test Utilities
- **Mock Services**: Docker API mocks and test fixtures in `src/test-utils/`
- **Setup Files**: Automated test environment configuration
- **Coverage Reports**: Generated in `coverage/` directory with multiple formats

### Recent Test Improvements
- **Strict Null Checking**: Enhanced test assertions to handle TypeScript strict mode with proper null checking
- **Error Validation**: Improved error message validation in tests with detailed field-specific assertions
- **Schema Testing**: Comprehensive validation schema testing with edge cases and boundary conditions
- **Cross-Validation Testing**: Tests for logical relationships between configuration fields
- **Real File System Integration**: Integration tests now use actual file system operations with temporary directories for realistic volume validation testing
- **Multi-Container Scenarios**: Advanced port conflict testing across multiple container configurations
- **Protocol-Specific Testing**: Comprehensive testing for mixed TCP/UDP port configurations
- **Network Driver Testing**: Custom network creation tests with different Docker network drivers (bridge, overlay)
- **Permission Validation**: Volume mount testing with file system permissions and accessibility checks

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

## Container Validation System

The container validation system provides comprehensive validation for all container configurations with detailed error reporting and TypeScript strict mode compliance:

### Key Features
- **Complete Configuration Validation**: Validates all aspects of container configuration including required fields, environment variables, ports, volumes, networks, restart policies, resources, health checks, and security options
- **Joi Schema-Based Validation**: Uses Joi validation library for robust schema validation with detailed error reporting
- **Specialized Validators**: Individual validation functions for each configuration aspect (ports, volumes, resources, health checks, security)
- **Cross-Validation Logic**: Ensures logical consistency between related fields (e.g., health check timeout < interval, ulimit soft <= hard)
- **Conflict Detection**: Identifies port conflicts, duplicate volume mappings, and network compatibility issues
- **Field-Specific Errors**: Detailed error messages with field names and invalid values for precise debugging
- **TypeScript Strict Compliance**: All validation code follows strict TypeScript rules with proper null checking

### Core Validation Schemas
- **portMappingSchema**: Port configuration with range (1-65535) and protocol validation
- **volumeMappingSchema**: Volume mount validation with absolute path requirements
- **resourceLimitsSchema**: CPU, memory, disk, and ulimit validation with cross-checks
- **healthCheckSchema**: Health check configuration with timing validation
- **securityOptionsSchema**: Security settings including privileges and capabilities
- **containerConfigSchema**: Complete container configuration with defaults
- **createContainerRequestSchema**: API request validation with proper defaults

### Validation Functions
- `validateSchema()` - Generic schema validation with error formatting
- `validateContainerConfig()` - Complete container configuration validation with detailed error reporting
- `validatePortMappings()` - Port configuration with conflict detection and reserved port warnings
- `validateVolumeMappings()` - Volume mount validation with path safety checks
- `validateNetworkConfiguration()` - Network name validation with Docker compatibility
- `validateResourceLimits()` - Resource limits with ulimit cross-validation
- `validatePortConfiguration()` - Port validation with existing port conflict detection
- `validateVolumeConfiguration()` - Volume validation with optional host path checking
- `validateNetworkCompatibility()` - Network validation against available Docker networks

### Testing Coverage
The validation system includes comprehensive unit tests with:
- **Schema Validation Tests**: All Joi schemas tested with valid and invalid data
- **Error Message Validation**: Ensures proper error formatting and field identification
- **Edge Case Testing**: Handles malformed data, missing fields, and boundary conditions
- **TypeScript Strict Mode**: All tests comply with strict null checking and type safety
- **Cross-Validation Testing**: Validates logical relationships between configuration fields
- **Mock Isolation**: Validation utilities are properly mocked in tests for better isolation and faster execution

## Docker Service Implementation

The Docker service layer provides a robust wrapper around the dockerode library with the following features:

### Key Features
- **Connection Management**: Automatic retry logic with exponential backoff
- **Error Handling**: Custom error types for Docker connection and operation failures
- **Health Monitoring**: Comprehensive health checks with Docker daemon status
- **Image Management**: Pull, list, and remove Docker images
- **Container Listing**: Retrieve all containers with status mapping, port configurations, and volume mounts
- **Service Interface**: Implements standardized service interface for lifecycle management

## Networking Service Implementation

The NetworkingService provides comprehensive validation and management for container networking and storage configurations:

### Key Features
- **Port Mapping Validation**: Conflict detection with existing containers and reserved ports
- **Volume Mount Validation**: Host path existence and accessibility checks
- **Network Configuration**: Compatibility validation with available Docker networks
- **Port Suggestions**: Intelligent port allocation to avoid conflicts
- **Custom Networks**: Automatic creation of custom Docker networks when needed
- **Error Handling**: Detailed validation errors with field-specific messages
- **Logging**: Comprehensive debug and error logging throughout operations

### NetworkingService API

```typescript
interface NetworkingService {
  validatePortMappings(ports: PortMapping[]): Promise<ValidationResult<PortMapping[]>>;
  validateVolumeMappings(volumes: VolumeMapping[]): Promise<ValidationResult<VolumeMapping[]>>;
  validateNetworkConfiguration(networks: string[]): Promise<ValidationResult<string[]>>;
  getAvailableNetworks(): Promise<string[]>;
  getUsedPorts(): Promise<number[]>;
  suggestAvailablePort(preferredPort?: number): Promise<number>;
  validateHostPath(path: string): Promise<ValidationResult<string>>;
  createNetworkIfNotExists(name: string, options?: any): Promise<void>;
}
```

### Validation Features
- **Port Conflict Detection**: Checks against currently used ports and reserved system ports
- **Host Path Validation**: Verifies path existence and accessibility before container creation
- **Network Compatibility**: Ensures specified networks exist or can be created
- **Data Integrity**: Robust validation with proper error handling for malformed configurations
- **Safe Data Processing**: Enhanced validation logic ensures only valid data is processed during host path validation

### Recent Improvements
- **Volume Validation Bug Fix**: Fixed issue where volume validation could fail when processing invalid data structures. The validation now properly checks for valid data before attempting host path validation, preventing runtime errors and ensuring reliable container configuration validation.
- **Enhanced Test Isolation**: Improved test architecture by properly mocking validation utilities, ensuring better test isolation and more reliable test execution. This prevents external dependencies from affecting test results and improves overall test performance.
- **Advanced Integration Testing**: Comprehensive integration tests now include real file system operations for volume validation, multi-container port conflict scenarios, mixed protocol configurations (TCP/UDP), reserved port handling, complex volume mapping with nested directories, and custom network creation with different drivers.

## App Template System

The template system provides a comprehensive solution for managing Docker application templates with validation, caching, and category management:

### Key Features
- **Template Loading**: Efficient loading and caching of JSON-based app templates
- **Category Management**: Automatic categorization with app counts and fallback generation
- **Search Functionality**: Multi-field search across names, descriptions, tags, and authors
- **Validation**: Comprehensive Joi-based template validation with detailed error reporting
- **Caching**: In-memory caching for improved performance with cache management methods
- **File System Integration**: Robust file parsing with JSON validation and error handling

### Template Service API

```typescript
interface TemplateService {
  loadTemplate(templateId: string): Promise<AppTemplate>;
  loadAllTemplates(): Promise<AppTemplate[]>;
  getTemplatesByCategory(category: string): Promise<AppTemplate[]>;
  searchTemplates(query: string): Promise<AppTemplate[]>;
  getCategories(): Promise<AppCategory[]>;
  validateTemplate(template: any): ValidationResult<AppTemplate>;
  parseTemplateFile(filePath: string): Promise<AppTemplate>;
}
```

### Template Structure
App templates are JSON files with the following structure:
- **Metadata**: ID, name, description, category, icon, version, tags, author
- **Container Configuration**: Default Docker configuration with ports, volumes, environment variables
- **Configuration Schema**: JSON schema for user customization options
- **Documentation**: Detailed usage instructions and setup guides

### Template Validation
The template validation system ensures:
- **Schema Compliance**: All required fields present with correct data types
- **ID Format**: Lowercase alphanumeric with hyphens only
- **Version Format**: Semantic versioning (x.y.z)
- **URI Validation**: Valid URLs for icons, homepage, and repository
- **Container Config**: Complete validation of default Docker configuration
- **JSON Schema**: Valid configuration schema for user customization

### Category Management
- **Automatic Discovery**: Categories generated from existing templates
- **App Counting**: Real-time count of applications per category
- **Icon Mapping**: Default category icons with emoji fallbacks
- **Name Formatting**: Automatic category name formatting from IDs

### Template Directory Structure
```
templates/
├── apps/                         # Individual app templates
│   ├── portainer.json           # Example: Portainer management UI
│   ├── nginx.json               # Example: Nginx web server
│   └── ...                      # Additional app templates
└── categories/                   # Category definitions (optional)
    └── categories.json          # Manual category configuration
```

### Template File Format
Each template is a JSON file with comprehensive configuration:
```json
{
  "id": "portainer",
  "name": "Portainer",
  "description": "Docker management UI",
  "category": "management",
  "icon": "https://portainer.io/images/logo.png",
  "version": "2.19.4",
  "image": "portainer/portainer-ce",
  "defaultConfig": {
    "ports": [
      {
        "hostPort": 9000,
        "containerPort": 9000,
        "protocol": "tcp",
        "description": "Web UI"
      }
    ],
    "volumes": [
      {
        "hostPath": "/var/run/docker.sock",
        "containerPath": "/var/run/docker.sock",
        "mode": "rw",
        "description": "Docker socket"
      }
    ]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "webPort": {
        "type": "number",
        "default": 9000,
        "description": "Web interface port"
      }
    }
  },
  "documentation": "Portainer is a lightweight management UI...",
  "tags": ["management", "docker", "ui"],
  "author": "Portainer Team"
}
```

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
- **Testing Infrastructure**: Jest configuration with mocks and utilities, TypeScript strict mode compliance
- **Module Skeleton**: Basic structure for all core modules
- **Container Validation**: Comprehensive Joi-based validation system with field-specific error reporting, cross-validation logic, conflict detection, and TypeScript strict mode compliance
- **Docker Service**: Complete Docker API integration with connection management, error handling, health checks, and container listing
- **Container Operations**: Container listing functionality implemented with status mapping and port/volume extraction
- **Networking Service**: Complete networking and storage validation with port conflict detection, host path validation, and network management
- **Container Service**: Full container lifecycle management with integrated networking validation and comprehensive configuration validation
- **App Template System**: Complete template service implementation with validation, caching, and category management
- **Integration Testing**: Advanced integration tests with real file system operations, multi-container scenarios, and comprehensive validation coverage
- **Next Steps**: App store service, monitoring system, and REST API endpoints

See the [tasks.md](.kiro/specs/docker-container-manager/tasks.md) file for detailed implementation progress.

## Contributing

1. Follow the established project structure in `src/`
2. Write tests for new functionality
3. Use TypeScript strict mode
4. Follow ESLint rules
5. Update documentation for API changes

## License

MIT