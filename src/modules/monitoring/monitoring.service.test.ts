import { MonitoringServiceImpl, MonitoringServiceError } from './monitoring.service';
import { DockerService } from '@/services/docker.service';
import { ContainerStats, Container } from '@/types/container.types';
import { SystemMetrics } from '@/types/api.types';
import * as os from 'os';

// Mock the os module
jest.mock('os');
jest.mock('fs/promises');

describe('MonitoringService', () => {
  let monitoringService: MonitoringServiceImpl;
  let mockDockerService: jest.Mocked<DockerService>;

  const mockContainerStats: ContainerStats = {
    cpu: 25.5,
    memory: {
      usage: 536870912, // 512MB
      limit: 1073741824, // 1GB
      percentage: 50.0
    },
    network: {
      rxBytes: 1024,
      txBytes: 2048,
      rxPackets: 10,
      txPackets: 20
    },
    disk: {
      readBytes: 4096,
      writeBytes: 8192,
      readOps: 5,
      writeOps: 10
    },
    timestamp: new Date('2023-01-01T00:00:00Z')
  };

  const mockContainer: Container = {
    id: 'container123',
    name: 'test-container',
    status: 'running',
    image: 'nginx:latest',
    created: new Date('2023-01-01T00:00:00Z'),
    ports: [],
    volumes: []
  };

  beforeEach(() => {
    // Create mock docker service
    mockDockerService = {
      getContainerStats: jest.fn(),
      listContainers: jest.fn(),
      initialize: jest.fn(),
      destroy: jest.fn(),
      listImages: jest.fn(),
      pullImage: jest.fn(),
      removeImage: jest.fn(),
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      restartContainer: jest.fn(),
      removeContainer: jest.fn(),
      getContainerLogs: jest.fn(),
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
    };

    monitoringService = new MonitoringServiceImpl(mockDockerService);

    // Mock os module functions
    (os.cpus as jest.Mock).mockReturnValue([
      {
        times: {
          user: 1000,
          nice: 100,
          sys: 500,
          idle: 8000,
          irq: 50
        }
      },
      {
        times: {
          user: 1200,
          nice: 80,
          sys: 600,
          idle: 7800,
          irq: 70
        }
      }
    ]);

    (os.totalmem as jest.Mock).mockReturnValue(8589934592); // 8GB
    (os.freemem as jest.Mock).mockReturnValue(4294967296); // 4GB
  });

  afterEach(() => {
    monitoringService.stopMetricsCollection();
    jest.clearAllMocks();
  });

  describe('getContainerMetrics', () => {
    it('should return container metrics from docker service', async () => {
      mockDockerService.getContainerStats.mockResolvedValue(mockContainerStats);

      const result = await monitoringService.getContainerMetrics('container123');

      expect(result).toEqual(mockContainerStats);
      expect(mockDockerService.getContainerStats).toHaveBeenCalledWith('container123');
    });

    it('should cache container metrics', async () => {
      // Create a fresh stats object for each call to ensure different timestamps
      const createMockStats = () => ({
        ...mockContainerStats,
        timestamp: new Date()
      });
      
      mockDockerService.getContainerStats.mockResolvedValue(createMockStats());

      // First call
      const result1 = await monitoringService.getContainerMetrics('container123');
      // Second call (should use cache)
      const result2 = await monitoringService.getContainerMetrics('container123');

      expect(mockDockerService.getContainerStats).toHaveBeenCalledTimes(1);
      // Results should be the same object from cache
      expect(result1).toBe(result2);
    });

    it('should throw MonitoringServiceError when docker service fails', async () => {
      const dockerError = new Error('Docker connection failed');
      mockDockerService.getContainerStats.mockRejectedValue(dockerError);

      await expect(monitoringService.getContainerMetrics('container123'))
        .rejects.toThrow(MonitoringServiceError);
      await expect(monitoringService.getContainerMetrics('container123'))
        .rejects.toThrow('Failed to get metrics for container container123');
    });
  });

  describe('getSystemMetrics', () => {
    beforeEach(() => {
      mockDockerService.listContainers.mockResolvedValue([
        { ...mockContainer, status: 'running' },
        { ...mockContainer, id: 'container456', status: 'stopped' }
      ]);
    });

    it('should return system metrics', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result).toMatchObject({
        cpu: {
          usage: expect.any(Number),
          cores: 2
        },
        memory: {
          total: 8589934592,
          used: 4294967296,
          free: 4294967296,
          percentage: 50
        },
        disk: {
          total: expect.any(Number),
          used: expect.any(Number),
          free: expect.any(Number),
          percentage: expect.any(Number)
        },
        containers: {
          total: 2,
          running: 1,
          stopped: 1
        },
        timestamp: expect.any(Date)
      });
    });

    it('should calculate CPU usage correctly', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.cpu.cores).toBe(2);
      expect(result.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(result.cpu.usage).toBeLessThanOrEqual(100);
    });

    it('should throw error when docker service fails', async () => {
      mockDockerService.listContainers.mockRejectedValue(new Error('Docker error'));

      await expect(monitoringService.getSystemMetrics())
        .rejects.toThrow(MonitoringServiceError);
    });
  });

  describe('getAllContainerMetrics', () => {
    it('should return metrics for all running containers', async () => {
      const containers = [
        { ...mockContainer, id: 'container1', status: 'running' as const },
        { ...mockContainer, id: 'container2', status: 'running' as const },
        { ...mockContainer, id: 'container3', status: 'stopped' as const }
      ];

      mockDockerService.listContainers.mockResolvedValue(containers);
      mockDockerService.getContainerStats
        .mockResolvedValueOnce({ ...mockContainerStats, cpu: 10 })
        .mockResolvedValueOnce({ ...mockContainerStats, cpu: 20 });

      const result = await monitoringService.getAllContainerMetrics();

      expect(result.size).toBe(2);
      expect(result.get('container1')?.cpu).toBe(10);
      expect(result.get('container2')?.cpu).toBe(20);
      expect(result.has('container3')).toBe(false);
    });

    it('should handle individual container errors gracefully', async () => {
      const containers = [
        { ...mockContainer, id: 'container1', status: 'running' as const },
        { ...mockContainer, id: 'container2', status: 'running' as const }
      ];

      mockDockerService.listContainers.mockResolvedValue(containers);
      mockDockerService.getContainerStats
        .mockResolvedValueOnce(mockContainerStats)
        .mockRejectedValueOnce(new Error('Container error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await monitoringService.getAllContainerMetrics();

      expect(result.size).toBe(1);
      expect(result.has('container1')).toBe(true);
      expect(result.has('container2')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get metrics for container container2:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('streamContainerStats', () => {
    it('should stream container stats for running container', (done) => {
      mockDockerService.listContainers.mockResolvedValue([mockContainer]);
      mockDockerService.getContainerStats.mockResolvedValue(mockContainerStats);

      const stream = monitoringService.streamContainerStats('container123');

      stream.on('stats', (stats) => {
        expect(stats).toEqual(mockContainerStats);
        stream.emit('stop');
        done();
      });

      stream.on('error', done);
    });

    it('should emit error for non-existent container', (done) => {
      mockDockerService.listContainers.mockResolvedValue([]);

      const stream = monitoringService.streamContainerStats('nonexistent');

      stream.on('error', (error) => {
        expect(error.message).toBe('Container nonexistent not found');
        done();
      });
    });

    it('should emit error for stopped container', (done) => {
      const stoppedContainer = { ...mockContainer, status: 'stopped' as const };
      mockDockerService.listContainers.mockResolvedValue([stoppedContainer]);

      const stream = monitoringService.streamContainerStats('container123');

      stream.on('error', (error) => {
        expect(error.message).toBe('Container container123 is not running');
        done();
      });
    });
  });

  describe('metrics collection lifecycle', () => {
    it('should start and stop metrics collection', () => {
      expect(monitoringService['metricsInterval']).toBeNull();

      monitoringService.startMetricsCollection();
      expect(monitoringService['metricsInterval']).not.toBeNull();

      monitoringService.stopMetricsCollection();
      expect(monitoringService['metricsInterval']).toBeNull();
    });

    it('should not start multiple intervals', () => {
      monitoringService.startMetricsCollection();
      const firstInterval = monitoringService['metricsInterval'];

      monitoringService.startMetricsCollection();
      const secondInterval = monitoringService['metricsInterval'];

      expect(firstInterval).toBe(secondInterval);
      
      monitoringService.stopMetricsCollection();
    });

    it('should emit system metrics during collection', (done) => {
      mockDockerService.listContainers.mockResolvedValue([]);

      const timeout = setTimeout(() => {
        monitoringService.stopMetricsCollection();
        done(new Error('Timeout waiting for system metrics'));
      }, 10000);

      monitoringService.onMetrics((data) => {
        if (data.cpu && data.memory && data.disk && data.containers) {
          clearTimeout(timeout);
          expect(data).toMatchObject({
            cpu: expect.any(Object),
            memory: expect.any(Object),
            disk: expect.any(Object),
            containers: expect.any(Object),
            timestamp: expect.any(Date)
          });
          monitoringService.stopMetricsCollection();
          done();
        }
      });

      monitoringService.startMetricsCollection();
    }, 15000);

    it('should emit container metrics during collection', (done) => {
      mockDockerService.listContainers.mockResolvedValue([mockContainer]);
      mockDockerService.getContainerStats.mockResolvedValue(mockContainerStats);

      const timeout = setTimeout(() => {
        monitoringService.stopMetricsCollection();
        done(new Error('Timeout waiting for container metrics'));
      }, 10000);

      monitoringService.onMetrics((data) => {
        if (data.containerId) {
          clearTimeout(timeout);
          expect(data).toMatchObject({
            containerId: 'container123',
            containerName: 'test-container',
            stats: mockContainerStats
          });
          monitoringService.stopMetricsCollection();
          done();
        }
      });

      monitoringService.startMetricsCollection();
    }, 15000);

    it('should handle errors during metrics collection', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDockerService.listContainers.mockRejectedValue(new Error('Docker error'));

      const timeout = setTimeout(() => {
        monitoringService.stopMetricsCollection();
        consoleSpy.mockRestore();
        done(new Error('Timeout waiting for metrics error'));
      }, 10000);

      monitoringService.onMetricsError((error) => {
        clearTimeout(timeout);
        expect(error.message).toBe('Failed to get system metrics');
        expect(consoleSpy).toHaveBeenCalledWith('Error during metrics collection:', error);
        monitoringService.stopMetricsCollection();
        consoleSpy.mockRestore();
        done();
      });

      monitoringService.startMetricsCollection();
    }, 15000);
  });

  describe('error handling', () => {
    it('should wrap docker service errors in MonitoringServiceError', async () => {
      const dockerError = new Error('Docker daemon not available');
      mockDockerService.getContainerStats.mockRejectedValue(dockerError);

      await expect(monitoringService.getContainerMetrics('container123'))
        .rejects.toThrow(MonitoringServiceError);
    });

    it('should handle system metrics collection errors', async () => {
      mockDockerService.listContainers.mockRejectedValue(new Error('Docker error'));

      await expect(monitoringService.getSystemMetrics())
        .rejects.toThrow(MonitoringServiceError);
    });
  });

  describe('caching behavior', () => {
    it('should respect cache TTL', async () => {
      mockDockerService.getContainerStats.mockResolvedValue(mockContainerStats);

      // First call
      await monitoringService.getContainerMetrics('container123');
      
      // Mock time passage beyond TTL
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 15000); // 15 seconds later

      // Second call should bypass cache
      await monitoringService.getContainerMetrics('container123');

      expect(mockDockerService.getContainerStats).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = originalNow;
    });
  });
});