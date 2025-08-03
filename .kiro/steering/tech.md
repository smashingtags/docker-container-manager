# Technology Stack & Build System

## Backend Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with modular routing
- **Docker Integration**: dockerode library for Docker API communication
- **Database**: SQLite for configuration storage
- **Real-time**: Socket.io for WebSocket communication
- **Process Management**: PM2 for production deployment

## Frontend Stack
- **Framework**: React with TypeScript
- **State Management**: Zustand (lightweight Redux alternative)
- **Styling**: Tailwind CSS with Headless UI components
- **Real-time**: Socket.io client for live updates

## Development Tools
- **Language**: TypeScript for type safety
- **Linting**: ESLint with TypeScript rules
- **Testing**: Jest for unit/integration tests, Playwright for E2E
- **Build**: Standard TypeScript compiler (tsc)

## Infrastructure
- **Containerization**: Docker for application deployment
- **Reverse Proxy**: Nginx (optional, for production)
- **Target Platform**: Linux-based systems with Docker installed

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start

# Docker deployment
docker build -t docker-container-manager .
docker-compose up -d

# Process management
pm2 start ecosystem.config.js
pm2 restart docker-container-manager
pm2 logs docker-container-manager
```

## Key Dependencies
- **dockerode**: Docker Engine API client
- **express**: Web application framework
- **socket.io**: Real-time bidirectional communication
- **sqlite3**: Embedded database
- **joi** or **zod**: Schema validation
- **react**: UI framework
- **tailwindcss**: Utility-first CSS framework