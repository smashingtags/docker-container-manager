import { App, AppDetails, AppTemplate, DeployConfig, AppCategory } from '@/types/app.types';
import { Container, ContainerConfig } from '@/types/container.types';
import { TemplateService, TemplateServiceImpl } from './template.service';
import { ContainerService } from '@/modules/containers';
import { logger } from '@/utils/logger';

export interface AppStoreService {
  getApps(category?: string): Promise<App[]>;
  searchApps(query: string): Promise<App[]>;
  getAppDetails(id: string): Promise<AppDetails>;
  getCategories(): Promise<AppCategory[]>;
  deployApp(appId: string, config: DeployConfig): Promise<Container>;
  getAppTemplate(id: string): Promise<AppTemplate>;
}

export class AppStoreServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'AppStoreServiceError';
  }
}

export class AppStoreServiceImpl implements AppStoreService {
  private templateService: TemplateService;
  private containerService: ContainerService;

  constructor(
    containerService: ContainerService,
    templateService?: TemplateService
  ) {
    this.containerService = containerService;
    this.templateService = templateService || new TemplateServiceImpl();
  }

  async getApps(category?: string): Promise<App[]> {
    const templates = category 
      ? await this.templateService.getTemplatesByCategory(category)
      : await this.templateService.loadAllTemplates();
    
    return templates.map(template => this.templateToApp(template));
  }

  async searchApps(query: string): Promise<App[]> {
    const templates = await this.templateService.searchTemplates(query);
    return templates.map(template => this.templateToApp(template));
  }

  async getAppDetails(id: string): Promise<AppDetails> {
    const template = await this.templateService.loadTemplate(id);
    return this.templateToAppDetails(template);
  }

  async getCategories(): Promise<AppCategory[]> {
    return await this.templateService.getCategories();
  }

  async deployApp(appId: string, config: DeployConfig): Promise<Container> {
    try {
      logger.debug('Deploying app', { appId, containerName: config.name });

      // Load the app template
      const template = await this.templateService.loadTemplate(appId);
      
      // Map template and deploy config to container configuration
      const containerConfig = this.mapToContainerConfig(template, config);
      
      // Create and start the container
      const container = await this.containerService.create(containerConfig);
      
      // Start the container after creation
      await this.containerService.start(container.id);
      
      logger.info('App deployed successfully', { 
        appId, 
        containerId: container.id, 
        containerName: container.name 
      });
      
      return container;
    } catch (error) {
      logger.error('Failed to deploy app', { 
        appId, 
        containerName: config.name, 
        error: error instanceof Error ? error.message : error 
      });
      
      throw new AppStoreServiceError(
        `Failed to deploy app '${appId}' as container '${config.name}'`,
        error as Error
      );
    }
  }

  async getAppTemplate(id: string): Promise<AppTemplate> {
    return await this.templateService.loadTemplate(id);
  }

  private templateToApp(template: AppTemplate): App {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      version: template.version,
      tags: template.tags,
      author: template.author
    };
  }

  private templateToAppDetails(template: AppTemplate): AppDetails {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      version: template.version,
      tags: template.tags,
      author: template.author,
      image: template.image,
      documentation: template.documentation,
      homepage: template.homepage,
      repository: template.repository,
      configSchema: template.configSchema,
      defaultConfig: template.defaultConfig
    };
  }

  /**
   * Maps an app template and deployment configuration to a container configuration
   */
  private mapToContainerConfig(template: AppTemplate, deployConfig: DeployConfig): ContainerConfig {
    // Start with template defaults and merge with deployment config
    const defaultConfig = template.defaultConfig;
    
    // Extract image and tag from template
    const imageParts = template.image.split(':');
    const image = imageParts[0] || template.image;
    const tag = imageParts[1] || 'latest';
    
    const containerConfig: ContainerConfig = {
      id: '', // Will be set by Docker
      name: deployConfig.name,
      image: image,
      tag: tag,
      
      // Merge environment variables (deploy config overrides template defaults)
      environment: {
        ...(defaultConfig.environment || {}),
        ...deployConfig.environment
      },
      
      // Use deploy config ports, fallback to template defaults
      ports: deployConfig.ports.length > 0 
        ? deployConfig.ports.map(port => ({
            hostPort: port.hostPort,
            containerPort: port.containerPort,
            protocol: port.protocol,
            description: this.findPortDescription(port, defaultConfig.ports || [])
          }))
        : defaultConfig.ports || [],
      
      // Use deploy config volumes, fallback to template defaults
      volumes: deployConfig.volumes.length > 0
        ? deployConfig.volumes.map(volume => ({
            hostPath: volume.hostPath,
            containerPath: volume.containerPath,
            mode: volume.mode,
            description: this.findVolumeDescription(volume, defaultConfig.volumes || [])
          }))
        : defaultConfig.volumes || [],
      
      // Use deploy config networks, fallback to template defaults
      networks: deployConfig.networks.length > 0 
        ? deployConfig.networks 
        : defaultConfig.networks || ['bridge'],
      
      // Use template defaults for other configuration
      restartPolicy: defaultConfig.restartPolicy || 'unless-stopped',
      
      // Merge resource limits (deploy config overrides template defaults)
      resources: {
        ...(defaultConfig.resources || {}),
        ...(deployConfig.resources || {})
      },
      
      // Copy other template configuration
      healthCheck: defaultConfig.healthCheck,
      security: defaultConfig.security,
      labels: {
        ...(defaultConfig.labels || {}),
        // Add app store specific labels
        'app-store.app-id': template.id,
        'app-store.app-name': template.name,
        'app-store.app-version': template.version,
        'app-store.category': template.category,
        'app-store.deployed-at': new Date().toISOString()
      },
      workingDir: defaultConfig.workingDir,
      entrypoint: defaultConfig.entrypoint,
      command: defaultConfig.command,
      hostname: defaultConfig.hostname,
      domainname: defaultConfig.domainname,
      autoRemove: defaultConfig.autoRemove || false
    };

    logger.debug('Mapped template to container config', {
      templateId: template.id,
      containerName: containerConfig.name,
      image: `${containerConfig.image}:${containerConfig.tag}`,
      portsCount: containerConfig.ports.length,
      volumesCount: containerConfig.volumes.length,
      networksCount: containerConfig.networks.length
    });

    return containerConfig;
  }

  /**
   * Find port description from template defaults
   */
  private findPortDescription(deployPort: any, templatePorts: any[]): string | undefined {
    const matchingPort = templatePorts.find(
      port => port.containerPort === deployPort.containerPort && 
               port.protocol === deployPort.protocol
    );
    return matchingPort?.description;
  }

  /**
   * Find volume description from template defaults
   */
  private findVolumeDescription(deployVolume: any, templateVolumes: any[]): string | undefined {
    const matchingVolume = templateVolumes.find(
      volume => volume.containerPath === deployVolume.containerPath
    );
    return matchingVolume?.description;
  }
}