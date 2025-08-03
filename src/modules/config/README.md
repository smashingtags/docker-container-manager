# Configuration Management Module

This module provides persistent storage and management for Docker container configurations using SQLite database.

## Features

- **Persistent Storage**: Store container configurations in SQLite database
- **CRUD Operations**: Create, read, update, and delete container configurations
- **Export/Import**: Export individual or all configurations to JSON format
- **Backup/Restore**: Create timestamped backups and restore from backup files
- **Migration System**: Automatic database schema migrations
- **CLI Tools**: Command-line utilities for configuration management

## Usage

### Basic Operations

```typescript
import { ConfigServiceImpl } from '@/modules/config';
import { DatabaseServiceImpl } from '@/services/database.service';

// Initialize services
const databaseService = new DatabaseServiceImpl();
const configService = new ConfigServiceImpl(databaseService);

await databaseService.initialize();
await configService.initialize();

// Save a container configuration
await configService.saveContainerConfig('my-container', containerConfig);

// Retrieve a configuration
const config = await configService.getContainerConfig('my-container');

// Get all configurations
const allConfigs = await configService.getAllContainerConfigs();

// Delete a configuration
await configService.deleteContainerConfig('my-container');
```

### Export and Import

```typescript
// Export single configuration
const exportData = await configService.exportConfig('my-container');
await fs.writeFile('my-container-config.json', exportData);

// Import configuration
const importData = await fs.readFile('my-container-config.json', 'utf8');
const importedConfig = await configService.importConfig(importData);

// Export all configurations
const allExportData = await configService.exportAllConfigs();

// Import all configurations
await configService.importAllConfigs(allExportData);
```

### Backup and Restore

```typescript
// Create backup
const backupPath = await configService.createBackup();
console.log(`Backup created: ${backupPath}`);

// Restore from backup
await configService.restoreFromBackup(backupPath);
```

## CLI Tools

The module includes command-line tools for managing configurations:

```bash
# Create a backup
npm run config:backup

# Restore from backup
npm run config:restore /path/to/backup.json

# Export single container configuration
npm run config:export container-id

# List all configurations
npm run config:list

# Delete a configuration
npm run config:delete container-id
```

## Database Schema

The module uses SQLite with the following schema:

### container_configs table
- `id` (TEXT PRIMARY KEY): Container ID
- `name` (TEXT NOT NULL): Container name
- `image` (TEXT NOT NULL): Docker image name
- `tag` (TEXT NOT NULL): Image tag
- `config_data` (TEXT NOT NULL): JSON-serialized configuration
- `created_at` (DATETIME): Creation timestamp
- `updated_at` (DATETIME): Last update timestamp

### migrations table
- `id` (INTEGER PRIMARY KEY): Migration ID
- `version` (TEXT UNIQUE): Migration version
- `applied_at` (DATETIME): Application timestamp

## Error Handling

The module uses custom `ConfigServiceError` for all errors:

```typescript
try {
  await configService.getContainerConfig('non-existent');
} catch (error) {
  if (error instanceof ConfigServiceError) {
    console.log(`Error code: ${error.code}`);
    console.log(`Error message: ${error.message}`);
    console.log(`Error details:`, error.details);
  }
}
```

### Error Codes

- `INIT_ERROR`: Service initialization failed
- `GET_CONFIG_ERROR`: Failed to retrieve configuration
- `SAVE_CONFIG_ERROR`: Failed to save configuration
- `DELETE_CONFIG_ERROR`: Failed to delete configuration
- `CONFIG_NOT_FOUND`: Configuration not found
- `EXPORT_CONFIG_ERROR`: Failed to export configuration
- `IMPORT_CONFIG_ERROR`: Failed to import configuration
- `INVALID_IMPORT_FORMAT`: Invalid import data format
- `INVALID_CONFIG_DATA`: Invalid configuration data
- `CREATE_BACKUP_ERROR`: Failed to create backup
- `RESTORE_BACKUP_ERROR`: Failed to restore backup
- `BACKUP_FILE_NOT_FOUND`: Backup file not found

## Testing

The module includes comprehensive unit and integration tests:

```bash
# Run unit tests
npm test -- src/modules/config/config.service.test.ts

# Run integration tests
npm test -- src/modules/config/config.service.integration.test.ts
```

## Migration System

The module includes an automatic migration system that:

1. Creates a `migrations` table to track applied migrations
2. Applies new migrations automatically on service initialization
3. Ensures migrations are only applied once
4. Supports multi-statement migrations

To add new migrations, update the `runMigrations()` method in `config.service.ts`.

## File Structure

```
src/modules/config/
├── config.service.ts              # Main service implementation
├── config.service.test.ts         # Unit tests
├── config.service.integration.test.ts  # Integration tests
├── config.cli.ts                  # CLI utilities
├── index.ts                       # Module exports
└── README.md                      # This documentation
```

## Dependencies

- `sqlite3`: SQLite database driver
- `fs/promises`: File system operations for backups
- `path`: Path utilities for backup file management