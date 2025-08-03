import { MonitoringServiceImpl } from './monitoring.service';
import { DockerServiceImpl } from '@/services/docker.service';
import { ContainerStats } from '@/types/container.types';

describe('MonitoringService Integration Tests', () => {
  let monitoringService: MonitoringServiceImpl;
  let dockerService: DockerServiceImpl;

  beforeAll(async () => {
    dockerService = new DockerServiceImpl();
    
    try {
      await dockerService.initialize();
      monitoringService = new MonitoringServiceImpl(dockerService);
    } catch (error) {
      console.log('Docker not available, skipping integration tests');
      return;
    }
  });

  afterAll(async () => {
    if (dockerService) {
      await dockerService.destroy();
    }
    if (monitoringService) {
      monitoringService.stopMetricsCollection();
    }
  });

  beforeEach(() => {
    if (!dockerService) {
      pending('Docker not available');
    }
  });

  describe('real Docker integration', () => {
    it('should get system metrics from real system', async () => {
      const metrics = await monitoringService.getSystemMetrics();

      expect(metrics).toMatchObject({
        cpu: {
          usage: expect.any(Number),
          cores: expect.any(Number)
        },
        memory: {
          total: expect.any(Number),
          used: expect.any(Number),
          free: expect.any(Number),
          percentage: expect.any(Number)
        },
        disk: {
          total: expect.any(Number),
          used: expect.any(Number),
          free: expect.any(Number),
          percentage: expect.any(Number)
        },
        containers: {
          total: expect.any(Number),
          running: expect.any(Number),
          stopped: expect.any(Number)
        },
        timestamp: expect.any(Date)
      });

      // Validate ranges
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
      expect(metrics.cpu.cores).toBeGreaterThan(0);
      
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.used).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.free).toBeGreaterThanOrEqual(0);
      
      expect(metrics.containers.total).toBeGreaterThanOrEqual(0);
      expect(metrics.containers.running).toBeGreaterThanOrEqual(0);
      expect(metrics.containers.stopped).toBeGreaterThanOrEqual(0);
      expect(metrics.containers.total).toBe(metrics.containers.running + metrics.containers.stopped);
    });

    it('should get all container metrics', async () => {
      const metricsMap = await monitoringService.getAllContainerMetrics();

      expect(metricsMap).toBeInstanceOf(Map);
      
      // If there are running containers, validate their metrics
      if (metricsMap.size > 0) {
        for (const [containerId, stats] of metricsMap) {
          expect(typeof containerId).toBe('string');
          expect(containerId.length).toBeGreaterThan(0);
          
          expect(stats).toMatchObject({
            cpu: expect.any(Number),
            memory: {
              usage: expect.any(Number),
              limit: expect.any(Number),
              percentage: expect.any(Number)
            },
            network: {
              rxBytes: expect.any(Number),
              txBytes: expect.any(Number),
              rxPackets: expect.any(Number),
              txPackets: expect.any(Number)
            },
            disk: {
              readBytes: expect.any(Number),
              writeBytes: expect.any(Number),
              readOps: expect.any(Number),
              writeOps: expect.any(Number)
            },
            timestamp: expect.any(Date)
          });

          // Validate ranges
          expect(stats.cpu).toBeGreaterThanOrEqual(0);
          expect(stats.memory.usage).toBeGreaterThanOrEqual(0);
          expect(stats.memory.limit).toBeGreaterThanOrEqual(0);
          expect(stats.memory.percentage).toBeGreaterThanOrEqual(0);
          expect(stats.memory.percentage).toBeLessThanOrEqual(100);
          expect(stats.network.rxBytes).toBeGreaterThanOrEqual(0);
          expect(stats.network.txBytes).toBeGreaterThanOrEqual(0);
          expect(stats.disk.readBytes).toBeGreaterThanOrEqual(0);
          expect(stats.disk.writeBytes).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle metrics collection lifecycle', (done) => {
      let systemMetricsReceived = false;
      let containerMetricsReceived = false;

      const timeout = setTimeout(() => {
        monitoringService.stopMetricsCollection();
        
        // At minimum, we should receive system metrics
        expect(systemMetricsReceived).toBe(true);
        done();
      }, 10000); // 10 second timeout

      monitoringService.onMetrics((data) => {
        if (data.cpu && data.memory && data.disk && data.containers) {
          systemMetricsReceived = true;
        } else if (data.containerId && data.stats) {
          containerMetricsReceived = true;
        }

        // If we've received both types or just system metrics after some time
        if (systemMetricsReceived && (containerMetricsReceived || Date.now() > Date.now() + 7000)) {
          clearTimeout(timeout);
          monitoringService.stopMetricsCollection();
          done();
        }
      });

      monitoringService.startMetricsCollection();
    });

    it('should stream container stats if containers are running', async () => {
      const containers = await dockerService.listContainers();
      const runningContainers = containers.filter(c => c.status === 'running');

      if (runningContainers.length === 0) {
        console.log('No running containers found, skipping stream test');
        return;
      }

      const containerId = runningContainers[0]!.id;
      
      return new Promise<void>((resolve, reject) => {
        const stream = monitoringService.streamContainerStats(containerId);
        let statsReceived = 0;

        const timeout = setTimeout(() => {
          stream.emit('stop');
          if (statsReceived > 0) {
            resolve();
          } else {
            reject(new Error('No stats received within timeout'));
          }
        }, 8000);

        stream.on('stats', (stats: ContainerStats) => {
          statsReceived++;
          
          expect(stats).toMatchObject({
            cpu: expect.any(Number),
            memory: expect.objectContaining({
              usage: expect.any(Number),
              limit: expect.any(Number),
              percentage: expect.any(Number)
            }),
            network: expect.objectContaining({
              rxBytes: expect.any(Number),
              txBytes: expect.any(Number)
            }),
            disk: expect.objectContaining({
              readBytes: expect.any(Number),
              writeBytes: expect.any(Number)
            }),
            timestamp: expect.any(Date)
          });

          if (statsReceived >= 2) {
            clearTimeout(timeout);
            stream.emit('stop');
            resolve();
          }
        });

        stream.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should handle errors gracefully for non-existent containers', async () => {
      const nonExistentId = 'nonexistent-container-id';
      
      await expect(monitoringService.getContainerMetrics(nonExistentId))
        .rejects.toThrow();
    });
  });

  describe('performance and reliability', () => {
    it('should handle concurrent metrics requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        monitoringService.getSystemMetrics()
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toMatchObject({
          cpu: expect.any(Object),
          memory: expect.any(Object),
          disk: expect.any(Object),
          containers: expect.any(Object),
          timestamp: expect.any(Date)
        });
      });
    });

    it('should cache container metrics effectively', async () => {
      const containers = await dockerService.listContainers();
      const runningContainers = containers.filter(c => c.status === 'running');

      if (runningContainers.length === 0) {
        console.log('No running containers found, skipping cache test');
        return;
      }

      const containerId = runningContainers[0]!.id;
      
      const start = Date.now();
      
      // First call - should hit Docker API
      await monitoringService.getContainerMetrics(containerId);
      const firstCallTime = Date.now() - start;
      
      const secondStart = Date.now();
      
      // Second call - should use cache
      await monitoringService.getContainerMetrics(containerId);
      const secondCallTime = Date.now() - secondStart;
      
      // Cache should be significantly faster
      expect(secondCallTime).toBeLessThan(firstCallTime);
      expect(secondCallTime).toBeLessThan(100); // Should be very fast from cache
    });
  });
});