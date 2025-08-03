import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { createAPIResponse, asyncHandler } from '@/api';
import { validate, commonSchemas } from '@/api/middleware/validation.middleware';
import {
    CreateContainerRequest,
    ContainerConfig,
    LogOptions,
    Container,
    ContainerStats
} from '@/types/container.types';
import { PaginatedResponse } from '@/types/api.types';

const router = Router();

// Validation schemas
const createContainerSchema = Joi.object({
    name: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/),
    image: Joi.string().required().min(1).max(200),
    tag: Joi.string().optional().default('latest').max(50),
    environment: Joi.object().pattern(Joi.string(), Joi.string()).optional().default({}),
    ports: Joi.array().items(
        Joi.object({
            hostPort: Joi.number().integer().min(1).max(65535).required(),
            containerPort: Joi.number().integer().min(1).max(65535).required(),
            protocol: Joi.string().valid('tcp', 'udp').default('tcp'),
            description: Joi.string().optional().max(200)
        })
    ).optional().default([]),
    volumes: Joi.array().items(
        Joi.object({
            hostPath: Joi.string().required().min(1).max(500),
            containerPath: Joi.string().required().min(1).max(500),
            mode: Joi.string().valid('ro', 'rw').default('rw'),
            description: Joi.string().optional().max(200)
        })
    ).optional().default([]),
    networks: Joi.array().items(Joi.string().min(1).max(100)).optional().default(['bridge']),
    restartPolicy: Joi.string().valid('no', 'always', 'unless-stopped', 'on-failure').default('unless-stopped'),
    resources: Joi.object({
        memory: Joi.number().integer().min(1).optional(),
        cpus: Joi.number().min(0.1).optional(),
        diskSpace: Joi.number().integer().min(1).optional(),
        pidsLimit: Joi.number().integer().min(1).optional(),
        ulimits: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                soft: Joi.number().integer().min(0).required(),
                hard: Joi.number().integer().min(0).required()
            })
        ).optional()
    }).optional().default({}),
    healthCheck: Joi.object({
        test: Joi.array().items(Joi.string()).min(1).required(),
        interval: Joi.number().integer().min(1).optional().default(30),
        timeout: Joi.number().integer().min(1).optional().default(30),
        retries: Joi.number().integer().min(1).optional().default(3),
        startPeriod: Joi.number().integer().min(0).optional().default(0)
    }).optional(),
    security: Joi.object({
        privileged: Joi.boolean().optional().default(false),
        readOnly: Joi.boolean().optional().default(false),
        user: Joi.string().optional(),
        capabilities: Joi.object({
            add: Joi.array().items(Joi.string()).optional(),
            drop: Joi.array().items(Joi.string()).optional()
        }).optional()
    }).optional().default({}),
    labels: Joi.object().pattern(Joi.string(), Joi.string()).optional().default({}),
    workingDir: Joi.string().optional(),
    entrypoint: Joi.array().items(Joi.string()).optional(),
    command: Joi.array().items(Joi.string()).optional(),
    hostname: Joi.string().optional(),
    domainname: Joi.string().optional(),
    autoRemove: Joi.boolean().optional().default(false)
});

const containerQuerySchema = Joi.object({
    status: Joi.string().valid('running', 'stopped', 'paused', 'restarting', 'created', 'exited').optional(),
    image: Joi.string().optional(),
    name: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('asc')
});

const logQuerySchema = Joi.object({
    tail: Joi.number().integer().min(1).max(10000).optional(),
    since: Joi.date().iso().optional(),
    until: Joi.date().iso().optional(),
    follow: Joi.boolean().optional().default(false),
    timestamps: Joi.boolean().optional().default(false)
});

const bulkActionSchema = Joi.object({
    action: Joi.string().valid('start', 'stop', 'restart', 'remove').required(),
    containerIds: Joi.array().items(Joi.string().required()).min(1).max(50).required(),
    force: Joi.boolean().optional().default(false)
});

// Service initialization function - will be implemented when services are available
function getContainerService() {
    // TODO: Replace with actual ContainerService implementation
    // This mock service provides the interface for development and testing
    return {
        list: async (): Promise<Container[]> => [],
        create: async (config: ContainerConfig): Promise<Container> => ({
            ...config,
            id: 'mock-id',
            status: 'created' as const,
            created: new Date()
        }),
        start: async (id: string): Promise<void> => { },
        stop: async (id: string): Promise<void> => { },
        restart: async (id: string): Promise<void> => { },
        remove: async (id: string): Promise<void> => { },
        getLogs: async (id: string, options?: LogOptions): Promise<string[]> => [],
        getStats: async (id: string): Promise<ContainerStats> => ({
            cpu: 0,
            memory: { usage: 0, limit: 0, percentage: 0 },
            network: { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0 },
            disk: { readBytes: 0, writeBytes: 0, readOps: 0, writeOps: 0 },
            timestamp: new Date()
        }),
        getContainerById: async (id: string): Promise<Container | null> => null
    };
}

// GET /api/containers - List containers with filtering and pagination
router.get('/',
    validate({ query: containerQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { status, image, name, page = 1, limit = 20, sort = 'name', order = 'asc' } = req.query as any;

        try {
            // Get all containers
            let containers = await getContainerService().list();

            // Apply filters
            if (status) {
                containers = containers.filter(container => container.status === status);
            }

            if (image) {
                containers = containers.filter(container =>
                    container.image.toLowerCase().includes(image.toLowerCase())
                );
            }

            if (name) {
                containers = containers.filter(container =>
                    container.name.toLowerCase().includes(name.toLowerCase())
                );
            }

            // Apply sorting
            containers.sort((a, b) => {
                let aValue: any = a[sort as keyof Container];
                let bValue: any = b[sort as keyof Container];

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
            const total = containers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedContainers = containers.slice(startIndex, endIndex);

            const response: PaginatedResponse<Container> = {
                items: paginatedContainers,
                total,
                page: Number(page),
                limit: Number(limit),
                hasNext: endIndex < total,
                hasPrev: page > 1
            };

            res.json(createAPIResponse(response));
        } catch (error) {
            res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// POST /api/containers - Create a new container
router.post('/',
    validate({ body: createContainerSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const createRequest: CreateContainerRequest = req.body;

            // Convert CreateContainerRequest to ContainerConfig
            const containerConfig: ContainerConfig = {
                id: '', // Will be generated by Docker
                name: createRequest.name,
                image: createRequest.image,
                tag: createRequest.tag || 'latest',
                environment: createRequest.environment || {},
                ports: createRequest.ports || [],
                volumes: createRequest.volumes || [],
                networks: createRequest.networks || ['bridge'],
                restartPolicy: createRequest.restartPolicy || 'unless-stopped',
                resources: createRequest.resources || {},
                healthCheck: createRequest.healthCheck,
                security: createRequest.security || {},
                labels: createRequest.labels || {},
                workingDir: createRequest.workingDir,
                entrypoint: createRequest.entrypoint,
                command: createRequest.command,
                hostname: createRequest.hostname,
                domainname: createRequest.domainname,
                autoRemove: createRequest.autoRemove || false
            };

            const container = await getContainerService().create(containerConfig);
            res.status(201).json(createAPIResponse(container));
        } catch (error) {
            res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/containers/:id - Get container details
router.get('/:id',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            const container = await getContainerService().getContainerById(containerId);

            if (!container) {
                return res.status(404).json(createAPIResponse(undefined, {
                    code: 'CONTAINER_NOT_FOUND',
                    message: `Container '${containerId}' not found`
                }));
            }

            return res.json(createAPIResponse(container));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// POST /api/containers/:id/start - Start a container
router.post('/:id/start',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            await getContainerService().start(containerId);
            return res.json(createAPIResponse({ message: 'Container started successfully' }));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

// POST /api/containers/:id/stop - Stop a container
router.post('/:id/stop',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            await getContainerService().stop(containerId);
            return res.json(createAPIResponse({ message: 'Container stopped successfully' }));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

// POST /api/containers/:id/restart - Restart a container
router.post('/:id/restart',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            await getContainerService().restart(containerId);
            return res.json(createAPIResponse({ message: 'Container restarted successfully' }));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

// DELETE /api/containers/:id - Remove a container
router.delete('/:id',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            await getContainerService().remove(containerId);
            return res.json(createAPIResponse({ message: 'Container removed successfully' }));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/containers/:id/logs - Get container logs
router.get('/:id/logs',
    validate({
        params: Joi.object({ id: commonSchemas.id }),
        query: logQuerySchema
    }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            const { tail, since, until, follow, timestamps } = req.query as any;

            const logOptions: LogOptions = {
                tail: tail ? Number(tail) : undefined,
                since: since ? new Date(since) : undefined,
                until: until ? new Date(until) : undefined,
                follow: follow === 'true',
                timestamps: timestamps === 'true'
            };

            const logs = await getContainerService().getLogs(containerId, logOptions);
            return res.json(createAPIResponse({ logs }));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// GET /api/containers/:id/stats - Get container statistics
router.get('/:id/stats',
    validate({ params: Joi.object({ id: commonSchemas.id }) }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const containerId = req.params['id'];
            if (!containerId) {
                return res.status(400).json(createAPIResponse(undefined, {
                    code: 'INVALID_PARAMETER',
                    message: 'Container ID is required'
                }));
            }

            const stats = await getContainerService().getStats(containerId);
            return res.json(createAPIResponse(stats));
        } catch (error) {
            return res.status(500).json(createAPIResponse(undefined, error));
        }
    })
);

// POST /api/containers/bulk - Bulk container operations
router.post('/bulk',
    validate({ body: bulkActionSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { action, containerIds, force } = req.body;
            const results: Array<{ containerId: string; success: boolean; error?: string }> = [];

            const service = getContainerService();
            for (const containerId of containerIds) {
                try {
                    switch (action) {
                        case 'start':
                            await service.start(containerId);
                            break;
                        case 'stop':
                            await service.stop(containerId);
                            break;
                        case 'restart':
                            await service.restart(containerId);
                            break;
                        case 'remove':
                            await service.remove(containerId);
                            break;
                    }
                    results.push({ containerId, success: true });
                } catch (error) {
                    results.push({
                        containerId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            return res.json(createAPIResponse({
                results,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: failureCount
                }
            }));
        } catch (error) {
            return res.status(400).json(createAPIResponse(undefined, error));
        }
    })
);

export default router;