import { App, AppDetails, AppTemplate, DeployConfig, AppCategory } from '@/types/app.types';
import { Container } from '@/types/container.types';
import { TemplateService, TemplateServiceImpl } from './template.service';

export interface AppStoreService {
  getApps(category?: string): Promise<App[]>;
  searchApps(query: string): Promise<App[]>;
  getAppDetails(id: string): Promise<AppDetails>;
  getCategories(): Promise<AppCategory[]>;
  deployApp(appId: string, config: DeployConfig): Promise<Container>;
  getAppTemplate(id: string): Promise<AppTemplate>;
}

export class AppStoreServiceImpl implements AppStoreService {
  private templateService: TemplateService;

  constructor(templateService?: TemplateService) {
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
    // Implementation will be added in task 4.2
    throw new Error('Not implemented');
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
}