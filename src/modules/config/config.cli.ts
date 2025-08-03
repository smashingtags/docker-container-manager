#!/usr/bin/env node

import { ConfigServiceImpl } from './config.service';
import { DatabaseServiceImpl } from '@/services/database.service';
import * as path from 'path';

/**
 * Simple CLI utility for managing container configurations
 * Usage examples:
 * - npm run config:backup
 * - npm run config:restore /path/to/backup.json
 * - npm run config:export container-id
 * - npm run config:list
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage: config-cli <command> [args...]');
    console.log('Commands:');
    console.log('  backup                    - Create a backup of all configurations');
    console.log('  restore <backup-path>     - Restore configurations from backup');
    console.log('  export <container-id>     - Export single container configuration');
    console.log('  list                      - List all container configurations');
    console.log('  delete <container-id>     - Delete container configuration');
    process.exit(1);
  }

  // Initialize services
  const databaseService = new DatabaseServiceImpl();
  const configService = new ConfigServiceImpl(databaseService);

  try {
    await databaseService.initialize();
    await configService.initialize();

    switch (command) {
      case 'backup':
        await createBackup(configService);
        break;
      case 'restore':
        if (!args[1]) {
          console.error('Error: backup path is required');
          process.exit(1);
        }
        await restoreBackup(configService, args[1]);
        break;
      case 'export':
        if (!args[1]) {
          console.error('Error: container ID is required');
          process.exit(1);
        }
        await exportConfig(configService, args[1]);
        break;
      case 'list':
        await listConfigs(configService);
        break;
      case 'delete':
        if (!args[1]) {
          console.error('Error: container ID is required');
          process.exit(1);
        }
        await deleteConfig(configService, args[1]);
        break;
      default:
        console.error(`Error: Unknown command '${command}'`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await databaseService.destroy();
  }
}

async function createBackup(configService: ConfigServiceImpl): Promise<void> {
  console.log('Creating backup...');
  const backupPath = await configService.createBackup();
  console.log(`Backup created successfully: ${backupPath}`);
}

async function restoreBackup(configService: ConfigServiceImpl, backupPath: string): Promise<void> {
  console.log(`Restoring from backup: ${backupPath}`);
  await configService.restoreFromBackup(backupPath);
  console.log('Backup restored successfully');
}

async function exportConfig(configService: ConfigServiceImpl, containerId: string): Promise<void> {
  console.log(`Exporting configuration for container: ${containerId}`);
  const exportData = await configService.exportConfig(containerId);
  
  const exportPath = path.join(process.cwd(), `${containerId}-config.json`);
  const fs = await import('fs/promises');
  await fs.writeFile(exportPath, exportData, 'utf8');
  
  console.log(`Configuration exported to: ${exportPath}`);
}

async function listConfigs(configService: ConfigServiceImpl): Promise<void> {
  console.log('Container configurations:');
  const configs = await configService.getAllContainerConfigs();
  
  if (configs.length === 0) {
    console.log('No configurations found');
    return;
  }

  console.log('\nID\t\t\tName\t\t\tImage\t\t\tTag');
  console.log('─'.repeat(80));
  
  for (const config of configs) {
    const id = config.id.substring(0, 12);
    const name = config.name.substring(0, 15);
    const image = config.image.substring(0, 15);
    const tag = config.tag.substring(0, 10);
    
    console.log(`${id.padEnd(12)}\t${name.padEnd(15)}\t${image.padEnd(15)}\t${tag}`);
  }
  
  console.log(`\nTotal: ${configs.length} configurations`);
}

async function deleteConfig(configService: ConfigServiceImpl, containerId: string): Promise<void> {
  console.log(`Deleting configuration for container: ${containerId}`);
  await configService.deleteContainerConfig(containerId);
  console.log('Configuration deleted successfully');
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as configCli };