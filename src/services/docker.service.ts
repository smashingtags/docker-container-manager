import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { Container, ContainerConfig, ContainerStats, LogOptions, PortMapping, VolumeMapping } from '@/types/container.types';
import { ServiceInterface } from '@/types';

export interface DockerService extends ServiceInterface {
  // Event emitter methods
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  listContainers(): Promise<Container[]>;
  createContainer(config: ContainerConfig): Promise<Container>;
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  restartContainer(id: string): Promise<void>;
  removeContainer(id: string): Promise<void>;
  getContainerLogs(id: string, options?: LogOptions): Promise<string[]>;
  getContainerStats(id: string): Promise<ContainerStats>;
  pullImage(image: string, tag?: string): Promise<void>;
  listImages(): Promise<Array<{ id: string; tags: string[]; size: number }>>;
  removeImage(id: string): Promise<void>;
  getDockerInfo(): Promise<any>;
  ping(): Promise<boolean>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }>;
  
  // Network management
  listNetworks(): Promise<Array<{ id: string; name: string; driver: string; scope: string }>>;
  createNetwork(name: string, options?: any): Promise<{ id: string; name: string }>;
  removeNetwork(id: string): Promise<void>;
  
  // Volume management
  listVolumes(): Promise<Array<{ name: string; driver: string; mountpoint: string }>>;
  createVolume(name: string, options?: any): Promise<{ name: string; mountpoint: string }>;
  removeVolume(name: string): Promise<void>;
  
  // Port and resource utilities
  getUsedPorts(): Promise<number[]>;
  validateHostPath(path: string): Promise<{ exists: boolean; accessible: boolean; isDirectory: boolean }>;
}

export class DockerConnectionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DockerConnectionError';
  }
}

export class DockerOperationError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DockerOperationError';
  }
}

export class DockerServiceImpl extends EventEmitter implements DockerService {
  private docker: Docker;
  private connectionRetries = 3;
  private connectionTimeout = 5000;

  constructor(options?: Docker.DockerOptions) {
    super();
    this.docker = new Docker(options);
  }

  async initialize(): Promise<void> {
    try {
      const isHealthy = await this.ping();
      if (!isHealthy) {
        throw new DockerConnectionError('Failed to connect to Docker daemon');
      }
    } catch (error) {
      throw new DockerConnectionError(
        'Docker service initialization failed',
        error as Error
      );
    }
  }

  async destroy(): Promise<void> {
    // Cleanup if needed - dockerode doesn't require explicit cleanup
  }

  async listContainers(): Promise<Container[]> {
    try {
      const containers = await this.executeWithRetry(() => 
        this.docker.listContainers({ all: true })
      );

      return containers.map((container: any) => ({
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || 'unnamed',
        status: this.mapContainerStatus(container.State),
        image: container.Image,
        created: new Date(container.Created * 1000),
        ports: this.mapPorts(container.Ports || []),
        volumes: this.mapVolumes(container.Mounts || [])
      }));
    } catch (error) {
      throw new DockerOperationError('Failed to list containers', error as Error);
    }
  }

  async createContainer(config: ContainerConfig): Promise<Container> {
    try {
      const createOptions = this.buildCreateOptions(config);
      
      const container = await this.executeWithRetry(() =>
        this.docker.createContainer(createOptions)
      );

      const containerInfo = await this.executeWithRetry(() => container.inspect());

      const containerData = {
        id: containerInfo.Id,
        name: containerInfo.Name.replace(/^\//, ''),
        status: this.mapContainerStatus(containerInfo.State.Status),
        image: containerInfo.Config.Image,
        created: new Date(containerInfo.Created),
        ports: config.ports,
        volumes: config.volumes
      };

      // Emit container created event
      this.emit('container:created', containerData.id, containerData.name);

      return containerData;
    } catch (error) {
      throw new DockerOperationError(
        `Failed to create container ${config.name}`,
        error as Error
      );
    }
  }

  async startContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      const containerInfo = await this.executeWithRetry(() => container.inspect());
      const containerName = containerInfo.Name.replace(/^\//, '');
      
      await this.executeWithRetry(() => container.start());
      
      // Emit container started event
      this.emit('container:started', id, containerName);
      this.emit('container:status', id, containerName, 'running', containerInfo.State.Status);
    } catch (error) {
      throw new DockerOperationError(
        `Failed to start container ${id}`,
        error as Error
      );
    }
  }

  async stopContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      const containerInfo = await this.executeWithRetry(() => container.inspect());
      const containerName = containerInfo.Name.replace(/^\//, '');
      
      await this.executeWithRetry(() => container.stop());
      
      // Emit container stopped event
      this.emit('container:stopped', id, containerName);
      this.emit('container:status', id, containerName, 'stopped', containerInfo.State.Status);
    } catch (error) {
      throw new DockerOperationError(
        `Failed to stop container ${id}`,
        error as Error
      );
    }
  }

  async restartContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await this.executeWithRetry(() => container.restart());
    } catch (error) {
      throw new DockerOperationError(
        `Failed to restart container ${id}`,
        error as Error
      );
    }
  }

  async removeContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      const containerInfo = await this.executeWithRetry(() => container.inspect());
      const containerName = containerInfo.Name.replace(/^\//, '');
      
      await this.executeWithRetry(() => container.remove({ force: true }));
      
      // Emit container removed event
      this.emit('container:removed', id, containerName);
    } catch (error) {
      throw new DockerOperationError(
        `Failed to remove container ${id}`,
        error as Error
      );
    }
  }

  async getContainerLogs(id: string, options?: LogOptions): Promise<string[]> {
    try {
      const container = this.docker.getContainer(id);
      
      const logOptions: any = {
        stdout: true,
        stderr: true,
        timestamps: options?.timestamps || false,
        tail: options?.tail || 100
      };

      if (options?.since) {
        logOptions.since = Math.floor(options.since.getTime() / 1000);
      }

      if (options?.until) {
        logOptions.until = Math.floor(options.until.getTime() / 1000);
      }

      const stream = await this.executeWithRetry(async () => {
        return container.logs(logOptions) as unknown as NodeJS.ReadableStream;
      });

      // Convert stream to string and split into lines
      const logs = (stream as any).toString('utf8');
      return logs
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => {
          // Remove Docker log prefixes (8 bytes header)
          if (line.length > 8) {
            return line.substring(8);
          }
          return line;
        });
    } catch (error) {
      throw new DockerOperationError(
        `Failed to get logs for container ${id}`,
        error as Error
      );
    }
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    try {
      const container = this.docker.getContainer(id);
      
      // Get stats with stream=false to get a single snapshot
      const stats = await this.executeWithRetry(async () => {
        return new Promise<any>((resolve, reject) => {
          container.stats({ stream: false }, (err: any, data: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
      });

      return this.parseContainerStats(stats);
    } catch (error) {
      throw new DockerOperationError(
        `Failed to get stats for container ${id}`,
        error as Error
      );
    }
  }

  async pullImage(image: string, tag = 'latest'): Promise<void> {
    try {
      const imageRef = `${image}:${tag}`;
      await this.executeWithRetry(async () => {
        const stream = await this.docker.pull(imageRef);
        return new Promise<void>((resolve, reject) => {
          this.docker.modem.followProgress(stream, (err: any) => {
            if (err) {
              reject(new DockerOperationError(`Failed to pull image ${imageRef}`, err));
            } else {
              resolve();
            }
          });
        });
      });
    } catch (error) {
      throw new DockerOperationError(
        `Failed to pull image ${image}:${tag}`,
        error as Error
      );
    }
  }

  async listImages(): Promise<Array<{ id: string; tags: string[]; size: number }>> {
    try {
      const images = await this.executeWithRetry(() => this.docker.listImages());
      return images.map((image: any) => ({
        id: image.Id,
        tags: image.RepoTags || [],
        size: image.Size || 0
      }));
    } catch (error) {
      throw new DockerOperationError('Failed to list images', error as Error);
    }
  }

  async removeImage(id: string): Promise<void> {
    try {
      const image = this.docker.getImage(id);
      await this.executeWithRetry(() => image.remove());
    } catch (error) {
      throw new DockerOperationError(`Failed to remove image ${id}`, error as Error);
    }
  }

  async getDockerInfo(): Promise<any> {
    try {
      return await this.executeWithRetry(() => this.docker.info());
    } catch (error) {
      throw new DockerOperationError('Failed to get Docker info', error as Error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.executeWithRetry(() => this.docker.ping());
      return true;
    } catch (error) {
      return false;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const pingResult = await this.ping();
      if (!pingResult) {
        return {
          status: 'unhealthy',
          details: { 
            error: 'Docker daemon is not responding to ping',
            timestamp: new Date().toISOString()
          }
        };
      }

      const info = await this.getDockerInfo();
      const version = await this.executeWithRetry(() => this.docker.version());

      return {
        status: 'healthy',
        details: {
          version: version.Version,
          apiVersion: version.ApiVersion,
          containers: info.Containers,
          images: info.Images,
          serverVersion: info.ServerVersion,
          operatingSystem: info.OperatingSystem,
          architecture: info.Architecture
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private mapContainerStatus(dockerStatus: string): Container['status'] {
    switch (dockerStatus.toLowerCase()) {
      case 'running':
        return 'running';
      case 'exited':
        return 'stopped';
      case 'created':
        return 'created';
      case 'restarting':
        return 'restarting';
      case 'paused':
        return 'paused';
      default:
        return 'stopped';
    }
  }

  private mapPorts(dockerPorts: any[]): PortMapping[] {
    return dockerPorts
      .filter(port => port.PublicPort && port.PrivatePort)
      .map(port => ({
        hostPort: port.PublicPort,
        containerPort: port.PrivatePort,
        protocol: port.Type as 'tcp' | 'udp'
      }));
  }

  private mapVolumes(dockerMounts: any[]): VolumeMapping[] {
    return dockerMounts
      .filter(mount => mount.Type === 'bind' || mount.Type === 'volume')
      .map(mount => ({
        hostPath: mount.Source,
        containerPath: mount.Destination,
        mode: mount.RW ? 'rw' : 'ro'
      }));
  }

  private buildCreateOptions(config: ContainerConfig): any {
    const createOptions: any = {
      name: config.name,
      Image: `${config.image}:${config.tag}`,
      Env: Object.entries(config.environment).map(([key, value]) => `${key}=${value}`),
      Labels: config.labels || {},
      WorkingDir: config.workingDir,
      Hostname: config.hostname,
      Domainname: config.domainname,
      HostConfig: {
        RestartPolicy: {
          Name: config.restartPolicy
        },
        AutoRemove: config.autoRemove || false,
        PortBindings: {},
        Binds: [],
        NetworkMode: this.determineNetworkMode(config.networks)
      },
      NetworkingConfig: {
        EndpointsConfig: {}
      }
    };

    // Add entrypoint and command if specified
    if (config.entrypoint) {
      createOptions.Entrypoint = config.entrypoint;
    }
    if (config.command) {
      createOptions.Cmd = config.command;
    }

    // Enhanced port binding configuration
    this.configurePortBindings(config.ports, createOptions);

    // Enhanced volume binding configuration
    this.configureVolumeBindings(config.volumes, createOptions);

    // Enhanced network configuration
    this.configureNetworking(config.networks, createOptions);

    // Add resource limits
    this.configureResourceLimits(config.resources, createOptions);

    // Add security options
    if (config.security) {
      this.configureSecurityOptions(config.security, createOptions);
    }

    // Add health check
    if (config.healthCheck) {
      this.configureHealthCheck(config.healthCheck, createOptions);
    }

    return createOptions;
  }

  private determineNetworkMode(networks: string[]): string {
    if (!networks || networks.length === 0) {
      return 'bridge';
    }
    
    // Special network modes
    if (networks.includes('host')) {
      return 'host';
    }
    if (networks.includes('none')) {
      return 'none';
    }
    
    // Use the first network as the primary network mode
    return networks[0] || 'bridge';
  }

  private configurePortBindings(ports: PortMapping[], createOptions: any): void {
    ports.forEach(port => {
      const containerPort = `${port.containerPort}/${port.protocol}`;
      createOptions.HostConfig.PortBindings[containerPort] = [
        { 
          HostPort: port.hostPort.toString(),
          HostIp: '0.0.0.0' // Bind to all interfaces by default
        }
      ];
    });

    // Also expose the ports in the container configuration
    createOptions.ExposedPorts = {};
    ports.forEach(port => {
      const containerPort = `${port.containerPort}/${port.protocol}`;
      createOptions.ExposedPorts[containerPort] = {};
    });
  }

  private configureVolumeBindings(volumes: VolumeMapping[], createOptions: any): void {
    volumes.forEach(volume => {
      // Enhanced volume binding with additional options
      let bindString = `${volume.hostPath}:${volume.containerPath}:${volume.mode}`;
      
      // Add additional mount options if needed
      // For example, you could add 'Z' for SELinux labeling: `${bindString},Z`
      
      createOptions.HostConfig.Binds.push(bindString);
    });

    // Also configure Mounts for more advanced volume configuration
    createOptions.HostConfig.Mounts = volumes.map(volume => ({
      Type: 'bind',
      Source: volume.hostPath,
      Target: volume.containerPath,
      ReadOnly: volume.mode === 'ro',
      BindOptions: {
        Propagation: 'rprivate' // Default propagation mode
      }
    }));
  }

  private configureNetworking(networks: string[], createOptions: any): void {
    if (!networks || networks.length === 0) {
      return;
    }

    // Configure additional networks (beyond the primary network mode)
    networks.forEach((network, index) => {
      if (index === 0) {
        // First network is handled by NetworkMode
        return;
      }

      // Skip special network modes for additional networks
      if (['host', 'none', 'container'].includes(network)) {
        return;
      }

      createOptions.NetworkingConfig.EndpointsConfig[network] = {
        // Network-specific configuration can be added here
        // For example: IPAMConfig, Links, Aliases, etc.
      };
    });
  }

  private configureResourceLimits(resources: any, createOptions: any): void {
    if (resources.memory) {
      createOptions.HostConfig.Memory = resources.memory * 1024 * 1024; // Convert MB to bytes
    }
    if (resources.cpus) {
      createOptions.HostConfig.NanoCpus = resources.cpus * 1000000000; // Convert to nanocpus
    }
    if (resources.pidsLimit) {
      createOptions.HostConfig.PidsLimit = resources.pidsLimit;
    }
    if (resources.diskSpace) {
      // Note: Docker doesn't have direct disk space limits, but we can set up storage driver options
      createOptions.HostConfig.StorageOpt = {
        size: `${resources.diskSpace}m`
      };
    }
    if (resources.ulimits) {
      createOptions.HostConfig.Ulimits = resources.ulimits.map((ulimit: any) => ({
        Name: ulimit.name,
        Soft: ulimit.soft,
        Hard: ulimit.hard
      }));
    }
  }

  private configureSecurityOptions(security: any, createOptions: any): void {
    if (security.privileged) {
      createOptions.HostConfig.Privileged = true;
    }
    if (security.readOnly) {
      createOptions.HostConfig.ReadonlyRootfs = true;
    }
    if (security.user) {
      createOptions.User = security.user;
    }
    if (security.capabilities) {
      createOptions.HostConfig.CapAdd = security.capabilities.add || [];
      createOptions.HostConfig.CapDrop = security.capabilities.drop || [];
    }
  }

  private configureHealthCheck(healthCheck: any, createOptions: any): void {
    createOptions.Healthcheck = {
      Test: healthCheck.test,
      Interval: (healthCheck.interval || 30) * 1000000000, // Convert to nanoseconds
      Timeout: (healthCheck.timeout || 30) * 1000000000,
      Retries: healthCheck.retries || 3,
      StartPeriod: (healthCheck.startPeriod || 0) * 1000000000
    };
  }

  // Network management methods
  async listNetworks(): Promise<Array<{ id: string; name: string; driver: string; scope: string }>> {
    try {
      const networks = await this.executeWithRetry(() => this.docker.listNetworks());
      return networks.map((network: any) => ({
        id: network.Id,
        name: network.Name,
        driver: network.Driver,
        scope: network.Scope
      }));
    } catch (error) {
      throw new DockerOperationError('Failed to list networks', error as Error);
    }
  }

  async createNetwork(name: string, options: any = {}): Promise<{ id: string; name: string }> {
    try {
      const networkOptions = {
        Name: name,
        Driver: options.driver || 'bridge',
        ...options
      };

      const network = await this.executeWithRetry(() => 
        this.docker.createNetwork(networkOptions)
      );

      return {
        id: network.id,
        name: name
      };
    } catch (error) {
      throw new DockerOperationError(`Failed to create network ${name}`, error as Error);
    }
  }

  async removeNetwork(id: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(id);
      await this.executeWithRetry(() => network.remove());
    } catch (error) {
      throw new DockerOperationError(`Failed to remove network ${id}`, error as Error);
    }
  }

  // Volume management methods
  async listVolumes(): Promise<Array<{ name: string; driver: string; mountpoint: string }>> {
    try {
      const result = await this.executeWithRetry(() => this.docker.listVolumes());
      const volumes = result.Volumes || [];
      
      return volumes.map((volume: any) => ({
        name: volume.Name,
        driver: volume.Driver,
        mountpoint: volume.Mountpoint
      }));
    } catch (error) {
      throw new DockerOperationError('Failed to list volumes', error as Error);
    }
  }

  async createVolume(name: string, options: any = {}): Promise<{ name: string; mountpoint: string }> {
    try {
      const volumeOptions = {
        Name: name,
        Driver: options.driver || 'local',
        ...options
      };

      const volume = await this.executeWithRetry(async () => 
        this.docker.createVolume(volumeOptions)
      ) as any;

      return {
        name: volume.Name,
        mountpoint: volume.Mountpoint
      };
    } catch (error) {
      throw new DockerOperationError(`Failed to create volume ${name}`, error as Error);
    }
  }

  async removeVolume(name: string): Promise<void> {
    try {
      const volume = this.docker.getVolume(name);
      await this.executeWithRetry(() => volume.remove());
    } catch (error) {
      throw new DockerOperationError(`Failed to remove volume ${name}`, error as Error);
    }
  }

  // Port and resource utilities
  async getUsedPorts(): Promise<number[]> {
    try {
      const containers = await this.listContainers();
      const usedPorts: number[] = [];
      
      containers.forEach(container => {
        container.ports.forEach(port => {
          usedPorts.push(port.hostPort);
        });
      });

      return [...new Set(usedPorts)].sort((a, b) => a - b);
    } catch (error) {
      throw new DockerOperationError('Failed to get used ports', error as Error);
    }
  }

  async validateHostPath(path: string): Promise<{ exists: boolean; accessible: boolean; isDirectory: boolean }> {
    try {
      // This is a basic implementation - in production, you might want to use fs.promises
      const fs = require('fs').promises;
      
      try {
        const stats = await fs.stat(path);
        return {
          exists: true,
          accessible: true,
          isDirectory: stats.isDirectory()
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return {
            exists: false,
            accessible: false,
            isDirectory: false
          };
        } else if (error.code === 'EACCES') {
          return {
            exists: true,
            accessible: false,
            isDirectory: false
          };
        }
        throw error;
      }
    } catch (error) {
      throw new DockerOperationError(`Failed to validate host path ${path}`, error as Error);
    }
  }

  private parseContainerStats(stats: any): ContainerStats {
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    // Memory stats
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    // Network stats
    const networks = stats.networks || {};
    let rxBytes = 0, txBytes = 0, rxPackets = 0, txPackets = 0;
    
    Object.values(networks).forEach((network: any) => {
      rxBytes += network.rx_bytes || 0;
      txBytes += network.tx_bytes || 0;
      rxPackets += network.rx_packets || 0;
      txPackets += network.tx_packets || 0;
    });

    // Disk I/O stats
    const blkioStats = stats.blkio_stats.io_service_bytes_recursive || [];
    let readBytes = 0, writeBytes = 0;
    let readOps = 0, writeOps = 0;

    blkioStats.forEach((stat: any) => {
      if (stat.op === 'Read') {
        readBytes += stat.value || 0;
      } else if (stat.op === 'Write') {
        writeBytes += stat.value || 0;
      }
    });

    const blkioOpsStats = stats.blkio_stats.io_serviced_recursive || [];
    blkioOpsStats.forEach((stat: any) => {
      if (stat.op === 'Read') {
        readOps += stat.value || 0;
      } else if (stat.op === 'Write') {
        writeOps += stat.value || 0;
      }
    });

    return {
      cpu: Math.round(cpuPercent * 100) / 100, // Round to 2 decimal places
      memory: {
        usage: memoryUsage,
        limit: memoryLimit,
        percentage: Math.round(memoryPercent * 100) / 100
      },
      network: {
        rxBytes,
        txBytes,
        rxPackets,
        txPackets
      },
      disk: {
        readBytes,
        writeBytes,
        readOps,
        writeOps
      },
      timestamp: new Date()
    };
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.connectionRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), this.connectionTimeout);
        });

        return await Promise.race([operation(), timeoutPromise]);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.connectionRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }

    throw new DockerConnectionError(
      `Operation failed after ${this.connectionRetries} attempts`,
      lastError!
    );
  }
}