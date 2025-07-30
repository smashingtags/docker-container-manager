import { ContainerServiceImpl } from './container.service';
import { NetworkingServiceImpl } from './networking.service';
import { DockerService } from '@/services/docker.service';
import { ContainerConfig, PortMapping, VolumeMapping } from '@/types/container.types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Networking and Storage Integration', () => {
  let containerService: ContainerServiceImpl;
  let networkingService: NetworkingServiceImpl;
  let mockDockerService: jest.Mocked<DockerService>;

  beforeEach(() => {
    mockDockerService = {
      listContainers: jest.fn(),
      createContainer: jest.fn(),
      getUsedPorts: jest.fn(),
      validateHostPath: jest.fn(),
      listNetworks: jest.fn(),
      createNetwork: jest.fn(),
    } as any;

    networkingService = new NetworkingServiceImpl(mockDockerService);
    containerService = new ContainerServiceImpl(mockDockerService, networkingService);
  });

  describe('Port Mapping Configuration', () => {
    it('should validate and create container with port mappings', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp', description: 'HTTP port' },
          { hostPort: 8443, containerPort: 443, protocol: 'tcp', description: 'HTTPS port' }
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock successful validation
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'test-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config.ports,
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.ports).toEqual(config.ports);
      expect(mockDockerService.getUsedPorts).toHaveBeenCalled();
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(config);
    });

    it('should prevent container creation with conflicting ports', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 3000, containerPort: 80, protocol: 'tcp' } // Conflicts with used port
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock port conflict
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Port configuration invalid');
    });

    it('should prevent container creation with duplicate host ports', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8080, containerPort: 443, protocol: 'tcp' } // Duplicate host port
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.getUsedPorts.mockResolvedValue([]);
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Invalid container configuration');
    });

    it('should warn about reserved ports but allow creation', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 22, containerPort: 22, protocol: 'tcp' } // SSH port
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.getUsedPorts.mockResolvedValue([]);
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Invalid container configuration');
    });
  });

  describe('Volume Mapping Configuration', () => {
    it('should validate and create container with volume mappings', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw', description: 'Data volume' },
          { hostPath: '/host/config', containerPath: '/app/config', mode: 'ro', description: 'Config volume' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock successful validation
      mockDockerService.validateHostPath
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true });
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'test-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: config.volumes
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.volumes).toEqual(config.volumes);
      expect(mockDockerService.validateHostPath).toHaveBeenCalledTimes(2);
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(config);
    });

    it('should prevent container creation with non-existent host paths', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: '/nonexistent/path', containerPath: '/app/data', mode: 'rw' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock non-existent path
      mockDockerService.validateHostPath.mockResolvedValue({ 
        exists: false, 
        accessible: false, 
        isDirectory: false 
      });
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Volume configuration invalid');
    });

    it('should prevent container creation with inaccessible host paths', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: '/restricted/path', containerPath: '/app/data', mode: 'rw' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock inaccessible path
      mockDockerService.validateHostPath.mockResolvedValue({ 
        exists: true, 
        accessible: false, 
        isDirectory: true 
      });
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Volume configuration invalid');
    });

    it('should prevent container creation with duplicate container paths', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: '/host/data1', containerPath: '/app/data', mode: 'rw' },
          { hostPath: '/host/data2', containerPath: '/app/data', mode: 'ro' } // Duplicate container path
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Invalid container configuration');
    });
  });

  describe('Network Configuration', () => {
    it('should validate and create container with custom networks', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['bridge', 'custom-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock successful validation
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'custom-network', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'test-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(mockDockerService.listNetworks).toHaveBeenCalled();
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(config);
    });

    it('should create missing networks automatically', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['new-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock network creation
      mockDockerService.listNetworks
        .mockResolvedValueOnce([
          { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
        ])
        .mockResolvedValueOnce([
          { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
          { id: '2', name: 'new-network', driver: 'bridge', scope: 'local' }
        ]);
      mockDockerService.createNetwork.mockResolvedValue({ 
        id: '2', 
        name: 'new-network' 
      });
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'test-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(mockDockerService.createNetwork).toHaveBeenCalledWith('new-network', {});
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(config);
    });

    it('should prevent container creation with duplicate network names', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['bridge', 'bridge'], // Duplicate network
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Invalid container configuration');
    });
  });

  describe('Combined Configuration Validation', () => {
    it('should validate complex container configuration with ports, volumes, and networks', async () => {
      const config: ContainerConfig = {
        id: 'complex-container',
        name: 'complex-container',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp', description: 'HTTP' },
          { hostPort: 8443, containerPort: 443, protocol: 'tcp', description: 'HTTPS' }
        ],
        volumes: [
          { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw', description: 'Data' },
          { hostPath: '/host/logs', containerPath: '/app/logs', mode: 'rw', description: 'Logs' }
        ],
        networks: ['bridge', 'app-network'],
        restartPolicy: 'unless-stopped',
        resources: {
          memory: 512,
          cpus: 1.0
        }
      };

      // Mock all validations as successful
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.validateHostPath
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true });
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'app-network', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'complex-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config.ports,
        volumes: config.volumes
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.ports).toEqual(config.ports);
      expect(result.volumes).toEqual(config.volumes);
      expect(mockDockerService.getUsedPorts).toHaveBeenCalled();
      expect(mockDockerService.validateHostPath).toHaveBeenCalledTimes(2);
      expect(mockDockerService.listNetworks).toHaveBeenCalled();
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(config);
    });

    it('should fail validation when multiple configuration aspects are invalid', async () => {
      const config: ContainerConfig = {
        id: 'invalid-container',
        name: 'invalid-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 3000, containerPort: 80, protocol: 'tcp' } // Conflicts with used port
        ],
        volumes: [
          { hostPath: '/nonexistent/path', containerPath: '/app/data', mode: 'rw' } // Non-existent path
        ],
        networks: ['nonexistent-network'], // Non-existent network
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock all validations as failing
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.validateHostPath.mockResolvedValue({ 
        exists: false, 
        accessible: false, 
        isDirectory: false 
      });
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Port configuration invalid');
    });
  });

  describe('Port Suggestion Service', () => {
    it('should suggest available ports', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([8080, 8081, 8082]);

      const suggestedPort = await networkingService.suggestAvailablePort(8080);

      expect(suggestedPort).toBeGreaterThan(8082);
      expect(suggestedPort).not.toBe(8080);
      expect(suggestedPort).not.toBe(8081);
      expect(suggestedPort).not.toBe(8082);
    });

    it('should suggest port starting from default when no preference given', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const suggestedPort = await networkingService.suggestAvailablePort();

      expect(suggestedPort).toBe(8080);
    });
  });

  describe('Network Management', () => {
    it('should create network if it does not exist', async () => {
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.createNetwork.mockResolvedValue({ 
        id: '2', 
        name: 'test-network' 
      });

      await networkingService.createNetworkIfNotExists('test-network');

      expect(mockDockerService.createNetwork).toHaveBeenCalledWith('test-network', {});
    });

    it('should not create network if it already exists', async () => {
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'test-network', driver: 'bridge', scope: 'local' }
      ]);

      await networkingService.createNetworkIfNotExists('test-network');

      expect(mockDockerService.createNetwork).not.toHaveBeenCalled();
    });
  });
});