import { DockerService } from '@/services/docker.service';
import { DatabaseService } from '@/services/database.service';
import { WebSocketService } from '@/services/websocket.service';
import { Container, ContainerConfig, ContainerStats } from '@/types/container.types';

export class MockDockerService implements DockerService {
  async initialize(): Promise<void> {
    // Mock implementation
  }

  async destroy(): Promise<void> {
    // Mock implementation
  }

  async listContainers(): Promise<Container[]> {
    return [];
  }

  async createContainer(config: ContainerConfig): Promise<Container> {
    return {
      id: 'mock-container-id',
      name: config.name,
      status: 'created',
      image: config.image,
      created: new Date(),
      ports: config.ports,
      volumes: config.volumes
    };
  }

  async startContainer(id: string): Promise<void> {
    // Mock implementation
  }

  async stopContainer(id: string): Promise<void> {
    // Mock implementation
  }

  async restartContainer(id: string): Promise<void> {
    // Mock implementation
  }

  async removeContainer(id: string): Promise<void> {
    // Mock implementation
  }

  async getContainerLogs(id: string, options?: any): Promise<string[]> {
    return ['Mock log line 1', 'Mock log line 2'];
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    return {
      cpu: 25.5,
      memory: {
        usage: 512 * 1024 * 1024,
        limit: 1024 * 1024 * 1024,
        percentage: 50
      },
      network: {
        rxBytes: 1024,
        txBytes: 2048,
        rxPackets: 10,
        txPackets: 15
      },
      disk: {
        readBytes: 4096,
        writeBytes: 8192,
        readOps: 5,
        writeOps: 10
      },
      timestamp: new Date()
    };
  }

  async pullImage(image: string, tag = 'latest'): Promise<void> {
    // Mock implementation
  }

  async listImages(): Promise<Array<{ id: string; tags: string[]; size: number }>> {
    return [];
  }

  async removeImage(id: string): Promise<void> {
    // Mock implementation
  }

  async getDockerInfo(): Promise<any> {
    return { version: '20.10.0' };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    return {
      status: 'healthy',
      details: {
        version: '20.10.0',
        apiVersion: '1.41',
        containers: 0,
        images: 0,
        serverVersion: '20.10.0',
        operatingSystem: 'Mock OS',
        architecture: 'x86_64'
      }
    };
  }

  // Network management
  async listNetworks(): Promise<Array<{ id: string; name: string; driver: string; scope: string }>> {
    return [
      { id: 'mock-network-1', name: 'bridge', driver: 'bridge', scope: 'local' },
      { id: 'mock-network-2', name: 'host', driver: 'host', scope: 'local' }
    ];
  }

  async createNetwork(name: string, options?: any): Promise<{ id: string; name: string }> {
    return { id: 'mock-network-id', name };
  }

  async removeNetwork(id: string): Promise<void> {
    // Mock implementation
  }

  // Volume management
  async listVolumes(): Promise<Array<{ name: string; driver: string; mountpoint: string }>> {
    return [
      { name: 'mock-volume-1', driver: 'local', mountpoint: '/var/lib/docker/volumes/mock-volume-1' }
    ];
  }

  async createVolume(name: string, options?: any): Promise<{ name: string; mountpoint: string }> {
    return { name, mountpoint: `/var/lib/docker/volumes/${name}` };
  }

  async removeVolume(name: string): Promise<void> {
    // Mock implementation
  }

  // Port and resource utilities
  async getUsedPorts(): Promise<number[]> {
    return [80, 443, 8080];
  }

  async validateHostPath(path: string): Promise<{ exists: boolean; accessible: boolean; isDirectory: boolean }> {
    return { exists: true, accessible: true, isDirectory: true };
  }
}

export class MockDatabaseService implements DatabaseService {
  private data: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async destroy(): Promise<void> {
    this.data.clear();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return [];
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return undefined;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return { lastID: 1, changes: 1 };
  }

  async close(): Promise<void> {
    // Mock implementation
  }
}

export class MockWebSocketService implements WebSocketService {
  async initialize(): Promise<void> {
    // Mock implementation
  }

  async destroy(): Promise<void> {
    // Mock implementation
  }

  broadcast(event: string, data: any): void {
    // Mock implementation
  }

  broadcastToRoom(room: string, event: string, data: any): void {
    // Mock implementation
  }

  getConnectedClients(): number {
    return 0;
  }
}