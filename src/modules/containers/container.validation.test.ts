import {
  validatePortMapping,
  validateVolumeMapping,
  validateNetworkConfig,
  validateResourceLimits,
  validateHealthCheck,
  validateSecurityOptions,
  validateRestartPolicy,
  validateContainerName,
  validateImageReference,
  validateEnvironmentVariables,
  validateContainerConfig,
  validateCreateContainerRequest,
  validatePortConflicts
} from './container.validation';

import {
  PortMapping,
  VolumeMapping,
  NetworkConfig,
  ResourceLimits,
  HealthCheck,
  SecurityOptions,
  ContainerConfig,
  CreateContainerRequest
} from '../../types/container.types';

describe('Container Validation', () => {
  describe('validatePortMapping', () => {
    it('should validate valid port mapping', () => {
      const validPort: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp',
        description: 'Web server'
      };

      const errors = validatePortMapping(validPort);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid host port', () => {
      const invalidPort: PortMapping = {
        hostPort: 0,
        containerPort: 80,
        protocol: 'tcp'
      };

      const errors = validatePortMapping(invalidPort);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('hostPort');
      expect(errors[0]?.message).toContain('between 1 and 65535');
    });

    it('should reject invalid container port', () => {
      const invalidPort: PortMapping = {
        hostPort: 8080,
        containerPort: 70000,
        protocol: 'tcp'
      };

      const errors = validatePortMapping(invalidPort);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('containerPort');
    });

    it('should reject invalid protocol', () => {
      const invalidPort: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'invalid' as any
      };

      const errors = validatePortMapping(invalidPort);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('protocol');
    });

    it('should reject non-string description', () => {
      const invalidPort: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp',
        description: 123 as any
      };

      const errors = validatePortMapping(invalidPort);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('description');
    });
  });

  describe('validateVolumeMapping', () => {
    it('should validate valid volume mapping', () => {
      const validVolume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw',
        description: 'Data volume'
      };

      const errors = validateVolumeMapping(validVolume);
      expect(errors).toHaveLength(0);
    });

    it('should reject relative host path', () => {
      const invalidVolume: VolumeMapping = {
        hostPath: 'relative/path',
        containerPath: '/app/data',
        mode: 'rw'
      };

      const errors = validateVolumeMapping(invalidVolume);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('hostPath');
      expect(errors[0]?.message).toContain('absolute path');
    });

    it('should reject relative container path', () => {
      const invalidVolume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: 'relative/path',
        mode: 'rw'
      };

      const errors = validateVolumeMapping(invalidVolume);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('containerPath');
    });

    it('should reject invalid mode', () => {
      const invalidVolume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'invalid' as any
      };

      const errors = validateVolumeMapping(invalidVolume);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('mode');
    });
  });

  describe('validateNetworkConfig', () => {
    it('should validate valid network config', () => {
      const validNetwork: NetworkConfig = {
        name: 'my-network',
        driver: 'bridge',
        options: {
          'com.docker.network.bridge.name': 'docker0'
        }
      };

      const errors = validateNetworkConfig(validNetwork);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid network name', () => {
      const invalidNetwork: NetworkConfig = {
        name: '-invalid-name'
      };

      const errors = validateNetworkConfig(invalidNetwork);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
    });

    it('should reject non-string option values', () => {
      const invalidNetwork: NetworkConfig = {
        name: 'valid-name',
        options: {
          'key': 123 as any
        }
      };

      const errors = validateNetworkConfig(invalidNetwork);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('options.key');
    });
  });

  describe('validateResourceLimits', () => {
    it('should validate valid resource limits', () => {
      const validResources: ResourceLimits = {
        memory: 512,
        cpus: 2.0,
        diskSpace: 1024,
        pidsLimit: 100,
        ulimits: [
          { name: 'nofile', soft: 1024, hard: 2048 }
        ]
      };

      const errors = validateResourceLimits(validResources);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative memory', () => {
      const invalidResources: ResourceLimits = {
        memory: -100
      };

      const errors = validateResourceLimits(invalidResources);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('memory');
    });

    it('should reject too low memory', () => {
      const invalidResources: ResourceLimits = {
        memory: 2
      };

      const errors = validateResourceLimits(invalidResources);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('memory');
      expect(errors[0]?.message).toContain('at least 4 MB');
    });

    it('should reject invalid ulimit with soft > hard', () => {
      const invalidResources: ResourceLimits = {
        ulimits: [
          { name: 'nofile', soft: 2048, hard: 1024 }
        ]
      };

      const errors = validateResourceLimits(invalidResources);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('ulimits[0]');
      expect(errors[0]?.message).toContain('soft value cannot be greater than hard');
    });
  });

  describe('validateHealthCheck', () => {
    it('should validate valid health check', () => {
      const validHealthCheck: HealthCheck = {
        test: ['CMD', 'curl', '-f', 'http://localhost/health'],
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 60
      };

      const errors = validateHealthCheck(validHealthCheck);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty test array', () => {
      const invalidHealthCheck: HealthCheck = {
        test: []
      };

      const errors = validateHealthCheck(invalidHealthCheck);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('test');
    });

    it('should reject timeout >= interval', () => {
      const invalidHealthCheck: HealthCheck = {
        test: ['CMD', 'true'],
        interval: 30,
        timeout: 30
      };

      const errors = validateHealthCheck(invalidHealthCheck);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('timeout');
      expect(errors[0]?.message).toContain('must be less than interval');
    });
  });

  describe('validateSecurityOptions', () => {
    it('should validate valid security options', () => {
      const validSecurity: SecurityOptions = {
        privileged: false,
        readOnly: true,
        user: 'www-data:www-data',
        capabilities: {
          add: ['NET_ADMIN'],
          drop: ['ALL']
        }
      };

      const errors = validateSecurityOptions(validSecurity);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid user format', () => {
      const invalidSecurity: SecurityOptions = {
        user: 'invalid user name'
      };

      const errors = validateSecurityOptions(invalidSecurity);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('user');
    });

    it('should reject non-array capabilities', () => {
      const invalidSecurity: SecurityOptions = {
        capabilities: {
          add: 'NET_ADMIN' as any
        }
      };

      const errors = validateSecurityOptions(invalidSecurity);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('capabilities.add');
    });
  });

  describe('validateRestartPolicy', () => {
    it('should validate valid restart policies', () => {
      const validPolicies = ['no', 'always', 'unless-stopped', 'on-failure'];
      
      validPolicies.forEach(policy => {
        const errors = validateRestartPolicy(policy as any);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid restart policy', () => {
      const errors = validateRestartPolicy('invalid' as any);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('restartPolicy');
    });
  });

  describe('validateContainerName', () => {
    it('should validate valid container names', () => {
      const validNames = ['web-server', 'app_1', 'my-app.test', 'container123'];
      
      validNames.forEach(name => {
        const errors = validateContainerName(name);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject names starting with special characters', () => {
      const errors = validateContainerName('-invalid');
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(64);
      const errors = validateContainerName(longName);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('name');
      expect(errors[0]?.message).toContain('63 characters');
    });
  });

  describe('validateImageReference', () => {
    it('should validate valid image references', () => {
      const validImages = [
        { image: 'nginx', tag: 'latest' },
        { image: 'ubuntu', tag: '20.04' },
        { image: 'registry.example.com/myapp', tag: 'v1.0.0' }
      ];

      validImages.forEach(({ image, tag }) => {
        const errors = validateImageReference(image, tag);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject uppercase image names', () => {
      const errors = validateImageReference('NGINX');
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('image');
    });

    it('should reject invalid tag format', () => {
      const errors = validateImageReference('nginx', '-invalid');
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('tag');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate valid environment variables', () => {
      const validEnv = {
        'NODE_ENV': 'production',
        'PORT': '3000',
        'DB_HOST': 'localhost'
      };

      const errors = validateEnvironmentVariables(validEnv);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid variable names', () => {
      const invalidEnv = {
        '123INVALID': 'value'
      };

      const errors = validateEnvironmentVariables(invalidEnv);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('environment.123INVALID');
    });

    it('should reject non-string values', () => {
      const invalidEnv = {
        'VALID_NAME': 123 as any
      };

      const errors = validateEnvironmentVariables(invalidEnv);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('environment.VALID_NAME');
    });
  });
}); 
 describe('validateContainerConfig', () => {
    it('should validate complete valid container config', () => {
      const validConfig: ContainerConfig = {
        id: 'container-123',
        name: 'web-server',
        image: 'nginx',
        tag: 'latest',
        environment: {
          'NODE_ENV': 'production'
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
        restartPolicy: 'always',
        resources: {
          memory: 512,
          cpus: 1.0
        },
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/health'],
          interval: 30,
          timeout: 10,
          retries: 3
        },
        security: {
          privileged: false,
          readOnly: false
        },
        labels: {
          'app': 'web-server',
          'version': '1.0'
        },
        workingDir: '/app',
        hostname: 'web-server',
        autoRemove: false
      };

      const result = validateContainerConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validConfig);
    });

    it('should detect port conflicts', () => {
      const configWithDuplicatePorts: ContainerConfig = {
        id: 'container-123',
        name: 'web-server',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8080, containerPort: 8080, protocol: 'tcp' }
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'always',
        resources: {}
      };

      const result = validateContainerConfig(configWithDuplicatePorts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'ports' && e.message.includes('Duplicate'))).toBe(true);
    });

    it('should validate all required fields', () => {
      const incompleteConfig = {
        // Missing required fields
      } as ContainerConfig;

      const result = validateContainerConfig(incompleteConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate nested field errors', () => {
      const configWithInvalidNested: ContainerConfig = {
        id: 'container-123',
        name: 'web-server',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 0, containerPort: 80, protocol: 'tcp' } // Invalid port
        ],
        volumes: [],
        networks: [],
        restartPolicy: 'always',
        resources: {
          memory: -100 // Invalid memory
        }
      };

      const result = validateContainerConfig(configWithInvalidNested);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'ports[0].hostPort')).toBe(true);
      expect(result.errors.some(e => e.field === 'resources.memory')).toBe(true);
    });
  });

  describe('validateCreateContainerRequest', () => {
    it('should validate valid creation request', () => {
      const validRequest: CreateContainerRequest = {
        name: 'web-server',
        image: 'nginx',
        tag: 'latest',
        environment: {
          'NODE_ENV': 'production'
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
        restartPolicy: 'always',
        resources: {
          memory: 512
        }
      };

      const result = validateCreateContainerRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validRequest);
    });

    it('should validate minimal request', () => {
      const minimalRequest: CreateContainerRequest = {
        name: 'simple-app',
        image: 'alpine'
      };

      const result = validateCreateContainerRequest(minimalRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid request', () => {
      const invalidRequest: CreateContainerRequest = {
        name: '', // Invalid name
        image: 'INVALID_IMAGE', // Invalid image
        ports: [
          { hostPort: 0, containerPort: 80, protocol: 'tcp' } // Invalid port
        ]
      };

      const result = validateCreateContainerRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validatePortConflicts', () => {
    it('should detect no conflicts with different ports', () => {
      const containers: ContainerConfig[] = [
        {
          id: '1',
          name: 'web1',
          image: 'nginx',
          tag: 'latest',
          environment: {},
          ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
          volumes: [],
          networks: [],
          restartPolicy: 'always',
          resources: {}
        },
        {
          id: '2',
          name: 'web2',
          image: 'nginx',
          tag: 'latest',
          environment: {},
          ports: [{ hostPort: 8081, containerPort: 80, protocol: 'tcp' }],
          volumes: [],
          networks: [],
          restartPolicy: 'always',
          resources: {}
        }
      ];

      const errors = validatePortConflicts(containers);
      expect(errors).toHaveLength(0);
    });

    it('should detect port conflicts', () => {
      const containers: ContainerConfig[] = [
        {
          id: '1',
          name: 'web1',
          image: 'nginx',
          tag: 'latest',
          environment: {},
          ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
          volumes: [],
          networks: [],
          restartPolicy: 'always',
          resources: {}
        },
        {
          id: '2',
          name: 'web2',
          image: 'nginx',
          tag: 'latest',
          environment: {},
          ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
          volumes: [],
          networks: [],
          restartPolicy: 'always',
          resources: {}
        }
      ];

      const errors = validatePortConflicts(containers);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('ports');
      expect(errors[0]?.message).toContain('Port 8080 is used by multiple containers');
      expect(errors[0]?.message).toContain('web1, web2');
    });

    it('should handle containers with no ports', () => {
      const containers: ContainerConfig[] = [
        {
          id: '1',
          name: 'worker1',
          image: 'alpine',
          tag: 'latest',
          environment: {},
          ports: [],
          volumes: [],
          networks: [],
          restartPolicy: 'always',
          resources: {}
        }
      ];

      const errors = validatePortConflicts(containers);
      expect(errors).toHaveLength(0);
    });
  });
});