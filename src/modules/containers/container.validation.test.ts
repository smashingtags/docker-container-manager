import {
  validateContainerConfig,
  validateCreateContainerRequest,
  validatePortMapping,
  validateVolumeMapping,
  validateRestartPolicy,
  validateResourceLimits,
  validateHealthCheck,
  validateSecurityOptions,
  validateHostPathExists,
  validatePortAvailability,
  validateContainerNameUniqueness
} from './container.validation';
import {
  ContainerConfig,
  CreateContainerRequest,
  PortMapping,
  VolumeMapping,
  ResourceLimits,
  HealthCheck,
  SecurityOptions,
  RestartPolicy
} from '../../types/container.types';
import * as fs from 'fs';

// Mock fs module for testing
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Container Validation', () => {
  describe('validatePortMapping', () => {
    it('should validate a correct port mapping', () => {
      const port: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp',
        description: 'Web server port'
      };

      const result = validatePortMapping(port);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(port);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid host port', () => {
      const port: PortMapping = {
        hostPort: 0,
        containerPort: 80,
        protocol: 'tcp'
      };

      const result = validatePortMapping(port);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('hostPort');
      expect(result.errors[0]!.message).toContain('must be between 1 and 65535');
    });

    it('should reject invalid container port', () => {
      const port: PortMapping = {
        hostPort: 8080,
        containerPort: 70000,
        protocol: 'tcp'
      };

      const result = validatePortMapping(port);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('containerPort');
      expect(result.errors[0]!.message).toContain('must be between 1 and 65535');
    });

    it('should reject invalid protocol', () => {
      const port: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'http' as any
      };

      const result = validatePortMapping(port);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('protocol');
      expect(result.errors[0]!.message).toContain('must be either "tcp" or "udp"');
    });

    it('should accept port mapping without description', () => {
      const port: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp'
      };

      const result = validatePortMapping(port);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateVolumeMapping', () => {
    it('should validate a correct volume mapping', () => {
      const volume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw',
        description: 'Application data'
      };

      const result = validateVolumeMapping(volume);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(volume);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject relative host path', () => {
      const volume: VolumeMapping = {
        hostPath: 'relative/path',
        containerPath: '/app/data',
        mode: 'rw'
      };

      const result = validateVolumeMapping(volume);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('hostPath');
      expect(result.errors[0]!.message).toContain('must be an absolute path');
    });

    it('should reject invalid mode', () => {
      const volume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'invalid' as any
      };

      const result = validateVolumeMapping(volume);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('mode');
      expect(result.errors[0]!.message).toContain('must be either "ro" (read-only) or "rw" (read-write)');
    });
  });

  describe('validateRestartPolicy', () => {
    it('should validate correct restart policies', () => {
      const policies: RestartPolicy[] = ['no', 'always', 'unless-stopped', 'on-failure'];
      
      policies.forEach(policy => {
        const result = validateRestartPolicy(policy);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(policy);
      });
    });

    it('should reject invalid restart policy', () => {
      const result = validateRestartPolicy('invalid' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('restartPolicy');
      expect(result.errors[0]!.message).toContain('must be one of');
    });
  });

  describe('validateResourceLimits', () => {
    it('should validate correct resource limits', () => {
      const resources: ResourceLimits = {
        memory: 512,
        cpus: 1.5,
        diskSpace: 1024,
        pidsLimit: 100,
        ulimits: [
          { name: 'nofile', soft: 1024, hard: 2048 }
        ]
      };

      const result = validateResourceLimits(resources);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(resources);
    });

    it('should reject negative memory limit', () => {
      const resources: ResourceLimits = {
        memory: -512
      };

      const result = validateResourceLimits(resources);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('memory');
      expect(result.errors[0]!.message).toContain('must be greater than 0');
    });

    it('should reject ulimits where soft > hard', () => {
      const resources: ResourceLimits = {
        ulimits: [
          { name: 'nofile', soft: 2048, hard: 1024 }
        ]
      };

      const result = validateResourceLimits(resources);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('soft value cannot be greater than hard value'))).toBe(true);
    });
  });

  describe('validateHealthCheck', () => {
    it('should validate correct health check', () => {
      const healthCheck: HealthCheck = {
        test: ['CMD', 'curl', '-f', 'http://localhost/health'],
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 60
      };

      const result = validateHealthCheck(healthCheck);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(healthCheck);
    });

    it('should reject empty test array', () => {
      const healthCheck: HealthCheck = {
        test: []
      };

      const result = validateHealthCheck(healthCheck);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('test');
      expect(result.errors[0]!.message).toContain('must be a non-empty array');
    });

    it('should reject timeout >= interval', () => {
      const healthCheck: HealthCheck = {
        test: ['CMD', 'echo', 'ok'],
        interval: 30,
        timeout: 30
      };

      const result = validateHealthCheck(healthCheck);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('timeout');
      expect(result.errors[0]!.message).toContain('must be less than interval');
    });
  });

  describe('validateSecurityOptions', () => {
    it('should validate correct security options', () => {
      const security: SecurityOptions = {
        privileged: false,
        readOnly: true,
        user: 'appuser',
        capabilities: {
          add: ['NET_ADMIN'],
          drop: ['ALL']
        }
      };

      const result = validateSecurityOptions(security);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(security);
    });

    it('should reject invalid privileged flag', () => {
      const security: SecurityOptions = {
        privileged: 'true' as any
      };

      const result = validateSecurityOptions(security);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('privileged');
      expect(result.errors[0]!.message).toContain('must be a boolean');
    });
  });

  describe('validateCreateContainerRequest', () => {
    it('should validate a minimal container request', () => {
      const request: CreateContainerRequest = {
        name: 'test-container',
        image: 'nginx'
      };

      const result = validateCreateContainerRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(request);
    });

    it('should reject invalid container name', () => {
      const request: CreateContainerRequest = {
        name: '-invalid-name',
        image: 'nginx'
      };

      const result = validateCreateContainerRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('name');
      expect(result.errors[0]!.message).toContain('must start with alphanumeric character');
    });

    it('should reject missing image', () => {
      const request: CreateContainerRequest = {
        name: 'test-container',
        image: ''
      };

      const result = validateCreateContainerRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('image');
      expect(result.errors[0]!.message).toContain('is required');
    });
  });

  describe('validateContainerConfig', () => {
    it('should validate a complete container configuration', () => {
      const config: ContainerConfig = {
        id: 'container-123',
        name: 'web-server',
        image: 'nginx',
        tag: 'latest',
        environment: {
          NODE_ENV: 'production'
        },
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' }
        ],
        volumes: [
          { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }
        ],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {
          memory: 512,
          cpus: 1
        }
      };

      const result = validateContainerConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(config);
    });

    it('should reject missing required fields', () => {
      const config: Partial<ContainerConfig> = {
        name: 'web-server',
        image: 'nginx'
        // Missing id, tag, environment, ports, volumes, networks, restartPolicy, resources
      };

      const result = validateContainerConfig(config as ContainerConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
      expect(result.errors.some(e => e.field === 'tag')).toBe(true);
    });
  });

  describe('validateHostPathExists', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should validate existing directory', () => {
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false
      };
      mockedFs.statSync.mockReturnValue(mockStats as any);

      const result = validateHostPathExists('/existing/directory');
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('/existing/directory');
    });

    it('should reject non-existent path', () => {
      mockedFs.statSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = validateHostPathExists('/non/existent/path');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('hostPath');
      expect(result.errors[0]!.message).toContain('does not exist');
    });
  });

  describe('validatePortAvailability', () => {
    it('should validate available high port', () => {
      const result = validatePortAvailability(8080);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(8080);
    });

    it('should warn about reserved ports', () => {
      const result = validatePortAvailability(80);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('hostPort');
      expect(result.errors[0]!.message).toContain('commonly reserved');
    });
  });

  describe('validateContainerNameUniqueness', () => {
    it('should validate unique name', () => {
      const existingNames = ['container1', 'container2'];
      const result = validateContainerNameUniqueness('new-container', existingNames);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('new-container');
    });

    it('should reject duplicate name', () => {
      const existingNames = ['container1', 'container2'];
      const result = validateContainerNameUniqueness('container1', existingNames);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.field).toBe('name');
      expect(result.errors[0]!.message).toContain('must be unique');
    });
  });
});