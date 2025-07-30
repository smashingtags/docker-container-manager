import { Container, ContainerConfig, ContainerStats, LogOptions } from '@/types/container.types';
import { DockerService } from '@/services/docker.service';
import { NetworkingService } from './networking.service';
import { validateContainerConfig } from './container.validation';
import { logger } from '@/utils/logger';

export interface ContainerService {
  list(): Promise<Container[]>;
  create(config: ContainerConfig): Promise<Container>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  getLogs(id: string, options?: LogOptions): Promise<string[]>;
  getStats(id: string): Promise<ContainerStats>;
  getContainerById(id: string): Promise<Container | null>;
  monitorContainerStatus(id: string): Promise<Container>;
}

export class ContainerServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'ContainerServiceError';
  }
}

export class ContainerServiceImpl implements ContainerService {
  constructor(
    private dockerService: DockerService,
    private networkingService?: NetworkingService
  ) {}

  async list(): Promise<Container[]> {
    try {
      logger.debug('Listing all containers');
      const containers = await this.dockerService.listContainers();
      logger.debug(`Found ${containers.length} containers`);
      return containers;
    } catch (error) {
      logger.error('Failed to list containers', { error });
      throw new ContainerServiceError(
        'Failed to list containers',
        error as Error
      );
    }
  }

  async create(config: ContainerConfig): Promise<Container> {
    try {
      logger.debug('Creating container', { name: config.name, image: config.image });
      
      // Validate configuration
      const validation = validateContainerConfig(config);
      if (!validation.isValid) {
        const errorMessage = validation.errors.map((e: any) => e.message).join(', ');
        throw new ContainerServiceError(`Invalid container configuration: ${errorMessage}`);
      }

      // Enhanced networking and storage validation if networking service is available
      if (this.networkingService) {
        // Validate port mappings
        if (config.ports && config.ports.length > 0) {
          const portValidation = await this.networkingService.validatePortMappings(config.ports);
          if (!portValidation.isValid) {
            const errorMessage = portValidation.errors.map(e => e.message).join(', ');
            throw new ContainerServiceError(`Port configuration invalid: ${errorMessage}`);
          }
        }

        // Validate volume mappings
        if (config.volumes && config.volumes.length > 0) {
          const volumeValidation = await this.networkingService.validateVolumeMappings(config.volumes);
          if (!volumeValidation.isValid) {
            const errorMessage = volumeValidation.errors.map(e => e.message).join(', ');
            throw new ContainerServiceError(`Volume configuration invalid: ${errorMessage}`);
          }
        }

        // Create custom networks if they don't exist (before validation)
        for (const network of config.networks || []) {
          if (!['bridge', 'host', 'none'].includes(network)) {
            try {
              await this.networkingService.createNetworkIfNotExists(network);
            } catch (error) {
              logger.warn('Failed to create network, continuing with container creation', { 
                network, 
                error: error instanceof Error ? error.message : error 
              });
            }
          }
        }

        // Validate network configuration
        if (config.networks && config.networks.length > 0) {
          const networkValidation = await this.networkingService.validateNetworkConfiguration(config.networks);
          if (!networkValidation.isValid) {
            const errorMessage = networkValidation.errors.map(e => e.message).join(', ');
            throw new ContainerServiceError(`Network configuration invalid: ${errorMessage}`);
          }
        }
      }

      // Check if container with same name already exists
      const existingContainers = await this.dockerService.listContainers();
      const nameExists = existingContainers.some(container => container.name === config.name);
      if (nameExists) {
        throw new ContainerServiceError(`Container with name '${config.name}' already exists`);
      }

      const container = await this.dockerService.createContainer(config);
      logger.info('Container created successfully', { 
        id: container.id, 
        name: container.name,
        ports: config.ports?.length || 0,
        volumes: config.volumes?.length || 0,
        networks: config.networks?.length || 0
      });
      
      return container;
    } catch (error) {
      logger.error('Failed to create container', { 
        name: config.name, 
        error: error instanceof Error ? error.message : error 
      });
      
      if (error instanceof ContainerServiceError) {
        throw error;
      }
      
      throw new ContainerServiceError(
        `Failed to create container '${config.name}'`,
        error as Error
      );
    }
  }

  async start(id: string): Promise<void> {
    try {
      logger.debug('Starting container', { id });
      await this.dockerService.startContainer(id);
      logger.info('Container started successfully', { id });
    } catch (error) {
      logger.error('Failed to start container', { id, error });
      throw new ContainerServiceError(
        `Failed to start container '${id}'`,
        error as Error
      );
    }
  }

  async stop(id: string): Promise<void> {
    try {
      logger.debug('Stopping container', { id });
      await this.dockerService.stopContainer(id);
      logger.info('Container stopped successfully', { id });
    } catch (error) {
      logger.error('Failed to stop container', { id, error });
      throw new ContainerServiceError(
        `Failed to stop container '${id}'`,
        error as Error
      );
    }
  }

  async restart(id: string): Promise<void> {
    try {
      logger.debug('Restarting container', { id });
      await this.dockerService.restartContainer(id);
      logger.info('Container restarted successfully', { id });
    } catch (error) {
      logger.error('Failed to restart container', { id, error });
      throw new ContainerServiceError(
        `Failed to restart container '${id}'`,
        error as Error
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      logger.debug('Removing container', { id });
      await this.dockerService.removeContainer(id);
      logger.info('Container removed successfully', { id });
    } catch (error) {
      logger.error('Failed to remove container', { id, error });
      throw new ContainerServiceError(
        `Failed to remove container '${id}'`,
        error as Error
      );
    }
  }

  async getLogs(id: string, options?: LogOptions): Promise<string[]> {
    try {
      logger.debug('Getting container logs', { id, options });
      const logs = await this.dockerService.getContainerLogs(id, options);
      logger.debug(`Retrieved ${logs.length} log lines for container`, { id });
      return logs;
    } catch (error) {
      logger.error('Failed to get container logs', { id, error });
      throw new ContainerServiceError(
        `Failed to get logs for container '${id}'`,
        error as Error
      );
    }
  }

  async getStats(id: string): Promise<ContainerStats> {
    try {
      logger.debug('Getting container stats', { id });
      const stats = await this.dockerService.getContainerStats(id);
      logger.debug('Retrieved container stats', { id });
      return stats;
    } catch (error) {
      logger.error('Failed to get container stats', { id, error });
      throw new ContainerServiceError(
        `Failed to get stats for container '${id}'`,
        error as Error
      );
    }
  }

  async getContainerById(id: string): Promise<Container | null> {
    try {
      logger.debug('Getting container by ID', { id });
      const containers = await this.dockerService.listContainers();
      const container = containers.find(c => c.id === id || c.name === id);
      
      if (!container) {
        logger.debug('Container not found', { id });
        return null;
      }
      
      logger.debug('Found container', { id: container.id, name: container.name });
      return container;
    } catch (error) {
      logger.error('Failed to get container by ID', { id, error });
      throw new ContainerServiceError(
        `Failed to get container '${id}'`,
        error as Error
      );
    }
  }

  async monitorContainerStatus(id: string): Promise<Container> {
    try {
      logger.debug('Monitoring container status', { id });
      
      const container = await this.getContainerById(id);
      if (!container) {
        throw new ContainerServiceError(`Container '${id}' not found`);
      }

      // This method provides real-time status monitoring
      // In a real implementation, this could be enhanced with WebSocket updates
      logger.debug('Container status monitored', { 
        id: container.id, 
        status: container.status 
      });
      
      return container;
    } catch (error) {
      logger.error('Failed to monitor container status', { id, error });
      
      if (error instanceof ContainerServiceError) {
        throw error;
      }
      
      throw new ContainerServiceError(
        `Failed to monitor status for container '${id}'`,
        error as Error
      );
    }
  }
}