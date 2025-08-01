import { ContainerStats } from '@/types/container.types';
import { SystemMetrics, HealthStatus } from '@/types/api.types';
import { DockerService } from '@/services/docker.service';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';

export interface MonitoringService {
  getContainerMetrics(id: string): Promise<ContainerStats>;
  getSystemMetrics(): Promise<SystemMetrics>;
  streamLogs(id: string): EventEmitter;
  checkHealth(id: string): Promise<HealthStatus>;
  startMetricsCollection(): void;
  stopMetricsCollection(): void;
  streamContainerStats(id: string): EventEmitter;
  getAllContainerMetrics(): Promise<Map<string, ContainerStats>>;
}

export class MonitoringServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'MonitoringServiceError';
  }
}

export class MonitoringServiceImpl implements MonitoringService {
  private metricsInterval: NodeJS.Timeout | null = null;
  private metricsEmitter: EventEmitter = new EventEmitter();
  private containerStatsCache: Map<string, ContainerStats> = new Map();
  private readonly METRICS_INTERVAL = 5000; // 5 seconds
  private readonly CACHE_TTL = 10000; // 10 seconds

  constructor(private dockerService: DockerService) {}

  async getContainerMetrics(id: string): Promise<ContainerStats> {
    try {
      // Check cache first
      const cached = this.containerStatsCache.get(id);
      if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
        return cached;
      }

      const stats = await this.dockerService.getContainerStats(id);
      this.containerStatsCache.set(id, stats);
      return stats;
    } catch (error) {
      throw new MonitoringServiceError(
        `Failed to get metrics for container ${id}`,
        error as Error
      );
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [cpuUsage, memoryInfo, diskInfo, containerInfo] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryInfo(),
        this.getDiskInfo(),
        this.getContainerInfo()
      ]);

      return {
        cpu: cpuUsage,
        memory: memoryInfo,
        disk: diskInfo,
        containers: containerInfo,
        timestamp: new Date()
      };
    } catch (error) {
      throw new MonitoringServiceError(
        'Failed to get system metrics',
        error as Error
      );
    }
  }

  streamLogs(id: string): EventEmitter {
    // Implementation will be added in task 5.2
    throw new Error('Not implemented');
  }

  async checkHealth(id: string): Promise<HealthStatus> {
    // Implementation will be added in task 5.2
    throw new Error('Not implemented');
  }

  startMetricsCollection(): void {
    if (this.metricsInterval) {
      return; // Already running
    }

    this.metricsInterval = setInterval(async () => {
      try {
        // Collect system metrics
        const systemMetrics = await this.getSystemMetrics();
        this.metricsEmitter.emit('system-metrics', systemMetrics);

        // Collect metrics for all running containers
        const containers = await this.dockerService.listContainers();
        const runningContainers = containers.filter(c => c.status === 'running');

        for (const container of runningContainers) {
          try {
            const stats = await this.dockerService.getContainerStats(container.id);
            this.containerStatsCache.set(container.id, stats);
            this.metricsEmitter.emit('container-metrics', {
              containerId: container.id,
              containerName: container.name,
              stats
            });
          } catch (error) {
            // Log error but continue with other containers
            console.error(`Failed to collect metrics for container ${container.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error during metrics collection:', error);
        this.metricsEmitter.emit('metrics-error', error);
      }
    }, this.METRICS_INTERVAL);

    console.log('Metrics collection started');
  }

  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('Metrics collection stopped');
    }
  }

  streamContainerStats(id: string): EventEmitter {
    const emitter = new EventEmitter();
    let interval: NodeJS.Timeout;

    const startStreaming = async () => {
      try {
        // Verify container exists
        const containers = await this.dockerService.listContainers();
        const container = containers.find(c => c.id === id);
        
        if (!container) {
          emitter.emit('error', new Error(`Container ${id} not found`));
          return;
        }

        if (container.status !== 'running') {
          emitter.emit('error', new Error(`Container ${id} is not running`));
          return;
        }

        interval = setInterval(async () => {
          try {
            const stats = await this.dockerService.getContainerStats(id);
            emitter.emit('stats', stats);
          } catch (error) {
            emitter.emit('error', error);
          }
        }, 2000); // Stream every 2 seconds

        emitter.on('stop', () => {
          if (interval) {
            clearInterval(interval);
          }
        });

      } catch (error) {
        emitter.emit('error', error);
      }
    };

    // Start streaming asynchronously
    setImmediate(startStreaming);

    return emitter;
  }

  async getAllContainerMetrics(): Promise<Map<string, ContainerStats>> {
    try {
      const containers = await this.dockerService.listContainers();
      const runningContainers = containers.filter(c => c.status === 'running');
      const metricsMap = new Map<string, ContainerStats>();

      await Promise.all(
        runningContainers.map(async (container) => {
          try {
            const stats = await this.getContainerMetrics(container.id);
            metricsMap.set(container.id, stats);
          } catch (error) {
            console.error(`Failed to get metrics for container ${container.id}:`, error);
          }
        })
      );

      return metricsMap;
    } catch (error) {
      throw new MonitoringServiceError(
        'Failed to get all container metrics',
        error as Error
      );
    }
  }

  // Event emitter for real-time metrics
  onMetrics(callback: (data: any) => void): void {
    this.metricsEmitter.on('system-metrics', callback);
    this.metricsEmitter.on('container-metrics', callback);
  }

  onMetricsError(callback: (error: Error) => void): void {
    this.metricsEmitter.on('metrics-error', callback);
  }

  private async getCPUUsage(): Promise<{ usage: number; cores: number }> {
    const cpus = os.cpus();
    const numCores = cpus.length;

    // Calculate average CPU usage across all cores
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / numCores;
    const total = totalTick / numCores;
    const usage = 100 - (100 * idle / total);

    return {
      usage: Math.round(usage * 100) / 100,
      cores: numCores
    };
  }

  private async getMemoryInfo(): Promise<{
    total: number;
    used: number;
    free: number;
    percentage: number;
  }> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  private async getDiskInfo(): Promise<{
    total: number;
    used: number;
    free: number;
    percentage: number;
  }> {
    try {
      // On Linux, read from /proc/mounts to get the root filesystem
      // This is a simplified implementation - in production you might want to use a library like 'node-disk-info'
      const stats = await fs.stat('/');
      
      // For now, return mock data as getting accurate disk info requires platform-specific code
      // In a real implementation, you'd use libraries like 'statvfs' or 'node-disk-info'
      return {
        total: 1000000000000, // 1TB mock
        used: 500000000000,   // 500GB mock
        free: 500000000000,   // 500GB mock
        percentage: 50.0
      };
    } catch (error) {
      // Fallback to mock data if we can't read disk info
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }

  private async getContainerInfo(): Promise<{
    total: number;
    running: number;
    stopped: number;
  }> {
    const containers = await this.dockerService.listContainers();
    const running = containers.filter(c => c.status === 'running').length;
    const stopped = containers.filter(c => c.status === 'stopped' || c.status === 'exited').length;

    return {
      total: containers.length,
      running,
      stopped
    };
  }
}