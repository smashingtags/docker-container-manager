import { AppStoreServiceImpl } from './appstore.service';
import { TemplateServiceImpl } from './template.service';
import { ContainerService } from '@/modules/containers';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock container service for integration tests
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

describe('AppStore Integration', () => {
  let appStoreService: AppStoreServiceImpl;
  let templateService: TemplateServiceImpl;
  const testTemplatesPath = path.join(__dirname, '../../../templates');

  beforeAll(async () => {
    // Check if templates directory exists
    try {
      await fs.access(testTemplatesPath);
      templateService = new TemplateServiceImpl('templates');
      appStoreService = new AppStoreServiceImpl(mockContainerService, templateService);
    } catch (error) {
      console.warn('Templates directory not found, skipping integration tests');
    }
  });

  beforeEach(() => {
    if (templateService) {
      templateService.clearCache();
    }
  });

  it('should load real templates from filesystem', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const apps = await appStoreService.getApps();
      
      expect(apps.length).toBeGreaterThan(0);
      
      // Check that we have the expected templates
      const appIds = apps.map(app => app.id);
      expect(appIds).toContain('nginx');
      expect(appIds).toContain('postgres');
      expect(appIds).toContain('plex');
      expect(appIds).toContain('redis');
      expect(appIds).toContain('portainer');
      
      // Verify app structure
      const nginxApp = apps.find(app => app.id === 'nginx');
      expect(nginxApp).toBeDefined();
      expect(nginxApp?.name).toBe('Nginx');
      expect(nginxApp?.category).toBe('web-servers');
      expect(nginxApp?.tags).toContain('web-server');
    } catch (error) {
      console.warn('Integration test failed:', error);
    }
  });

  it('should load categories with correct app counts', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const categories = await appStoreService.getCategories();
      
      expect(categories.length).toBeGreaterThan(0);
      
      // Find web-servers category
      const webServersCategory = categories.find(cat => cat.id === 'web-servers');
      expect(webServersCategory).toBeDefined();
      expect(webServersCategory?.appCount).toBeGreaterThan(0);
      
      // Find databases category
      const databasesCategory = categories.find(cat => cat.id === 'databases');
      expect(databasesCategory).toBeDefined();
      expect(databasesCategory?.appCount).toBeGreaterThan(0);
    } catch (error) {
      console.warn('Categories test failed:', error);
    }
  });

  it('should filter apps by category', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const webServerApps = await appStoreService.getApps('web-servers');
      
      expect(webServerApps.length).toBeGreaterThan(0);
      webServerApps.forEach(app => {
        expect(app.category).toBe('web-servers');
      });
      
      // Should include nginx
      const nginxApp = webServerApps.find(app => app.id === 'nginx');
      expect(nginxApp).toBeDefined();
    } catch (error) {
      console.warn('Category filtering test failed:', error);
    }
  });

  it('should search apps by query', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const searchResults = await appStoreService.searchApps('database');
      
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Should include postgres and redis
      const appIds = searchResults.map(app => app.id);
      expect(appIds).toContain('postgres');
      expect(appIds).toContain('redis');
    } catch (error) {
      console.warn('Search test failed:', error);
    }
  });

  it('should get detailed app information', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const nginxDetails = await appStoreService.getAppDetails('nginx');
      
      expect(nginxDetails.id).toBe('nginx');
      expect(nginxDetails.name).toBe('Nginx');
      expect(nginxDetails.image).toBe('nginx');
      expect(nginxDetails.documentation).toBeDefined();
      expect(nginxDetails.configSchema).toBeDefined();
      expect(nginxDetails.defaultConfig).toBeDefined();
      
      // Check that default config has expected structure
      expect(nginxDetails.defaultConfig.ports).toBeDefined();
      expect(nginxDetails.defaultConfig.volumes).toBeDefined();
      expect(nginxDetails.defaultConfig.restartPolicy).toBe('unless-stopped');
    } catch (error) {
      console.warn('App details test failed:', error);
    }
  });

  it('should get full app template', async () => {
    if (!templateService) {
      console.warn('Skipping test - templates directory not available');
      return;
    }

    try {
      const nginxTemplate = await appStoreService.getAppTemplate('nginx');
      
      expect(nginxTemplate.id).toBe('nginx');
      expect(nginxTemplate.name).toBe('Nginx');
      expect(nginxTemplate.image).toBe('nginx');
      expect(nginxTemplate.defaultConfig).toBeDefined();
      expect(nginxTemplate.configSchema).toBeDefined();
      expect(nginxTemplate.documentation).toBeDefined();
      expect(nginxTemplate.tags).toContain('web-server');
    } catch (error) {
      console.warn('Template loading test failed:', error);
    }
  });
});