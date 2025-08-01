import { TemplateServiceImpl } from './template.service';
import { AppTemplate, AppCategory } from '@/types/app.types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TemplateService', () => {
  let templateService: TemplateServiceImpl;
  const mockTemplatesPath = 'test-templates';

  beforeEach(() => {
    templateService = new TemplateServiceImpl(mockTemplatesPath);
    templateService.clearCache();
    jest.clearAllMocks();
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const validTemplate = {
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
          ports: [],
          volumes: [],
          networks: ['bridge'],
          restartPolicy: 'unless-stopped' as const,
          resources: {}
        },
        configSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        documentation: 'Nginx documentation',
        tags: ['web-server', 'http']
      };

      const result = templateService.validateTemplate(validTemplate);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validTemplate);
    });

    it('should reject template with invalid id format', () => {
      const invalidTemplate = {
        id: 'Invalid_ID',
        name: 'Test',
        description: 'Test description',
        category: 'web-servers',
        icon: 'https://example.com/icon.png',
        version: '1.0.0',
        image: 'test',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Test docs',
        tags: ['test']
      };

      const result = templateService.validateTemplate(invalidTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('id');
      expect(result.errors[0]?.message).toContain('pattern');
    });

    it('should reject template with missing required fields', () => {
      const incompleteTemplate = {
        id: 'test',
        name: 'Test'
        // Missing required fields
      };

      const result = templateService.validateTemplate(incompleteTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const requiredFields = ['description', 'category', 'icon', 'version', 'image', 'defaultConfig', 'configSchema', 'documentation', 'tags'];
      requiredFields.forEach(field => {
        expect(result.errors.some(error => error.field === field)).toBe(true);
      });
    });

    it('should reject template with invalid version format', () => {
      const invalidTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test description',
        category: 'web-servers',
        icon: 'https://example.com/icon.png',
        version: 'invalid-version',
        image: 'test',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Test docs',
        tags: ['test']
      };

      const result = templateService.validateTemplate(invalidTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.field === 'version')).toBe(true);
    });

    it('should validate template with complex defaultConfig', () => {
      const complexTemplate = {
        id: 'complex-app',
        name: 'Complex App',
        description: 'A complex application template',
        category: 'development',
        icon: 'https://example.com/complex.png',
        version: '2.1.0',
        image: 'complex/app',
        defaultConfig: {
          name: 'complex-app',
          image: 'complex/app',
          tag: 'v2.1.0',
          environment: {
            NODE_ENV: 'production',
            PORT: '3000'
          },
          ports: [
            {
              hostPort: 3000,
              containerPort: 3000,
              protocol: 'tcp' as const,
              description: 'HTTP port'
            }
          ],
          volumes: [
            {
              hostPath: '/data/app',
              containerPath: '/app/data',
              mode: 'rw' as const,
              description: 'Application data'
            }
          ],
          networks: ['bridge'],
          restartPolicy: 'always' as const,
          resources: {
            memory: 512,
            cpus: 1.0,
            diskSpace: 1024,
            pidsLimit: 100,
            ulimits: [
              {
                name: 'nofile',
                soft: 1024,
                hard: 2048
              }
            ]
          },
          healthCheck: {
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
            interval: 30,
            timeout: 10,
            retries: 3,
            startPeriod: 60
          },
          security: {
            privileged: false,
            readOnly: false,
            user: 'app',
            capabilities: {
              add: ['NET_ADMIN'],
              drop: ['ALL']
            }
          },
          labels: {
            'app.name': 'complex-app',
            'app.version': '2.1.0'
          },
          workingDir: '/app',
          entrypoint: ['node'],
          command: ['server.js'],
          hostname: 'complex-app',
          domainname: 'example.com',
          autoRemove: false
        },
        configSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            environment: {
              type: 'object',
              properties: {
                NODE_ENV: { type: 'string' },
                PORT: { type: 'string' }
              }
            }
          },
          required: ['name']
        },
        documentation: 'Complex application with all configuration options',
        tags: ['complex', 'development', 'nodejs'],
        author: 'Test Author',
        homepage: 'https://example.com',
        repository: 'https://github.com/example/complex-app'
      };

      const result = templateService.validateTemplate(complexTemplate);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(complexTemplate);
    });
  });

  describe('parseTemplateFile', () => {
    it('should parse a valid template file', async () => {
      const templateData = {
        id: 'nginx',
        name: 'Nginx',
        description: 'HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        image: 'nginx',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Nginx docs',
        tags: ['web-server']
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(templateData));

      const result = await templateService.parseTemplateFile('test.json');
      
      expect(result.id).toBe('nginx');
      expect(result.name).toBe('Nginx');
      expect(mockFs.readFile).toHaveBeenCalledWith('test.json', 'utf-8');
    });

    it('should throw error for invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(templateService.parseTemplateFile('invalid.json'))
        .rejects.toThrow('Invalid JSON in template file');
    });

    it('should throw error for invalid template format', async () => {
      const invalidTemplate = { id: 'invalid' };
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidTemplate));

      await expect(templateService.parseTemplateFile('invalid.json'))
        .rejects.toThrow('Invalid template format');
    });
  });

  describe('loadTemplate', () => {
    it('should load template from file', async () => {
      const templateData = {
        id: 'nginx',
        name: 'Nginx',
        description: 'HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        image: 'nginx',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Nginx docs',
        tags: ['web-server']
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(templateData));

      const result = await templateService.loadTemplate('nginx');
      
      expect(result.id).toBe('nginx');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(mockTemplatesPath, 'apps', 'nginx.json'),
        'utf-8'
      );
    });

    it('should return cached template on second call', async () => {
      const templateData = {
        id: 'nginx',
        name: 'Nginx',
        description: 'HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        image: 'nginx',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Nginx docs',
        tags: ['web-server']
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(templateData));

      // First call
      await templateService.loadTemplate('nginx');
      // Second call
      await templateService.loadTemplate('nginx');
      
      // Should only read file once
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error when template file not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(templateService.loadTemplate('nonexistent'))
        .rejects.toThrow('Failed to load template nonexistent');
    });
  });

  describe('loadAllTemplates', () => {
    it('should load all valid templates', async () => {
      const templateFiles = ['nginx.json', 'postgres.json', 'invalid.txt'];
      const nginxTemplate = {
        id: 'nginx',
        name: 'Nginx',
        description: 'HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        image: 'nginx',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Nginx docs',
        tags: ['web-server']
      };
      const postgresTemplate = {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Database server',
        category: 'databases',
        icon: 'https://example.com/postgres.png',
        version: '1.0.0',
        image: 'postgres',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'PostgreSQL docs',
        tags: ['database']
      };

      mockFs.readdir.mockResolvedValue(templateFiles as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(nginxTemplate))
        .mockResolvedValueOnce(JSON.stringify(postgresTemplate));

      const result = await templateService.loadAllTemplates();
      
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('nginx');
      expect(result[1]?.id).toBe('postgres');
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should skip invalid template files', async () => {
      const templateFiles = ['valid.json', 'invalid.json'];
      const validTemplate = {
        id: 'valid',
        name: 'Valid',
        description: 'Valid template',
        category: 'utilities',
        icon: 'https://example.com/valid.png',
        version: '1.0.0',
        image: 'valid',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Valid docs',
        tags: ['valid']
      };

      mockFs.readdir.mockResolvedValue(templateFiles as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(validTemplate))
        .mockResolvedValueOnce('invalid json');

      // Mock console.warn to avoid test output
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await templateService.loadAllTemplates();
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('valid');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load template from invalid.json'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when templates directory cannot be read', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      await expect(templateService.loadAllTemplates())
        .rejects.toThrow('Failed to load templates');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates filtered by category', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server']
        },
        {
          id: 'postgres',
          name: 'PostgreSQL',
          description: 'Database server',
          category: 'databases',
          icon: 'https://example.com/postgres.png',
          version: '1.0.0',
          image: 'postgres',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'PostgreSQL docs',
          tags: ['database']
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json', 'postgres.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(templates[0]))
        .mockResolvedValueOnce(JSON.stringify(templates[1]));

      const result = await templateService.getTemplatesByCategory('web-servers');
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
      expect(result[0]?.category).toBe('web-servers');
    });
  });

  describe('searchTemplates', () => {
    it('should search templates by name', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx Web Server',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server'],
          author: 'Nginx Team'
        },
        {
          id: 'postgres',
          name: 'PostgreSQL',
          description: 'Database server',
          category: 'databases',
          icon: 'https://example.com/postgres.png',
          version: '1.0.0',
          image: 'postgres',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'PostgreSQL docs',
          tags: ['database']
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json', 'postgres.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(templates[0]))
        .mockResolvedValueOnce(JSON.stringify(templates[1]));

      const result = await templateService.searchTemplates('nginx');
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
    });

    it('should search templates by description', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'High-performance HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server']
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(templates[0]));

      const result = await templateService.searchTemplates('high-performance');
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
    });

    it('should search templates by tags', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server', 'reverse-proxy']
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(templates[0]));

      const result = await templateService.searchTemplates('reverse-proxy');
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
    });

    it('should search templates by author', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server'],
          author: 'Nginx Team'
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(templates[0]));

      const result = await templateService.searchTemplates('nginx team');
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('nginx');
    });

    it('should return empty array when no matches found', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server']
        }
      ];

      mockFs.readdir.mockResolvedValue(['nginx.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(templates[0]));

      const result = await templateService.searchTemplates('nonexistent');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should load categories from file', async () => {
      const categories = [
        {
          id: 'web-servers',
          name: 'Web Servers',
          description: 'HTTP servers and proxies',
          icon: '🌐',
          appCount: 0
        }
      ];
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server']
        }
      ];

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(categories))
        .mockResolvedValueOnce(JSON.stringify(templates[0]));
      mockFs.readdir.mockResolvedValue(['nginx.json'] as any);

      const result = await templateService.getCategories();
      
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('web-servers');
      expect(result[0]?.appCount).toBe(1);
    });

    it('should generate categories from templates when file not found', async () => {
      const templates = [
        {
          id: 'nginx',
          name: 'Nginx',
          description: 'HTTP server',
          category: 'web-servers',
          icon: 'https://example.com/nginx.png',
          version: '1.0.0',
          image: 'nginx',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'Nginx docs',
          tags: ['web-server']
        },
        {
          id: 'postgres',
          name: 'PostgreSQL',
          description: 'Database server',
          category: 'databases',
          icon: 'https://example.com/postgres.png',
          version: '1.0.0',
          image: 'postgres',
          defaultConfig: {},
          configSchema: { type: 'object', properties: {} },
          documentation: 'PostgreSQL docs',
          tags: ['database']
        }
      ];

      // First call fails (categories file not found)
      mockFs.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(JSON.stringify(templates[0]))
        .mockResolvedValueOnce(JSON.stringify(templates[1]));
      mockFs.readdir.mockResolvedValue(['nginx.json', 'postgres.json'] as any);

      const result = await templateService.getCategories();
      
      expect(result).toHaveLength(2);
      expect(result.find(c => c.id === 'web-servers')).toBeDefined();
      expect(result.find(c => c.id === 'databases')).toBeDefined();
      expect(result.find(c => c.id === 'web-servers')?.appCount).toBe(1);
      expect(result.find(c => c.id === 'databases')?.appCount).toBe(1);
    });

    it('should return cached categories on second call', async () => {
      const categories = [
        {
          id: 'web-servers',
          name: 'Web Servers',
          description: 'HTTP servers',
          icon: '🌐',
          appCount: 0
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(categories));
      mockFs.readdir.mockResolvedValue([]);

      // First call
      await templateService.getCategories();
      // Second call
      await templateService.getCategories();
      
      // Should only read categories file once
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('should clear template and category cache', async () => {
      const templateData = {
        id: 'nginx',
        name: 'Nginx',
        description: 'HTTP server',
        category: 'web-servers',
        icon: 'https://example.com/nginx.png',
        version: '1.0.0',
        image: 'nginx',
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        documentation: 'Nginx docs',
        tags: ['web-server']
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(templateData));

      // Load template to cache it
      await templateService.loadTemplate('nginx');
      
      // Clear cache
      templateService.clearCache();
      
      // Load template again - should read from file
      await templateService.loadTemplate('nginx');
      
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});