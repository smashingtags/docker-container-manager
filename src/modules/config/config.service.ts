import { ContainerConfig } from '@/types/container.types';
import { DatabaseService } from '@/services/database.service';
import { MigrationService, MigrationServiceImpl } from '@/services/migration.service';
import { logger } from '@/utils/logger';
import { validateContainerConfig } from '@/modules/containers/container.validation';
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
}

interface ExportData {
  version: string;
  timestamp: string;
  config?: ContainerConfig;
  configs?: ContainerConfig[];
}

export class ConfigServiceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ConfigServiceError';
  }
}

export class ConfigServiceImpl implements ConfigService {
  private migrationService: MigrationService;
  private readonly backupDir = './data/backups';
  private readonly configVersion = '1.0.0';

  constructor(private databaseService: DatabaseService) {
    this.migrationService = new MigrationServiceImpl(databaseService);
  }

  async initialize(): Promise<void> {
    try {
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Run database migrations
      await this.migrationService.runMigrations();
      
      logger.info('ConfigService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ConfigService:', error);
      throw new ConfigServiceError(
        'Failed to initialize configuration service',
        'INIT_FAILED',
        error
      );
    }
  }

  private mapRowToConfig(row: DatabaseConfigRow): ContainerConfig {
    return {
      id: row.id,
      name: row.name,
      image: row.image,
      tag: row.tag,
      environment: JSON.parse(row.environment),
      ports: JSON.parse(row.ports),
      volumes: JSON.parse(row.volumes),
      networks: JSON.parse(row.networks),
      restartPolicy: row.restart_policy as ContainerConfig['restartPolicy'],
      resources: JSON.parse(row.resources),
      healthCheck: row.health_check ? JSON.parse(row.health_check) : undefined,
      security: row.security ? JSON.parse(row.security) : undefined,
      labels: row.labels ? JSON.parse(row.labels) : undefined,
      workingDir: row.working_dir || undefined,
      entrypoint: row.entrypoint ? JSON.parse(row.entrypoint) : undefined,
      command: row.command ? JSON.parse(row.command) : undefined,
      hostname: row.hostname || undefined,
      domainname: row.domainname || undefined,
      autoRemove: Boolean(row.auto_remove)
    };
  }

  async getContainerConfig(id: string): Promise<ContainerConfig | null> {
    try {
      const row = await this.databaseService.get<DatabaseConfigRow>(
        'SELECT * FROM container_configs WHERE id = ?',
        [id]
      );

      if (!row) {
        return null;
      }

      return this.mapRowToConfig(row);
    } catch (error) {
      logger.error(`Failed to get container config for ${id}:`, error);
      throw new ConfigServiceError(
        `Failed to retrieve configuration for container ${id}`,
        'GET_CONFIG_FAILED',
        error
      );
    }
  }

  async saveContainerConfig(id: string, config: ContainerConfig): Promise<void> {
    try {
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
            restart_policy, resources, health_check, security, labels,
            working_dir, entrypoint, command, hostname, domainname,
            auto_remove, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
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
          now
        ]);
      }

      logger.info(`Container configuration saved for ${id}`);
    } catch (error) {
      logger.error(`Failed to save container config for ${id}:`, error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to save configuration for container ${id}`,
        'SAVE_CONFIG_FAILED',
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
          `Container configuration not found for ID: ${id}`,
          'CONFIG_NOT_FOUND'
        );
      }

      logger.info(`Container configuration deleted for ${id}`);
    } catch (error) {
      logger.error(`Failed to delete container config for ${id}:`, error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to delete configuration for container ${id}`,
        'DELETE_CONFIG_FAILED',
        error
      );
    }
  }

  async getAllContainerConfigs(): Promise<ContainerConfig[]> {
    try {
      const rows = await this.databaseService.query<DatabaseConfigRow>(
        'SELECT * FROM container_configs ORDER BY name'
      );

      return rows.map(row => this.mapRowToConfig(row));
    } catch (error) {
      logger.error('Failed to get all container configs:', error);
      throw new ConfigServiceError(
        'Failed to retrieve all container configurations',
        'GET_ALL_CONFIGS_FAILED',
        error
      );
    }
  }

  async exportConfig(id: string): Promise<string> {
    try {
      const config = await this.getContainerConfig(id);
      if (!config) {
        throw new ConfigServiceError(
          `Container configuration not found for ID: ${id}`,
          'CONFIG_NOT_FOUND'
        );
      }

      const exportData: ExportData = {
        version: this.configVersion,
        timestamp: new Date().toISOString(),
        config
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error(`Failed to export config for ${id}:`, error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to export configuration for container ${id}`,
        'EXPORT_CONFIG_FAILED',
        error
      );
    }
  }

  async importConfig(configData: string): Promise<ContainerConfig> {
    try {
      const importData = JSON.parse(configData) as ExportData;

      // Validate import data structure
      if (!importData.config || !importData.version) {
        throw new ConfigServiceError(
          'Invalid configuration data format',
          'INVALID_IMPORT_FORMAT'
        );
      }

      const config = importData.config;

      // Validate required fields
      if (!config.id || !config.name || !config.image) {
        throw new ConfigServiceError(
          'Missing required configuration fields (id, name, image)',
          'INVALID_CONFIG_DATA'
        );
      }

      // Save the imported config
      await this.saveContainerConfig(config.id, config);

      logger.info(`Configuration imported for container ${config.id}`);
      return config;
    } catch (error) {
      logger.error('Failed to import config:', error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        'Failed to import configuration',
        'IMPORT_CONFIG_FAILED',
        error
      );
    }
  }

  async exportAllConfigs(): Promise<string> {
    try {
      const configs = await this.getAllContainerConfigs();

      const exportData: ExportData = {
        version: this.configVersion,
        timestamp: new Date().toISOString(),
        configs
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('Failed to export all configs:', error);
      throw new ConfigServiceError(
        'Failed to export all configurations',
        'EXPORT_ALL_CONFIGS_FAILED',
        error
      );
    }
  }

  async importAllConfigs(configData: string): Promise<void> {
    try {
      const importData = JSON.parse(configData) as ExportData;

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
            `Invalid configuration data for container: ${config.name || 'unknown'}`,
            'INVALID_CONFIG_DATA'
          );
        }

        await this.saveContainerConfig(config.id, config);
      }

      logger.info(`Imported ${importData.configs.length} container configurations`);
    } catch (error) {
      logger.error('Failed to import all configs:', error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        'Failed to import all configurations',
        'IMPORT_ALL_CONFIGS_FAILED',
        error
      );
    }
  }

  async createBackup(name: string, description?: string): Promise<number> {
    try {
      const backupData = await this.exportAllConfigs();
      const now = new Date().toISOString();

      // Insert backup record into database
      const result = await this.databaseService.run(`
        INSERT INTO config_backups (name, description, backup_data, created_at)
        VALUES (?, ?, ?, ?)
      `, [name, description || null, backupData, now]);

      const backupId = result.lastID as number;

      // Also create a file backup
      const timestamp = now.replace(/[:.]/g, '-');
      const backupFileName = `config-backup-${backupId}-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);
      await fs.writeFile(backupPath, backupData, 'utf8');

      logger.info(`Configuration backup created: ${name} (ID: ${backupId})`);
      return backupId;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw new ConfigServiceError(
        'Failed to create configuration backup',
        'CREATE_BACKUP_FAILED',
        error
      );
    }
  }

  async restoreBackup(backupId: number): Promise<void> {
    try {
      // Get backup data from database
      const backup = await this.databaseService.get<{
        id: number;
        name: string;
        backup_data: string;
        created_at: string;
      }>('SELECT * FROM config_backups WHERE id = ?', [backupId]);

      if (!backup) {
        throw new ConfigServiceError(
          `Backup not found with ID: ${backupId}`,
          'BACKUP_NOT_FOUND'
        );
      }

      // Import all configs from backup
      await this.importAllConfigs(backup.backup_data);

      logger.info(`Configuration restored from backup: ${backup.name} (ID: ${backupId})`);
    } catch (error) {
      logger.error(`Failed to restore backup ${backupId}:`, error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to restore configuration from backup ${backupId}`,
        'RESTORE_BACKUP_FAILED',
        error
      );
    }
  }

  async listBackups(): Promise<ConfigBackup[]> {
    try {
      const rows = await this.databaseService.query<{
        id: number;
        name: string;
        description?: string;
        created_at: string;
      }>('SELECT id, name, description, created_at FROM config_backups ORDER BY created_at DESC');

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw new ConfigServiceError(
        'Failed to retrieve backup list',
        'LIST_BACKUPS_FAILED',
        error
      );
    }
  }

  async deleteBackup(backupId: number): Promise<void> {
    try {
      const result = await this.databaseService.run(
        'DELETE FROM config_backups WHERE id = ?',
        [backupId]
      );

      if (result.changes === 0) {
        throw new ConfigServiceError(
          `Backup not found with ID: ${backupId}`,
          'BACKUP_NOT_FOUND'
        );
      }

      // Also try to delete the file backup (if it exists)
      try {
        const backupFiles = await fs.readdir(this.backupDir);
        const targetFile = backupFiles.find(file => file.includes(`-${backupId}-`));
        if (targetFile) {
          await fs.unlink(path.join(this.backupDir, targetFile));
        }
      } catch (fileError) {
        // File deletion is not critical, just log the error
        logger.warn(`Failed to delete backup file for backup ${backupId}:`, fileError);
      }

      logger.info(`Configuration backup deleted: ID ${backupId}`);
    } catch (error) {
      logger.error(`Failed to delete backup ${backupId}:`, error);
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError(
        `Failed to delete backup ${backupId}`,
        'DELETE_BACKUP_FAILED',
        error
      );
    }
  }
}