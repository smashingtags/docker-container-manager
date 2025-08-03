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
- **Validation**: Joi for schema validation with comprehensive middleware
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
- **Integration Tests**: Testing module interactions and API endpoints with comprehensive middleware testing
- **E2E Tests**: Playwright for browser automation and user workflow testing
- **Coverage Target**: Minimum 80% code coverage for core modules

### API Integration Testing
The API layer includes comprehensive integration tests covering:
- **Middleware Testing**: Request validation, input sanitization, error handling, and security headers
- **Docker Service Integration**: Mocked Docker service for isolated API testing with proper test isolation
- **CORS Configuration**: Cross-origin request handling with credentials support and origin validation
- **Request Processing**: JSON parsing, URL encoding, and request size limits
- **Security Features**: Helmet middleware integration and rate limiting functionality
- **Error Handling**: Centralized error middleware with proper HTTP status codes and structured responses

### Test Utilities
- **Mock Services**: Docker API mocks and test fixtures in `src/test-utils/`
- **Setup Files**: Automated test environment configuration with Docker service mocking
- **Coverage Reports**: Generated in `coverage/` directory with multiple formats
- **Test Isolation**: Proper mock cleanup and service isolation between test runs

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
- **Mock Management**: Comprehensive Docker service mocking with automatic cleanup
- **Test Isolation**: Proper mock reset and service isolation between test runs

## API Validation & Security

The API includes comprehensive request validation and security middleware:

### Validation Middleware
- **Schema Validation**: Joi-based validation for request body, query parameters, route parameters, and headers
- **Input Sanitization**: XSS protection through script tag removal and input cleaning
- **Error Handling**: Structured validation error responses with detailed field-level feedback
- **Common Schemas**: Reusable validation schemas for IDs, pagination, and search parameters

### Validation Features
```typescript
// Request validation with multiple schema types
validate({
  body: containerConfigSchema,
  params: { id: Joi.string().required() },
  query: paginationSchema
})

// Common validation schemas available
commonSchemas.id          // String ID validation (1-100 chars)
commonSchemas.pagination  // Page, limit, sort, order parameters
commonSchemas.search      // Query and category search parameters
```

### Security Measures
- **Input Sanitization**: Automatic removal of script tags and malicious content
- **Request Validation**: Comprehensive validation of all request components
- **Error Responses**: Consistent error format with validation details
- **Type Safety**: Full TypeScript integration for validation schemas

## API Endpoints

The REST API provides the following endpoints:

### Container Management
- `GET /api/containers` - List all containers with filtering and pagination ✅
- `POST /api/containers` - Create new container ✅
- `GET /api/containers/:id` - Get container details ✅
- `DELETE /api/containers/:id` - Remove container ✅
- `POST /api/containers/:id/start` - Start container ✅
- `POST /api/containers/:id/stop` - Stop container ✅
- `POST /api/containers/:id/restart` - Restart container ✅
- `GET /api/containers/:id/logs` - Get container logs ✅
- `GET /api/containers/:id/stats` - Get container metrics ✅
- `POST /api/containers/bulk` - Bulk container operations ✅

### App Store
- `GET /api/apps` - Browse available applications with filtering and pagination ✅
- `GET /api/apps/search` - Search applications by name, description, and tags ✅
- `GET /api/apps/categories` - Get all app categories ✅
- `GET /api/apps/categories/:categoryId` - Get category details ✅
- `GET /api/apps/stats` - Get app store statistics ✅
- `GET /api/apps/popular` - Get popular applications ✅
- `GET /api/apps/recent` - Get recently added applications ✅
- `GET /api/apps/:id` - Get application details ✅
- `GET /api/apps/:id/schema` - Get application configuration schema ✅
- `GET /api/apps/:id/docs` - Get application documentation ✅
- `POST /api/apps/:id/deploy` - Deploy application with custom configuration ✅
- `POST /api/apps/templates/validate` - Validate app template ✅

### Monitoring (Planned)
- `WebSocket /api/ws` - Real-time updates

### API Features
- **Request Validation**: Comprehensive Joi-based validation for all endpoints
- **Error Handling**: Structured error responses with detailed messages
- **Pagination**: Built-in pagination support for list endpoints
- **Filtering**: Query parameter filtering for container and app lists
- **Search Functionality**: Full-text search across app names, descriptions, and tags
- **Bulk Operations**: Support for bulk container actions
- **Template Management**: App template validation and deployment workflows

### Container API Implementation

The container management API is fully implemented with the following features:

#### Endpoint Details
- **GET /api/containers**: List containers with optional filtering by status, image, name, and pagination support
- **POST /api/containers**: Create new containers with comprehensive configuration validation
- **GET /api/containers/:id**: Retrieve detailed container information
- **POST /api/containers/:id/start**: Start a stopped container
- **POST /api/containers/:id/stop**: Stop a running container  
- **POST /api/containers/:id/restart**: Restart a container
- **DELETE /api/containers/:id**: Remove a container
- **GET /api/containers/:id/logs**: Retrieve container logs with filtering options (tail, since, until, timestamps)
- **GET /api/containers/:id/stats**: Get real-time container resource usage statistics
- **POST /api/containers/bulk**: Perform bulk operations on multiple containers

#### Request/Response Format
All API endpoints follow a consistent response format:
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

Error responses include detailed validation information:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { /* field-specific errors */ }
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

#### Validation Features
- **Container Configuration**: Complete validation of container settings including ports, volumes, environment variables, resource limits, health checks, and security options
- **Query Parameters**: Validation of pagination, filtering, and log retrieval parameters
- **Input Sanitization**: XSS protection and malicious input filtering
- **Type Safety**: Full TypeScript integration with runtime validation

### App Store API Implementation

The app store API is fully implemented with comprehensive functionality for browsing, searching, and deploying containerized applications:

#### Endpoint Details
- **GET /api/apps**: Browse apps with optional category filtering, tag filtering, pagination, and sorting
- **GET /api/apps/search**: Full-text search across app names, descriptions, and tags with additional filtering
- **GET /api/apps/categories**: Retrieve all available app categories with app counts
- **GET /api/apps/categories/:categoryId**: Get detailed information about a specific category
- **GET /api/apps/stats**: Get app store statistics including total apps and category breakdowns
- **GET /api/apps/popular**: Retrieve popular applications (currently sorted by name, ready for popularity metrics)
- **GET /api/apps/recent**: Get recently added applications (currently sorted by name, ready for timestamp sorting)
- **GET /api/apps/:appId**: Get detailed information about a specific application
- **GET /api/apps/:appId/schema**: Retrieve the configuration schema and default settings for an app
- **GET /api/apps/:appId/docs**: Get application documentation, homepage, and repository links
- **POST /api/apps/:appId/deploy**: Deploy an application with custom configuration
- **POST /api/apps/templates/validate**: Validate app template structure and provide feedback

#### App Store Features
- **Advanced Filtering**: Filter apps by category, tags, and search terms
- **Pagination Support**: Built-in pagination for all list endpoints
- **Sorting Options**: Sort by name, category, version, or author
- **Template Validation**: Comprehensive validation of app templates with warnings and errors
- **Configuration Schema**: JSON schema support for guided app configuration
- **Deployment Workflow**: Complete app deployment with configuration customization
- **Error Handling**: Specific error codes for different scenarios (app not found, deployment conflicts, etc.)

#### Request/Response Examples
Browse apps with filtering:
```bash
GET /api/apps?category=web&tags=nginx,proxy&page=1&limit=10&sort=name&order=asc
```

Search apps:
```bash
GET /api/apps/search?q=database&category=storage&page=1&limit=20
```

Deploy an app:
```bash
POST /api/apps/nginx/deploy
{
  "name": "my-nginx-server",
  "configuration": {
    "environment": {
      "NGINX_HOST": "localhost"
    },
    "ports": [
      {
        "hostPort": 8080,
        "containerPort": 80,
        "protocol": "tcp"
      }
    ],
    "volumes": [
      {
        "hostPath": "/host/nginx/html",
        "containerPath": "/usr/share/nginx/html",
        "mode": "ro"
      }
    ]
  }
}
```

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

## App Store Service Implementation

The AppStoreService provides a complete app store experience for discovering and deploying containerized applications:

### Key Features
- **App Discovery**: Browse apps by category or search across all available applications
- **Template Integration**: Seamless integration with the template service for app metadata
- **Container Deployment**: Complete deployment workflow from app selection to running container
- **Configuration Mapping**: Intelligent mapping of app templates to container configurations
- **Dependency Injection**: Constructor-based dependency injection for container service integration
- **Error Handling**: Custom error types with detailed error messages and original error preservation
- **Logging**: Comprehensive logging throughout the deployment process for debugging and monitoring

### AppStoreService API

```typescript
interface AppStoreService {
  getApps(category?: string): Promise<App[]>;
  searchApps(query: string): Promise<App[]>;
  getAppDetails(id: string): Promise<AppDetails>;
  getCategories(): Promise<AppCategory[]>;
  deployApp(appId: string, config: DeployConfig): Promise<Container>;
  getAppTemplate(id: string): Promise<AppTemplate>;
}
```

### Deployment Process

The `deployApp` method implements a complete deployment workflow:

1. **Template Loading**: Load the app template using the template service
2. **Configuration Mapping**: Map template defaults and user configuration to container config
3. **Container Creation**: Create the container using the container service
4. **Container Startup**: Automatically start the newly created container
5. **Labeling**: Add app store specific labels for tracking and management
6. **Error Handling**: Comprehensive error handling with detailed logging

### Configuration Mapping Features

- **Environment Variables**: Merge template defaults with user-provided environment variables
- **Port Mappings**: Use user configuration with fallback to template defaults, including port descriptions
- **Volume Mounts**: Support user-defined volumes with fallback to template defaults, including volume descriptions
- **Network Configuration**: Flexible network configuration with template defaults
- **Resource Limits**: Merge resource limits from template and user configuration
- **Metadata Preservation**: Preserve template metadata in container labels for tracking
- **Smart Defaults**: Intelligent default values for restart policy, resource limits, and other configuration

### Error Handling

The service uses custom error types for better error handling:

```typescript
export class AppStoreServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'AppStoreServiceError';
  }
}
```

### Testing Coverage

The AppStoreService includes comprehensive unit tests covering:
- **App Discovery**: Browse and search functionality with category filtering
- **Template Integration**: Template loading and validation
- **Deployment Workflow**: Complete deployment process with configuration mapping
- **Error Scenarios**: Error handling for invalid templates, deployment failures, and service errors
- **Configuration Mapping**: Template-to-container configuration conversion with all supported options
- **Dependency Injection**: Constructor-based service dependencies and mocking

## App Store System

The app store system provides a complete solution for discovering, configuring, and deploying containerized applications with an intuitive app store experience:

### Key Features
- **App Discovery**: Browse and search available applications with category filtering
- **Template Management**: Efficient loading and caching of JSON-based app templates
- **App Deployment**: Complete deployment workflow from template to running container
- **Configuration Mapping**: Intelligent mapping of app templates to container configurations
- **Category Management**: Automatic categorization with app counts and fallback generation
- **Search Functionality**: Multi-field search across names, descriptions, tags, and authors
- **Validation**: Comprehensive Joi-based template validation with detailed error reporting
- **Caching**: In-memory caching for improved performance with cache management methods
- **File System Integration**: Robust file parsing with JSON validation and error handling
- **Logging**: Comprehensive logging for deployment tracking and debugging

### App Store Service API

```typescript
interface AppStoreService {
  getApps(category?: string): Promise<App[]>;
  searchApps(query: string): Promise<App[]>;
  getAppDetails(id: string): Promise<AppDetails>;
  getCategories(): Promise<AppCategory[]>;
  deployApp(appId: string, config: DeployConfig): Promise<Container>;
  getAppTemplate(id: string): Promise<AppTemplate>;
}
```

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

### App Deployment Workflow

The app store service provides a complete deployment workflow:

1. **Template Loading**: Load app template with default configuration
2. **Configuration Mapping**: Map template and user config to container configuration
3. **Container Creation**: Create container using the container service
4. **Container Startup**: Automatically start the deployed container
5. **Logging**: Track deployment progress and results
6. **Error Handling**: Comprehensive error handling with detailed error messages

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
  getContainerStats(id: string): Promise<ContainerStats>;  // ✅ Implemented
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

## Monitoring Service Implementation

The MonitoringService provides comprehensive container monitoring, logging, and health checking capabilities:

### Key Features
- **Real-time Metrics**: Live container statistics collection with caching for performance
- **Log Management**: Advanced log streaming, export, and historical log access
- **Health Monitoring**: Comprehensive container health checks with resource monitoring
- **System Metrics**: System-wide resource monitoring (CPU, memory, disk, containers)
- **Event-driven Updates**: Real-time metrics streaming using EventEmitter pattern
- **Advanced Log Streaming**: Filtered log streaming with regex pattern support
- **Log Export**: Multiple export formats (JSON, text) with customizable options
- **Error Handling**: Robust error handling with custom error types and error preservation

### MonitoringService API

```typescript
interface MonitoringService {
  getContainerMetrics(id: string): Promise<ContainerStats>;
  getSystemMetrics(): Promise<SystemMetrics>;
  streamLogs(id: string, options?: LogOptions): EventEmitter;
  checkHealth(id: string): Promise<HealthStatus>;
  startMetricsCollection(): void;
  stopMetricsCollection(): void;
  streamContainerStats(id: string): EventEmitter;
  getAllContainerMetrics(): Promise<Map<string, ContainerStats>>;
  exportLogs(id: string, options?: ExportOptions): Promise<string>;
  getHistoricalLogs(id: string, options?: HistoricalLogOptions): Promise<LogEntry[]>;
  downloadLogs(id: string, format?: 'json' | 'text', options?: ExportOptions): Promise<DownloadResult>;
  streamLogsAdvanced(id: string, options?: AdvancedLogOptions): Promise<EventEmitter>;
  checkContainerHealth(id: string): Promise<HealthStatus>;
}
```

### Container Metrics Collection

The monitoring service includes comprehensive container metrics collection:

#### Features
- **Real-time Metrics**: Retrieves live container statistics from Docker daemon
- **CPU Metrics**: Calculates CPU percentage with proper delta computation and multi-core support
- **Memory Statistics**: Tracks memory usage, limits, and percentage utilization
- **Network Statistics**: Aggregates network I/O across all container interfaces (rx/tx bytes and packets)
- **Disk I/O Metrics**: Monitors disk read/write operations and bytes from blkio statistics
- **Timestamp Tracking**: Includes collection timestamp for metrics correlation
- **Error Handling**: Robust error handling with DockerOperationError for failed operations
- **Data Safety**: Null-safe parsing with fallback values for missing statistics
- **Caching**: Intelligent caching with TTL for improved performance

#### ContainerStats Interface
```typescript
interface ContainerStats {
  cpu: number;                    // CPU percentage (0-100 * number of cores)
  memory: {
    usage: number;                // Memory usage in bytes
    limit: number;                // Memory limit in bytes
    percentage: number;           // Memory usage percentage
  };
  network: {
    rxBytes: number;              // Received bytes across all interfaces
    txBytes: number;              // Transmitted bytes across all interfaces
    rxPackets: number;            // Received packets across all interfaces
    txPackets: number;            // Transmitted packets across all interfaces
  };
  disk: {
    readBytes: number;            // Disk read bytes
    writeBytes: number;           // Disk write bytes
    readOps: number;              // Disk read operations
    writeOps: number;             // Disk write operations
  };
  timestamp: Date;                // Collection timestamp
}
```

#### Usage Example
```typescript
const dockerService = new DockerServiceImpl();
const stats = await dockerService.getContainerStats('container-id');

console.log(`CPU: ${stats.cpu.toFixed(2)}%`);
console.log(`Memory: ${(stats.memory.usage / 1024 / 1024).toFixed(2)} MB (${stats.memory.percentage.toFixed(2)}%)`);
console.log(`Network RX: ${(stats.network.rxBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Disk Read: ${(stats.disk.readBytes / 1024 / 1024).toFixed(2)} MB`);
```

### Log Management Features

The monitoring service provides advanced log management capabilities:

#### Log Streaming
- **Real-time Streaming**: Live log streaming with WebSocket-like EventEmitter pattern
- **Historical Access**: Retrieve historical logs with flexible time range filtering
- **Advanced Filtering**: Regex-based log filtering for targeted log analysis
- **Multiple Formats**: Support for timestamped and raw log formats
- **Follow Mode**: Continuous log streaming for real-time monitoring

#### Log Export and Download
- **Multiple Formats**: Export logs in JSON or plain text format
- **Flexible Options**: Customizable time ranges, timestamps, and filtering
- **Structured Export**: JSON export includes container metadata and export options
- **Download Ready**: Formatted downloads with proper MIME types and filenames
- **Error Preservation**: Enhanced error handling that preserves specific error messages

#### Health Monitoring
- **Comprehensive Checks**: Multi-faceted health assessment including resource usage, stability, and error analysis
- **Resource Thresholds**: Configurable CPU and memory usage thresholds with warning and critical levels
- **Log Analysis**: Automatic error detection in recent container logs
- **Stability Assessment**: Container restart and age analysis for stability evaluation
- **Detailed Reporting**: Structured health reports with individual check results and overall status

### Error Handling
- **MonitoringServiceError**: Custom error type for monitoring-specific failures
- **Error Preservation**: Enhanced error handling that preserves original error context and specific error messages
- **DockerConnectionError**: Thrown when Docker daemon connection fails
- **DockerOperationError**: Thrown when Docker operations fail
- **Retry Logic**: Automatic retry with configurable attempts and timeout
- **Health Checks**: Comprehensive system status monitoring

## Configuration Management

The ConfigService provides comprehensive container configuration persistence with backup and restore capabilities:

### Key Features
- **SQLite Storage**: Persistent configuration storage with automatic migration system
- **CRUD Operations**: Complete create, read, update, delete operations for container configurations
- **Import/Export**: JSON-based configuration export and import with comprehensive validation
- **Dual Backup System**: Database-backed backups with file redundancy in `data/backups/`
- **Bulk Operations**: Export and import all configurations with atomic operations
- **Error Handling**: Custom ConfigServiceError with specific error codes and detailed messages
- **Data Validation**: Container configuration validation using validation utilities
- **Migration Support**: Automatic database schema management through MigrationService

### Configuration Service API

```typescript
interface ConfigService {
  // Lifecycle
  initialize(): Promise<void>;                                    // ✅ Implemented
  
  // Individual Configuration Management
  getContainerConfig(id: string): Promise<ContainerConfig | null>; // ✅ Implemented
  saveContainerConfig(id: string, config: ContainerConfig): Promise<void>; // ✅ Implemented
  deleteContainerConfig(id: string): Promise<void>;              // ✅ Implemented
  getAllContainerConfigs(): Promise<ContainerConfig[]>;          // ✅ Implemented
  
  // Import/Export Operations
  exportConfig(id: string): Promise<string>;                     // ✅ Implemented
  importConfig(configData: string): Promise<ContainerConfig>;    // ✅ Implemented
  exportAllConfigs(): Promise<string>;                           // ✅ Implemented
  importAllConfigs(configData: string): Promise<void>;           // ✅ Implemented
  
  // Backup and Restore Management
  createBackup(name: string, description?: string): Promise<number>; // ✅ Implemented
  restoreBackup(backupId: number): Promise<void>;                // ✅ Implemented
  listBackups(): Promise<ConfigBackup[]>;                        // ✅ Implemented
  deleteBackup(backupId: number): Promise<void>;                 // ✅ Implemented
}
```

### Database Schema
The service uses comprehensive database schema with full container configuration support:
```sql
CREATE TABLE container_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  tag TEXT NOT NULL,
  environment TEXT NOT NULL,
  ports TEXT NOT NULL,
  volumes TEXT NOT NULL,
  networks TEXT NOT NULL,
  restart_policy TEXT NOT NULL,
  resources TEXT NOT NULL,
  health_check TEXT,
  security TEXT,
  labels TEXT,
  working_dir TEXT,
  entrypoint TEXT,
  command TEXT,
  hostname TEXT,
  domainname TEXT,
  auto_remove INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE config_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  backup_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Backup Management
Enhanced backup system with database storage and file redundancy:
```typescript
interface ConfigBackup {
  id: number;           // Unique backup identifier
  name: string;         // User-defined backup name
  description?: string; // Optional backup description
  createdAt: Date;      // Backup creation timestamp
}
```

### Error Handling
The ConfigService includes comprehensive error handling with specific error codes:
- `INIT_ERROR`: Service initialization failures
- `GET_CONFIG_ERROR`: Configuration retrieval failures
- `SAVE_CONFIG_ERROR`: Configuration save failures
- `DELETE_CONFIG_ERROR`: Configuration deletion failures
- `CONFIG_NOT_FOUND`: Requested configuration doesn't exist
- `EXPORT_CONFIG_ERROR`: Configuration export failures
- `IMPORT_CONFIG_ERROR`: Configuration import failures
- `INVALID_IMPORT_FORMAT`: Invalid import data structure
- `INVALID_CONFIG_DATA`: Missing required configuration fields
- `CREATE_BACKUP_ERROR`: Backup creation failures
- `RESTORE_BACKUP_ERROR`: Backup restoration failures
- `BACKUP_FILE_NOT_FOUND`: Backup file doesn't exist

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
- ✅ **Configuration Management**: Complete ConfigService with SQLite persistence, backup/restore, and import/export functionality
- ✅ **API Validation Middleware**: Comprehensive request validation and sanitization with Joi schemas
- 🔄 **Core Implementation**: Business logic and API endpoints (in progress)

### Current Implementation Status
- **Foundation**: Complete project scaffolding and configuration
- **Types & Interfaces**: Core data models and service contracts defined
- **Testing Infrastructure**: Jest configuration with mocks and utilities
- **Module Structure**: Organized modules for containers, app store, monitoring, auth, and config
- **Docker Service**: Complete Docker API integration with connection management, error handling, health checks, and container listing
- **Container Operations**: Container listing functionality implemented with status mapping and port/volume extraction
- **Configuration Service**: Full implementation with SQLite storage, backup/restore, import/export, and comprehensive error handling
- **API Validation**: Complete request validation middleware with Joi schemas, input sanitization, and structured error responses
- **Container API**: Complete REST API endpoints for container management with comprehensive validation and error handling
- **App Store API**: Complete REST API endpoints for app browsing, searching, deployment, and template management
- **Service Layer**: Mock service implementation ready for integration with actual Docker operations
- **Next Steps**: Container service implementation (create, start, stop, remove operations) and app store service implementation

See the [tasks.md](.kiro/specs/docker-container-manager/tasks.md) file for detailed implementation progress.

## Contributing

1. Follow the established project structure in `src/`
2. Write tests for new functionality
3. Use TypeScript strict mode
4. Follow ESLint rules
5. Update documentation for API changes

## License

MIT