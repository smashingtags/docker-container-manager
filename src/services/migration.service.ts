import { DatabaseService } from './database.service';
import { logger } from '@/utils/logger';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export interface MigrationService {
  runMigrations(): Promise<void>;
  rollbackMigration(version: number): Promise<void>;
  getCurrentVersion(): Promise<number>;
}

export class MigrationServiceImpl implements MigrationService {
  private migrations: Migration[] = [
    {
      version: 1,
      name: 'create_container_configs_table',
      up: `
        CREATE TABLE IF NOT EXISTS container_configs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          image TEXT NOT NULL,
          tag TEXT NOT NULL DEFAULT 'latest',
          environment TEXT NOT NULL DEFAULT '{}',
          ports TEXT NOT NULL DEFAULT '[]',
          volumes TEXT NOT NULL DEFAULT '[]',
          networks TEXT NOT NULL DEFAULT '[]',
          restart_policy TEXT NOT NULL DEFAULT 'no',
          resources TEXT NOT NULL DEFAULT '{}',
          health_check TEXT,
          security TEXT,
          labels TEXT,
          working_dir TEXT,
          entrypoint TEXT,
          command TEXT,
          hostname TEXT,
          domainname TEXT,
          auto_remove INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
      down: `DROP TABLE IF EXISTS container_configs;`
    },
    {
      version: 2,
      name: 'create_config_backups_table',
      up: `
        CREATE TABLE IF NOT EXISTS config_backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          backup_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
      down: `DROP TABLE IF EXISTS config_backups;`
    },
    {
      version: 3,
      name: 'create_schema_migrations_table',
      up: `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
      down: `DROP TABLE IF EXISTS schema_migrations;`
    }
  ];

  constructor(private databaseService: DatabaseService) {}

  async runMigrations(): Promise<void> {
    try {
      // Ensure schema_migrations table exists first
      await this.databaseService.run(this.migrations[2].up);
      
      const currentVersion = await this.getCurrentVersion();
      const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`);
        
        await this.databaseService.run(migration.up);
        
        await this.databaseService.run(
          'INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (?, ?)',
          [migration.version, migration.name]
        );
        
        logger.info(`Migration ${migration.version} completed`);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  async rollbackMigration(version: number): Promise<void> {
    try {
      const migration = this.migrations.find(m => m.version === version);
      if (!migration) {
        throw new Error(`Migration version ${version} not found`);
      }

      const currentVersion = await this.getCurrentVersion();
      if (version > currentVersion) {
        throw new Error(`Cannot rollback migration ${version}: not yet applied`);
      }

      logger.info(`Rolling back migration ${version}: ${migration.name}`);
      
      await this.databaseService.run(migration.down);
      
      await this.databaseService.run(
        'DELETE FROM schema_migrations WHERE version = ?',
        [version]
      );
      
      logger.info(`Migration ${version} rolled back successfully`);
    } catch (error) {
      logger.error(`Rollback failed for migration ${version}:`, error);
      throw error;
    }
  }

  async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.databaseService.get<{ version: number }>(
        'SELECT MAX(version) as version FROM schema_migrations'
      );
      return result?.version || 0;
    } catch (error) {
      // If schema_migrations table doesn't exist, return 0
      return 0;
    }
  }
}