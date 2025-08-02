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

export class ConfigServiceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ConfigServiceError';
  }
}

export class ConfigServiceImpl implements ConfigService {
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
        error
      );
    }
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
            restart_policy, resources, health_check, secur