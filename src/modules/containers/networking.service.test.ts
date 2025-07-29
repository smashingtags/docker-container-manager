import { NetworkingServiceImpl, NetworkingServiceError } from './networking.service';
import { DockerService } from '@/services/docker.service';
import { PortMapping, VolumeMapping } from '@/types/container.types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('NetworkingService', () => {
  let networkingService: NetworkingServiceImpl;
  let mockDockerService: jest.Mocked<DockerService>;

  beforeEach(() => {
    mockDockerService = {
      getUsedPorts: jest.fn(),
      validateHostPath: jest.fn(),
      listNetworks: jest.fn(),
      createNetwork: jest.fn(),
    } as any;

    networkingService = new NetworkingServiceImpl(mockDockerService);
  });

  describe('validatePortMappings', () => {
    it('should validate port mappings successfully', async () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8443, containerPort: 443, protocol: 'tcp' }
      ];

      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);

      const result = await networkingService.validatePortMappings(ports);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(ports);
      expect(mockDockerService.getUsedPorts).toHaveBeenCalled();
    });

    it('should detect port conflicts', async () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 3000, containerPort: 443, protocol: 'tcp' } // Conflict with used port
      ];

      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);

      const result = await networkingService.validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('already in use');
    });

    it('should detect duplicate host ports', async () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 443, protocol: 'tcp' } // Duplicate host port
      ];

      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const result = await networkingService.validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('already in use');
    });

    it('should validate port ranges', async () => {
      const ports: PortMapping[] = [
        { hostPort: 0, containerPort: 80, protocol: 'tcp' }, // Invalid port
        { hostPort: 70000, containerPort: 443, protocol: 'tcp' } // Invalid port
      ];

      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const result = await networkingService.validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about reserved ports', async () => {
      const ports: PortMapping[] = [
        { hostPort: 22, containerPort: 80, protocol: 'tcp' }, // SSH port
        { hostPort: 443, containerPort: 443, protocol: 'tcp' } // HTTPS port
      ];

      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const result = await networkingService.validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('reserved'))).toBe(true);
    });

    it('should handle docker service errors', async () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' }
      ];

      mockDockerService.getUsedPorts.mockRejectedValue(new Error('Docker error'));

      await expect(networkingService.validatePortMappings(ports))
        .rejects.toThrow(NetworkingServiceError);
    });
  });

  describe('validateVolumeMappings', () => {
    it('should validate volume mappings successfully', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/config', containerPath: '/app/config', mode: 'ro' }
      ];

      mockDockerService.validateHostPath
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, accessible: true, isDirectory: true });

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(volumes);
      expect(mockDockerService.validateHostPath).toHaveBeenCalledTimes(2);
    });

    it('should detect duplicate container paths', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data1', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/data2', containerPath: '/app/data', mode: 'ro' } // Duplicate container path
      ];

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('already mapped');
    });

    it('should detect non-existent host paths', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/nonexistent/path', containerPath: '/app/data', mode: 'rw' }
      ];

      mockDockerService.validateHostPath
        .mockResolvedValue({ exists: false, accessible: false, isDirectory: false });

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('does not exist');
    });

    it('should detect inaccessible host paths', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/restricted/path', containerPath: '/app/data', mode: 'rw' }
      ];

      mockDockerService.validateHostPath
        .mockResolvedValue({ exists: true, accessible: false, isDirectory: true });

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('not accessible');
    });

    it('should validate path formats', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: 'relative/path', containerPath: '/app/data', mode: 'rw' }, // Relative path
        { hostPath: '/host/data', containerPath: 'relative/container', mode: 'rw' } // Relative container path
      ];

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about dangerous host paths', async () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/etc', containerPath: '/app/etc', mode: 'rw' }, // Dangerous system path
        { hostPath: '/var', containerPath: '/app/var', mode: 'rw' } // Dangerous system path
      ];

      const result = await networkingService.validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('dangerous'))).toBe(true);
    });
  });

  describe('validateNetworkConfiguration', () => {
    it('should validate network configuration successfully', async () => {
      const networks = ['bridge', 'custom-network'];

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'custom-network', driver: 'bridge', scope: 'local' }
      ]);

      const result = await networkingService.validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(networks);
    });

    it('should detect non-existent networks', async () => {
      const networks = ['bridge', 'nonexistent-network'];

      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);

      const result = await networkingService.validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('does not exist');
    });

    it('should detect duplicate network names', async () => {
      const networks = ['bridge', 'bridge']; // Duplicate

      const result = await networkingService.validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('Duplicate network names');
    });

    it('should validate network name formats', async () => {
      const networks = ['invalid-network-name!', '123invalid']; // Invalid characters

      const result = await networkingService.validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableNetworks', () => {
    it('should return available networks', async () => {
      const mockNetworks = [
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: 'host', driver: 'host', scope: 'local' },
        { id: '3', name: 'custom', driver: 'bridge', scope: 'local' }
      ];

      mockDockerService.listNetworks.mockResolvedValue(mockNetworks);

      const result = await networkingService.getAvailableNetworks();

      expect(result).toEqual(['bridge', 'host', 'custom']);
      expect(mockDockerService.listNetworks).toHaveBeenCalled();
    });

    it('should handle docker service errors', async () => {
      mockDockerService.listNetworks.mockRejectedValue(new Error('Docker error'));

      await expect(networkingService.getAvailableNetworks())
        .rejects.toThrow(NetworkingServiceError);
    });
  });

  describe('getUsedPorts', () => {
    it('should return used ports', async () => {
      const usedPorts = [3000, 8080, 9000];
      mockDockerService.getUsedPorts.mockResolvedValue(usedPorts);

      const result = await networkingService.getUsedPorts();

      expect(result).toEqual(usedPorts);
      expect(mockDockerService.getUsedPorts).toHaveBeenCalled();
    });

    it('should handle docker service errors', async () => {
      mockDockerService.getUsedPorts.mockRejectedValue(new Error('Docker error'));

      await expect(networkingService.getUsedPorts())
        .rejects.toThrow(NetworkingServiceError);
    });
  });

  describe('suggestAvailablePort', () => {
    it('should return preferred port if available', async () => {
      const preferredPort = 8080;
      mockDockerService.getUsedPorts.mockResolvedValue([3000, 5000]);

      const result = await networkingService.suggestAvailablePort(preferredPort);

      expect(result).toBe(preferredPort);
    });

    it('should find next available port if preferred is taken', async () => {
      const preferredPort = 8080;
      mockDockerService.getUsedPorts.mockResolvedValue([8080, 8081]);

      const result = await networkingService.suggestAvailablePort(preferredPort);

      expect(result).toBeGreaterThan(preferredPort);
      expect(result).not.toBe(8080);
      expect(result).not.toBe(8081);
    });

    it('should start from default port if no preference given', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const result = await networkingService.suggestAvailablePort();

      expect(result).toBe(8080); // Default starting port
    });

    it('should skip reserved ports', async () => {
      mockDockerService.getUsedPorts.mockResolvedValue([]);

      const result = await networkingService.suggestAvailablePort(22); // SSH port

      expect(result).not.toBe(22);
      expect(result).not.toBe(80);
      expect(result).not.toBe(443);
    });
  });

  describe('validateHostPath', () => {
    it('should validate existing accessible path', async () => {
      const path = '/valid/path';
      mockDockerService.validateHostPath.mockResolvedValue({
        exists: true,
        accessible: true,
        isDirectory: true
      });

      const result = await networkingService.validateHostPath(path);

      expect(result.isValid).toBe(true);
      expect(result.data).toBe(path);
    });

    it('should reject empty paths', async () => {
      const result = await networkingService.validateHostPath('');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('cannot be empty');
    });

    it('should reject relative paths', async () => {
      const result = await networkingService.validateHostPath('relative/path');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('absolute path');
    });

    it('should reject non-existent paths', async () => {
      const path = '/nonexistent/path';
      mockDockerService.validateHostPath.mockResolvedValue({
        exists: false,
        accessible: false,
        isDirectory: false
      });

      const result = await networkingService.validateHostPath(path);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('does not exist');
    });

    it('should reject inaccessible paths', async () => {
      const path = '/inaccessible/path';
      mockDockerService.validateHostPath.mockResolvedValue({
        exists: true,
        accessible: false,
        isDirectory: true
      });

      const result = await networkingService.validateHostPath(path);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('not accessible');
    });
  });

  describe('createNetworkIfNotExists', () => {
    it('should create network if it does not exist', async () => {
      const networkName = 'new-network';
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' }
      ]);
      mockDockerService.createNetwork.mockResolvedValue({ id: '2', name: networkName });

      await networkingService.createNetworkIfNotExists(networkName);

      expect(mockDockerService.createNetwork).toHaveBeenCalledWith(networkName, {});
    });

    it('should not create network if it already exists', async () => {
      const networkName = 'existing-network';
      mockDockerService.listNetworks.mockResolvedValue([
        { id: '1', name: 'bridge', driver: 'bridge', scope: 'local' },
        { id: '2', name: networkName, driver: 'bridge', scope: 'local' }
      ]);

      await networkingService.createNetworkIfNotExists(networkName);

      expect(mockDockerService.createNetwork).not.toHaveBeenCalled();
    });

    it('should handle docker service errors', async () => {
      const networkName = 'test-network';
      mockDockerService.listNetworks.mockRejectedValue(new Error('Docker error'));

      await expect(networkingService.createNetworkIfNotExists(networkName))
        .rejects.toThrow(NetworkingServiceError);
    });
  });
});