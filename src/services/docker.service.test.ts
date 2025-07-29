import Docker from 'dockerode';
import { DockerServiceImpl, DockerConnectionError, DockerOperationError } from './docker.service';

// Mock dockerode
jest.mock('dockerode');

describe('DockerService', () => {
  let dockerService: DockerServiceImpl;
  let mockDocker: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock Docker instance
    mockDocker = {
      ping: jest.fn(),
      info: jest.fn(),
      version: jest.fn(),
      pull: jest.fn(),
      listImages: jest.fn(),
      getImage: jest.fn(),
      modem: {
        followProgress: jest.fn()
      }
    };

    // Mock Docker constructor
    (Docker as jest.MockedClass<typeof Docker>).mockImplementation(() => mockDocker);

    dockerService = new DockerServiceImpl();
  });

  describe('initialization', () => {
    it('should initialize successfully when Docker is available', async () => {
      mockDocker.ping.mockResolvedValue(undefined);

      await expect(dockerService.initialize()).resolves.not.toThrow();
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should throw DockerConnectionError when Docker is not available', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Connection refused'));

      await expect(dockerService.initialize()).rejects.toThrow(DockerConnectionError);
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should handle ping returning false', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Docker not running'));

      await expect(dockerService.initialize()).rejects.toThrow(DockerConnectionError);
    });
  });

  describe('ping', () => {
    it('should return true when Docker daemon responds', async () => {
      mockDocker.ping.mockResolvedValue(undefined);

      const result = await dockerService.ping();
      expect(result).toBe(true);
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should return false when Docker daemon does not respond', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await dockerService.ping();
      expect(result).toBe(false);
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should retry on failure and eventually succeed', async () => {
      mockDocker.ping
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(undefined);

      const result = await dockerService.ping();
      expect(result).toBe(true);
      expect(mockDocker.ping).toHaveBeenCalledTimes(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Docker is working', async () => {
      const mockInfo = {
        Containers: 5,
        Images: 10,
        ServerVersion: '20.10.0',
        OperatingSystem: 'Ubuntu 20.04',
        Architecture: 'x86_64'
      };
      const mockVersion = {
        Version: '20.10.0',
        ApiVersion: '1.41',
        Arch: 'amd64',
        BuildTime: '2021-01-01T00:00:00.000000000+00:00',
        Components: [],
        GitCommit: 'abc123',
        GoVersion: 'go1.16',
        KernelVersion: '5.4.0',
        MinAPIVersion: '1.12',
        Os: 'linux'
      };

      mockDocker.ping.mockResolvedValue(undefined);
      mockDocker.info.mockResolvedValue(mockInfo);
      mockDocker.version.mockResolvedValue(mockVersion);

      const result = await dockerService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({
        version: '20.10.0',
        apiVersion: '1.41',
        containers: 5,
        images: 10,
        serverVersion: '20.10.0',
        operatingSystem: 'Ubuntu 20.04',
        architecture: 'x86_64'
      });
    });

    it('should return unhealthy status when ping fails', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await dockerService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBe('Docker daemon is not responding to ping');
    });

    it('should return unhealthy status when info fails', async () => {
      mockDocker.ping.mockResolvedValue(undefined);
      mockDocker.info.mockRejectedValue(new Error('Info failed'));

      const result = await dockerService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toContain('Failed to get Docker info');
    });

    it('should include timestamp in unhealthy response', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await dockerService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.timestamp).toBeDefined();
      expect(new Date(result.details.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('getDockerInfo', () => {
    it('should return Docker info successfully', async () => {
      const mockInfo = {
        Containers: 5,
        Images: 10,
        ServerVersion: '20.10.0'
      };
      mockDocker.info.mockResolvedValue(mockInfo);

      const result = await dockerService.getDockerInfo();

      expect(result).toEqual(mockInfo);
      expect(mockDocker.info).toHaveBeenCalled();
    });

    it('should throw DockerOperationError on failure', async () => {
      mockDocker.info.mockRejectedValue(new Error('Info failed'));

      await expect(dockerService.getDockerInfo()).rejects.toThrow(DockerOperationError);
      expect(mockDocker.info).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      const mockInfo = { Containers: 5 };
      mockDocker.info
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(mockInfo);

      const result = await dockerService.getDockerInfo();

      expect(result).toEqual(mockInfo);
      expect(mockDocker.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('pullImage', () => {
    it('should pull image successfully', async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      
      // Mock pull to return a promise that resolves to a stream
      mockDocker.pull.mockImplementation((imageRef: string) => {
        return Promise.resolve(mockStream);
      });
      
      // Mock followProgress
      mockDocker.modem.followProgress = jest.fn().mockImplementation((stream: any, callback: any) => {
        callback(null);
      });

      await expect(dockerService.pullImage('nginx', '1.20')).resolves.not.toThrow();
      expect(mockDocker.pull).toHaveBeenCalledWith('nginx:1.20');
    });

    it('should use latest tag by default', async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress = jest.fn().mockImplementation((stream: any, callback: any) => {
        callback(null);
      });

      await dockerService.pullImage('nginx');
      expect(mockDocker.pull).toHaveBeenCalledWith('nginx:latest');
    });

    it('should throw DockerOperationError on pull failure', async () => {
      mockDocker.pull.mockRejectedValue(new Error('Pull failed'));

      await expect(dockerService.pullImage('nginx')).rejects.toThrow(DockerOperationError);
    });

    it('should throw DockerOperationError on progress failure', async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress = jest.fn().mockImplementation((stream: any, callback: any) => {
        callback(new Error('Progress failed'));
      });

      await expect(dockerService.pullImage('nginx')).rejects.toThrow(DockerOperationError);
    });
  });

  describe('listImages', () => {
    it('should list images successfully', async () => {
      const mockImages = [
        {
          Id: 'sha256:abc123',
          RepoTags: ['nginx:latest', 'nginx:1.20'],
          Size: 133000000,
          ParentId: '',
          Created: 1640995200,
          VirtualSize: 133000000,
          SharedSize: 0,
          Labels: {},
          Containers: 0
        },
        {
          Id: 'sha256:def456',
          RepoTags: ['redis:6'],
          Size: 104000000,
          ParentId: '',
          Created: 1640995200,
          VirtualSize: 104000000,
          SharedSize: 0,
          Labels: {},
          Containers: 0
        }
      ];
      mockDocker.listImages.mockResolvedValue(mockImages);

      const result = await dockerService.listImages();

      expect(result).toEqual([
        {
          id: 'sha256:abc123',
          tags: ['nginx:latest', 'nginx:1.20'],
          size: 133000000
        },
        {
          id: 'sha256:def456',
          tags: ['redis:6'],
          size: 104000000
        }
      ]);
      expect(mockDocker.listImages).toHaveBeenCalled();
    });

    it('should handle images without tags', async () => {
      const mockImages = [
        {
          Id: 'sha256:abc123',
          RepoTags: null,
          Size: 133000000,
          ParentId: '',
          Created: 1640995200,
          VirtualSize: 133000000,
          SharedSize: 0,
          Labels: {},
          Containers: 0
        }
      ];
      mockDocker.listImages.mockResolvedValue(mockImages);

      const result = await dockerService.listImages();

      expect(result).toEqual([
        {
          id: 'sha256:abc123',
          tags: [],
          size: 133000000
        }
      ]);
    });

    it('should throw DockerOperationError on failure', async () => {
      mockDocker.listImages.mockRejectedValue(new Error('List failed'));

      await expect(dockerService.listImages()).rejects.toThrow(DockerOperationError);
    });
  });

  describe('removeImage', () => {
    it('should remove image successfully', async () => {
      const mockImage = {
        remove: jest.fn().mockResolvedValue(undefined)
      };
      mockDocker.getImage.mockReturnValue(mockImage as any);

      await expect(dockerService.removeImage('sha256:abc123')).resolves.not.toThrow();
      expect(mockDocker.getImage).toHaveBeenCalledWith('sha256:abc123');
      expect(mockImage.remove).toHaveBeenCalled();
    });

    it('should throw DockerOperationError on failure', async () => {
      const mockImage = {
        remove: jest.fn().mockRejectedValue(new Error('Remove failed'))
      };
      mockDocker.getImage.mockReturnValue(mockImage as any);

      await expect(dockerService.removeImage('sha256:abc123')).rejects.toThrow(DockerOperationError);
    });
  });

  describe('error handling and retries', () => {
    it('should retry operations on failure', async () => {
      mockDocker.info
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValue({ Containers: 5 });

      const result = await dockerService.getDockerInfo();

      expect(result).toEqual({ Containers: 5 });
      expect(mockDocker.info).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retries', async () => {
      mockDocker.info.mockRejectedValue(new Error('Persistent failure'));

      await expect(dockerService.getDockerInfo()).rejects.toThrow(DockerOperationError);
      expect(mockDocker.info).toHaveBeenCalledTimes(3); // Default retry count
    });

    it('should handle timeout errors', async () => {
      // Mock a long-running operation that exceeds the service timeout (5000ms)
      mockDocker.info.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 100))
      );

      await expect(dockerService.getDockerInfo()).rejects.toThrow(DockerOperationError);
    });
  });

  describe('destroy', () => {
    it('should destroy service without errors', async () => {
      await expect(dockerService.destroy()).resolves.not.toThrow();
    });
  });
});