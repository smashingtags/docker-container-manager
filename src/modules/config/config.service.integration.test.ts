import { ConfigServiceImpl, ConfigServiceError } from './config.service';
import { DatabaseServiceImpl } from '@/services/database.service';
import { ContainerConfig } from '@/types/container.types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ConfigService Integration', () => {
  let configService: ConfigServiceImpl;
  let databaseService: DatabaseServiceImpl;
  let testDbPath: string;
  let mockConfig: ContainerConfig;

  beforeAll(async () => {
    // Create a unique test database path
    testDbPath = path.join(__dirname, `test-config-${Date.now()}.sqlite`);
    databaseService = new DatabaseServiceImpl(testDbPath);
    configService = new ConfigServiceImpl(databaseService);

    // Initialize services
    await databaseService.initialize();
    await configService.initialize();

    mockConfig = {
      id: 'test-container-1',
      name: 'test-container',
      image: 'nginx',
      tag: 'latest',
      environment: { NODE_ENV: 'production' },
      ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
      volumes: [{ hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }],
      networks: ['bridge'],
      restartPolicy: 'always',
      resources: { memory: 512, cpus: 1 },
      labels: { 'app.name': 'test-app' }
    };
  });

  afterAll(async () => {
    // Clean up
    await databaseService.destroy();
    
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(async () => {
    // Clear the database before each test
    await databaseService.run('DELETE FROM container_configs');
  });

  describe('database operations', () => {
    it('should save and retrieve container config', async () => {
      await configService.saveContainerConfig('test-container-1', mockConfig);
      
      const retrieved = await configService.getContainerConfig('test-container-1');
      
      expect(retrieved).toEqual(mockConfig);
    });

    it('should update existing config', async () => {
      // Save initial config
      await configService.saveContainerConfig('test-container-1', mockConfig);
      
      // Update config
      const updatedConfig = { ...mockConfig, image: 'nginx', tag: '1.21' };
      await configService.saveContainerConfig('test-container-1', updatedConfig);
      
      const retrieved = await configService.getContainerConfig('test-container-1');
      
      expect(retrieved?.image).toBe('nginx');
      expect(retrieved?.tag).toBe('1.21');
    });

    it('should delete container config', async () => {
      await configService.saveContainerConfig('test-container-1', mockConfig);
      
      await configService.deleteContainerConfig('test-container-1');
      
      const retrieved = await configService.getContainerConfig('test-container-1');
      expect(retrieved).toBeNull();
    });

    it('should get all container configs', async () => {
      const config1 = { ...mockConfig, id: 'container-1', name: 'container-1' };
      const config2 = { ...mockConfig, id: 'container-2', name: 'container-2', image: 'redis' };
      
      await configService.saveContainerConfig('container-1', config1);
      await configService.saveContainerConfig('container-2', config2);
      
      const allConfigs = await configService.getAllContainerConfigs();
      
      expect(allConfigs).toHaveLength(2);
      expect(allConfigs.find(c => c.id === 'container-1')).toEqual(config1);
      expect(allConfigs.find(c => c.id === 'container-2')).toEqual(config2);
    });
  });

  describe('export and import operations', () => {
    it('should export and import single config', async () => {
      await configService.saveContainerConfig('test-container-1', mockConfig);
      
      const exportData = await configService.exportConfig('test-container-1');
      
      // Clear database
      await databaseService.run('DELETE FROM container_configs');
      
      const importedConfig = await configService.importConfig(exportData);
      
      expect(importedConfig).toEqual(mockConfig);
      
      const retrieved = await configService.getContainerConfig('test-container-1');
      expect(retrieved).toEqual(mockConfig);
    });

    it('should export and import all configs', async () => {
      const config1 = { ...mockConfig, id: 'container-1', name: 'container-1' };
      const config2 = { ...mockConfig, id: 'container-2', name: 'container-2', image: 'redis' };
      
      await configService.saveContainerConfig('container-1', config1);
      await configService.saveContainerConfig('container-2', config2);
      
      const exportData = await configService.exportAllConfigs();
      
      // Clear database
      await databaseService.run('DELETE FROM container_configs');
      
      await configService.importAllConfigs(exportData);
      
      const allConfigs = await configService.getAllContainerConfigs();
      expect(allConfigs).toHaveLength(2);
      expect(allConfigs.find(c => c.id === 'container-1')).toEqual(config1);
      expect(allConfigs.find(c => c.id === 'container-2')).toEqual(config2);
    });
  });

  describe('backup and restore operations', () => {
    it('should create and restore from backup', async () => {
      const config1 = { ...mockConfig, id: 'container-1', name: 'container-1' };
      const config2 = { ...mockConfig, id: 'container-2', name: 'container-2', image: 'redis' };
      
      await configService.saveContainerConfig('container-1', config1);
      await configService.saveContainerConfig('container-2', config2);
      
      const backupPath = await configService.createBackup();
      
      // Verify backup file exists
      expect(backupPath).toMatch(/config-backup-.*\.json$/);
      
      try {
        await fs.access(backupPath);
      } catch (error) {
        fail('Backup file should exist');
      }
      
      // Clear database
      await databaseService.run('DELETE FROM container_configs');
      
      // Restore from backup
      await configService.restoreFromBackup(backupPath);
      
      const allConfigs = await configService.getAllContainerConfigs();
      expect(allConfigs).toHaveLength(2);
      expect(allConfigs.find(c => c.id === 'container-1')).toEqual(config1);
      expect(allConfigs.find(c => c.id === 'container-2')).toEqual(config2);
      
      // Clean up backup file
      try {
        await fs.unlink(backupPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should handle backup file not found error', async () => {
      await expect(configService.restoreFromBackup('/nonexistent/backup.json'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.restoreFromBackup('/nonexistent/backup.json'))
        .rejects.toThrow('Backup file not found');
    });
  });

  describe('error handling', () => {
    it('should throw error when deleting non-existent config', async () => {
      await expect(configService.deleteContainerConfig('non-existent'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.deleteContainerConfig('non-existent'))
        .rejects.toThrow('Container config not found');
    });

    it('should throw error when exporting non-existent config', async () => {
      await expect(configService.exportConfig('non-existent'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.exportConfig('non-existent'))
        .rejects.toThrow('Container config not found');
    });

    it('should handle invalid JSON in import', async () => {
      await expect(configService.importConfig('invalid json'))
        .rejects.toThrow(ConfigServiceError);
    });

    it('should handle invalid backup format in importAllConfigs', async () => {
      const invalidBackup = JSON.stringify({ invalid: 'format' });
      
      await expect(configService.importAllConfigs(invalidBackup))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.importAllConfigs(invalidBackup))
        .rejects.toThrow('Invalid backup data format');
    });
  });

  describe('data persistence', () => {
    it('should persist data across service restarts', async () => {
      await configService.saveContainerConfig('persistent-container', mockConfig);
      
      // Simulate service restart by creating new instances
      await databaseService.destroy();
      
      const newDatabaseService = new DatabaseServiceImpl(testDbPath);
      const newConfigService = new ConfigServiceImpl(newDatabaseService);
      
      await newDatabaseService.initialize();
      await newConfigService.initialize();
      
      const retrieved = await newConfigService.getContainerConfig('persistent-container');
      expect(retrieved).toEqual(mockConfig);
      
      await newDatabaseService.destroy();
    });
  });
});