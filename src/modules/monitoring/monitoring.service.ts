import { ContainerStats } from '@/types/container.types';
import { SystemMetrics, HealthStatus } from '@/types/api.types';
import { EventEmitter } from 'events';

export interface MonitoringService {
  getContainerMetrics(id: string): Promise<ContainerStats>;
  getSystemMetrics(): Promise<SystemMetrics>;
  streamLogs(id: string): EventEmitter;
  checkHealth(id: string): Promise<HealthStatus>;
  startMetricsCollection(): void;
  stopMetricsCollection(): void;
}

export class MonitoringServiceImpl implements MonitoringService {
  private metricsInterval: NodeJS.Timeout | null = null;

  async getContainerMetrics(id: string): Promise<ContainerStats> {
    // Implementation will be added in task 5.1
    throw new Error('Not implemented');
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    // Implementation will be added in task 5.1
    throw new Error('Not implemented');
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
    // Implementation will be added in task 5.1
    throw new Error('Not implemented');
  }

  stopMetricsCollection(): void {
    // Implementation will be added in task 5.1
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}