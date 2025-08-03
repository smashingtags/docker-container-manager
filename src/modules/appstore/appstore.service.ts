import { App, AppDetails, AppTemplate, DeployConfig, AppCategory } from '@/types/app.types';
import { Container } from '@/types/container.types';

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
  }
}