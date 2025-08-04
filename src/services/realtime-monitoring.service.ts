import { EventEmitter } from 'events';
import { WebSocketService } from './websocket.service';
import { DockerService } from './docker.service';
import { MonitoringService } from '@/modules/monitoring/monitoring.service';
import { WebSocketEventManager } from './websocket-event-manager';
import { Container } from '@/types/container.types';
import { logger } from '@/utils/logger';

export interface RealTimeMonitoringService {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  // Container monitoring
  startContainerMonitoring(containerId: string): void;
  stopContainerMonitoring(containerId: string): void;
  
  // System monitoring
  startSystemMonitoring(): void;
  stopSystemMonitoring(): void;
  
  // Log streaming
  startLogStreaming(containerId: string): void;
  stopLogStreaming(containerId: string): void;
  
  // Status monitoring
  startStatusMonitoring(): void;
  stopStatusMonitoring(): void;
}

export class RealTimeMonitoringServiceImpl extends EventEmitter implements RealTimeMonitoringService {
  private websocketService: WebSocketService;
  private dockerService: DockerService;
  private monitoringService: MonitoringService;
  private websocketEventManager: WebSocketEventManager;
  
  private containerMonitors: Map<string, NodeJS.Timeout> = new Map();
  private systemMonitorInterval: NodeJS.Timeout | null = null;
  private logStreamers: Map<string, NodeJS.Timeout> = new Map();
  private statusMonitorInterval: NodeJS.Timeout | null = null;
  
  private containerStatusCache: Map<string, string> = new Map();
  
  constructor(
    websocketService: WebSocketService,
    dockerService: DockerService,
    monitoringService: MonitoringService,
    websocketEventManager: WebSocketEventManager
  ) {
    super();
    this.websocketService = websocketService;
    this.dockerService = dockerService;
    this.monitoringService = monitoringService;
    this.websocketEventManager = websocketEventManager;
  }

  async initialize(): Promise<void> {
    // Start system-wide monitoring by default
    this.startSystemMonitoring();
    this.startStatusMonitoring();
    
    logger.info('Real-time monitoring service initialized');
  }

  async destroy(): Promise<void> {
    // Stop all monitoring
    this.stopSystemMonitoring();
    this.stopStatusMonitoring();
    
    // Stop all container monitors
    this.containerMonitors.forEach((interval, containerId) => {
      this.stopContainerMonitoring(containerId);
    });
    
    // Stop all log streamers
    this.logStreamers.forEach((interval, containerId) => {
      this.stopLogStreaming(containerId);
    });
    
    this.removeAllListeners();
    logger.info('Real-time monitoring service destroyed');
  }

  startContainerMonitoring(containerId: string): void {
    if (this.containerMonitors.has(containerId)) {
      return; // Already monitoring
    }

    const monitorContainer = async () => {
      try {
        const stats = await this.dockerService.getContainerStats(containerId);
        const containers = await this.dockerService.listContainers();
        const container = containers.find(c => c.id === containerId);
        
        if (container) {
          this.websocketService.broadcastToRoom(`container:${containerId}`, 'metrics:container', {
            containerId,
            containerName: container.name,
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
          });
        }
      } catch (error) {
        logger.error(`Error monitoring container ${containerId}:`, error);
        // Stop monitoring if container doesn't exist
        this.stopContainerMonitoring(containerId);
      }
    };

    // Monitor every 5 seconds
    const interval = setInterval(monitorContainer, 5000);
    this.containerMonitors.set(containerId, interval);
    
    logger.debug(`Started monitoring container: ${containerId}`);
  }

  stopContainerMonitoring(containerId: string): void {
    const interval = this.containerMonitors.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.containerMonitors.delete(containerId);
      logger.debug(`Stopped monitoring container: ${containerId}`);
    }
  }

  startSystemMonitoring(): void {
    if (this.systemMonitorInterval) {
      return; // Already monitoring
    }

    const monitorSystem = async () => {
      try {
        const systemMetrics = await this.monitoringService.getSystemMetrics();
        
        this.websocketService.broadcastToRoom('metrics', 'metrics:system', {
          timestamp: new Date().toISOString(),
          metrics: systemMetrics
        });
      } catch (error) {
        logger.error('Error collecting system metrics:', error);
        
        this.websocketService.broadcastToRoom('metrics', 'error', {
          timestamp: new Date().toISOString(),
          error: {
            code: 'SYSTEM_METRICS_ERROR',
            message: 'Failed to collect system metrics',
            details: error instanceof Error ? error.message : String(error)
          }
        });
      }
    };

    // Monitor every 10 seconds
    this.systemMonitorInterval = setInterval(monitorSystem, 10000);
    logger.debug('Started system monitoring');
  }

  stopSystemMonitoring(): void {
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
      this.systemMonitorInterval = null;
      logger.debug('Stopped system monitoring');
    }
  }

  startLogStreaming(containerId: string): void {
    if (this.logStreamers.has(containerId)) {
      return; // Already streaming
    }

    const streamLogs = async () => {
      try {
        const logs = await this.monitoringService.getHistoricalLogs(containerId, {
          tail: 10,
          since: new Date(Date.now() - 5000) // Last 5 seconds
        });

        if (logs.length > 0) {
          const containers = await this.dockerService.listContainers();
          const container = containers.find(c => c.id === containerId);
          
          this.websocketService.broadcastToRoom(`logs:${containerId}`, 'container:logs', {
            containerId,
            containerName: container?.name || 'unknown',
            timestamp: new Date().toISOString(),
            logs: logs.map(log => log.message),
            stream: 'stdout'
          });
        }
      } catch (error) {
        logger.error(`Error streaming logs for container ${containerId}:`, error);
        // Stop streaming if container doesn't exist
        this.stopLogStreaming(containerId);
      }
    };

    // Stream logs every 2 seconds
    const interval = setInterval(streamLogs, 2000);
    this.logStreamers.set(containerId, interval);
    
    logger.debug(`Started log streaming for container: ${containerId}`);
  }

  stopLogStreaming(containerId: string): void {
    const interval = this.logStreamers.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.logStreamers.delete(containerId);
      logger.debug(`Stopped log streaming for container: ${containerId}`);
    }
  }

  startStatusMonitoring(): void {
    if (this.statusMonitorInterval) {
      return; // Already monitoring
    }

    const monitorStatus = async () => {
      try {
        const containers = await this.dockerService.listContainers();
        
        for (const container of containers) {
          const previousStatus = this.containerStatusCache.get(container.id);
          const currentStatus = container.status;
          
          if (previousStatus && previousStatus !== currentStatus) {
            // Status changed, broadcast update
            this.websocketService.broadcast('container:status', {
              containerId: container.id,
              containerName: container.name,
              timestamp: new Date().toISOString(),
              status: currentStatus,
              previousStatus
            });
            
            this.websocketService.broadcastToRoom('containers', 'container:status', {
              containerId: container.id,
              containerName: container.name,
              timestamp: new Date().toISOString(),
              status: currentStatus,
              previousStatus
            });
            
            this.websocketService.broadcastToRoom(`container:${container.id}`, 'container:status', {
              containerId: container.id,
              containerName: container.name,
              timestamp: new Date().toISOString(),
              status: currentStatus,
              previousStatus
            });
            
            logger.info(`Container status changed: ${container.name} (${container.id}) ${previousStatus} -> ${currentStatus}`);
          }
          
          // Update cache
          this.containerStatusCache.set(container.id, currentStatus);
        }
        
        // Remove containers that no longer exist from cache
        const existingContainerIds = new Set(containers.map(c => c.id));
        for (const [cachedId] of this.containerStatusCache) {
          if (!existingContainerIds.has(cachedId)) {
            this.containerStatusCache.delete(cachedId);
          }
        }
        
      } catch (error) {
        logger.error('Error monitoring container status:', error);
      }
    };

    // Monitor status every 3 seconds
    this.statusMonitorInterval = setInterval(monitorStatus, 3000);
    logger.debug('Started container status monitoring');
  }

  stopStatusMonitoring(): void {
    if (this.statusMonitorInterval) {
      clearInterval(this.statusMonitorInterval);
      this.statusMonitorInterval = null;
      logger.debug('Stopped container status monitoring');
    }
  }
}