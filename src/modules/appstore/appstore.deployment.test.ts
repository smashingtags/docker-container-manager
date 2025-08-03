import { AppStoreServiceImpl, AppStoreServiceError } from './appstore.service';
import { TemplateService } from './template.service';
import { ContainerService } from '@/modules/containers';
import { AppTemplate, DeployConfig } from '@/types/app.types';
import { Container, ContainerConfig } from '@/types/container.types';

// Mock services
const mockTemplateService: jest.Mocked<TemplateService> = {
  loadTemplate: jest.fn(),
  loadAllTemplates: jest.fn(),
  getTemplatesByCategory: jest.fn(),
  searchTemplates: jest.fn(),
  getCategories: jest.fn(),
  validateTemplate: jest.fn(),
  parseTemplateFile: jest.fn()
};

const mockContainerService: jest.Mocked<ContainerService> = {
  list: jest.fn(),
  create: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  restart: jest.fn(),
  remove: jest.fn(),
  getLogs: jest.fn(),
  getStats: jest.fn(),
  getContainerById: jest.fn(),
  monitorContainerStatus: jest.fn()
};

describe('AppStoreService - Deployment Functionality', () => {
  let appStoreService: AppStoreServiceImpl;

  beforeEach(() => {
    appStoreService = new AppStoreServiceImpl(mockContainerService, mockTemplateService);
    jest.clearAllMocks();
  });

  const mockTemplate: AppTemplate = {
    id: 'nginx',
    name: 'Nginx',
    description: 'High-performance HTTP server',
    category: 'web-servers',
    icon: 'https://example.com/nginx.png',
    version: '1.0.0',
    image: 'nginx:alpine',
    defaultConfig: {
      environment: {
        'NGINX_HOST': 'localhost',
        'NGINX_PORT': '80'
      },
      ports: [
        {
          hostPort: 8080,
          containerPort: 80,
          protocol: 'tcp',
          description: 'HTTP port'
        }
      ],
      volumes: [
        {
          hostPath: '/tmp/nginx-html',
          containerPath: '/usr/share/nginx/html',
          mode: 'ro',
          description: 'Static content directory'
        }
      ],
      networks: ['bridge'],
      restartPolicy: 'unless-stopped',
      resources: {
        memory: 128,
        cpus: 0.5
      },
      labels: {
        'service.type': 'web-server'
      }
    },
    configSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        environment: { type: 'object' },
        ports: { type: 'array' },
        volumes: { type: 'array' }
      },
      required: ['name']
    },
    documentation: 'Nginx is a web server...',
    tags: ['web-server', 'http'],
    author: 'Nginx Team'
  };

  const mockContainer: Container = {
    id: 'container-123',
    name: 'test-nginx',
    status: 'running',
    image: 'nginx:alpine',
    created: new Date(),
    ports: [],
    volumes: []
  };

  describe('deployApp', () => {
    it('should successfully deploy an app with default configuration', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx-default',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      const result = await appStoreService.deployApp('nginx', deployConfig);

      expect(result).toEqual(mockContainer);
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('nginx');
      expect(mockContainerService.create).toHaveBeenCalled();
      expect(mockContainerService.start).toHaveBeenCalledWith('container-123');

      // Verify the container config passed to create method
      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.name).toBe('test-nginx-default');
      expect(containerConfig.image).toBe('nginx');
      expect(containerConfig.tag).toBe('alpine');
      expect(containerConfig.environment).toEqual({
        'NGINX_HOST': 'localhost',
        'NGINX_PORT': '80'
      });
      expect(containerConfig.ports).toEqual([
        {
          hostPort: 8080,
          containerPort: 80,
          protocol: 'tcp',
          description: 'HTTP port'
        }
      ]);
      expect(containerConfig.volumes).toEqual([
        {
          hostPath: '/tmp/nginx-html',
          containerPath: '/usr/share/nginx/html',
          mode: 'ro',
          description: 'Static content directory'
        }
      ]);
      expect(containerConfig.networks).toEqual(['bridge']);
      expect(containerConfig.restartPolicy).toBe('unless-stopped');
      expect(containerConfig.resources).toEqual({
        memory: 128,
        cpus: 0.5
      });
    });

    it('should deploy an app with custom configuration overrides', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx-custom',
        environment: {
          'NGINX_HOST': 'custom.example.com',
          'CUSTOM_VAR': 'custom-value'
        },
        ports: [
          {
            hostPort: 9090,
            containerPort: 80,
            protocol: 'tcp'
          }
        ],
        volumes: [
          {
            hostPath: '/custom/path',
            containerPath: '/usr/share/nginx/html',
            mode: 'rw'
          }
        ],
        networks: ['custom-network'],
        resources: {
          memory: 256,
          cpus: 1.0
        }
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      const result = await appStoreService.deployApp('nginx', deployConfig);

      expect(result).toEqual(mockContainer);

      // Verify custom configuration was applied
      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.name).toBe('test-nginx-custom');
      expect(containerConfig.environment).toEqual({
        'NGINX_HOST': 'custom.example.com',
        'NGINX_PORT': '80', // From template
        'CUSTOM_VAR': 'custom-value' // From deploy config
      });
      expect(containerConfig.ports).toEqual([
        {
          hostPort: 9090,
          containerPort: 80,
          protocol: 'tcp',
          description: 'HTTP port' // Preserved from template
        }
      ]);
      expect(containerConfig.volumes).toEqual([
        {
          hostPath: '/custom/path',
          containerPath: '/usr/share/nginx/html',
          mode: 'rw',
          description: 'Static content directory' // Preserved from template
        }
      ]);
      expect(containerConfig.networks).toEqual(['custom-network']);
      expect(containerConfig.resources).toEqual({
        memory: 256, // Overridden
        cpus: 1.0 // Overridden
      });
    });

    it('should add app store labels to deployed containers', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx-labels',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      // Verify app store labels were added
      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.labels).toEqual(expect.objectContaining({
        'service.type': 'web-server', // From template
        'app-store.app-id': 'nginx',
        'app-store.app-name': 'Nginx',
        'app-store.app-version': '1.0.0',
        'app-store.category': 'web-servers',
        'app-store.deployed-at': expect.any(String)
      }));
    });

    it('should handle template loading errors', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockRejectedValue(new Error('Template not found'));

      await expect(appStoreService.deployApp('nonexistent', deployConfig))
        .rejects.toThrow(AppStoreServiceError);
      
      expect(mockContainerService.create).not.toHaveBeenCalled();
      expect(mockContainerService.start).not.toHaveBeenCalled();
    });

    it('should handle container creation errors', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockRejectedValue(new Error('Container creation failed'));

      await expect(appStoreService.deployApp('nginx', deployConfig))
        .rejects.toThrow(AppStoreServiceError);
      
      expect(mockContainerService.start).not.toHaveBeenCalled();
    });

    it('should handle container start errors', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-nginx',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockRejectedValue(new Error('Container start failed'));

      await expect(appStoreService.deployApp('nginx', deployConfig))
        .rejects.toThrow(AppStoreServiceError);
    });

    it('should handle image with tag correctly', async () => {
      const taggedTemplate: AppTemplate = {
        ...mockTemplate,
        image: 'nginx:1.21-alpine'
      };

      const deployConfig: DeployConfig = {
        name: 'test-tagged',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(taggedTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.image).toBe('nginx');
      expect(containerConfig.tag).toBe('1.21-alpine');
    });

    it('should handle image without tag correctly', async () => {
      const noTagTemplate: AppTemplate = {
        ...mockTemplate,
        image: 'nginx'
      };

      const deployConfig: DeployConfig = {
        name: 'test-no-tag',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(noTagTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.image).toBe('nginx');
      expect(containerConfig.tag).toBe('latest');
    });

    it('should preserve port descriptions from template', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-port-descriptions',
        environment: {},
        ports: [
          {
            hostPort: 9090,
            containerPort: 80,
            protocol: 'tcp'
          }
        ],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.ports[0]?.description).toBe('HTTP port');
    });

    it('should preserve volume descriptions from template', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-volume-descriptions',
        environment: {},
        ports: [],
        volumes: [
          {
            hostPath: '/custom/path',
            containerPath: '/usr/share/nginx/html',
            mode: 'rw'
          }
        ],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.volumes[0]?.description).toBe('Static content directory');
    });

    it('should handle empty deploy config arrays correctly', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-empty-arrays',
        environment: {},
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      // Should use template defaults when deploy config arrays are empty
      expect(containerConfig.ports).toEqual(mockTemplate.defaultConfig.ports);
      expect(containerConfig.volumes).toEqual(mockTemplate.defaultConfig.volumes);
      expect(containerConfig.networks).toEqual(['bridge']);
    });

    it('should merge environment variables correctly', async () => {
      const deployConfig: DeployConfig = {
        name: 'test-env-merge',
        environment: {
          'NGINX_HOST': 'override.example.com', // Override template value
          'NEW_VAR': 'new-value' // Add new variable
        },
        ports: [],
        volumes: [],
        networks: [],
        resources: {}
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      await appStoreService.deployApp('nginx', deployConfig);

      const createCall = mockContainerService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const containerConfig = createCall![0] as ContainerConfig;
      
      expect(containerConfig.environment).toEqual({
        'NGINX_HOST': 'override.example.com', // Overridden
        'NGINX_PORT': '80', // From template
        'NEW_VAR': 'new-value' // Added
      });
    });
  });
});