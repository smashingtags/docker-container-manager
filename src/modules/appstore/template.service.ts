import { AppTemplate, AppCategory } from '@/types/app.types';
import { ValidationResult, ValidationError } from '@/types/container.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import Joi from 'joi';

export interface TemplateService {
  loadTemplate(templateId: string): Promise<AppTemplate>;
  loadAllTemplates(): Promise<AppTemplate[]>;
  getTemplatesByCategory(category: string): Promise<AppTemplate[]>;
  searchTemplates(query: string): Promise<AppTemplate[]>;
  getCategories(): Promise<AppCategory[]>;
  validateTemplate(template: any): ValidationResult<AppTemplate>;
  parseTemplateFile(filePath: string): Promise<AppTemplate>;
}

export class TemplateServiceImpl implements TemplateService {
  private readonly templatesPath: string;
  private readonly categoriesPath: string;
  private templateCache: Map<string, AppTemplate> = new Map();
  private categoryCache: AppCategory[] | null = null;

  constructor(templatesBasePath: string = 'templates') {
    this.templatesPath = path.join(templatesBasePath, 'apps');
    this.categoriesPath = path.join(templatesBasePath, 'categories');
  }

  async loadTemplate(templateId: string): Promise<AppTemplate> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    const templatePath = path.join(this.templatesPath, `${templateId}.json`);
    
    try {
      const template = await this.parseTemplateFile(templatePath);
      this.templateCache.set(templateId, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadAllTemplates(): Promise<AppTemplate[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templateFiles = files.filter(file => file.endsWith('.json'));
      
      const templates: AppTemplate[] = [];
      
      for (const file of templateFiles) {
        try {
          const templatePath = path.join(this.templatesPath, file);
          const template = await this.parseTemplateFile(templatePath);
          templates.push(template);
          this.templateCache.set(template.id, template);
        } catch (error) {
          console.warn(`Failed to load template from ${file}:`, error);
        }
      }
      
      return templates;
    } catch (error) {
      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplatesByCategory(category: string): Promise<AppTemplate[]> {
    const allTemplates = await this.loadAllTemplates();
    return allTemplates.filter(template => template.category === category);
  }

  async searchTemplates(query: string): Promise<AppTemplate[]> {
    const allTemplates = await this.loadAllTemplates();
    const searchTerm = query.toLowerCase();
    
    return allTemplates.filter(template => 
      template.name.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      (template.author && template.author.toLowerCase().includes(searchTerm))
    );
  }

  async getCategories(): Promise<AppCategory[]> {
    if (this.categoryCache) {
      return this.categoryCache;
    }

    try {
      const categoriesFile = path.join(this.categoriesPath, 'categories.json');
      const categoriesData = await fs.readFile(categoriesFile, 'utf-8');
      const categories = JSON.parse(categoriesData) as AppCategory[];
      
      // Count apps in each category
      const allTemplates = await this.loadAllTemplates();
      const categoriesWithCounts = categories.map(category => ({
        ...category,
        appCount: allTemplates.filter(template => template.category === category.id).length
      }));
      
      this.categoryCache = categoriesWithCounts;
      return categoriesWithCounts;
    } catch (error) {
      // If categories file doesn't exist, generate from templates
      const allTemplates = await this.loadAllTemplates();
      const categoryMap = new Map<string, number>();
      
      allTemplates.forEach(template => {
        categoryMap.set(template.category, (categoryMap.get(template.category) || 0) + 1);
      });
      
      const generatedCategories: AppCategory[] = Array.from(categoryMap.entries()).map(([id, count]) => ({
        id,
        name: this.formatCategoryName(id),
        description: `${this.formatCategoryName(id)} applications`,
        icon: this.getDefaultCategoryIcon(id),
        appCount: count
      }));
      
      this.categoryCache = generatedCategories;
      return generatedCategories;
    }
  }

  validateTemplate(template: any): ValidationResult<AppTemplate> {
    const schema = this.getTemplateValidationSchema();
    const { error, value } = schema.validate(template, { abortEarly: false });
    
    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return {
        isValid: false,
        errors
      };
    }
    
    return {
      isValid: true,
      data: value as AppTemplate,
      errors: []
    };
  }

  async parseTemplateFile(filePath: string): Promise<AppTemplate> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const templateData = JSON.parse(fileContent);
      
      const validation = this.validateTemplate(templateData);
      if (!validation.isValid) {
        throw new Error(`Invalid template format: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      return validation.data!;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in template file: ${error.message}`);
      }
      throw error;
    }
  }

  private getTemplateValidationSchema(): Joi.ObjectSchema {
    return Joi.object({
      id: Joi.string().required().pattern(/^[a-z0-9-]+$/),
      name: Joi.string().required().min(1).max(100),
      description: Joi.string().required().min(1).max(500),
      category: Joi.string().required().pattern(/^[a-z0-9-]+$/),
      icon: Joi.string().required().uri(),
      version: Joi.string().required().pattern(/^\d+\.\d+\.\d+$/),
      image: Joi.string().required().min(1),
      defaultConfig: Joi.object({
        id: Joi.string().optional(),
        name: Joi.string().optional(),
        image: Joi.string().optional(),
        tag: Joi.string().optional(),
        environment: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
        ports: Joi.array().items(Joi.object({
          hostPort: Joi.number().integer().min(1).max(65535).required(),
          containerPort: Joi.number().integer().min(1).max(65535).required(),
          protocol: Joi.string().valid('tcp', 'udp').required(),
          description: Joi.string().optional()
        })).optional(),
        volumes: Joi.array().items(Joi.object({
          hostPath: Joi.string().required(),
          containerPath: Joi.string().required(),
          mode: Joi.string().valid('ro', 'rw').required(),
          description: Joi.string().optional()
        })).optional(),
        networks: Joi.array().items(Joi.string()).optional(),
        restartPolicy: Joi.string().valid('no', 'always', 'unless-stopped', 'on-failure').optional(),
        resources: Joi.object({
          memory: Joi.number().integer().min(1).optional(),
          cpus: Joi.number().min(0.1).optional(),
          diskSpace: Joi.number().integer().min(1).optional(),
          pidsLimit: Joi.number().integer().min(1).optional(),
          ulimits: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            soft: Joi.number().integer().min(0).required(),
            hard: Joi.number().integer().min(0).required()
          })).optional()
        }).optional(),
        healthCheck: Joi.object({
          test: Joi.array().items(Joi.string()).min(1).required(),
          interval: Joi.number().integer().min(1).optional(),
          timeout: Joi.number().integer().min(1).optional(),
          retries: Joi.number().integer().min(1).optional(),
          startPeriod: Joi.number().integer().min(0).optional()
        }).optional(),
        security: Joi.object({
          privileged: Joi.boolean().optional(),
          readOnly: Joi.boolean().optional(),
          user: Joi.string().optional(),
          capabilities: Joi.object({
            add: Joi.array().items(Joi.string()).optional(),
            drop: Joi.array().items(Joi.string()).optional()
          }).optional()
        }).optional(),
        labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
        workingDir: Joi.string().optional(),
        entrypoint: Joi.array().items(Joi.string()).optional(),
        command: Joi.array().items(Joi.string()).optional(),
        hostname: Joi.string().optional(),
        domainname: Joi.string().optional(),
        autoRemove: Joi.boolean().optional()
      }).required(),
      configSchema: Joi.object({
        type: Joi.string().valid('object').required(),
        properties: Joi.object().required(),
        required: Joi.array().items(Joi.string()).optional(),
        additionalProperties: Joi.boolean().optional()
      }).required(),
      documentation: Joi.string().required().min(1),
      tags: Joi.array().items(Joi.string().pattern(/^[a-z0-9-]+$/)).min(1).required(),
      author: Joi.string().optional(),
      homepage: Joi.string().uri().optional(),
      repository: Joi.string().uri().optional()
    });
  }

  private formatCategoryName(categoryId: string): string {
    return categoryId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getDefaultCategoryIcon(categoryId: string): string {
    const iconMap: Record<string, string> = {
      'web-servers': '🌐',
      'databases': '🗄️',
      'media': '🎬',
      'development': '💻',
      'networking': '🔗',
      'security': '🔒',
      'monitoring': '📊',
      'productivity': '📋',
      'gaming': '🎮',
      'utilities': '🔧'
    };
    
    return iconMap[categoryId] || '📦';
  }

  // Clear cache methods for testing
  clearCache(): void {
    this.templateCache.clear();
    this.categoryCache = null;
  }
}