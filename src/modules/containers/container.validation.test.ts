import {
  validateCompleteContainerConfig,
  validateCreateContainerRequest,
  validateContainerNameUniqueness,
  validateDockerImage,
  validateHostPath,
  validatePortAvailability
} from './container.validation';
import { ContainerConfig, CreateContainerRequest } from '@/types/container.types';

describe('Container Validation', () => {
  describe('validateCompleteContainerConfig', () => {
    it('should validate a complete valid container configuration', () => {
      const validConfig: ContainerConfig = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: { NODE_ENV: 'production' },
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8443, containerPort: 443, protocol: 'tcp' }
        ],
        volumes: [
          { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' },
          { hostPath: '/host/config', containerPath: '/app/config', mode: 'ro' }
        ],
        networks: ['bridge', 'custom-network'],
        restartPolicy: 'unless-stopped',
        resources: {
          memory: 512,
          cpus: 1.5,
          ulimits: [
            { name: 'nofile', soft: 1024, hard: 2048 }
          ]
        },
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/health'],
          interval: 30,
          timeout: 10,
          retries: 3
        },
        security: {
          privileged: false,
          readOnly: false,
          user: '1000:1000'
        },
        labels: {
          'app.name': 'test-app',
          'app.version': '1.0.0'
        }
      };

      const result = validateCompleteContainerConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should detect port conflicts in container configuration', () => {
      const configWithPortConflicts = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8080, containerPort: 8080, protocol: 'tcp' } // Conflict
        ],
        volumes: [],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      const result = validateCompleteContainerConfig(configWithPortConflicts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('already in use'))).toBe(true);
    });

    it('should detect volume path conflicts in container configuration', () => {
      const configWithVolumeConflicts = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [
          { hostPath: '/host/data1', containerPath: '/app/data', mode: 'rw' },
          { hostPath: '/host/data2', containerPath: '/app/data', mode: 'ro' } // Conflict
        ],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      const result = validateCompleteContainerConfig(configWithVolumeConflicts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('already mapped'))).toBe(true);
    });

    it('should detect duplicate networks in container configuration', () => {
      const configWithNetworkDuplicates = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['bridge', 'bridge', 'custom'], // Duplicate
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      const result = validateCompleteContainerConfig(configWithNetworkDuplicates);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate network names'))).toBe(true);
    });

    it('should detect invalid ulimit configuration', () => {
      const configWithInvalidUlimits = {
        id: 'test-container',
        name: 'test-app',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {
          ulimits: [
            { name: 'nofile', soft: 2048, hard: 1024 } // Hard < Soft
          ]
        }
      };

      const result = validateCompleteContainerConfig(configWithInvalidUlimits);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Hard limit must be greater than or equal to soft limit'))).toBe(true);
    });

    it('should reject invalid container name format', () => {
      const configWithInvalidName = {
        id: 'test-container',
        name: 'invalid name with spaces',
        image: 'nginx',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        restartPolicy: 'unless-stopped',
        resources: {}
      };

      const result = validateCompleteContainerConfig(configWithInvalidName);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });
  });

  describe('validateCreateContainerRequest', () => {
    it('should validate a valid create container request', () => {
      const validRequest: CreateContainerRequest = {
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

      const result = validateCreateContainerRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should validate minimal create container request', () => {
      const minimalRequest = {
        name: 'test-app',
        image: 'nginx'
      };

      const result = validateCreateContainerRequest(minimalRequest);
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should reject create request with missing required fields', () => {
      const invalidRequest = {
        image: 'nginx'
        // Missing name
      };

      const result = validateCreateContainerRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should detect conflicts in create container request', () => {
      const requestWithConflicts = {
        name: 'test-app',
        image: 'nginx',
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          { hostPort: 8080, containerPort: 8080, protocol: 'tcp' } // Conflict
        ]
      };

      const result = validateCreateContainerRequest(requestWithConflicts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('already in use'))).toBe(true);
    });
  });

  describe('validateContainerNameUniqueness', () => {
    it('should validate unique container name', () => {
      const existingContainers = [
        { name: 'existing-app-1' },
        { name: 'existing-app-2' }
      ];

      const result = validateContainerNameUniqueness('new-app', existingContainers);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('new-app');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate container name', () => {
      const existingContainers = [
        { name: 'existing-app-1' },
        { name: 'existing-app-2' }
      ];

      const result = validateContainerNameUniqueness('existing-app-1', existingContainers);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('already in use');
    });

    it('should handle empty existing containers list', () => {
      const result = validateContainerNameUniqueness('new-app', []);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('new-app');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateDockerImage', () => {
    it('should validate valid Docker image names', () => {
      const validImages = [
        'nginx',
        'ubuntu',
        'node',
        'mysql/mysql-server',
        'registry.example.com/my-app',
        'localhost:5000/my-app'
      ];

      validImages.forEach(image => {
        const result = validateDockerImage(image);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(`${image}:latest`);
      });
    });

    it('should validate Docker image with custom tag', () => {
      const result = validateDockerImage('nginx', '1.21');
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('nginx:1.21');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty image name', () => {
      const result = validateDockerImage('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('cannot be empty');
    });

    it('should reject invalid image name format', () => {
      const invalidImages = [
        'nginx@sha256:abc123', // SHA format not handled in basic validation
        'nginx:tag with spaces', // Spaces not allowed
        '-nginx', // Cannot start with dash
        'nginx-', // Cannot end with dash
        'nginx..test' // Double dots not allowed
      ];

      invalidImages.forEach(image => {
        const result = validateDockerImage(image);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateHostPath', () => {
    it('should validate valid absolute paths', () => {
      const validPaths = [
        '/home/user/data',
        '/var/lib/docker',
        '/tmp',
        'C:\\Users\\data', // Windows path
        'D:\\docker\\volumes'
      ];

      validPaths.forEach(path => {
        const result = validateHostPath(path);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(path);
      });
    });

    it('should reject empty host path', () => {
      const result = validateHostPath('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('cannot be empty');
    });

    it('should reject relative paths', () => {
      const relativePaths = [
        'relative/path',
        './current/dir',
        '../parent/dir',
        'data'
      ];

      relativePaths.forEach(path => {
        const result = validateHostPath(path);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('absolute path'))).toBe(true);
      });
    });
  });

  describe('validatePortAvailability', () => {
    it('should validate valid port numbers', () => {
      const validPorts = [1, 8080, 3000, 9000, 65535];

      validPorts.forEach(port => {
        const result = validatePortAvailability(port);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(port);
      });
    });

    it('should reject invalid port ranges', () => {
      const invalidPorts = [0, -1, 65536, 70000];

      invalidPorts.forEach(port => {
        const result = validatePortAvailability(port);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('between 1 and 65535'))).toBe(true);
      });
    });

    it('should warn about commonly reserved ports', () => {
      const reservedPorts = [22, 80, 443, 3306, 5432];

      reservedPorts.forEach(port => {
        const result = validatePortAvailability(port);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('commonly reserved'))).toBe(true);
      });
    });

    it('should allow non-reserved ports', () => {
      const nonReservedPorts = [8080, 3000, 9000, 4000];

      nonReservedPorts.forEach(port => {
        const result = validatePortAvailability(port);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(port);
      });
    });
  });
});