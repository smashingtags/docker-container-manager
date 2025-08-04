# Docker Container Manager - Web UI

This is the React frontend for the Docker Container Manager application.

## Features

- **Dashboard**: Overview of container status and system metrics
- **Container Management**: Start, stop, restart, and remove containers
- **App Store**: Browse and deploy applications from templates
- **Real-time Updates**: WebSocket-based live updates for container status and metrics

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Socket.io Client** for real-time communication

## Development

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Build for production:
```bash
npm run build
```

### Environment Variables

Create a `.env` file with the following variables:

```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=http://localhost:3000
REACT_APP_ENV=development
```

## Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Shared components
│   ├── containers/     # Container-specific components
│   └── appstore/       # App store components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── stores/             # Zustand state stores
├── services/           # API and WebSocket services
└── types/              # TypeScript type definitions
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (not recommended)

## API Integration

The frontend communicates with the backend API at `/api` endpoints:

- `/api/containers` - Container management
- `/api/apps` - App store functionality
- `/api/ws` - WebSocket connection for real-time updates