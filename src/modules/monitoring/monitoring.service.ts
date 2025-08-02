import { ContainerStats, Container } from '@/types/container.types';
import { SystemMetrics, HealthStatus } from '@/types/api.types';
import { DockerService } from '@/services/docker.service';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';

export interface MonitoringService {
  getContainerMetrics(id: string): Promise<ContainerStats>;
  getSystemMetrics(): Promise<SystemMetrics>;
  streamLogs(id: string, options?: { tail?: number; follow?: boolean; timestamps?: boolean }): EventEmitter;
  checkHealth(id: string): Promise<HealthStatus>;
  startMetricsCollection(): void;
  stopMetricsCollection(): void;
  streamContainerStats(id: string): EventEmitter;
  getAllContainerMetrics(): Promise<Map<string, ContainerStats>>;
  exportLogs(id: string, options?: { since?: Date; until?: Date; timestamps?: boolean }): Promise<string>;
  getHistoricalLogs(id: string, options?: { tail?: number; since?: Date; until?: Date; timestamps?: boolean }): Promise<Array<{ timestamp: Date; message: string }>>;
  downloadLogs(id: string, format?: 'json' | 'text', options?: { since?: Date; until?: Date; timestamps?: boolean }): Promise<{ filename: string; content: string; mimeType: string }>;
  streamLogsAdvanced(id: string, options?: { tail?: number; follow?: boolean; timestamps?: boolean; since?: Date; filter?: string }): Promise<EventEmitter>;
  checkContainerHealth(id: string): Promise<HealthStatus>;
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

  streamLogs(id: string, options?: { tail?: number; follow?: boolean; timestamps?: boolean }): EventEmitter {
    const emitter = new EventEmitter();
    let logInterval: NodeJS.Timeout | null = null;
    let lastLogTimestamp: Date | undefined;

    const startLogStreaming = async () => {
      try {
        // Verify container exists
        const containers = await this.dockerService.listContainers();
        const container = containers.find(c => c.id === id);
        
        if (!container) {
          emitter.emit('error', new MonitoringServiceError(`Container ${id} not found`));
          return;
        }

        // Get initial logs
        const initialLogs = await this.dockerService.getContainerLogs(id, {
          tail: options?.tail || 100,
          timestamps: options?.timestamps || true,
          follow: false
        });

        // Emit initial logs
        initialLogs.forEach(log => {
          emitter.emit('log', {
            timestamp: new Date(),
            message: log,
            containerId: id,
            containerName: container.name
          });
        });

        // Set up streaming if follow is enabled
        if (options?.follow) {
          lastLogTimestamp = new Date();
          
          logInterval = setInterval(async () => {
            try {
              const newLogs = await this.dockerService.getContainerLogs(id, {
                since: lastLogTimestamp,
                timestamps: options?.timestamps || true,
                follow: false
              });

              if (newLogs.length > 0) {
                lastLogTimestamp = new Date();
                newLogs.forEach(log => {
                  emitter.emit('log', {
                    timestamp: new Date(),
                    message: log,
                    containerId: id,
                    containerName: container.name
                  });
                });
              }
            } catch (error) {
              emitter.emit('error', new MonitoringServiceError(
                `Failed to stream logs for container ${id}`,
                error as Error
              ));
            }
          }, 1000); // Check for new logs every second
        }

        emitter.on('stop', () => {
          if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
          }
        });

      } catch (error) {
        emitter.emit('error', new MonitoringServiceError(
          `Failed to start log streaming for container ${id}`,
          error as Error
        ));
      }
    };

    // Start streaming asynchronously
    setImmediate(startLogStreaming);

    return emitter;
  }

  async checkHealth(id: string): Promise<HealthStatus> {
    try {
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id);
      
      if (!container) {
        return {
          status: 'unknown',
          checks: [{
            name: 'container-exists',
            status: 'fail',
            message: `Container ${id} not found`
          }],
          timestamp: new Date()
        };
      }

      const checks: Array<{
        name: string;
        status: 'pass' | 'fail' | 'warn';
        message?: string;
      }> = [];

      // Check container status
      if (container.status === 'running') {
        checks.push({
          name: 'container-status',
          status: 'pass',
          message: 'Container is running'
        });
      } else {
        checks.push({
          name: 'container-status',
          status: 'fail',
          message: `Container is ${container.status}`
        });
      }

      // Check resource usage if container is running
      if (container.status === 'running') {
        try {
          const stats = await this.dockerService.getContainerStats(id);
          
          // Check CPU usage
          if (stats.cpu > 90) {
            checks.push({
              name: 'cpu-usage',
              status: 'warn',
              message: `High CPU usage: ${stats.cpu.toFixed(1)}%`
            });
          } else {
            checks.push({
              name: 'cpu-usage',
              status: 'pass',
              message: `CPU usage: ${stats.cpu.toFixed(1)}%`
            });
          }

          // Check memory usage
          if (stats.memory.percentage > 90) {
            checks.push({
              name: 'memory-usage',
              status: 'warn',
              message: `High memory usage: ${stats.memory.percentage.toFixed(1)}%`
            });
          } else {
            checks.push({
              name: 'memory-usage',
              status: 'pass',
              message: `Memory usage: ${stats.memory.percentage.toFixed(1)}%`
            });
          }

          // Check if container has been restarting recently
          const containerAge = Date.now() - container.created.getTime();
          if (containerAge < 300000) { // Less than 5 minutes old
            checks.push({
              name: 'container-stability',
              status: 'warn',
              message: 'Container was recently created/restarted'
            });
          } else {
            checks.push({
              name: 'container-stability',
              status: 'pass',
              message: 'Container has been stable'
            });
          }

        } catch (error) {
          checks.push({
            name: 'resource-monitoring',
            status: 'warn',
            message: 'Unable to retrieve resource metrics'
          });
        }
      }

      // Determine overall health status
      const hasFailures = checks.some(check => check.status === 'fail');
      const hasWarnings = checks.some(check => check.status === 'warn');
      
      let overallStatus: 'healthy' | 'unhealthy' | 'unknown';
      if (hasFailures) {
        overallStatus = 'unhealthy';
      } else if (hasWarnings) {
        overallStatus = 'unhealthy'; // Treat warnings as unhealthy for now
      } else {
        overallStatus = 'healthy';
      }

      return {
        status: overallStatus,
        checks,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'unknown',
        checks: [{
          name: 'health-check-error',
          status: 'fail',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        timestamp: new Date()
      };
    }
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

  async exportLogs(id: string, options?: { since?: Date; until?: Date; timestamps?: boolean }): Promise<string> {
    try {
      // Verify container exists
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id);
      
      if (!container) {
        throw new MonitoringServiceError(`Container ${id} not found`);
      }

      // Get logs with specified options
      const logs = await this.dockerService.getContainerLogs(id, {
        since: options?.since,
        until: options?.until,
        timestamps: options?.timestamps || true,
        tail: 0 // Get all logs for export
      });

      // Format logs for export
      const exportData = {
        containerId: id,
        containerName: container.name,
        exportedAt: new Date().toISOString(),
        options: {
          since: options?.since?.toISOString(),
          until: options?.until?.toISOString(),
          timestamps: options?.timestamps
        },
        logs: logs
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      // Re-throw MonitoringServiceError as-is to preserve specific error messages
      if (error instanceof MonitoringServiceError) {
        throw error;
      }
      throw new MonitoringServiceError(
        `Failed to export logs for container ${id}`,
        error as Error
      );
    }
  }

  async getHistoricalLogs(id: string, options?: { tail?: number; since?: Date; until?: Date; timestamps?: boolean }): Promise<Array<{ timestamp: Date; message: string }>> {
    try {
      // Verify container exists
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id);
      
      if (!container) {
        throw new MonitoringServiceError(`Container ${id} not found`);
      }

      // Get logs with specified options
      const logs = await this.dockerService.getContainerLogs(id, {
        since: options?.since,
        until: options?.until,
        timestamps: options?.timestamps !== false, // Default to true
        tail: options?.tail || 1000
      });

      // Parse logs into structured format
      return logs.map(log => {
        let timestamp = new Date();
        let message = log;

        // If timestamps are enabled, try to parse them
        if (options?.timestamps !== false) {
          const timestampMatch = log.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
          if (timestampMatch && timestampMatch[1] && timestampMatch[2]) {
            timestamp = new Date(timestampMatch[1]);
            message = timestampMatch[2];
          }
        }

        return {
          timestamp,
          message: message.trim()
        };
      }).filter(entry => entry.message.length > 0);
    } catch (error) {
      throw new MonitoringServiceError(
        `Failed to get historical logs for container ${id}`,
        error as Error
      );
    }
  }

  async downloadLogs(id: string, format: 'json' | 'text' = 'text', options?: { since?: Date; until?: Date; timestamps?: boolean }): Promise<{ filename: string; content: string; mimeType: string }> {
    try {
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id);
      
      if (!container) {
        throw new MonitoringServiceError(`Container ${id} not found`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filename: string;
      let content: string;
      let mimeType: string;

      if (format === 'json') {
        filename = `${container.name}-logs-${timestamp}.json`;
        content = await this.exportLogs(id, options);
        mimeType = 'application/json';
      } else {
        filename = `${container.name}-logs-${timestamp}.txt`;
        const logs = await this.dockerService.getContainerLogs(id, {
          since: options?.since,
          until: options?.until,
          timestamps: options?.timestamps || true,
          tail: 0
        });
        
        const header = [
          `Container: ${container.name} (${id})`,
          `Exported: ${new Date().toISOString()}`,
          `Options: ${JSON.stringify(options || {})}`,
          '='.repeat(80),
          ''
        ].join('\n');
        
        content = header + logs.join('\n');
        mimeType = 'text/plain';
      }

      return { filename, content, mimeType };
    } catch (error) {
      throw new MonitoringServiceError(
        `Failed to download logs for container ${id}`,
        error as Error
      );
    }
  }

  async streamLogsAdvanced(id: string, options?: { 
    tail?: number; 
    follow?: boolean; 
    timestamps?: boolean;
    since?: Date;
    filter?: string; // Regex pattern to filter log lines
  }): Promise<EventEmitter> {
    const emitter = new EventEmitter();
    let logInterval: NodeJS.Timeout | null = null;
    let lastLogTimestamp: Date | undefined;
    let filterRegex: RegExp | undefined;

    // Compile filter regex if provided
    if (options?.filter) {
      try {
        filterRegex = new RegExp(options.filter, 'i');
      } catch (error) {
        // Emit error on next tick to allow error handler to be attached
        setImmediate(() => {
          emitter.emit('error', new MonitoringServiceError(`Invalid filter regex: ${options.filter}`));
        });
        return emitter;
      }
    }

    const startLogStreaming = async () => {
      try {
        // Verify container exists
        const containers = await this.dockerService.listContainers();
        const container = containers.find(c => c.id === id);
        
        if (!container) {
          emitter.emit('error', new MonitoringServiceError(`Container ${id} not found`));
          return;
        }

        // Get initial logs
        const initialLogs = await this.dockerService.getContainerLogs(id, {
          tail: options?.tail || 100,
          timestamps: options?.timestamps || true,
          since: options?.since,
          follow: false
        });

        // Process and emit initial logs
        initialLogs.forEach(log => {
          const logEntry = this.parseLogEntry(log, container, options?.timestamps);
          
          // Apply filter if specified
          if (!filterRegex || filterRegex.test(logEntry.message)) {
            emitter.emit('log', logEntry);
          }
        });

        // Set up streaming if follow is enabled
        if (options?.follow) {
          lastLogTimestamp = new Date();
          
          logInterval = setInterval(async () => {
            try {
              const newLogs = await this.dockerService.getContainerLogs(id, {
                since: lastLogTimestamp,
                timestamps: options?.timestamps || true,
                follow: false
              });

              if (newLogs.length > 0) {
                lastLogTimestamp = new Date();
                newLogs.forEach(log => {
                  const logEntry = this.parseLogEntry(log, container, options?.timestamps);
                  
                  // Apply filter if specified
                  if (!filterRegex || filterRegex.test(logEntry.message)) {
                    emitter.emit('log', logEntry);
                  }
                });
              }
            } catch (error) {
              emitter.emit('error', new MonitoringServiceError(
                `Failed to stream logs for container ${id}`,
                error as Error
              ));
            }
          }, 1000); // Check for new logs every second
        }

        emitter.on('stop', () => {
          if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
          }
        });

      } catch (error) {
        emitter.emit('error', new MonitoringServiceError(
          `Failed to start log streaming for container ${id}`,
          error as Error
        ));
      }
    };

    // Start streaming asynchronously
    setImmediate(startLogStreaming);

    return emitter;
  }

  async checkContainerHealth(id: string): Promise<HealthStatus> {
    try {
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id);
      
      if (!container) {
        return {
          status: 'unknown',
          checks: [{
            name: 'container-exists',
            status: 'fail',
            message: `Container ${id} not found`
          }],
          timestamp: new Date()
        };
      }

      const checks: Array<{
        name: string;
        status: 'pass' | 'fail' | 'warn';
        message?: string;
      }> = [];

      // Check container status
      if (container.status === 'running') {
        checks.push({
          name: 'container-status',
          status: 'pass',
          message: 'Container is running'
        });

        // Additional health checks for running containers
        try {
          const stats = await this.dockerService.getContainerStats(id);
          
          // Check CPU usage
          if (stats.cpu > 95) {
            checks.push({
              name: 'cpu-usage',
              status: 'fail',
              message: `Critical CPU usage: ${stats.cpu.toFixed(1)}%`
            });
          } else if (stats.cpu > 80) {
            checks.push({
              name: 'cpu-usage',
              status: 'warn',
              message: `High CPU usage: ${stats.cpu.toFixed(1)}%`
            });
          } else {
            checks.push({
              name: 'cpu-usage',
              status: 'pass',
              message: `CPU usage: ${stats.cpu.toFixed(1)}%`
            });
          }

          // Check memory usage
          if (stats.memory.percentage > 95) {
            checks.push({
              name: 'memory-usage',
              status: 'fail',
              message: `Critical memory usage: ${stats.memory.percentage.toFixed(1)}%`
            });
          } else if (stats.memory.percentage > 80) {
            checks.push({
              name: 'memory-usage',
              status: 'warn',
              message: `High memory usage: ${stats.memory.percentage.toFixed(1)}%`
            });
          } else {
            checks.push({
              name: 'memory-usage',
              status: 'pass',
              message: `Memory usage: ${stats.memory.percentage.toFixed(1)}%`
            });
          }

          // Check container stability (recent restarts)
          const containerAge = Date.now() - container.created.getTime();
          if (containerAge < 60000) { // Less than 1 minute old
            checks.push({
              name: 'container-stability',
              status: 'warn',
              message: 'Container was recently created/restarted'
            });
          } else if (containerAge < 300000) { // Less than 5 minutes old
            checks.push({
              name: 'container-stability',
              status: 'warn',
              message: 'Container may be unstable (recently restarted)'
            });
          } else {
            checks.push({
              name: 'container-stability',
              status: 'pass',
              message: 'Container has been stable'
            });
          }

          // Check for excessive disk I/O
          const diskIORate = (stats.disk.readOps + stats.disk.writeOps) / 60; // Operations per second (assuming 1-minute window)
          if (diskIORate > 1000) {
            checks.push({
              name: 'disk-io',
              status: 'warn',
              message: `High disk I/O: ${diskIORate.toFixed(0)} ops/sec`
            });
          } else {
            checks.push({
              name: 'disk-io',
              status: 'pass',
              message: `Disk I/O: ${diskIORate.toFixed(0)} ops/sec`
            });
          }

        } catch (error) {
          checks.push({
            name: 'resource-monitoring',
            status: 'warn',
            message: 'Unable to retrieve resource metrics'
          });
        }

        // Check for recent error logs
        try {
          const recentLogs = await this.dockerService.getContainerLogs(id, {
            since: new Date(Date.now() - 300000), // Last 5 minutes
            tail: 50,
            timestamps: true
          });

          const errorLogs = recentLogs.filter(log => 
            log.toLowerCase().includes('error') || 
            log.toLowerCase().includes('exception') ||
            log.toLowerCase().includes('fatal')
          );

          if (errorLogs.length > 10) {
            checks.push({
              name: 'error-logs',
              status: 'fail',
              message: `High error rate: ${errorLogs.length} errors in last 5 minutes`
            });
          } else if (errorLogs.length > 0) {
            checks.push({
              name: 'error-logs',
              status: 'warn',
              message: `${errorLogs.length} errors found in recent logs`
            });
          } else {
            checks.push({
              name: 'error-logs',
              status: 'pass',
              message: 'No recent errors in logs'
            });
          }
        } catch (error) {
          checks.push({
            name: 'log-analysis',
            status: 'warn',
            message: 'Unable to analyze recent logs'
          });
        }

      } else {
        checks.push({
          name: 'container-status',
          status: 'fail',
          message: `Container is ${container.status}`
        });
      }

      // Determine overall health status
      const hasFailures = checks.some(check => check.status === 'fail');
      const hasWarnings = checks.some(check => check.status === 'warn');
      
      let overallStatus: 'healthy' | 'unhealthy' | 'unknown';
      if (hasFailures) {
        overallStatus = 'unhealthy';
      } else if (hasWarnings) {
        overallStatus = 'unhealthy'; // Treat warnings as unhealthy for safety
      } else {
        overallStatus = 'healthy';
      }

      return {
        status: overallStatus,
        checks,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'unknown',
        checks: [{
          name: 'health-check-error',
          status: 'fail',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        timestamp: new Date()
      };
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

  private parseLogEntry(log: string, container: Container, includeTimestamp?: boolean): {
    timestamp: Date;
    message: string;
    containerId: string;
    containerName: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
  } {
    let timestamp = new Date();
    let message = log;
    let level: 'info' | 'warn' | 'error' | 'debug' | undefined;

    // Parse timestamp if included
    if (includeTimestamp) {
      const timestampMatch = log.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
      if (timestampMatch && timestampMatch[1] && timestampMatch[2]) {
        timestamp = new Date(timestampMatch[1]);
        message = timestampMatch[2];
      }
    }

    // Try to detect log level from message content
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('err:') || lowerMessage.includes('fatal')) {
      level = 'error';
    } else if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) {
      level = 'warn';
    } else if (lowerMessage.includes('debug') || lowerMessage.includes('trace')) {
      level = 'debug';
    } else {
      level = 'info';
    }

    return {
      timestamp,
      message: message.trim(),
      containerId: container.id,
      containerName: container.name,
      level
    };
  }
}