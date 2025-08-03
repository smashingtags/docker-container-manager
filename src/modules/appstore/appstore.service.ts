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
<<<<<<< HEAD
  // Mock data for testing - in a real implementation this would come from templates
  private mockApps: App[] = [
    {
      id: 'nginx-web-server',
      name: 'Nginx Web Server',
      description: 'High-performance web server and reverse proxy',
      category: 'web-servers',
      icon: 'https://example.com/nginx-icon.png',
      version: '1.21.0',
      tags: ['web', 'server', 'proxy'],
      author: 'Nginx Team'
    },
    {
      id: 'mysql-database',
      name: 'MySQL Database',
      description: 'Popular open-source relational database',
      category: 'databases',
      icon: 'https://example.com/mysql-icon.png',
      version: '8.0',
      tags: ['database', 'sql', 'mysql'],
      author: 'Oracle'
    }
  ];

  private mockCategories: AppCategory[] = [
    {
      id: 'web-servers',
      name: 'Web Servers',
      description: 'HTTP servers and reverse proxies',
      icon: 'https://example.com/web-servers-icon.png',
      appCount: 5
    },
    {
      id: 'databases',
      name: 'Databases',
      description: 'Database management systems',
      icon: 'https://example.com/databases-icon.png',
      appCount: 8
    }
  ];

  async getApps(category?: string): Promise<App[]> {
    let apps = [...this.mockApps];
    if (category) {
      apps = apps.filter(app => app.category === category);
    }
    return apps;
  }

  async searchApps(query: string): Promise<App[]> {
    const searchTerm = query.toLowerCase();
    return this.mockApps.filter(app => 
      app.name.toLowerCase().includes(searchTerm) ||
      app.description.toLowerCase().includes(searchTerm) ||
      app.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  async getAppDetails(id: string): Promise<AppDetails> {
    const app = this.mockApps.find(a => a.id === id);
    if (!app) {
      throw new Error(`App '${id}' not found`);
    }

    return {
      ...app,
      image: `${app.name.toLowerCase().replace(/\s+/g, '-')}:${app.version}`,
      documentation: `${app.name} is a powerful application for ${app.description.toLowerCase()}...`,
      homepage: `https://${app.name.toLowerCase().replace(/\s+/g, '-')}.org`,
      repository: `https://github.com/${app.author?.toLowerCase()}/${app.name.toLowerCase().replace(/\s+/g, '-')}`,
      configSchema: {
        type: 'object',
        properties: {
          port: { type: 'number', default: 80 }
        },
        required: ['port']
      },
      defaultConfig: {
        ports: [{ hostPort: 80, containerPort: 80, protocol: 'tcp' as const }]
      }
    };
  }

  async getCategories(): Promise<AppCategory[]> {
    return [...this.mockCategories];
  }

  async deployApp(appId: string, config: DeployConfig): Promise<Container> {
    const app = this.mockApps.find(a => a.id === appId);
    if (!app) {
      throw new Error(`App '${appId}' not found`);
    }

    // Mock container creation
    return {
      id: `container-${Date.now()}`,
      name: config.name,
      status: 'running' as const,
      image: `${app.name.toLowerCase().replace(/\s+/g, '-')}:${app.version}`,
      created: new Date(),
      ports: config.ports,
      volumes: config.volumes
    };
  }

  async getAppTemplate(id: string): Promise<AppTemplate> {
    const appDetails = await this.getAppDetails(id);
    
    return {
      ...appDetails,
      defaultConfig: appDetails.defaultConfig,
      configSchema: appDetails.configSchema,
      documentation: appDetails.documentation
    };
=======
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
>>>>>>> cd4f38d65df26a11a3979d8f1da347190033b8c5
  }
}