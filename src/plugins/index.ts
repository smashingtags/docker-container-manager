import { Plugin, PluginContext } from '@/types';
import { logger } from '@/utils/logger';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async loadPlugin(plugin: Plugin): Promise<void> {
    try {
      await plugin.initialize(this.context);
      this.plugins.set(plugin.name, plugin);
      logger.info(`Plugin loaded: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      this.plugins.delete(name);
      logger.info(`Plugin unloaded: ${name}`);
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getLoadedPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
}