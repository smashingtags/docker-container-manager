import {
  validateSchema,
  validateContainerConfig,
  validatePortMappings,
  validateVolumeMappings,
  validateNetworkConfiguration,
  validateResourceLimits,
  validatePortConfiguration,
  validateVolumeConfiguration,
  validateNetworkCompatibility,
  portMappingSchema,
  volumeMappingSchema,
  resourceLimitsSchema,
  healthCheckSchema,
  securityOptionsSchema,
  containerConfigSchema,
  createContainerRequestSchema,
  deployConfigSchema
} from './validation';
import { PortMapping, VolumeMapping, ResourceLimits, HealthCheck, SecurityOptions, ContainerConfig, CreateContainerRequest } from '@/types/container.types';

describe('Validation Schemas', () => {
  describe('portMappingSchema', () => {
    it('should validate valid port mapping', () => {
      const validPort: PortMapping = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'tcp',
        description: 'Web server port'
      };

      const { error, value } = portMappingSchema.validate(validPort);
      expect(error).toBeUndefined();
      expect(value).toEqual(validPort);
    });

    it('should apply default protocol when not specified', () => {
      const portWithoutProtocol = {
        hostPort: 8080,
        containerPort: 80
      };

      const { error, value } = portMappingSchema.validate(portWithoutProtocol);
      expect(error).toBeUndefined();
      expect(value.protocol).toBe('tcp');
    });

    it('should reject invalid port numbers', () => {
      const invalidPort = {
        hostPort: 70000, // Too high
        containerPort: 80,
        protocol: 'tcp'
      };

      const { error } = portMappingSchema.validate(invalidPort);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be less than or equal to 65535');
    });

    it('should reject invalid protocol', () => {
      const invalidProtocol = {
        hostPort: 8080,
        containerPort: 80,
        protocol: 'http' // Invalid protocol
      };

      const { error } = portMappingSchema.validate(invalidProtocol);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be one of [tcp, udp]');
    });

    it('should reject missing required fields', () => {
      const missingFields = {
        hostPort: 8080
        // Missing containerPort
      };

      const { error } = portMappingSchema.validate(missingFields);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('containerPort');
    });
  });

  describe('volumeMappingSchema', () => {
    it('should validate valid volume mapping', () => {
      const validVolume: VolumeMapping = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'rw',
        description: 'Application data'
      };

      const { error, value } = volumeMappingSchema.validate(validVolume);
      expect(error).toBeUndefined();
      expect(value).toEqual(validVolume);
    });

    it('should apply default mode when not specified', () => {
      const volumeWithoutMode = {
        hostPath: '/host/data',
        containerPath: '/app/data'
      };

      const { error, value } = volumeMappingSchema.validate(volumeWithoutMode);
      expect(error).toBeUndefined();
      expect(value.mode).toBe('rw');
    });

    it('should reject invalid mode', () => {
      const invalidMode = {
        hostPath: '/host/data',
        containerPath: '/app/data',
        mode: 'invalid' // Invalid mode
      };

      const { error } = volumeMappingSchema.validate(invalidMode);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be one of [ro, rw]');
    });

    it('should reject missing required fields', () => {
      const missingFields = {
        hostPath: '/host/data'
        // Missing containerPath
      };

      const { error } = volumeMappingSchema.validate(missingFields);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('containerPath');
    });
  });

  describe('resourceLimitsSchema', () => {
    it('should validate valid resource limits', () => {
      const validResources: ResourceLimits = {
        memory: 512,
        cpus: 1.5,
        diskSpace: 1024,
        pidsLimit: 100,
        ulimits: [
          { name: 'nofile', soft: 1024, hard: 2048 }
        ]
      };

      const { error, value } = resourceLimitsSchema.validate(validResources);
      expect(error).toBeUndefined();
      expect(value).toEqual(validResources);
    });

    it('should reject negative values', () => {
      const negativeMemory = {
        memory: -512
      };

      const { error } = resourceLimitsSchema.validate(negativeMemory);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be greater than or equal to 1');
    });

    it('should reject invalid CPU values', () => {
      const invalidCpus = {
        cpus: 0.05 // Too low
      };

      const { error } = resourceLimitsSchema.validate(invalidCpus);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be greater than or equal to 0.1');
    });

    it('should validate ulimits structure', () => {
      const invalidUlimits = {
        ulimits: [
          { name: 'nofile', soft: 1024 } // Missing hard limit
        ]
      };

      const { error } = resourceLimitsSchema.validate(invalidUlimits);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('hard');
    });
  });

  describe('healthCheckSchema', () => {
    it('should validate valid health check', () => {
      const validHealthCheck: HealthCheck = {
        test: ['CMD', 'curl', '-f', 'http://localhost/health'],
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 60
      };

      const { error, value } = healthCheckSchema.validate(validHealthCheck);
      expect(error).toBeUndefined();
      expect(value).toEqual(validHealthCheck);
    });

    it('should reject empty test array', () => {
      const emptyTest = {
        test: []
      };

      const { error } = healthCheckSchema.validate(emptyTest);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must contain at least 1 items');
    });

    it('should reject negative values', () => {
      const negativeInterval = {
        test: ['CMD', 'echo', 'ok'],
        interval: -30
      };

      const { error } = healthCheckSchema.validate(negativeInterval);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be greater than or equal to 1');
    });
  });

  describe('securityOptionsSchema', () => {
    it('should validate valid security options', () => {
      const validSecurity: SecurityOptions = {
        privileged: false,
        readOnly: true,
        user: '1000:1000',
        capabilities: {
          add: ['NET_ADMIN'],
          drop: ['ALL']
        }
      };

      const { error, value } = securityOptionsSchema.validate(validSecurity);
      expect(error).toBeUndefined();
      expect(value).toEqual(validSecurity);
    });

    it('should accept empty capabilities', () => {
      const emptyCaps = {
        capabilities: {}
      };

      const { error, value } = securityOptionsSchema.validate(emptyCaps);
      expect(error).toBeUndefined();
      expect(value).toEqual(emptyCaps);
    });
  });

  describe('containerConfigSchema', () => {
    it('should validate complete container config', () => {
      const validConfig: ContainerConfig = {
        id: 'container-123',
        name: 'my-app',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
        volumes: [{ hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: { memory: 512 },
        labels: { 'app.name': 'my-app' }
      };

      const { error, value } = containerConfigSchema.validate(validConfig);
      expect(error).toBeUndefined();
      expect(value.tag).toBe('latest'); // Default applied
    });

    it('should apply defaults for optional fields', () => {
      const minimalConfig = {
        id: 'container-123',
        name: 'my-app',
        image: 'nginx'
      };

      const { error, value } = containerConfigSchema.validate(minimalConfig);
      expect(error).toBeUndefined();
      expect(value.tag).toBe('latest');
      expect(value.environment).toEqual({});
      expect(value.ports).toEqual([]);
      expect(value.volumes).toEqual([]);
      expect(value.networks).toEqual([]);
      expect(value.restartPolicy).toBe('unless-stopped');
      expect(value.resources).toEqual({});
    });

    it('should reject invalid container name', () => {
      const invalidName = {
        id: 'container-123',
        name: 'my app', // Spaces not allowed
        image: 'nginx'
      };

      const { error } = containerConfigSchema.validate(invalidName);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('fails to match the required pattern');
    });

    it('should reject invalid restart policy', () => {
      const invalidRestart = {
        id: 'container-123',
        name: 'my-app',
        image: 'nginx',
        restartPolicy: 'invalid-policy'
      };

      const { error } = containerConfigSchema.validate(invalidRestart);
      expect(error).toBeDefined();
      expect(error!.details).toBeDefined();
      expect(error!.details[0]!.message).toContain('must be one of');
    });
  });

  describe('createContainerRequestSchema', () => {
    it('should validate create container request', () => {
      const validRequest: CreateContainerRequest = {
        name: 'my-app',
        image: 'nginx',
        environment: { NODE_ENV: 'production' },
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }]
      };

      const { error, value } = createContainerRequestSchema.validate(validRequest);
      expect(error).toBeUndefined();
      expect(value.tag).toBe('latest'); // Default applied
    });

    it('should require name and image', () => {
      const missingFields = {
        // Missing name and image
        environment: { NODE_ENV: 'production' }
      };

      const { error } = createContainerRequestSchema.validate(missingFields);
      expect(error).toBeDefined();
      expect(error?.details.length).toBeGreaterThan(0);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateSchema', () => {
    it('should return value when validation passes', () => {
      const data = { hostPort: 8080, containerPort: 80, protocol: 'tcp' };
      const result = validateSchema(portMappingSchema, data);
      
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(expect.objectContaining(data));
    });

    it('should return error when validation fails', () => {
      const data = { hostPort: 'invalid', containerPort: 80 };
      const result = validateSchema(portMappingSchema, data);
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('must be a number');
    });
  });

  describe('validateContainerConfig', () => {
    it('should return success result for valid data', () => {
      const data = { hostPort: 8080, containerPort: 80, protocol: 'tcp' };
      const result = validateContainerConfig(portMappingSchema, data);
      
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(expect.objectContaining(data));
      expect(result.errors).toEqual([]);
    });

    it('should return detailed errors for invalid data', () => {
      const data = { hostPort: 'invalid', containerPort: -1 };
      const result = validateContainerConfig(portMappingSchema, data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toEqual(expect.objectContaining({
        field: 'hostPort',
        message: expect.stringContaining('must be a number')
      }));
      expect(result.errors[1]).toEqual(expect.objectContaining({
        field: 'containerPort',
        message: expect.stringContaining('must be greater than or equal to 1')
      }));
    });
  });

  describe('validatePortMappings', () => {
    it('should validate array of valid port mappings', () => {
      const ports = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8443, containerPort: 443, protocol: 'tcp' }
      ];
      
      const result = validatePortMappings(ports);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(ports);
    });

    it('should detect duplicate host ports', () => {
      const ports = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 443, protocol: 'tcp' } // Duplicate host port
      ];
      
      const result = validatePortMappings(ports);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'ports[1].hostPort',
        message: 'Host port 8080 is already in use'
      }));
    });

    it('should warn about reserved ports', () => {
      const ports = [
        { hostPort: 22, containerPort: 22, protocol: 'tcp' } // SSH port
      ];
      
      const result = validatePortMappings(ports);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'ports[0].hostPort',
        message: expect.stringContaining('commonly reserved')
      }));
    });

    it('should validate port ranges', () => {
      const ports = [
        { hostPort: 0, containerPort: 80, protocol: 'tcp' }, // Invalid port
        { hostPort: 8080, containerPort: 70000, protocol: 'tcp' } // Invalid port
      ];
      
      const result = validatePortMappings(ports);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateVolumeMappings', () => {
    it('should validate array of valid volume mappings', () => {
      const volumes = [
        { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/config', containerPath: '/app/config', mode: 'ro' }
      ];
      
      const result = validateVolumeMappings(volumes);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(volumes);
    });

    it('should detect duplicate container paths', () => {
      const volumes = [
        { hostPath: '/host/data1', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/data2', containerPath: '/app/data', mode: 'rw' } // Duplicate container path
      ];
      
      const result = validateVolumeMappings(volumes);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'volumes[1].containerPath',
        message: 'Container path /app/data is already mapped'
      }));
    });

    it('should warn about duplicate host paths', () => {
      const volumes = [
        { hostPath: '/host/data', containerPath: '/app/data1', mode: 'rw' },
        { hostPath: '/host/data', containerPath: '/app/data2', mode: 'rw' } // Duplicate host path
      ];
      
      const result = validateVolumeMappings(volumes);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'volumes[1].hostPath',
        message: expect.stringContaining('mapped multiple times')
      }));
    });

    it('should validate absolute paths', () => {
      const volumes = [
        { hostPath: 'relative/path', containerPath: '/app/data', mode: 'rw' }, // Invalid relative path
        { hostPath: '/host/data', containerPath: 'relative/path', mode: 'rw' } // Invalid relative path
      ];
      
      const result = validateVolumeMappings(volumes);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should warn about dangerous host paths', () => {
      const volumes = [
        { hostPath: '/etc', containerPath: '/app/etc', mode: 'rw' } // Dangerous path
      ];
      
      const result = validateVolumeMappings(volumes);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'volumes[0].hostPath',
        message: expect.stringContaining('may be dangerous')
      }));
    });
  });

  describe('validateNetworkConfiguration', () => {
    it('should validate array of network names', () => {
      const networks = ['bridge', 'custom-network'];
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(networks);
    });

    it('should reject non-array input', () => {
      const networks = 'not-an-array' as any;
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]!.message).toBe('Networks must be an array');
    });

    it('should detect duplicate network names', () => {
      const networks = ['bridge', 'custom-network', 'bridge']; // Duplicate
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]!.message).toBe('Duplicate network names are not allowed');
    });

    it('should validate network name format', () => {
      const networks = ['valid-network', 'invalid network']; // Space not allowed
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'networks[1]',
        message: expect.stringContaining('invalid characters')
      }));
    });

    it('should reject reserved network names', () => {
      const networks = ['container']; // Reserved name
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]!.message).toContain('reserved');
    });

    it('should reject empty or invalid network names', () => {
      const networks = ['', null, undefined] as any;
      
      const result = validateNetworkConfiguration(networks);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('validateResourceLimits', () => {
    it('should validate valid resource limits', () => {
      const resources = {
        memory: 512,
        cpus: 1.5,
        ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }]
      };
      
      const result = validateResourceLimits(resources);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(resources);
    });

    it('should validate ulimit soft/hard relationship', () => {
      const resources = {
        ulimits: [{ name: 'nofile', soft: 2048, hard: 1024 }] // Hard < soft
      };
      
      const result = validateResourceLimits(resources);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'resources.ulimits[0]',
        message: 'Hard limit must be greater than or equal to soft limit'
      }));
    });
  });

  describe('validatePortConfiguration', () => {
    it('should validate ports without existing port conflicts', () => {
      const ports = [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }];
      
      const result = validatePortConfiguration(ports);
      expect(result.isValid).toBe(true);
    });

    it('should detect conflicts with existing ports', () => {
      const ports = [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }];
      const existingPorts = [8080, 9000];
      
      const result = validatePortConfiguration(ports, existingPorts);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'ports[0].hostPort',
        message: expect.stringContaining('already in use by another container')
      }));
    });
  });

  describe('validateVolumeConfiguration', () => {
    it('should validate volumes without host path checking', () => {
      const volumes = [{ hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }];
      
      const result = validateVolumeConfiguration(volumes, false);
      expect(result.isValid).toBe(true);
    });

    it('should perform additional validation when checking host paths', () => {
      const volumes = [
        { hostPath: '/host/../data', containerPath: '/app/data', mode: 'rw' }, // Relative path component
        { hostPath: '', containerPath: '/app/data', mode: 'rw' } // Empty path
      ];
      
      const result = validateVolumeConfiguration(volumes, true);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateNetworkCompatibility', () => {
    it('should validate networks without availability checking', () => {
      const networks = ['bridge', 'custom-network'];
      
      const result = validateNetworkCompatibility(networks);
      expect(result.isValid).toBe(true);
    });

    it('should check against available networks', () => {
      const networks = ['bridge', 'non-existent-network'];
      const availableNetworks = ['bridge', 'host'];
      
      const result = validateNetworkCompatibility(networks, availableNetworks);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        field: 'networks[1]',
        message: expect.stringContaining('does not exist')
      }));
    });

    it('should allow built-in Docker networks', () => {
      const networks = ['bridge', 'host', 'none'];
      const availableNetworks = ['bridge']; // host and none not in available list
      
      const result = validateNetworkCompatibility(networks, availableNetworks);
      expect(result.isValid).toBe(true); // Should pass because host and none are built-in
    });
  });
});