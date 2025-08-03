import { ContainerConfig } from '@/types/container.types';
import { DatabaseService } from '@/services/database.service';
<<<<<<< HEAD
=======
import { MigrationService, MigrationServiceImpl } from '@/services/migration.service';
import { logger } from '@/utils/logger';
import { validateContainerConfig } from '@/modules/containers/container.validation';
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ConfigService {
  initialize(): Promise<void>;
  getContainerConfig(id: string): Promise<ContainerConfig | null>;
  saveContainerConfig(id: string, config: ContainerConfig): Promise<void>;
  deleteContainerConfig(id: string): Promise<void>;
  getAllContainerConfigs(): Promise<ContainerConfig[]>;
  exportConfig(id: string): Promise<string>;
  importConfig(configData: string): Promise<ContainerConfig>;
  exportAllConfigs(): Promise<string>;
  importAllConfigs(configData: string): Promise<void>;
<<<<<<< HEAD
  createBackup(): Promise<string>;
  restoreFromBackup(backupPath: string): Promise<void>;
}

export interface ConfigBackup {
  version: string;
  timestamp: string;
  configs: ContainerConfig[];
=======
  createBackup(name: string, description?: string): Promise<number>;
  restoreBackup(backupId: number): Promise<void>;
  listBackups(): Promise<ConfigBackup[]>;
  deleteBackup(backupId: number): Promise<void>;
}

export interface ConfigBackup {
  id: number;
  name: string;
  description?: string;
  createdAt: Date;
}

interface DatabaseConfigRow {
  id: string;
  name: string;
  image: string;
  tag: string;
  environment: string;
  ports: string;
  volumes: string;
  networks: string;
  restart_policy: string;
  resources: string;
  health_check?: string;
  security?: string;
  labels?: string;
  working_dir?: string;
  entrypoint?: string;
  command?: string;
  hostname?: string;
  domainname?: string;
  auto_remove: number;
  created_at: string;
  updated_at: string;
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
}

export class ConfigServiceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ConfigServiceError';
  }
}

export class ConfigServiceImpl implements ConfigService {
<<<<<<< HEAD
  private readonly backupDir = './data/backups';
  private readonly configVersion = '1.0.0';

  constructor(private databaseService: DatabaseService) { }

  async initialize(): Promise<void> {
    try {
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create container_configs table if it doesn't exist
      await this.createTables();
    } catch (error) {
      throw new ConfigServiceError(
        'Failed to initialize config service',
        'INIT_ERROR',
=======
  private migrationService: MigrationService;

  constructor(private databaseService: DatabaseService) {
    this.migrationService = new MigrationServiceImpl(databaseService);
  }

  async initialize(): Promise<void> {
    try {
      await this.migrationService.runMigrations();
      logger.info('ConfigService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ConfigService:', error);
      throw new ConfigServiceError(
        'Failed to initialize configuration service',
        'INIT_FAILED',
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
        error
      );
    }
  }
<<<<<<< HEAD

  private async createTables(): Promise<void> {
    // Run migrations
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Define migrations
    const migrations = [
      {
        version: '001_initial_schema',
        sql: `
          CREATE TABLE IF NOT EXISTS container_configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            image TEXT NOT NULL,
            tag TEXT NOT NULL,
            config_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_container_configs_name 
          ON container_configs(name);
        `
      }
    ];

    // Apply migrations
    for (const migration of migrations) {
      const existing = await this.databaseService.get(
        'SELECT version FROM migrations WHERE version = ?',
        [migration.version]
      );

      if (!existing) {
        // Split SQL by semicolon and execute each statement
        const statements = migration.sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          await this.databaseService.run(statement);
        }

        // Record migration as applied
        await this.databaseService.run(
          'INSERT INTO migrations (version) VALUES (?)',
          [migration.version]
        );
      }
    }
  }

  async getContainerConfig(id: string): Promise<ContainerConfig | null> {
    try {
      const row = await this.databaseService.get<{
        id: string;
        name: string;
        image: string;
        tag: string;
        config_data: string;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM container_configs WHERE id = ?', [id]);
=======

  async getContainerConfig(id: string): Promise<ContainerConfig | null> {
    try {
      const row = await this.databaseService.get<DatabaseConfigRow>(
        'SELECT * FROM container_configs WHERE id = ?',
        [id]
      );
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5

      if (!row) {
        return null;
      }

<<<<<<< HEAD
      const config = JSON.parse(row.config_data) as ContainerConfig;
      return config;
    } catch (error) {
      throw new ConfigServiceError(
        `Failed to get container config for ID: ${id}`,
        'GET_CONFIG_ERROR',
=======
      return this.mapRowToConfig(row);
    } catch (error) {
      logger.error(`Failed to get container config for ${id}:`, error);
      throw new ConfigServiceError(
        `Failed to retrieve configuration for container ${id}`,
        'GET_CONFIG_FAILED',
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
        error
      );
    }
  }

  async saveContainerConfig(id: string, config: ContainerConfig): Promise<void> {
    try {
<<<<<<< HEAD
      const configData = JSON.stringify(config);
      const now = new Date().toISOString();

      // Check if config exists
      const existing = await this.databaseService.get(
        'SELECT id FROM container_configs WHERE id = ?',
        [id]
      );

      if (existing) {
        // Update existing config
        await this.databaseService.run(
          `UPDATE container_configs 
           SET name = ?, image = ?, tag = ?, config_data = ?, updated_at = ?
           WHERE id = ?`,
          [config.name, config.image, config.tag, configData, now, id]
        );
      } else {
        // Insert new config
        await this.databaseService.run(
          `INSERT INTO container_configs (id, name, image, tag, config_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, config.name, config.image, config.tag, configData, now, now]
        );
      }
    } catch (error) {
      throw new ConfigServiceError(
        `Failed to save container config for ID: ${id}`,
        'SAVE_CONFIG_ERROR',
        error
      );
    }
  }

  async deleteContainerConfig(id: string): Promise<void> {
    try {
      const result = await this.databaseService.run(
        'DELETE FROM container_configs WHERE id = ?',
        [id]
      );

      if (result.changes === 0) {
        throw new ConfigServiceError(
          `Container config not found for ID: ${id}`,
          'CONFIG_NOT_FOUND'
        );
      }
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to delete container config for ID: ${id}`,
        'DELETE_CONFIG_ERROR',
        error
      );
    }
  }

  async getAllContainerConfigs(): Promise<ContainerConfig[]> {
    try {
      const rows = await this.databaseService.query<{
        id: string;
        name: string;
        image: string;
        tag: string;
        config_data: string;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM container_configs ORDER BY name');

      return rows.map(row => JSON.parse(row.config_data) as ContainerConfig);
    } catch (error) {
      throw new ConfigServiceError(
        'Failed to get all container configs',
        'GET_ALL_CONFIGS_ERROR',
        error
      );
    }
  }

  async exportConfig(id: string): Promise<string> {
    try {
      const config = await this.getContainerConfig(id);
      if (!config) {
        throw new ConfigServiceError(
          `Container config not found for ID: ${id}`,
          'CONFIG_NOT_FOUND'
        );
      }

      const exportData = {
        version: this.configVersion,
        timestamp: new Date().toISOString(),
        config
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to export config for ID: ${id}`,
        'EXPORT_CONFIG_ERROR',
        error
      );
    }
  }

  async importConfig(configData: string): Promise<ContainerConfig> {
    try {
      const importData = JSON.parse(configData);

      // Validate import data structure
      if (!importData.config || !importData.version) {
        throw new ConfigServiceError(
          'Invalid config data format',
          'INVALID_IMPORT_FORMAT'
        );
      }

      const config = importData.config as ContainerConfig;

      // Validate required fields
      if (!config.id || !config.name || !config.image) {
        throw new ConfigServiceError(
          'Missing required config fields (id, name, image)',
          'INVALID_CONFIG_DATA'
        );
      }

      // Save the imported config
      await this.saveContainerConfig(config.id, config);

      return config;
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        'Failed to import config',
        'IMPORT_CONFIG_ERROR',
        error
      );
    }
  }

  async exportAllConfigs(): Promise<string> {
    try {
      const configs = await this.getAllContainerConfigs();

      const exportData: ConfigBackup = {
        version: this.configVersion,
        timestamp: new Date().toISOString(),
        configs
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new ConfigServiceError(
        'Failed to export all configs',
        'EXPORT_ALL_CONFIGS_ERROR',
        error
      );
    }
  }

  async importAllConfigs(configData: string): Promise<void> {
    try {
      const importData = JSON.parse(configData) as ConfigBackup;

      // Validate import data structure
      if (!importData.configs || !Array.isArray(importData.configs) || !importData.version) {
        throw new ConfigServiceError(
          'Invalid backup data format',
          'INVALID_BACKUP_FORMAT'
        );
      }

      // Import each config
      for (const config of importData.configs) {
        if (!config.id || !config.name || !config.image) {
          throw new ConfigServiceError(
            `Invalid config data for container: ${config.name || 'unknown'}`,
            'INVALID_CONFIG_DATA'
          );
        }

        await this.saveContainerConfig(config.id, config);
      }
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        'Failed to import all configs',
        'IMPORT_ALL_CONFIGS_ERROR',
        error
      );
    }
  }

  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `config-backup-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      const backupData = await this.exportAllConfigs();
      await fs.writeFile(backupPath, backupData, 'utf8');

      return backupPath;
    } catch (error) {
      throw new ConfigServiceError(
        'Failed to create backup',
        'CREATE_BACKUP_ERROR',
        error
      );
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      // Check if backup file exists
      try {
        await fs.access(backupPath);
      } catch {
        throw new ConfigServiceError(
          `Backup file not found: ${backupPath}`,
          'BACKUP_FILE_NOT_FOUND'
        );
      }

      // Read backup data
      const backupData = await fs.readFile(backupPath, 'utf8');

      // Import all configs from backup
      await this.importAllConfigs(backupData);
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to restore from backup: ${backupPath}`,
        'RESTORE_BACKUP_ERROR',
        error
      );
    }
  }
}
=======
      // Validate the configuration
      const validation = validateContainerConfig(config);
      if (!validation.isValid) {
        throw new ConfigServiceError(
          'Invalid container configuration',
          'VALIDATION_FAILED',
          validation.errors
        );
      }

      const now = new Date().toISOString();
      
      // Check if config exists
      const existing = await this.getContainerConfig(id);
      
      if (existing) {
        // Update existing configuration
        await this.databaseService.run(`
          UPDATE container_configs SET
            name = ?, image = ?, tag = ?, environment = ?, ports = ?,
            volumes = ?, networks = ?, restart_policy = ?, resources = ?,
            health_check = ?, security = ?, labels = ?, working_dir = ?,
            entrypoint = ?, command = ?, hostname = ?, domainname = ?,
            auto_remove = ?, updated_at = ?
          WHERE id = ?
        `, [
          config.name,
          config.image,
          config.tag,
          JSON.stringify(config.environment),
          JSON.stringify(config.ports),
          JSON.stringify(config.volumes),
          JSON.stringify(config.networks),
          config.restartPolicy,
          JSON.stringify(config.resources),
          config.healthCheck ? JSON.stringify(config.healthCheck) : null,
          config.security ? JSON.stringify(config.security) : null,
          config.labels ? JSON.stringify(config.labels) : null,
          config.workingDir || null,
          config.entrypoint ? JSON.stringify(config.entrypoint) : null,
          config.command ? JSON.stringify(config.command) : null,
          config.hostname || null,
          config.domainname || null,
          config.autoRemove ? 1 : 0,
          now,
          id
        ]);
      } else {
        // Insert new configuration
        await this.databaseService.run(`
          INSERT INTO container_configs (
            id, name, image, tag, environment, ports, volumes, networks,
            restart_policy, resources, health_check, secur
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
