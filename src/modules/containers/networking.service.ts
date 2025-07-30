import { DockerService } from '@/services/docker.service';
import { PortMapping, VolumeMapping, ValidationResult, ValidationError } from '@/types/container.types';
import { 
  validatePortConfiguration, 
  validateVolumeConfiguration, 
  validateNetworkCompatibility,
  validateNetworkConfiguration
} from '@/utils/validation';
import { logger } from '@/utils/logger';

export interface NetworkingService {
  validatePortMappings(ports: PortMapping[]): Promise<ValidationResult<PortMapping[]>>;
  validateVolumeMappings(volumes: VolumeMapping[]): Promise<ValidationResult<VolumeMapping[]>>;
  validateNetworkConfiguration(networks: string[]): Promise<ValidationResult<string[]>>;
  getAvailableNetworks(): Promise<string[]>;
  getUsedPorts(): Promise<number[]>;
  suggestAvailablePort(preferredPort?: number): Promise<number>;
  validateHostPath(path: string): Promise<ValidationResult<string>>;
  createNetworkIfNotExists(name: string, options?: any): Promise<void>;
}

export class NetworkingServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'NetworkingServiceError';
  }
}

export class NetworkingServiceImpl implements NetworkingService {
  constructor(private dockerService: DockerService) {}

  async validatePortMappings(ports: PortMapping[]): Promise<ValidationResult<PortMapping[]>> {
    try {
      logger.debug('Validating port mappings', { portCount: ports.length });
      
      // Get currently used ports
      const usedPorts = await this.dockerService.getUsedPorts();
      
      // Validate port configuration with conflict detection
      const result = validatePortConfiguration(ports, usedPorts);
      
      if (!result.isValid) {
        logger.warn('Port mapping validation failed', { errors: result.errors });
      } else {
        logger.debug('Port mapping validation successful');
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to validate port mappings', { error });
      throw new NetworkingServiceError(
        'Failed to validate port mappings',
        error as Error
      );
    }
  }

  async validateVolumeMappings(volumes: VolumeMapping[]): Promise<ValidationResult<VolumeMapping[]>> {
    try {
      logger.debug('Validating volume mappings', { volumeCount: volumes.length });
      
      // Validate volume configuration with path checks
      const result = validateVolumeConfiguration(volumes, true);
      
      if (!result.isValid) {
        logger.warn('Volume mapping validation failed', { errors: result.errors });
        return result;
      }

      // Additional host path validation
      const pathValidationErrors: ValidationError[] = [];
      
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const volume = result.data[i];
          try {
            const pathInfo = await this.dockerService.validateHostPath(volume.hostPath);
            
            if (!pathInfo.exists) {
              pathValidationErrors.push({
                field: `volumes[${i}].hostPath`,
                message: `Host path '${volume.hostPath}' does not exist`,
                value: volume.hostPath
              });
            } else if (!pathInfo.accessible) {
              pathValidationErrors.push({
                field: `volumes[${i}].hostPath`,
                message: `Host path '${volume.hostPath}' is not accessible`,
                value: volume.hostPath
              });
            }
          } catch (error) {
            pathValidationErrors.push({
              field: `volumes[${i}].hostPath`,
              message: `Failed to validate host path '${volume.hostPath}': ${error}`,
              value: volume.hostPath
            });
          }
        }
      }

      if (pathValidationErrors.length > 0) {
        logger.warn('Host path validation failed', { errors: pathValidationErrors });
        return {
          isValid: false,
          errors: [...result.errors, ...pathValidationErrors]
        };
      }

      logger.debug('Volume mapping validation successful');
      return result;
    } catch (error) {
      logger.error('Failed to validate volume mappings', { error });
      throw new NetworkingServiceError(
        'Failed to validate volume mappings',
        error as Error
      );
    }
  }

  async validateNetworkConfiguration(networks: string[]): Promise<ValidationResult<string[]>> {
    try {
      logger.debug('Validating network configuration', { networks });
      
      // First validate basic network configuration (format, duplicates, etc.)
      const basicValidation = validateNetworkConfiguration(networks);
      if (!basicValidation.isValid) {
        logger.warn('Network configuration validation failed', { errors: basicValidation.errors });
        return basicValidation;
      }
      
      // Get available networks for compatibility check
      const availableNetworks = await this.getAvailableNetworks();
      
      // Validate network compatibility
      const result = validateNetworkCompatibility(networks, availableNetworks);
      
      if (!result.isValid) {
        logger.warn('Network configuration validation failed', { errors: result.errors });
      } else {
        logger.debug('Network configuration validation successful');
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to validate network configuration', { error });
      throw new NetworkingServiceError(
        'Failed to validate network configuration',
        error as Error
      );
    }
  }

  async getAvailableNetworks(): Promise<string[]> {
    try {
      logger.debug('Getting available networks');
      
      const networks = await this.dockerService.listNetworks();
      const networkNames = networks.map(network => network.name);
      
      logger.debug('Retrieved available networks', { networks: networkNames });
      return networkNames;
    } catch (error) {
      logger.error('Failed to get available networks', { error });
      throw new NetworkingServiceError(
        'Failed to get available networks',
        error as Error
      );
    }
  }

  async getUsedPorts(): Promise<number[]> {
    try {
      logger.debug('Getting used ports');
      
      const usedPorts = await this.dockerService.getUsedPorts();
      
      logger.debug('Retrieved used ports', { portCount: usedPorts.length });
      return usedPorts;
    } catch (error) {
      logger.error('Failed to get used ports', { error });
      throw new NetworkingServiceError(
        'Failed to get used ports',
        error as Error
      );
    }
  }

  async suggestAvailablePort(preferredPort?: number): Promise<number> {
    try {
      logger.debug('Suggesting available port', { preferredPort });
      
      const usedPorts = await this.getUsedPorts();
      const usedPortsSet = new Set(usedPorts);
      const reservedPorts = [22, 80, 443, 3306, 5432, 6379, 27017];
      
      // If preferred port is specified, check if it's available and not reserved
      if (preferredPort && !usedPortsSet.has(preferredPort) && !reservedPorts.includes(preferredPort)) {
        logger.debug('Preferred port is available', { port: preferredPort });
        return preferredPort;
      }
      
      // Find next available port starting from preferred port or 8080
      const startPort = preferredPort || 8080;
      const maxPort = 65535;
      
      for (let port = startPort; port <= maxPort; port++) {
        if (!usedPortsSet.has(port) && !reservedPorts.includes(port)) {
          logger.debug('Found available port', { port });
          return port;
        }
      }
      
      throw new NetworkingServiceError('No available ports found');
    } catch (error) {
      logger.error('Failed to suggest available port', { error });
      throw new NetworkingServiceError(
        'Failed to suggest available port',
        error as Error
      );
    }
  }

  async validateHostPath(path: string): Promise<ValidationResult<string>> {
    try {
      logger.debug('Validating host path', { path });
      
      // Basic path format validation
      if (!path || path.trim() === '') {
        return {
          isValid: false,
          errors: [{
            field: 'hostPath',
            message: 'Host path cannot be empty',
            value: path
          }]
        };
      }

      // Check if path is absolute
      if (!path.startsWith('/') && !path.match(/^[A-Za-z]:\\/)) {
        return {
          isValid: false,
          errors: [{
            field: 'hostPath',
            message: 'Host path must be an absolute path',
            value: path
          }]
        };
      }

      // Validate path accessibility
      const pathInfo = await this.dockerService.validateHostPath(path);
      const errors: ValidationError[] = [];

      if (!pathInfo.exists) {
        errors.push({
          field: 'hostPath',
          message: `Host path '${path}' does not exist`,
          value: path
        });
      } else if (!pathInfo.accessible) {
        errors.push({
          field: 'hostPath',
          message: `Host path '${path}' is not accessible`,
          value: path
        });
      }

      if (errors.length > 0) {
        logger.warn('Host path validation failed', { path, errors });
        return {
          isValid: false,
          errors
        };
      }

      logger.debug('Host path validation successful', { path });
      return {
        isValid: true,
        data: path,
        errors: []
      };
    } catch (error) {
      logger.error('Failed to validate host path', { path, error });
      throw new NetworkingServiceError(
        `Failed to validate host path '${path}'`,
        error as Error
      );
    }
  }

  async createNetworkIfNotExists(name: string, options: any = {}): Promise<void> {
    try {
      logger.debug('Creating network if not exists', { name, options });
      
      const availableNetworks = await this.getAvailableNetworks();
      
      if (availableNetworks.includes(name)) {
        logger.debug('Network already exists', { name });
        return;
      }

      await this.dockerService.createNetwork(name, options);
      logger.info('Network created successfully', { name });
    } catch (error) {
      logger.error('Failed to create network', { name, error });
      throw new NetworkingServiceError(
        `Failed to create network '${name}'`,
        error as Error
      );
    }
  }
}