# Project Structure & Organization

## Directory Layout

```
docker-container-manager/
├── src/                          # Source code
│   ├── api/                      # API Gateway and routing
│   │   ├── index.ts              # Main API entry point
│   │   ├── middleware/           # Express middleware
│   │   └── routes/               # Route definitions
│   ├── modules/                  # Core business logic modules
│   │   ├── containers/           # Container management
│   │   ├── appstore/             # App store functionality
│   │   ├── monitoring/           # Metrics and monitoring
│   │   ├── config/               # Configuration management
│   │   └── auth/                 # Authentication module
│   ├── services/                 # Shared services
│   │   ├── docker.service.ts     # Docker API wrapper
│   │   ├── database.service.ts   # Database operations
│   │   └── websocket.service.ts  # Real-time communication
│   ├── types/                    # TypeScript type definitions
│   │   ├── container.types.ts    # Container-related types
│   │   ├── app.types.ts          # App store types
│   │   └── api.types.ts          # API response types
│   ├── utils/                    # Utility functions
│   └── plugins/                  # Plugin system
├── web/                          # Frontend React application
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Page components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── stores/               # Zustand state stores
│   │   ├── services/             # API client services
│   │   └── types/                # Frontend type definitions
│   ├── public/                   # Static assets
│   └── package.json
├── templates/                    # App templates and configurations
│   ├── categories/               # Template categories
│   └── apps/                     # Individual app templates
├── data/                         # Runtime data storage
│   ├── config/                   # Configuration files
│   ├── logs/                     # Application logs
│   └── backups/                  # Configuration backups
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   ├── e2e/                      # End-to-end tests
│   └── fixtures/                 # Test data
├── docker/                       # Docker-related files
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
└── docs/                         # Documentation
```

## Module Organization

### Backend Modules
Each module follows a consistent structure:
```
modules/[module-name]/
├── index.ts                      # Module exports
├── [module].service.ts           # Core business logic
├── [module].controller.ts        # HTTP request handlers
├── [module].types.ts             # Module-specific types
├── [module].validation.ts        # Input validation schemas
└── [module].test.ts              # Unit tests
```

### Frontend Components
Components are organized by feature and reusability:
```
web/src/components/
├── common/                       # Shared UI components
│   ├── Button/
│   ├── Modal/
│   └── LoadingSpinner/
├── containers/                   # Container-specific components
│   ├── ContainerList/
│   ├── ContainerCard/
│   └── ContainerActions/
└── appstore/                     # App store components
    ├── AppGrid/
    ├── AppCard/
    └── AppInstaller/
```

## Naming Conventions

### Files & Directories
- **Directories**: lowercase with hyphens (`container-manager/`)
- **TypeScript files**: camelCase with descriptive suffixes (`.service.ts`, `.controller.ts`, `.types.ts`)
- **React components**: PascalCase directories with index files (`Button/index.tsx`)
- **Test files**: Same name as source with `.test.ts` suffix

### Code Conventions
- **Interfaces**: PascalCase with descriptive names (`ContainerConfig`, `AppTemplate`)
- **Services**: camelCase with Service suffix (`containerService`, `dockerService`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`, `API_ENDPOINTS`)
- **Functions**: camelCase with verb-noun pattern (`createContainer`, `validateConfig`)

## Configuration Management

### Environment Configuration
- `.env.development` - Development settings
- `.env.production` - Production settings
- `.env.test` - Test environment settings

### Application Configuration
- `config/default.json` - Default application settings
- `config/production.json` - Production overrides
- `templates/` - App template definitions in JSON format

## Plugin Architecture

Plugins extend functionality through a standardized structure:
```
src/plugins/[plugin-name]/
├── index.ts                      # Plugin entry point
├── plugin.json                   # Plugin metadata
├── routes.ts                     # Additional API routes
├── components/                   # UI components (if any)
└── types.ts                      # Plugin-specific types
```

## Testing Organization

- **Unit tests**: Co-located with source files (`*.test.ts`)
- **Integration tests**: Grouped by feature in `tests/integration/`
- **E2E tests**: User workflow scenarios in `tests/e2e/`
- **Test utilities**: Shared helpers in `tests/utils/`

## Build Artifacts

- `dist/` - Compiled TypeScript output
- `web/build/` - Built React application
- `coverage/` - Test coverage reports
- `logs/` - Application runtime logs