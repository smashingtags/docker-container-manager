import { AppStoreServiceImpl } from './appstore.service';
import { TemplateService } from './template.service';
import { ContainerService } from '@/modules/containers';
import { AppTemplate, AppCategory } from '@/types/app.types';

// Mock the template service
const mockTemplateService: jest.Mocked<TemplateService> = {
  loadTemplate: jest.fn(),
  loadAllTemplates: jest.fn(),
  getTemplatesByCategory: jest.fn(),
  searchTemplates: jest.fn(),
  getCategories: jest.fn(),
  validateTemplate: jest.fn(),
  parseTemplateFile: jest.fn()
};

// Mock the container service
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

describe('AppStoreService', () => {
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
    image: 'nginx',
    defaultConfig: {
      name: 'nginx',
      image: 'nginx',
      tag: 'latest',
      environment: {},
      ports: [
        {
          hostPort: 80,
          containerPort: 80,
          protocol: 'tcp',
          description: 'HTTP port'
        }
      ],
      volumes: [],
      networks: ['bridge'],
      restartPolicy: 'unless-stopped',
      resources: {}
    },
    configSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    },
    documentation: 'Nginx is a web server...',
    tags: ['web-server', 'http'],
    author: 'Nginx Team',
    homepage: 'https://nginx.org',
    repository: 'https://github.com/nginx/nginx'
  };

  describe('getApps', () => {
    it('should return all apps when no category specified', async () => {
      const templates = [mockTemplate];
      mockTemplateService.loadAllTemplates.mockResolvedValue(templates);

      const result = await appStoreService.getApps();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'nginx',
        name: 'Nginx',
        description: 'High-performance HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        tags: ['web-server', 'http'],
        author: 'Nginx Team'
      });
      expect(mockTemplateService.loadAllTemplates).toHaveBeenCalledTimes(1);
    });

    it('should return apps filtered by category', async () => {
      const templates = [mockTemplate];
      mockTemplateService.getTemplatesByCategory.mockResolvedValue(templates);

      const result = await appStoreService.getApps('web-servers');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
      expect(mockTemplateService.getTemplatesByCategory).toHaveBeenCalledWith('web-servers');
    });

    it('should handle templates without optional fields', async () => {
      const minimalTemplate: AppTemplate = {
        id: 'minimal',
        name: 'Minimal App',
        description: 'A minimal application',
        category: 'utilities',
        icon: 'https://example.com/minimal.png',
        version: '1.0.0',
        image: 'minimal',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Minimal docs',
        tags: ['minimal']
      };

      mockTemplateService.loadAllTemplates.mockResolvedValue([minimalTemplate]);

      const result = await appStoreService.getApps();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'minimal',
        name: 'Minimal App',
        description: 'A minimal application',
        category: 'utilities',
        icon: 'https://example.com/minimal.png',
        version: '1.0.0',
        tags: ['minimal'],
        author: undefined
      });
    });
  });

  describe('searchApps', () => {
    it('should search apps and return results', async () => {
      const templates = [mockTemplate];
      mockTemplateService.searchTemplates.mockResolvedValue(templates);

      const result = await appStoreService.searchApps('nginx');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
      expect(mockTemplateService.searchTemplates).toHaveBeenCalledWith('nginx');
    });

    it('should return empty array when no matches found', async () => {
      mockTemplateService.searchTemplates.mockResolvedValue([]);

      const result = await appStoreService.searchApps('nonexistent');

      expect(result).toHaveLength(0);
      expect(mockTemplateService.searchTemplates).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('getAppDetails', () => {
    it('should return detailed app information', async () => {
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);

      const result = await appStoreService.getAppDetails('nginx');

      expect(result).toEqual({
        id: 'nginx',
        name: 'Nginx',
        description: 'High-performance HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        tags: ['web-server', 'http'],
        author: 'Nginx Team',
        image: 'nginx',
        documentation: 'Nginx is a web server...',
        homepage: 'https://nginx.org',
        repository: 'https://github.com/nginx/nginx',
        configSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        defaultConfig: mockTemplate.defaultConfig
      });
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('nginx');
    });

    it('should handle templates without optional fields in details', async () => {
      const minimalTemplate: AppTemplate = {
        id: 'minimal',
        name: 'Minimal App',
        description: 'A minimal application',
        category: 'utilities',
        icon: 'https://example.com/minimal.png',
        version: '1.0.0',
        image: 'minimal',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Minimal docs',
        tags: ['minimal']
      };

      mockTemplateService.loadTemplate.mockResolvedValue(minimalTemplate);

      const result = await appStoreService.getAppDetails('minimal');

      expect(result.author).toBeUndefined();
      expect(result.homepage).toBeUndefined();
      expect(result.repository).toBeUndefined();
      expect(result.image).toBe('minimal');
      expect(result.documentation).toBe('Minimal docs');
    });

    it('should throw error when template not found', async () => {
      mockTemplateService.loadTemplate.mockRejectedValue(new Error('Template not found'));

      await expect(appStoreService.getAppDetails('nonexistent'))
        .rejects.toThrow('Template not found');
    });
  });

  describe('getCategories', () => {
    it('should return categories from template service', async () => {
      const categories: AppCategory[] = [
        {
          id: 'web-servers',
          name: 'Web Servers',
          description: 'HTTP servers and proxies',
          icon: '🌐',
          appCount: 5
        },
        {
          id: 'databases',
          name: 'Databases',
          description: 'Database systems',
          icon: '🗄️',
          appCount: 3
        }
      ];

      mockTemplateService.getCategories.mockResolvedValue(categories);

      const result = await appStoreService.getCategories();

      expect(result).toEqual(categories);
      expect(mockTemplateService.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should handle empty categories', async () => {
      mockTemplateService.getCategories.mockResolvedValue([]);

      const result = await appStoreService.getCategories();

      expect(result).toHaveLength(0);
    });
  });

  describe('getAppTemplate', () => {
    it('should return full template', async () => {
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);

      const result = await appStoreService.getAppTemplate('nginx');

      expect(result).toEqual(mockTemplate);
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('nginx');
    });

    it('should throw error when template not found', async () => {
      mockTemplateService.loadTemplate.mockRejectedValue(new Error('Template not found'));

      await expect(appStoreService.getAppTemplate('nonexistent'))
        .rejects.toThrow('Template not found');
    });
  });

  describe('deployApp', () => {
    it('should deploy app successfully', async () => {
      const deployConfig = {
        name: 'test-nginx',
        environment: { 'CUSTOM_VAR': 'value' },
        ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' as const }],
        volumes: [],
        networks: [],
        resources: {}
      };

      const mockContainer = {
        id: 'container-123',
        name: 'test-nginx',
        status: 'running' as const,
        image: 'nginx:latest',
        created: new Date(),
        ports: [],
        volumes: []
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockContainerService.create.mockResolvedValue(mockContainer);
      mockContainerService.start.mockResolvedValue();

      const result = await appStoreService.deployApp('nginx', deployConfig);

      expect(result).toEqual(mockContainer);
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('nginx');
      expect(mockContainerService.create).toHaveBeenCalled();
      expect(mockContainerService.start).toHaveBeenCalledWith('container-123');
    });

    it('should handle deployment errors', async () => {
      const deployConfig = {
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
        .rejects.toThrow('Failed to deploy app \'nginx\' as container \'test-nginx\'');
    });
  });

  describe('template conversion methods', () => {
    it('should convert template to app correctly', async () => {
      mockTemplateService.loadAllTemplates.mockResolvedValue([mockTemplate]);

      const result = await appStoreService.getApps();

      expect(result[0]).toEqual({
        id: mockTemplate.id,
        name: mockTemplate.name,
        description: mockTemplate.description,
        category: mockTemplate.category,
        icon: mockTemplate.icon,
        version: mockTemplate.version,
        tags: mockTemplate.tags,
        author: mockTemplate.author
      });
    });

    it('should convert template to app details correctly', async () => {
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);

      const result = await appStoreService.getAppDetails('nginx');

      expect(result).toEqual({
        id: mockTemplate.id,
        name: mockTemplate.name,
        description: mockTemplate.description,
        category: mockTemplate.category,
        icon: mockTemplate.icon,
        version: mockTemplate.version,
        tags: mockTemplate.tags,
        author: mockTemplate.author,
        image: mockTemplate.image,
        documentation: mockTemplate.documentation,
        homepage: mockTemplate.homepage,
        repository: mockTemplate.repository,
        configSchema: mockTemplate.configSchema,
        defaultConfig: mockTemplate.defaultConfig
      });
    });
  });
});