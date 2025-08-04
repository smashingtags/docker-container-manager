import { EventEmitter } from 'events';
import { WebSocketService } from './websocket.service';
import { DockerService } from './docker.service';
import { MonitoringService } from '@/modules/monitoring/monitoring.service';
import { 
  ContainerStatusEvent, 
  ContainerEvent, 
  ContainerLogsEvent, 
  ContainerMetricsEvent,
  SystemMetricsEvent,
  WebSocketRoom 
} from '@/types';
import { logger } from '@/utils/logger';

export interface WebSocketEventManager {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  // Container event handlers
  onContainerCreated(containerId: string, containerName: string): void;
  onContainerStarted(containerId: string, containerName: string): void;
  onContainerStopped(containerId: string, containerName: string): void;
  onContainerRemoved(containerId: string, containerName: string): void;
  onContainerStatusChanged(containerId: string, containerName: string, status: string, previousStatus?: string): void;
  
  // Log streaming
  startLogStreaming(containerId: string): void;
  stopLogStreaming(containerId: string): void;
  
  // Metrics streaming
  startContainerMetricsStreaming(containerId: string): void;
  stopContainerMetricsStreaming(containerId: string): void;
}

export class WebSocketEventManagerImpl extends EventEmitter implements WebSocketEventManager {
  private websocketService: WebSocketService;
  private dockerService: DockerService;
  private monitoringService: MonitoringService;
  private logStreams: Map<string, NodeJS.Timeout> = new Map();
  private metricsStreams: Map<string, NodeJS.Timeout> = new Map();
  private systemMetricsInterval: NodeJS.Timeout | null = null;

  constructor(
    websocketService: WebSocketService,
    dockerService: DockerService,
    monitoringService: MonitoringService
  ) {
    super();
    this.websocketService = websocketService;
    this.dockerService = dockerService;
    this.monitoringService = monitoringService;
  }

  async initialize(): Promise<void> {
    // Set up WebSocket service event listeners
    this.websocketService.on('metrics:collect', this.handleMetricsCollection.bind(this));
    
    // Set up Docker service event listeners for container status changes
    this.dockerService.on('container:created', this.onContainerCreated.bind(this));
    this.dockerService.on('container:started', this.onContainerStarted.bind(this));
    this.dockerService.on('container:stopped', this.onContainerStopped.bind(this));
    this.dockerService.on('container:removed', this.onContainerRemoved.bind(this));
    this.dockerService.on('container:status', this.onContainerStatusChanged.bind(this));
    
    logger.info('WebSocket event manager initialized');
  }

  async destroy(): Promise<void> {
    // Clear all streaming intervals
    this.logStreams.forEach((interval) => clearInterval(interval));
    this.metricsStreams.forEach((interval) => clearInterval(interval));
    this.logStreams.clear();
    this.metricsStreams.clear();
    
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = null;
    }
    
    this.removeAllListeners();
    logger.info('WebSocket event manager destroyed');
  }

  onContainerCreated(containerId: string, containerName: string): void {
    const event: ContainerEvent = {
      containerId,
      containerName,
      timestamp: new Date().toISOString()
    };

    this.websocketService.broadcast('container:created', event);
    this.websocketService.broadcastToRoom('containers', 'container:created', event);
    this.websocketService.broadcastToRoom(`container:${containerId}`, 'container:created', event);
    
    logger.debug(`Container created event broadcasted: ${containerName} (${containerId})`);
  }

  onContainerStarted(containerId: string, containerName: string): void {
    const event: ContainerEvent = {
      containerId,
      containerName,
      timestamp: new Date().toISOString()
    };

    this.websocketService.broadcast('container:started', event);
    this.websocketService.broadcastToRoom('containers', 'container:started', event);
    this.websocketService.broadcastToRoom(`container:${containerId}`, 'container:started', event);
    
    logger.debug(`Container started event broadcasted: ${containerName} (${containerId})`);
  }

  onContainerStopped(containerId: string, containerName: string): void {
    const event: ContainerEvent = {
      containerId,
      containerName,
      timestamp: new Date().toISOString()
    };

    this.websocketService.broadcast('container:stopped', event);
    this.websocketService.broadcastToRoom('containers', 'container:stopped', event);
    this.websocketService.broadcastToRoom(`container:${containerId}`, 'container:stopped', event);
    
    // Stop any active streaming for this container
    this.stopLogStreaming(containerId);
    this.stopContainerMetricsStreaming(containerId);
    
    logger.debug(`Container stopped event broadcasted: ${containerName} (${containerId})`);
  }

  onContainerRemoved(containerId: string, containerName: string): void {
    const event: ContainerEvent = {
      containerId,
      containerName,
      timestamp: new Date().toISOString()
    };

    this.websocketService.broadcast('container:removed', event);
    this.websocketService.broadcastToRoom('containers', 'container:removed', event);
    this.websocketService.broadcastToRoom(`container:${containerId}`, 'container:removed', event);
    
    // Stop any active streaming for this container
    this.stopLogStreaming(containerId);
    this.stopContainerMetricsStreaming(containerId);
    
    logger.debug(`Container removed event broadcasted: ${containerName} (${containerId})`);
  }

  onContainerStatusChanged(containerId: string, containerName: string, status: string, previousStatus?: string): void {
    const event: ContainerStatusEvent = {
      containerId,
      containerName,
      timestamp: new Date().toISOString(),
      status: status as any,
      previousStatus
    };

    this.websocketService.broadcast('container:status', event);
    this.websocketService.broadcastToRoom('containers', 'container:status', event);
    this.websocketService.broadcastToRoom(`container:${containerId}`, 'container:status', event);
    
    logger.debug(`Container status changed: ${containerName} (${containerId}) ${previousStatus} -> ${status}`);
  }

  startLogStreaming(containerId: string): void {
    if (this.logStreams.has(containerId)) {
      return; // Already streaming
    }

    const streamLogs = async () => {
      try {
        const logs = await this.monitoringService.getHistoricalLogs(containerId, { 
          tail: 10,
          since: new Date(Date.now() - 60000) // Last minute
        });

        if (logs.length > 0) {
          const event: ContainerLogsEvent = {
            containerId,
            containerName: '', // Will be filled by monitoring service
            timestamp: new Date().toISOString(),
            logs: logs.map(log => log.message),
            stream: 'stdout'
          };

          this.websocketService.broadcastToRoom(`logs:${containerId}`, 'container:logs', event);
          this.websocketService.broadcastToRoom('logs', 'container:logs', event);
        }
      } catch (error) {
        logger.error(`Error streaming logs for container ${containerId}:`, error);
      }
    };

    // Stream logs every 2 seconds
    const interval = setInterval(streamLogs, 2000);
    this.logStreams.set(containerId, interval);
    
    logger.debug(`Started log streaming for container: ${containerId}`);
  }

  stopLogStreaming(containerId: string): void {
    const interval = this.logStreams.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.logStreams.delete(containerId);
      logger.debug(`Stopped log streaming for container: ${containerId}`);
    }
  }

  startContainerMetricsStreaming(containerId: string): void {
    if (this.metricsStreams.has(containerId)) {
      return; // Already streaming
    }

    const streamMetrics = async () => {
      try {
        const stats = await this.dockerService.getContainerStats(containerId);
        
        const event: ContainerMetricsEvent = {
          containerId,
          containerName: '', // Will be filled by docker service
          timestamp: new Date().toISOString(),
          metrics: {
            cpu: stats.cpu,
            memory: stats.memory,
            network: {
              rx_bytes: stats.network.rxBytes,
              tx_bytes: stats.network.txBytes
            },
            disk: {
              read_bytes: stats.disk.readBytes,
              write_bytes: stats.disk.writeBytes
            }
          }
        };

        this.websocketService.broadcastToRoom(`container:${containerId}`, 'metrics:container', event);
        this.websocketService.broadcastToRoom('metrics', 'metrics:container', event);
      } catch (error) {
        logger.error(`Error streaming metrics for container ${containerId}:`, error);
      }
    };

    // Stream metrics every 5 seconds
    const interval = setInterval(streamMetrics, 5000);
    this.metricsStreams.set(containerId, interval);
    
    logger.debug(`Started metrics streaming for container: ${containerId}`);
  }

  stopContainerMetricsStreaming(containerId: string): void {
    const interval = this.metricsStreams.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.metricsStreams.delete(containerId);
      logger.debug(`Stopped metrics streaming for container: ${containerId}`);
    }
  }

  private async handleMetricsCollection(): Promise<void> {
    try {
      // Collect system metrics
      const systemMetrics = await this.monitoringService.getSystemMetrics();
      
      const event: SystemMetricsEvent = {
        timestamp: new Date().toISOString(),
        metrics: systemMetrics
      };

      this.websocketService.broadcastToRoom('metrics', 'metrics:system', event);
      
      // Collect metrics for all running containers
      const containers = await this.dockerService.listContainers();
      const runningContainers = containers.filter(c => c.status === 'running');
      
      for (const container of runningContainers) {
        // Only stream metrics if there are clients subscribed to this container
        const containerRoom: WebSocketRoom = `container:${container.id}`;
        if (this.websocketService.getClientsInRoom(containerRoom) > 0) {
          this.startContainerMetricsStreaming(container.id);
        }
      }
      
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      
      this.websocketService.broadcastToRoom('metrics', 'error', {
        timestamp: new Date().toISOString(),
        error: {
          code: 'METRICS_COLLECTION_ERROR',
          message: 'Failed to collect system metrics',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
}