// WebSocket event types for real-time communication

export interface WebSocketEvents {
  // Container events
  'container:status': ContainerStatusEvent;
  'container:created': ContainerEvent;
  'container:started': ContainerEvent;
  'container:stopped': ContainerEvent;
  'container:removed': ContainerEvent;
  'container:logs': ContainerLogsEvent;
  
  // Metrics events
  'metrics:container': ContainerMetricsEvent;
  'metrics:system': SystemMetricsEvent;
  
  // General events
  'error': ErrorEvent;
  'connected': ConnectedEvent;
  'disconnected': DisconnectedEvent;
}

export interface ContainerEvent {
  containerId: string;
  containerName: string;
  timestamp: string;
  data?: any;
}

export interface ContainerStatusEvent extends ContainerEvent {
  status: 'running' | 'stopped' | 'paused' | 'restarting' | 'created' | 'exited';
  previousStatus?: string;
}

export interface ContainerLogsEvent extends ContainerEvent {
  logs: string[];
  stream: 'stdout' | 'stderr';
}

export interface ContainerMetricsEvent extends ContainerEvent {
  metrics: {
    cpu: number;
    memory: {
      usage: number;
      limit: number;
      percentage: number;
    };
    network: {
      rx_bytes: number;
      tx_bytes: number;
    };
    disk: {
      read_bytes: number;
      write_bytes: number;
    };
  };
}

export interface SystemMetricsEvent {
  timestamp: string;
  metrics: {
    cpu: {
      usage: number;
      cores: number;
    };
    memory: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    disk: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    containers: {
      total: number;
      running: number;
      stopped: number;
    };
  };
}

export interface ErrorEvent {
  timestamp: string;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ConnectedEvent {
  timestamp: string;
  clientId: string;
}

export interface DisconnectedEvent {
  timestamp: string;
  clientId: string;
  reason?: string;
}

// WebSocket room types
export type WebSocketRoom = 
  | 'containers'           // General container updates
  | 'metrics'             // System and container metrics
  | 'logs'                // Container logs
  | `container:${string}` // Specific container updates
  | `logs:${string}`;     // Specific container logs

// Client subscription preferences
export interface ClientSubscription {
  rooms: WebSocketRoom[];
  containerId?: string;
  metricsInterval?: number; // milliseconds
}