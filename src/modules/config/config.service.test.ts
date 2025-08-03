import { ConfigServiceImpl, ConfigServiceError } from './config.service';
import { DatabaseService } from '@/services/database.service';
import { ContainerConfig } from '@/types/container.types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock database service
const mockDatabaseService: jest.Mocked<DatabaseService> = {
  initialize: jest.fn(),
  destroy: jest.fn(),
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  close: jest.fn(),
};

describe('ConfigService', () => {
  let configService: ConfigServiceImpl;
  let mockConfig: ContainerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigServiceImpl(mockDatabaseService);
    
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

  describe('initialize', () => {
    it('should create backup directory and database tables', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      await configService.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith('./data/backups', { recursive: true });
      expect(mockDatabaseService.run).toHaveBeenCalledTimes(4); // migrations table + migration statements + migration record
    });

    it('should throw ConfigServiceError on initialization failure', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(configService.initialize()).rejects.toThrow(ConfigServiceError);
      await expect(configService.initialize()).rejects.toThrow('Failed to initialize config service');
    });
  });

  describe('getContainerConfig', () => {
    it('should return container config when found', async () => {
      const mockRow = {
        id: 'test-container-1',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        config_data: JSON.stringify(mockConfig),
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDatabaseService.get.mockResolvedValue(mockRow);

      const result = await configService.getContainerConfig('test-container-1');

      expect(result).toEqual(mockConfig);
      expect(mockDatabaseService.get).toHaveBeenCalledWith(
        'SELECT * FROM container_configs WHERE id = ?',
        ['test-container-1']
      );
    });

    it('should return null when config not found', async () => {
      mockDatabaseService.get.mockResolvedValue(undefined);

      const result = await configService.getContainerConfig('non-existent');

      expect(result).toBeNull();
    });

    it('should throw ConfigServiceError on database error', async () => {
      mockDatabaseService.get.mockRejectedValue(new Error('Database error'));

      await expect(configService.getContainerConfig('test-container-1'))
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('saveContainerConfig', () => {
    it('should insert new config when not exists', async () => {
      mockDatabaseService.get.mockResolvedValue(undefined); // Config doesn't exist
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      await configService.saveContainerConfig('test-container-1', mockConfig);

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO container_configs'),
        expect.arrayContaining([
          'test-container-1',
          'test-container',
          'nginx',
          'latest',
          JSON.stringify(mockConfig)
        ])
      );
    });

    it('should update existing config when exists', async () => {
      mockDatabaseService.get.mockResolvedValue({ id: 'test-container-1' }); // Config exists
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      await configService.saveContainerConfig('test-container-1', mockConfig);

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE container_configs'),
        expect.arrayContaining([
          'test-container',
          'nginx',
          'latest',
          JSON.stringify(mockConfig)
        ])
      );
    });

    it('should throw ConfigServiceError on database error', async () => {
      mockDatabaseService.get.mockRejectedValue(new Error('Database error'));

      await expect(configService.saveContainerConfig('test-container-1', mockConfig))
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('deleteContainerConfig', () => {
    it('should delete existing config', async () => {
      mockDatabaseService.run.mockResolvedValue({ lastID: 0, changes: 1 });

      await configService.deleteContainerConfig('test-container-1');

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        'DELETE FROM container_configs WHERE id = ?',
        ['test-container-1']
      );
    });

    it('should throw ConfigServiceError when config not found', async () => {
      mockDatabaseService.run.mockResolvedValue({ lastID: 0, changes: 0 });

      await expect(configService.deleteContainerConfig('non-existent'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.deleteContainerConfig('non-existent'))
        .rejects.toThrow('Container config not found');
    });

    it('should throw ConfigServiceError on database error', async () => {
      mockDatabaseService.run.mockRejectedValue(new Error('Database error'));

      await expect(configService.deleteContainerConfig('test-container-1'))
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('getAllContainerConfigs', () => {
    it('should return all container configs', async () => {
      const mockRows = [
        {
          id: 'test-container-1',
          name: 'test-container-1',
          image: 'nginx',
          tag: 'latest',
          config_data: JSON.stringify(mockConfig),
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'test-container-2',
          name: 'test-container-2',
          image: 'redis',
          tag: 'alpine',
          config_data: JSON.stringify({ ...mockConfig, id: 'test-container-2', image: 'redis' }),
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(mockRows);

      const result = await configService.getAllContainerConfigs();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockConfig);
      expect(result[1]?.image).toBe('redis');
    });

    it('should throw ConfigServiceError on database error', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Database error'));

      await expect(configService.getAllContainerConfigs())
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('exportConfig', () => {
    it('should export single config as JSON', async () => {
      const mockRow = {
        id: 'test-container-1',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
        config_data: JSON.stringify(mockConfig),
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDatabaseService.get.mockResolvedValue(mockRow);

      const result = await configService.exportConfig('test-container-1');
      const exportData = JSON.parse(result);

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.config).toEqual(mockConfig);
      expect(exportData.timestamp).toBeDefined();
    });

    it('should throw ConfigServiceError when config not found', async () => {
      mockDatabaseService.get.mockResolvedValue(undefined);

      await expect(configService.exportConfig('non-existent'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.exportConfig('non-existent'))
        .rejects.toThrow('Container config not found');
    });
  });

  describe('importConfig', () => {
    it('should import valid config data', async () => {
      const exportData = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00.000Z',
        config: mockConfig
      };

      mockDatabaseService.get.mockResolvedValue(undefined); // Config doesn't exist
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      const result = await configService.importConfig(JSON.stringify(exportData));

      expect(result).toEqual(mockConfig);
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO container_configs'),
        expect.any(Array)
      );
    });

    it('should throw ConfigServiceError for invalid format', async () => {
      const invalidData = { invalid: 'data' };

      await expect(configService.importConfig(JSON.stringify(invalidData)))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.importConfig(JSON.stringify(invalidData)))
        .rejects.toThrow('Invalid config data format');
    });

    it('should throw ConfigServiceError for missing required fields', async () => {
      const invalidConfig = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00.000Z',
        config: { name: 'test' } // Missing id and image
      };

      await expect(configService.importConfig(JSON.stringify(invalidConfig)))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.importConfig(JSON.stringify(invalidConfig)))
        .rejects.toThrow('Missing required config fields');
    });
  });

  describe('exportAllConfigs', () => {
    it('should export all configs as backup format', async () => {
      const mockRows = [
        {
          id: 'test-container-1',
          name: 'test-container-1',
          image: 'nginx',
          tag: 'latest',
          config_data: JSON.stringify(mockConfig),
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(mockRows);

      const result = await configService.exportAllConfigs();
      const backupData = JSON.parse(result);

      expect(backupData.version).toBe('1.0.0');
      expect(backupData.configs).toHaveLength(1);
      expect(backupData.configs[0]).toEqual(mockConfig);
      expect(backupData.timestamp).toBeDefined();
    });
  });

  describe('importAllConfigs', () => {
    it('should import all configs from backup', async () => {
      const backupData = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00.000Z',
        configs: [mockConfig, { ...mockConfig, id: 'test-container-2' }]
      };

      mockDatabaseService.get.mockResolvedValue(undefined); // Configs don't exist
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      await configService.importAllConfigs(JSON.stringify(backupData));

      expect(mockDatabaseService.run).toHaveBeenCalledTimes(2); // Two configs imported
    });

    it('should throw ConfigServiceError for invalid backup format', async () => {
      const invalidBackup = { invalid: 'backup' };

      await expect(configService.importAllConfigs(JSON.stringify(invalidBackup)))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.importAllConfigs(JSON.stringify(invalidBackup)))
        .rejects.toThrow('Invalid backup data format');
    });
  });

  describe('createBackup', () => {
    it('should create backup file with timestamp', async () => {
      const mockRows = [
        {
          id: 'test-container-1',
          name: 'test-container-1',
          image: 'nginx',
          tag: 'latest',
          config_data: JSON.stringify(mockConfig),
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(mockRows);
      mockFs.writeFile.mockResolvedValue(undefined);

      const backupPath = await configService.createBackup();

      expect(backupPath).toMatch(/config-backup-.*\.json$/);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/config-backup-.*\.json$/),
        expect.stringContaining('"version": "1.0.0"'),
        'utf8'
      );
    });

    it('should throw ConfigServiceError on file write error', async () => {
      mockDatabaseService.query.mockResolvedValue([]);
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(configService.createBackup())
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore configs from backup file', async () => {
      const backupData = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00.000Z',
        configs: [mockConfig]
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(backupData));
      mockDatabaseService.get.mockResolvedValue(undefined); // Config doesn't exist
      mockDatabaseService.run.mockResolvedValue({ lastID: 1, changes: 1 });

      await configService.restoreFromBackup('/path/to/backup.json');

      expect(mockFs.access).toHaveBeenCalledWith('/path/to/backup.json');
      expect(mockFs.readFile).toHaveBeenCalledWith('/path/to/backup.json', 'utf8');
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO container_configs'),
        expect.any(Array)
      );
    });

    it('should throw ConfigServiceError when backup file not found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(configService.restoreFromBackup('/path/to/nonexistent.json'))
        .rejects.toThrow(ConfigServiceError);
      await expect(configService.restoreFromBackup('/path/to/nonexistent.json'))
        .rejects.toThrow('Backup file not found');
    });

    it('should throw ConfigServiceError on file read error', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      await expect(configService.restoreFromBackup('/path/to/backup.json'))
        .rejects.toThrow(ConfigServiceError);
    });
  });

  describe('ConfigServiceError', () => {
    it('should create error with code and details', () => {
      const error = new ConfigServiceError('Test message', 'TEST_CODE', { detail: 'test' });

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('ConfigServiceError');
    });
  });
});