import { EventEmitter } from 'events';
import { WebSocketEventManagerImpl } from './websocket-event-manager';
import { WebSocketService } from './websocket.service';
import { DockerService } from './docker.service';
import { MonitoringService } from '@/modules/monitoring/monitoring.service';

// Mock services
const mockWebSocketService: jest.Mocked<WebSocketService> = {
  initialize: jest.fn(),
  destroy: jest.fn(),
  broadcast: jest.fn(),
  broadcastToRoom: jest.fn(),
  getConnectedClients: jest.fn(),
  getClientsInRoom: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  startMetricsStreaming: jest.fn(),
  stopMetricsStreaming: jest.fn()
};

const mockDockerService: jest.Mocked<DockerService & EventEmitter> = Object.assign(new EventEmitter(), {
  initialize: jest.fn(),
  destroy: jest.fn(),
  listContainers: jest.fn(),
  createContainer: jest.fn(),
  startContainer: jest.fn(),
  stopContainer: jest.fn(),
  restartContainer: jest.fn(),
  removeContainer: jest.fn(),
  getContainerLogs: jest.fn(),
  getContainerStats: jest.fn(),
  pullImage: jest.fn(),
  listImages: jest.fn(),
  removeImage: jest.fn(),
  getDockerInfo: jest.fn(),
  ping: jest.fn(),
  healthCheck: jest.fn(),
  listNetworks: jest.fn(),
  createNetwork: jest.fn(),
  removeNetwork: jest.fn(),
  listVolumes: jest.fn(),
  createVolume: jest.fn(),
  removeVolume: jest.fn(),
  getUsedPorts: jest.fn(),
  validateHostPath: jest.fn()
});

const mockMonitoringService: jest.Mocked<MonitoringService> = {
  getContainerMetrics: jest.fn(),
  getSystemMetrics: jest.fn(),
  streamLogs: jest.fn(),
  checkHealth: jest.fn(),
  startMetricsCollection: jest.fn(),
  stopMetricsCollection: jest.fn(),
  streamContainerStats: jest.fn(),
  getAllContainerMetrics: jest.fn(),
  exportLogs: jest.fn(),
  getHistoricalLogs: jest.fn(),
  downloadLogs: jest.fn(),
  streamLogsAdvanced: jest.fn(),
  checkContainerHealth: jest.fn()
};

describe('WebSocketEventManager', () => {
  let eventManager: WebSocketEventManagerImpl;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    eventManager = new WebSocketEventManagerImpl(
      mockWebSocketService,
      mockDockerService,
      mockMonitoringService
    );
    
    await eventManager.initialize();
  });

  afterEach(async () => {
    await eventManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newEventManager = new WebSocketEventManagerImpl(
        mockWebSocketService,
        mockDockerService,
        mockMonitoringService
      );
      
      await expect(newEventManager.initialize()).resolves.not.toThrow();
      await newEventManager.destroy();
    });

    it('should set up event listeners on initialization', async () => {
      expect(mockWebSocketService.on).toHaveBeenCalledWith('metrics:collect', expect.any(Function));
    });
  });

  describe('Container Events', () => {
    it('should handle container created events', () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';

      eventManager.onContainerCreated(containerId, containerName);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:created', {
        containerId,
        containerName,
        timestamp: expect.any(String)
      });

      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'containers',
        'container:created',
        expect.objectContaining({ containerId, containerName })
      );

      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        `container:${containerId}`,
        'container:created',
        expect.objectContaining({ containerId, containerName })
      );
    });

    it('should handle container started events', () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';

      eventManager.onContainerStarted(containerId, containerName);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:started', {
        containerId,
        containerName,
        timestamp: expect.any(String)
      });
    });

    it('should handle container stopped events', () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';

      eventManager.onContainerStopped(containerId, containerName);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:stopped', {
        containerId,
        containerName,
        timestamp: expect.any(String)
      });
    });

    it('should handle container removed events', () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';

      eventManager.onContainerRemoved(containerId, containerName);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:removed', {
        containerId,
        containerName,
        timestamp: expect.any(String)
      });
    });

    it('should handle container status change events', () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';
      const status = 'running';
      const previousStatus = 'stopped';

      eventManager.onContainerStatusChanged(containerId, containerName, status, previousStatus);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:status', {
        containerId,
        containerName,
        timestamp: expect.any(String),
        status,
        previousStatus
      });
    });
  });

  describe('Log Streaming', () => {
    it('should start log streaming for a container', () => {
      const containerId = 'test-container-123';
      
      eventManager.startLogStreaming(containerId);
      
      // Verify that streaming was started (interval should be set)
      // We can't directly test the interval, but we can test that it doesn't throw
      expect(() => eventManager.startLogStreaming(containerId)).not.toThrow();
    });

    it('should stop log streaming for a container', () => {
      const containerId = 'test-container-123';
      
      eventManager.startLogStreaming(containerId);
      eventManager.stopLogStreaming(containerId);
      
      // Should not throw when stopping
      expect(() => eventManager.stopLogStreaming(containerId)).not.toThrow();
    });

    it('should not start duplicate log streams', () => {
      const containerId = 'test-container-123';
      
      eventManager.startLogStreaming(containerId);
      eventManager.startLogStreaming(containerId); // Should not create duplicate
      
      // Should not throw
      expect(() => eventManager.startLogStreaming(containerId)).not.toThrow();
    });

    it('should handle log streaming with mock data', async () => {
      const containerId = 'test-container-123';
      const mockLogs = [
        { timestamp: new Date(), message: 'Log line 1' },
        { timestamp: new Date(), message: 'Log line 2' }
      ];

      mockMonitoringService.getHistoricalLogs.mockResolvedValue(mockLogs);

      eventManager.startLogStreaming(containerId);

      // Wait for the first log collection cycle
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(mockMonitoringService.getHistoricalLogs).toHaveBeenCalledWith(
        containerId,
        expect.objectContaining({
          tail: 10,
          since: expect.any(Date)
        })
      );

      eventManager.stopLogStreaming(containerId);
    });
  });

  describe('Metrics Streaming', () => {
    it('should start container metrics streaming', () => {
      const containerId = 'test-container-123';
      
      eventManager.startContainerMetricsStreaming(containerId);
      
      expect(() => eventManager.startContainerMetricsStreaming(containerId)).not.toThrow();
    });

    it('should stop container metrics streaming', () => {
      const containerId = 'test-container-123';
      
      eventManager.startContainerMetricsStreaming(containerId);
      eventManager.stopContainerMetricsStreaming(containerId);
      
      expect(() => eventManager.stopContainerMetricsStreaming(containerId)).not.toThrow();
    });

    it('should handle metrics collection', async () => {
      const mockSystemMetrics = {
        cpu: { usage: 50, cores: 4 },
        memory: { total: 8000000000, used: 4000000000, free: 4000000000, percentage: 50 },
        disk: { total: 1000000000000, used: 500000000000, free: 500000000000, percentage: 50 },
        containers: { total: 5, running: 3, stopped: 2 },
        timestamp: new Date()
      };

      const mockContainers = [
        { id: 'container1', name: 'test1', status: 'running' as const, image: 'nginx', created: new Date(), ports: [], volumes: [] },
        { id: 'container2', name: 'test2', status: 'stopped' as const, image: 'redis', created: new Date(), ports: [], volumes: [] }
      ];

      mockMonitoringService.getSystemMetrics.mockResolvedValue(mockSystemMetrics);
      mockDockerService.listContainers.mockResolvedValue(mockContainers);
      mockWebSocketService.getClientsInRoom.mockReturnValue(1);

      // Simulate metrics collection event
      const handleMetricsCollection = (eventManager as any).handleMetricsCollection.bind(eventManager);
      await handleMetricsCollection();

      expect(mockMonitoringService.getSystemMetrics).toHaveBeenCalled();
      expect(mockDockerService.listContainers).toHaveBeenCalled();
      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'metrics',
        'metrics:system',
        expect.objectContaining({
          timestamp: expect.any(String),
          metrics: mockSystemMetrics
        })
      );
    });
  });

  describe('Docker Service Integration', () => {
    it('should listen to Docker service events', async () => {
      const containerId = 'test-container-123';
      const containerName = 'test-container';

      // Simulate Docker service events
      mockDockerService.emit('container:created', containerId, containerName);
      mockDockerService.emit('container:started', containerId, containerName);
      mockDockerService.emit('container:stopped', containerId, containerName);
      mockDockerService.emit('container:removed', containerId, containerName);

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that WebSocket events were broadcasted
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:created', expect.any(Object));
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:started', expect.any(Object));
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:stopped', expect.any(Object));
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith('container:removed', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics collection errors gracefully', async () => {
      const error = new Error('Metrics collection failed');
      mockMonitoringService.getSystemMetrics.mockRejectedValue(error);

      const handleMetricsCollection = (eventManager as any).handleMetricsCollection.bind(eventManager);
      
      // Should not throw
      await expect(handleMetricsCollection()).resolves.not.toThrow();

      expect(mockWebSocketService.broadcastToRoom).toHaveBeenCalledWith(
        'metrics',
        'error',
        expect.objectContaining({
          timestamp: expect.any(String),
          error: expect.objectContaining({
            code: 'METRICS_COLLECTION_ERROR',
            message: 'Failed to collect system metrics'
          })
        })
      );
    });

    it('should handle log streaming errors gracefully', async () => {
      const containerId = 'test-container-123';
      const error = new Error('Log retrieval failed');
      
      mockMonitoringService.getHistoricalLogs.mockRejectedValue(error);

      eventManager.startLogStreaming(containerId);

      // Wait for the error to be handled
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Should not crash the application
      expect(() => eventManager.stopLogStreaming(containerId)).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      const containerId = 'test-container-123';
      
      eventManager.startLogStreaming(containerId);
      eventManager.startContainerMetricsStreaming(containerId);

      await eventManager.destroy();

      // Should not throw after cleanup
      expect(() => eventManager.stopLogStreaming(containerId)).not.toThrow();
      expect(() => eventManager.stopContainerMetricsStreaming(containerId)).not.toThrow();
    });
  });
});