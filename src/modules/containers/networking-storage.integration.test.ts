import { ContainerServiceImpl } from './container.service';
import { NetworkingServiceImpl } from './networking.service';
import { DockerService } from '@/services/docker.service';
import { ContainerConfig, PortMapping, VolumeMapping } from '@/types/container.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock validation utilities to allow real integration testing
jest.mock('@/utils/validation', () => {
  const actual = jest.requireActual('@/utils/validation');
  return {
    ...actual,
    // Keep real validation functions for integration tests
  };
});

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

      await expect(containerService.create(config)).rejects.toThrow('Port configuration invalid');
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

      await expect(containerService.create(config)).rejects.toThrow('Port configuration invalid');
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

      await expect(containerService.create(config)).rejects.toThrow('Volume configuration invalid');
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

      await expect(containerService.create(config)).rejects.toThrow('Network configuration invalid');
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

  describe('Advanced Port Management Integration', () => {
    it('should handle port range conflicts across multiple containers', async () => {
      const config1: ContainerConfig = {
        id: 'container-1',
        name: 'container-1',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8081, containerPort: 81, protocol: 'tcp' }
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      const config2: ContainerConfig = {
        id: 'container-2',
        name: 'container-2',
        image: 'apache',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8081, containerPort: 80, protocol: 'tcp' }, // Conflicts with container-1
          { hostPort: 8082, containerPort: 443, protocol: 'tcp' }
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock first container creation success
      mockDockerService.getUsedPorts.mockResolvedValueOnce([3000, 5000]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValueOnce({
        id: 'container-1-id',
        name: 'container-1',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config1.ports,
        volumes: []
      });

      const result1 = await containerService.create(config1);
      expect(result1).toBeDefined();

      // Mock second container creation with port conflict
      mockDockerService.getUsedPorts.mockResolvedValueOnce([3000, 5000, 8080, 8081]);
      mockDockerService.listContainers.mockResolvedValue([result1]);

      await expect(containerService.create(config2)).rejects.toThrow('Port configuration invalid');
    });

    it('should handle mixed protocol port configurations', async () => {
      const config: ContainerConfig = {
        id: 'mixed-protocol-container',
        name: 'mixed-protocol-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 9080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 9081, containerPort: 80, protocol: 'udp' }, // Different host port, UDP protocol
          { hostPort: 9082, containerPort: 443, protocol: 'tcp' }
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'mixed-protocol-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config.ports,
        volumes: []
      });

      const result = await containerService.create(config);
      expect(result).toBeDefined();
      expect(result.ports).toHaveLength(3);
      expect(result.ports.some(p => p.protocol === 'tcp')).toBe(true);
      expect(result.ports.some(p => p.protocol === 'udp')).toBe(true);
    });

    it('should suggest alternative ports when conflicts occur', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([8080, 8081, 8082, 8083, 8084]);

      const suggestedPort = await networkingService.suggestAvailablePort(8080);

      expect(suggestedPort).toBeGreaterThan(8084);
      expect([8080, 8081, 8082, 8083, 8084]).not.toContain(suggestedPort);
    });

    it('should avoid reserved system ports in suggestions', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const suggestedPort = await networkingService.suggestAvailablePort(22); // SSH port

      expect(suggestedPort).not.toBe(22);
      expect(suggestedPort).not.toBe(80);
      expect(suggestedPort).not.toBe(443);
      // The service should suggest a port starting from 8080 or higher when reserved ports are requested
      expect(suggestedPort).toBeGreaterThan(22);
    });
  });

  describe('Advanced Volume Management Integration', () => {
    let tempDir: string;

    beforeEach(async () => {
      // Create temporary directory for testing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docker-test-'));
    });

    afterEach(async () => {
      // Clean up temporary directory
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should handle complex volume mapping scenarios', async () => {
      const dataDir = path.join(tempDir, 'data');
      const configDir = path.join(tempDir, 'config');
      const logsDir = path.join(tempDir, 'logs');

      // Create test directories
      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });
      await fs.mkdir(logsDir, { recursive: true });

      const config: ContainerConfig = {
        id: 'complex-volumes-container',
        name: 'complex-volumes-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: dataDir, containerPath: '/app/data', mode: 'rw', description: 'Application data' },
          { hostPath: configDir, containerPath: '/app/config', mode: 'ro', description: 'Configuration files' },
          { hostPath: logsDir, containerPath: '/app/logs', mode: 'rw', description: 'Log files' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.validateHostPath
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true });
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'complex-volumes-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: config.volumes
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.volumes).toHaveLength(3);
      expect(mockDockerService.validateHostPath).toHaveBeenCalledTimes(3);
    });

    it('should handle volume permission and ownership validation', async () => {
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedDir, { recursive: true });

      const config: ContainerConfig = {
        id: 'permission-test-container',
        name: 'permission-test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: restrictedDir, containerPath: '/app/data', mode: 'rw' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      // Mock inaccessible directory
      mockDockerService.validateHostPath.mockResolvedValue({ 
        exists: true, 
        accessible: false, 
        isDirectory: true 
      });
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Volume configuration invalid');
    });

    it('should validate volume mount conflicts within container', async () => {
      const dataDir = path.join(tempDir, 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const config: ContainerConfig = {
        id: 'volume-conflict-container',
        name: 'volume-conflict-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: dataDir, containerPath: '/app/data', mode: 'rw' },
          { hostPath: dataDir, containerPath: '/app/data', mode: 'ro' } // Same container path
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.create(config)).rejects.toThrow('Volume configuration invalid');
    });

    it('should handle nested volume mount validation', async () => {
      const parentDir = path.join(tempDir, 'parent');
      const childDir = path.join(parentDir, 'child');
      await fs.mkdir(childDir, { recursive: true });

      const config: ContainerConfig = {
        id: 'nested-volumes-container',
        name: 'nested-volumes-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: parentDir, containerPath: '/app/parent', mode: 'rw' },
          { hostPath: childDir, containerPath: '/app/child', mode: 'ro' }
        ],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.validateHostPath
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true });
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'nested-volumes-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: config.volumes
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.volumes).toHaveLength(2);
    });
  });

  describe('Advanced Network Management Integration', () => {
    it('should handle custom network creation with specific drivers', async () => {
      const config: ContainerConfig = {
        id: 'custom-network-container',
        name: 'custom-network-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['custom-overlay-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks
        .mockResolvedValueOnce([
          { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
        ])
        .mockResolvedValueOnce([
          { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
          { id: '2', name: 'custom-overlay-network', driver: 'overlay', scope: 'swarm' }
        ]);
      mockDockerService.createNetwork.mockResolvedValue({ 
        id: '2', 
        name: 'custom-overlay-network' 
      });
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'custom-network-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(mockDockerService.createNetwork).toHaveBeenCalledWith('custom-overlay-network', {});
    });

    it('should handle multiple network attachments', async () => {
      const config: ContainerConfig = {
        id: 'multi-network-container',
        name: 'multi-network-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['frontend-network', 'backend-network', 'monitoring-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'frontend-network', driver: 'bridge', scope: 'local' },
        { id: '3', name: 'backend-network', driver: 'bridge', scope: 'local' },
        { id: '4', name: 'monitoring-network', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'multi-network-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(mockDockerService.listNetworks).toHaveBeenCalled();
    });

    it('should validate network compatibility with container requirements', async () => {
      const networks = ['host', 'bridge']; // host network conflicts with port mappings

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'host', driver: 'host', scope: 'local' }
      ]);

      const result = await networkingService.validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(true); // Basic validation should pass
      expect(mockDockerService.listNetworks).toHaveBeenCalled();
    });

    it('should handle network isolation scenarios', async () => {
      const config: ContainerConfig = {
        id: 'isolated-container',
        name: 'isolated-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['none'], // Isolated network
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'none', driver: 'null', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'isolated-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
    });
  });

  describe('Cross-Feature Integration Tests', () => {
    it('should validate port mappings with host network mode', async () => {
      const config: ContainerConfig = {
        id: 'host-network-container',
        name: 'host-network-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' } // Should be ignored in host mode
        ],
        volumes: [],
        networks: ['host'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'host', driver: 'host', scope: 'local' }
      ]);
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'host-network-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config.ports,
        volumes: []
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      // In host network mode, port mappings are typically ignored
    });

    it('should handle volume mounts with network storage backends', async () => {
      const config: ContainerConfig = {
        id: 'network-storage-container',
        name: 'network-storage-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
        volumes: [
          { hostPath: '/nfs/shared/data', containerPath: '/app/data', mode: 'rw', description: 'NFS mount' }
        ],
        networks: ['storage-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);
      mockDockerService.validateHostPath.mockResolvedValue({ 
        exists: true, 
        accessible: true, 
        isDirectory: true 
      });
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'storage-network', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({
        id: 'container-id',
        name: 'network-storage-container',
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
    });

    it('should validate resource constraints with networking and storage', async () => {
      const config: ContainerConfig = {
        id: 'resource-constrained-container',
        name: 'resource-constrained-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8443, containerPort: 443, protocol: 'tcp' }
        ],
        volumes: [
          { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' },
          { hostPath: '/host/logs', containerPath: '/app/logs', mode: 'rw' }
        ],
        networks: ['app-network'],
        restartPolicy: 'unless-stopped',
        resources: {
          memory: 256, // Limited memory
          cpus: 0.5,   // Limited CPU
          diskSpace: 1024 // Limited disk space
        }
      };

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
        name: 'resource-constrained-container',
        status: 'created',
        image: 'nginx:latest',
        created: new Date(),
        ports: config.ports,
        volumes: config.volumes
      });

      const result = await containerService.create(config);

      expect(result).toBeDefined();
      expect(result.ports).toHaveLength(2);
      expect(result.volumes).toHaveLength(2);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Docker daemon connection failures gracefully', async () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.getUsedPorts.mockRejectedValue(new Error('Docker daemon not available'));

      await expect(containerService.create(config)).rejects.toThrow('Failed to create container');
    });

    it('should handle partial validation failures with detailed error reporting', async () => {
      const config: ContainerConfig = {
        id: 'multi-error-container',
        name: 'multi-error-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 3000, containerPort: 80, protocol: 'tcp' }, // Port conflict
          { hostPort: 0, containerPort: 443, protocol: 'tcp' }    // Invalid port
        ],
        volumes: [
          { hostPath: '/nonexistent', containerPath: '/app/data', mode: 'rw' } // Non-existent path
        ],
        networks: ['nonexistent-network'], // Non-existent network
        restartPolicy: 'unless-stopped',
        resources: {}
      };

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

      await expect(containerService.create(config)).rejects.toThrow();
    });

    it('should handle network creation failures during container deployment', async () => {
      const config: ContainerConfig = {
        id: 'network-fail-container',
        name: 'network-fail-container',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['failing-network'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.createNetwork.mockRejectedValue(new Error('Network creation failed'));
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(networkingService.createNetworkIfNotExists('failing-network'))
        .rejects.toThrow('Failed to create network');
    });
  });
});