import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { createAPIResponse, asyncHandler } from '@/api';
import { validate, commonSchemas } from '@/api/middleware/validation.middleware';
import { AppStoreService, AppStoreServiceImpl } from '@/modules/appstore';
import { App, AppDetails, AppCategory, DeployConfig } from '@/types/app.types';
import { PaginatedResponse } from '@/types/api.types';

const router = Router();

// Validation schemas
const appQuerySchema = Joi.object({
    category: Joi.string().optional().min(1).max(50),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('name', 'category', 'version', 'author').default('name'),
    order: Joi.string().valid('asc', 'desc').default('asc'),
    tags: Joi.string().optional() // Comma-separated tags
});

const searchQuerySchema = Joi.object({
    q: Joi.string().required().min(1).max(200),
    category: Joi.string().optional().min(1).max(50),
    tags: Joi.string().optional(), // Comma-separated tags
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

const deployConfigSchema = Joi.object({
    name: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/),
    configuration: Joi.object({
        environment: Joi.object().pattern(Joi.string(), Joi.string()).optional().default({}),
        ports: Joi.array().items(
            Joi.object({
                hostPort: Joi.number().integer().min(1).max(65535).required(),
                containerPort: Joi.number().integer().min(1).max(65535).required(),
                protocol: Joi.string().valid('tcp', 'udp').default('tcp')
            })
        ).optional().default([]),
        volumes: Joi.array().items(
            Joi.object({
                hostPath: Joi.string().required().min(1).max(500),
                containerPath: Joi.string().required().min(1).max(500),
                mode: Joi.string().valid('ro', 'rw').default('rw')
            })
        ).optional().default([]),
        networks: Joi.array().items(Joi.string().min(1).max(100)).optional().default(['bridge']),
        resources: Joi.object({
            memory: Joi.number().integer().min(1).optional(),
            cpus: Joi.number().min(0.1).optional()
        }).optional().default({})
    }).required()
});

const templateValidationSchema = Joi.object({
    id: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/),
    name: Joi.string().required().min(1).max(200),
    description: Joi.string().required().min(1).max(1000),
    category: Joi.string().required().min(1).max(50),
    icon: Joi.string().optional().uri(),
    version: Joi.string().required().min(1).max(50),
    image: Joi.string().required().min(1).max(200),
    tags: Joi.array().items(Joi.string().min(1).max(50)).optional().default([]),
    author: Joi.string().optional().max(100),
    homepage: Joi.string().optional().uri(),
    repository: Joi.string().optional().uri(),
    documentation: Joi.string().optional().max(5000),
    defaultConfig: Joi.object().optional().default({}),
    configSchema: Joi.object({
        type: Joi.string().required(),
        properties: Joi.object().required(),
        required: Joi.array().items(Joi.string()).optional(),
        additionalProperties: Joi.boolean().optional()
    }).optional()
});

// Service initialization function
function getAppStoreService(): AppStoreService {
    return new AppStoreServiceImpl();
}

// GET /api/apps - Browse apps with filtering and pagination
router.get('/',
    validate({ query: appQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { category, page = 1, limit = 20, sort = 'name', order = 'asc', tags } = req.query as any;

            const service = getAppStoreService();
            let apps = await service.getApps(category);

            // Apply tag filtering if specified
            if (tags) {
                const tagList = tags.split(',').map((tag: string) => tag.trim().toLowerCase());
                apps = apps.filter(app => 
                    app.tags && app.tags.some(tag => 
                        tagList.includes(tag.toLowerCase())
                    )
                );
            }

            // Apply sorting
            apps.sort((a, b) => {
                let aValue: any = a[sort as keyof App];
                let bValue: any = b[sort as keyof App];

                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (order === 'desc') {
                    return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
                }
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            });

            // Apply pagination
            const total = apps.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedApps = apps.slice(startIndex, endIndex);

            const response: PaginatedResponse<App> = {
                items: paginatedApps,
                total,
                page: Number(page),
                limit: Number(limit),
                hasNext: endIndex < total,
                hasPrev: page > 1
            };

            return res.json(createAPIResponse(response));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/search - Search apps
router.get('/search',
    validate({ query: searchQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { q, category, tags, page = 1, limit = 20 } = req.query as any;

            const service = getAppStoreService();
            let apps = await service.searchApps(q);

            // Apply additional filters
            if (category) {
                apps = apps.filter(app => app.category === category);
            }

            if (tags) {
                const tagList = tags.split(',').map((tag: string) => tag.trim().toLowerCase());
                apps = apps.filter(app => 
                    app.tags && app.tags.some(tag => 
                        tagList.includes(tag.toLowerCase())
                    )
                );
            }

            // Apply pagination
            const total = apps.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedApps = apps.slice(startIndex, endIndex);

            const response: PaginatedResponse<App> = {
                items: paginatedApps,
                total,
                page: Number(page),
                limit: Number(limit),
                hasNext: endIndex < total,
                hasPrev: page > 1
            };

            return res.json(createAPIResponse(response));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/categories - Get app categories
router.get('/categories',
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const service = getAppStoreService();
            const categories = await service.getCategories();

            return res.json(createAPIResponse(categories));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/categories/:categoryId - Get category details
router.get('/categories/:categoryId',
    validate({ params: Joi.object({ categoryId: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const categoryId = req.params['categoryId'];
            if (!categoryId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Category ID is required'
                }));
            }

            const service = getAppStoreService();
            const categories = await service.getCategories();
            const category = categories.find(cat => cat.id === categoryId);

            if (!category) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'CATEGORY_NOT_FOUND',
                    message: `Category '${categoryId}' not found`
                }));
            }

            return res.json(createAPIResponse(category));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/stats - Get app store statistics
router.get('/stats',
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const service = getAppStoreService();
            const [apps, categories] = await Promise.all([
                service.getApps(),
                service.getCategories()
            ]);

            const stats = {
                totalApps: apps.length,
                totalCategories: categories.length,
                categoriesWithCounts: categories.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    appCount: cat.appCount
                }))
            };

            return res.json(createAPIResponse(stats));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/popular - Get popular apps
router.get('/popular',
    validate({ 
        query: Joi.object({
            limit: Joi.number().integer().min(1).max(50).default(10)
        })
    }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { limit = 10 } = req.query as any;

            const service = getAppStoreService();
            const apps = await service.getApps();

            // For now, return apps sorted by name as we don't have popularity metrics
            // In a real implementation, this would sort by download count, ratings, etc.
            const popularApps = apps
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, limit);

            return res.json(createAPIResponse(popularApps));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/recent - Get recently added apps
router.get('/recent',
    validate({ 
        query: Joi.object({
            limit: Joi.number().integer().min(1).max(50).default(5)
        })
    }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { limit = 5 } = req.query as any;

            const service = getAppStoreService();
            const apps = await service.getApps();

            // For now, return apps sorted by name as we don't have creation timestamps
            // In a real implementation, this would sort by creation date
            const recentApps = apps
                .sort((a, b) => b.name.localeCompare(a.name))
                .slice(0, limit);

            return res.json(createAPIResponse(recentApps));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/apps/:appId - Get app details
router.get('/:appId',
    validate({ params: Joi.object({ appId: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const appId = req.params['appId'];
            if (!appId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'App ID is required'
                }));
            }

            const service = getAppStoreService();
            const appDetails = await service.getAppDetails(appId);

            return res.json(createAPIResponse(appDetails));
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'APP_NOT_FOUND',
                    message: `App '${req.params['appId']}' not found`
                }));
            } else {
                return res.status(500).json(createAPIResponse(undefined, error));
            }
        }
    })
);

// GET /api/apps/:appId/schema - Get app configuration schema
router.get('/:appId/schema',
    validate({ params: Joi.object({ appId: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const appId = req.params['appId'];
            if (!appId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'App ID is required'
                }));
            }

            const service = getAppStoreService();
            const template = await service.getAppTemplate(appId);

            return res.json(createAPIResponse({
                schema: template.configSchema,
                defaultConfig: template.defaultConfig
            }));
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'APP_NOT_FOUND',
                    message: `App '${req.params['appId']}' not found`
                }));
            } else {
                return res.status(500).json(createAPIResponse(undefined, error));
            }
        }
    })
);

// GET /api/apps/:appId/docs - Get app documentation
router.get('/:appId/docs',
    validate({ params: Joi.object({ appId: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const appId = req.params['appId'];
            if (!appId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'App ID is required'
                }));
            }

            const service = getAppStoreService();
            const template = await service.getAppTemplate(appId);

            return res.json(createAPIResponse({
                documentation: template.documentation,
                homepage: template.homepage,
                repository: template.repository
            }));
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'APP_NOT_FOUND',
                    message: `App '${req.params['appId']}' not found`
                }));
            } else {
                return res.status(500).json(createAPIResponse(undefined, error));
            }
        }
    })
);

// POST /api/apps/:appId/deploy - Deploy an app
router.post('/:appId/deploy',
    validate({ 
        params: Joi.object({ appId: commonSchemas.id }),
        body: deployConfigSchema
    }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const appId = req.params['appId'];
            if (!appId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'App ID is required'
                }));
            }

            const { name, configuration } = req.body;

            // Convert API request to DeployConfig
            const deployConfig: DeployConfig = {
                name,
                environment: configuration.environment || {},
                ports: configuration.ports || [],
                volumes: configuration.volumes || [],
                networks: configuration.networks || ['bridge'],
                resources: configuration.resources || {}
            };

            const service = getAppStoreService();
            const container = await service.deployApp(appId, deployConfig);

            return res.status(201).json(createAPIResponse(container));
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'APP_NOT_FOUND',
                    message: `App '${req.params['appId']}' not found`
                }));
            } else if (error instanceof Error && error.message.includes('conflict')) {
                return res.status(409).json(createAPIResponse(undefined, {
                    code: 'DEPLOYMENT_CONFLICT',
                    message: error.message
                }));
            } else {
                return res.status(400).json(createAPIResponse(undefined, error));
            }
        }
    })
);

// POST /api/apps/templates/validate - Validate app template
router.post('/templates/validate',
    validate({ body: templateValidationSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const templateData = req.body;

            // Perform basic validation (schema validation already done by middleware)
            const validationResult = {
                valid: true,
                errors: [] as string[],
                warnings: [] as string[]
            };

            // Additional custom validation logic can be added here
            if (!templateData.configSchema) {
                validationResult.warnings.push('No configuration schema provided - users will not have guided configuration');
            }

            if (!templateData.documentation) {
                validationResult.warnings.push('No documentation provided - consider adding usage instructions');
            }

            if (!templateData.icon) {
                validationResult.warnings.push('No icon provided - a default icon will be used');
            }

            return res.json(createAPIResponse(validationResult));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

export default router;