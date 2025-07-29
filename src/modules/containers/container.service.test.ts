import { ContainerServiceImpl, ContainerServiceError } from './container.service';
import { DockerService } from '@/services/docker.service';
import { Container, ContainerConfig, LogOptions } from '@/types/container.types';
import { validateCompleteContainerConfig } from './container.validation';

// Mock the validation module
jest.mock('./container.validation');
const mockValidateContainerConfig = validateCompleteContainerConfig as jest.MockedFunction<typeof validateCompleteContainerConfig>;

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('ContainerService', () => {
  let containerService: ContainerServiceImpl;
  let mockDockerService: jest.Mocked<DockerService>;

  const mockContainer: Container = {
    id: 'container-123',
    name: 'test-container',
    status: 'running',
    image: 'nginx:latest',
    created: new Date('2023-01-01T00:00:00Z'),
    ports: [
      {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp'
      }
    ],
    volumes: [
      {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw'
      }
    ]
  };

  const mockContainerConfig: ContainerConfig = {
    id: 'config-123',
    name: 'test-container',
    image: 'nginx',
    tag: 'latest',
    environment: {
      NODE_ENV: 'production'
    },
    ports: [
      {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp'
      }
    ],
    volumes: [
      {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw'
      }
    ],
    networks: ['bridge'],
    restartPolicy: 'unless-stopped',
    resources: {
      memory: 512,
      cpus: 1
    }
  };

  beforeEach(() => {
    // Create mock Docker service
    mockDockerService = {
      initialize: jest.fn(),
      destroy: jest.fn(),
      listContainers: jest.fn(),
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      restartContainer: jest.fn(),
      removeContainer: jest.fn(),
      getContainerLogs: jest.fn(),
      getContainerStats: jest.fn(),
      pullImage: jest.fn(),
      listImages: jest.fn(),
      removeImage: jest.fn(),
      getDockerInfo: jest.fn(),
      ping: jest.fn(),
      healthCheck: jest.fn(),
      listNetworks: jest.fn(),
      createNetwork: jest.fn(),
      removeNetwork: jest.fn(),
      listVolumes: jest.fn(),
      createVolume: jest.fn(),
      removeVolume: jest.fn(),
      getUsedPorts: jest.fn(),
      validateHostPath: jest.fn()
    };

    containerService = new ContainerServiceImpl(mockDockerService);

    // Reset all mocks
    jest.clearAllMocks();

    // Default validation mock
    mockValidateContainerConfig.mockReturnValue({
      isValid: true,
      data: mockContainerConfig,
      errors: []
    });
  });

  describe('list', () => {
    it('should return list of containers successfully', async () => {
      const mockContainers = [mockContainer];
      mockDockerService.listContainers.mockResolvedValue(mockContainers);

      const result = await containerService.list();

      expect(result).toEqual(mockContainers);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const dockerError = new Error('Docker daemon not available');
      mockDockerService.listContainers.mockRejectedValue(dockerError);

      await expect(containerService.list()).rejects.toThrow(ContainerServiceError);
      await expect(containerService.list()).rejects.toThrow('Failed to list containers');
    });

    it('should return empty array when no containers exist', async () => {
      mockDockerService.listContainers.mockResolvedValue([]);

      const result = await containerService.list();

      expect(result).toEqual([]);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should create container successfully with valid configuration', async () => {
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue(mockContainer);

      const result = await containerService.create(mockContainerConfig);

      expect(result).toEqual(mockContainer);
      expect(mockValidateContainerConfig).toHaveBeenCalledWith(mockContainerConfig);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(mockContainerConfig);
    });

    it('should throw ContainerServiceError for invalid configuration', async () => {
      mockValidateContainerConfig.mockReturnValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Name is required' },
          { field: 'image', message: 'Image is required' }
        ]
      });

      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(
        'Invalid container configuration: Name is required, Image is required'
      );
      
      expect(mockDockerService.createContainer).not.toHaveBeenCalled();
    });

    it('should throw ContainerServiceError when container name already exists', async () => {
      const existingContainer = { ...mockContainer, name: mockContainerConfig.name };
      mockDockerService.listContainers.mockResolvedValue([existingContainer]);

      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(
        `Container with name '${mockContainerConfig.name}' already exists`
      );
      
      expect(mockDockerService.createContainer).not.toHaveBeenCalled();
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const dockerError = new Error('Failed to create container');
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockRejectedValue(dockerError);

      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.create(mockContainerConfig)).rejects.toThrow(
        `Failed to create container '${mockContainerConfig.name}'`
      );
    });

    it('should allow creating containers with different names', async () => {
      const existingContainer = { ...mockContainer, name: 'different-container' };
      mockDockerService.listContainers.mockResolvedValue([existingContainer]);
      mockDockerService.createContainer.mockResolvedValue(mockContainer);

      const result = await containerService.create(mockContainerConfig);

      expect(result).toEqual(mockContainer);
      expect(mockDockerService.createContainer).toHaveBeenCalledWith(mockContainerConfig);
    });
  });

  describe('start', () => {
    it('should start container successfully', async () => {
      const containerId = 'container-123';
      mockDockerService.startContainer.mockResolvedValue();

      await containerService.start(containerId);

      expect(mockDockerService.startContainer).toHaveBeenCalledWith(containerId);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.startContainer.mockRejectedValue(dockerError);

      await expect(containerService.start(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.start(containerId)).rejects.toThrow(
        `Failed to start container '${containerId}'`
      );
    });
  });

  describe('stop', () => {
    it('should stop container successfully', async () => {
      const containerId = 'container-123';
      mockDockerService.stopContainer.mockResolvedValue();

      await containerService.stop(containerId);

      expect(mockDockerService.stopContainer).toHaveBeenCalledWith(containerId);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.stopContainer.mockRejectedValue(dockerError);

      await expect(containerService.stop(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.stop(containerId)).rejects.toThrow(
        `Failed to stop container '${containerId}'`
      );
    });
  });

  describe('restart', () => {
    it('should restart container successfully', async () => {
      const containerId = 'container-123';
      mockDockerService.restartContainer.mockResolvedValue();

      await containerService.restart(containerId);

      expect(mockDockerService.restartContainer).toHaveBeenCalledWith(containerId);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.restartContainer.mockRejectedValue(dockerError);

      await expect(containerService.restart(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.restart(containerId)).rejects.toThrow(
        `Failed to restart container '${containerId}'`
      );
    });
  });

  describe('remove', () => {
    it('should remove container successfully', async () => {
      const containerId = 'container-123';
      mockDockerService.removeContainer.mockResolvedValue();

      await containerService.remove(containerId);

      expect(mockDockerService.removeContainer).toHaveBeenCalledWith(containerId);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.removeContainer.mockRejectedValue(dockerError);

      await expect(containerService.remove(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.remove(containerId)).rejects.toThrow(
        `Failed to remove container '${containerId}'`
      );
    });
  });

  describe('getLogs', () => {
    it('should get container logs successfully without options', async () => {
      const containerId = 'container-123';
      const mockLogs = ['Log line 1', 'Log line 2', 'Log line 3'];
      mockDockerService.getContainerLogs.mockResolvedValue(mockLogs);

      const result = await containerService.getLogs(containerId);

      expect(result).toEqual(mockLogs);
      expect(mockDockerService.getContainerLogs).toHaveBeenCalledWith(containerId, undefined);
    });

    it('should get container logs successfully with options', async () => {
      const containerId = 'container-123';
      const logOptions: LogOptions = {
        tail: 50,
        since: new Date('2023-01-01T00:00:00Z'),
        timestamps: true
      };
      const mockLogs = ['2023-01-01T00:00:01Z Log line 1', '2023-01-01T00:00:02Z Log line 2'];
      mockDockerService.getContainerLogs.mockResolvedValue(mockLogs);

      const result = await containerService.getLogs(containerId, logOptions);

      expect(result).toEqual(mockLogs);
      expect(mockDockerService.getContainerLogs).toHaveBeenCalledWith(containerId, logOptions);
    });

    it('should return empty array when no logs exist', async () => {
      const containerId = 'container-123';
      mockDockerService.getContainerLogs.mockResolvedValue([]);

      const result = await containerService.getLogs(containerId);

      expect(result).toEqual([]);
      expect(mockDockerService.getContainerLogs).toHaveBeenCalledWith(containerId, undefined);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.getContainerLogs.mockRejectedValue(dockerError);

      await expect(containerService.getLogs(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.getLogs(containerId)).rejects.toThrow(
        `Failed to get logs for container '${containerId}'`
      );
    });
  });

  describe('getStats', () => {
    it('should get container stats successfully', async () => {
      const containerId = 'container-123';
      const mockStats = {
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
      mockDockerService.getContainerStats.mockResolvedValue(mockStats);

      const result = await containerService.getStats(containerId);

      expect(result).toEqual(mockStats);
      expect(mockDockerService.getContainerStats).toHaveBeenCalledWith(containerId);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const containerId = 'container-123';
      const dockerError = new Error('Container not found');
      mockDockerService.getContainerStats.mockRejectedValue(dockerError);

      await expect(containerService.getStats(containerId)).rejects.toThrow(ContainerServiceError);
      await expect(containerService.getStats(containerId)).rejects.toThrow(
        `Failed to get stats for container '${containerId}'`
      );
    });
  });

  describe('getContainerById', () => {
    it('should return container when found by ID', async () => {
      const containers = [mockContainer];
      mockDockerService.listContainers.mockResolvedValue(containers);

      const result = await containerService.getContainerById(mockContainer.id);

      expect(result).toEqual(mockContainer);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });

    it('should return container when found by name', async () => {
      const containers = [mockContainer];
      mockDockerService.listContainers.mockResolvedValue(containers);

      const result = await containerService.getContainerById(mockContainer.name);

      expect(result).toEqual(mockContainer);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });

    it('should return null when container not found', async () => {
      mockDockerService.listContainers.mockResolvedValue([]);

      const result = await containerService.getContainerById('non-existent-id');

      expect(result).toBeNull();
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const dockerError = new Error('Docker daemon not available');
      mockDockerService.listContainers.mockRejectedValue(dockerError);

      await expect(containerService.getContainerById('some-id')).rejects.toThrow(ContainerServiceError);
      await expect(containerService.getContainerById('some-id')).rejects.toThrow(
        "Failed to get container 'some-id'"
      );
    });
  });

  describe('monitorContainerStatus', () => {
    it('should return container status successfully', async () => {
      const containers = [mockContainer];
      mockDockerService.listContainers.mockResolvedValue(containers);

      const result = await containerService.monitorContainerStatus(mockContainer.id);

      expect(result).toEqual(mockContainer);
      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(1);
    });

    it('should throw ContainerServiceError when container not found', async () => {
      mockDockerService.listContainers.mockResolvedValue([]);

      await expect(containerService.monitorContainerStatus('non-existent-id')).rejects.toThrow(
        ContainerServiceError
      );
      await expect(containerService.monitorContainerStatus('non-existent-id')).rejects.toThrow(
        "Container 'non-existent-id' not found"
      );
    });

    it('should throw ContainerServiceError when Docker service fails', async () => {
      const dockerError = new Error('Docker daemon not available');
      mockDockerService.listContainers.mockRejectedValue(dockerError);

      await expect(containerService.monitorContainerStatus('some-id')).rejects.toThrow(
        ContainerServiceError
      );
      await expect(containerService.monitorContainerStatus('some-id')).rejects.toThrow(
        "Failed to get container 'some-id'"
      );
    });
  });

  describe('error handling', () => {
    it('should preserve original ContainerServiceError when thrown', async () => {
      const originalError = new ContainerServiceError('Original error message');
      mockValidateContainerConfig.mockImplementation(() => {
        throw originalError;
      });

      await expect(containerService.create(mockContainerConfig)).rejects.toBe(originalError);
    });

    it('should wrap non-ContainerServiceError in ContainerServiceError', async () => {
      const originalError = new Error('Some other error');
      mockDockerService.listContainers.mockRejectedValue(originalError);

      await expect(containerService.list()).rejects.toThrow(ContainerServiceError);
      
      try {
        await containerService.list();
      } catch (error) {
        expect(error).toBeInstanceOf(ContainerServiceError);
        expect((error as ContainerServiceError).originalError).toBe(originalError);
      }
    });
  });
});