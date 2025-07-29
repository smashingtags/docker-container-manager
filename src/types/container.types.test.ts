import { 
  ContainerConfig, 
  PortMapping, 
  VolumeMapping, 
  ResourceLimits,
  HealthCheck,
  SecurityOptions,
  CreateContainerRequest,
  ValidationResult,
  ValidationError
} from './container.types';

describe('Container Types', () => {
  describe('ContainerConfig', () => {
    it('should define the correct interface structure with basic properties', () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [],
        volumes: [],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      expect(config.id).toBe('test-container');
      expect(config.name).toBe('test-app');
      expect(config.image).toBe('nginx');
      expect(config.tag).toBe('latest');
      expect(config.restartPolicy).toBe('unless-stopped');
    });

    it('should support extended configuration options', () => {
      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [],
        volumes: [],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {},
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/'],
          interval: 30,
          timeout: 10,
          retries: 3
        },
        security: {
          privileged: false,
          readOnly: true,
          user: '1000:1000'
        },
        labels: {
          'app.name': 'test-app',
          'app.version': '1.0.0'
        },
        workingDir: '/app',
        hostname: 'test-host',
        autoRemove: true
      };

      expect(config.healthCheck?.test).toEqual(['CMD', 'curl', '-f', 'http://localhost/']);
      expect(config.security?.privileged).toBe(false);
      expect(config.labels?.['app.name']).toBe('test-app');
      expect(config.workingDir).toBe('/app');
      expect(config.hostname).toBe('test-host');
      expect(config.autoRemove).toBe(true);
    });
  });

  describe('PortMapping', () => {
    it('should define the correct interface structure', () => {
      const portMapping: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp',
        description: 'HTTP port'
      };

      expect(portMapping.hostPort).toBe(8080);
      expect(portMapping.containerPort).toBe(80);
      expect(portMapping.protocol).toBe('tcp');
      expect(portMapping.description).toBe('HTTP port');
    });

    it('should support UDP protocol', () => {
      const portMapping: PortMapping = {
        hostPort: 53,
        containerPort: 53,
        protocol: 'udp'
      };

      expect(portMapping.protocol).toBe('udp');
    });
  });

  describe('VolumeMapping', () => {
    it('should define the correct interface structure', () => {
      const volumeMapping: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw',
        description: 'Application data'
      };

      expect(volumeMapping.hostPath).toBe('/host/data');
      expect(volumeMapping.containerPath).toBe('/app/data');
      expect(volumeMapping.mode).toBe('rw');
      expect(volumeMapping.description).toBe('Application data');
    });

    it('should support read-only mode', () => {
      const volumeMapping: VolumeMapping = {
        hostPath: '/host/config',
        containerPath: '/app/config',
        mode: 'ro'
      };

      expect(volumeMapping.mode).toBe('ro');
    });
  });

  describe('ResourceLimits', () => {
    it('should define basic resource limits', () => {
      const resources: ResourceLimits = {
        memory: 512,
        cpus: 1.5,
        diskSpace: 1024
      };

      expect(resources.memory).toBe(512);
      expect(resources.cpus).toBe(1.5);
      expect(resources.diskSpace).toBe(1024);
    });

    it('should support extended resource limits', () => {
      const resources: ResourceLimits = {
        memory: 512,
        cpus: 1.5,
        pidsLimit: 100,
        ulimits: [
          { name: 'nofile', soft: 1024, hard: 2048 },
          { name: 'nproc', soft: 512, hard: 1024 }
        ]
      };

      expect(resources.pidsLimit).toBe(100);
      expect(resources.ulimits).toHaveLength(2);
      if (resources.ulimits && resources.ulimits.length > 0) {
        expect(resources.ulimits[0]!.name).toBe('nofile');
        expect(resources.ulimits[0]!.soft).toBe(1024);
        expect(resources.ulimits[0]!.hard).toBe(2048);
      }
    });
  });

  describe('HealthCheck', () => {
    it('should define health check configuration', () => {
      const healthCheck: HealthCheck = {
        test: ['CMD', 'curl', '-f', 'http://localhost/health'],
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 60
      };

      expect(healthCheck.test).toEqual(['CMD', 'curl', '-f', 'http://localhost/health']);
      expect(healthCheck.interval).toBe(30);
      expect(healthCheck.timeout).toBe(10);
      expect(healthCheck.retries).toBe(3);
      expect(healthCheck.startPeriod).toBe(60);
    });
  });

  describe('SecurityOptions', () => {
    it('should define security configuration', () => {
      const security: SecurityOptions = {
        privileged: false,
        readOnly: true,
        user: '1000:1000',
        capabilities: {
          add: ['NET_ADMIN'],
          drop: ['ALL']
        }
      };

      expect(security.privileged).toBe(false);
      expect(security.readOnly).toBe(true);
      expect(security.user).toBe('1000:1000');
      expect(security.capabilities?.add).toEqual(['NET_ADMIN']);
      expect(security.capabilities?.drop).toEqual(['ALL']);
    });
  });

  describe('CreateContainerRequest', () => {
    it('should define container creation request structure', () => {
      const request: CreateContainerRequest = {
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
        volumes: [{ hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: { memory: 512 }
      };

      expect(request.name).toBe('test-app');
      expect(request.image).toBe('nginx');
      expect(request.ports).toHaveLength(1);
      expect(request.volumes).toHaveLength(1);
      expect(request.networks).toEqual(['bridge']);
    });
  });

  describe('ValidationResult', () => {
    it('should define validation result for successful validation', () => {
      const result: ValidationResult<string> = {
        isValid: true,
        data: 'test-data',
        errors: []
      };

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('test-data');
      expect(result.errors).toHaveLength(0);
    });

    it('should define validation result for failed validation', () => {
      const errors: ValidationError[] = [
        { field: 'name', message: 'Name is required' },
        { field: 'image', message: 'Image is required' }
      ];

      const result: ValidationResult<any> = {
        isValid: false,
        errors
      };

      expect(result.isValid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]!.field).toBe('name');
      expect(result.errors[1]!.field).toBe('image');
    });
  });
});