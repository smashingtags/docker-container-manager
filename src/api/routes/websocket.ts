import { Router, Request, Response } from 'express';
import { asyncHandler, createAPIResponse } from '@/api';
import { validate } from '@/api/middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// GET /api/websocket/status - Get WebSocket connection status
router.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    // This would typically be handled by the WebSocket service
    // For now, return basic status information
    const status = {
      connected: true,
      clients: 0, // Would be populated by WebSocket service
      rooms: ['containers', 'metrics', 'logs'],
      timestamp: new Date().toISOString()
    };

    res.json(createAPIResponse(status));
  })
);

// POST /api/websocket/broadcast - Broadcast message to all clients (for testing)
router.post('/broadcast',
  validate({
    body: Joi.object({
      event: Joi.string().required(),
      data: Joi.object().required(),
      room: Joi.string().optional()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { event, data, room } = req.body;

    // This would typically use the WebSocket service to broadcast
    // For now, just return success
    const result = {
      event,
      data,
      room,
      broadcasted: true,
      timestamp: new Date().toISOString()
    };

    res.json(createAPIResponse(result));
  })
);

// GET /api/websocket/rooms - Get available WebSocket rooms
router.get('/rooms',
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = [
      {
        name: 'containers',
        description: 'General container updates',
        clients: 0
      },
      {
        name: 'metrics',
        description: 'System and container metrics',
        clients: 0
      },
      {
        name: 'logs',
        description: 'Container logs',
        clients: 0
      }
    ];

    res.json(createAPIResponse(rooms));
  })
);

// GET /api/websocket/events - Get available WebSocket events
router.get('/events',
  asyncHandler(async (req: Request, res: Response) => {
    const events = [
      {
        name: 'container:status',
        description: 'Container status changes',
        example: {
          containerId: 'abc123',
          containerName: 'nginx',
          status: 'running',
          previousStatus: 'stopped',
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'container:created',
        description: 'Container created',
        example: {
          containerId: 'abc123',
          containerName: 'nginx',
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'container:logs',
        description: 'Container log output',
        example: {
          containerId: 'abc123',
          containerName: 'nginx',
          logs: ['Log line 1', 'Log line 2'],
          stream: 'stdout',
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'metrics:container',
        description: 'Container resource metrics',
        example: {
          containerId: 'abc123',
          containerName: 'nginx',
          metrics: {
            cpu: 25.5,
            memory: {
              usage: 128000000,
              limit: 512000000,
              percentage: 25
            },
            network: {
              rx_bytes: 1024,
              tx_bytes: 2048
            },
            disk: {
              read_bytes: 4096,
              write_bytes: 8192
            }
          },
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'metrics:system',
        description: 'System-wide metrics',
        example: {
          metrics: {
            cpu: {
              usage: 45.2,
              cores: 4
            },
            memory: {
              total: 8000000000,
              used: 4000000000,
              free: 4000000000,
              percentage: 50
            },
            disk: {
              total: 1000000000000,
              used: 500000000000,
              free: 500000000000,
              percentage: 50
            },
            containers: {
              total: 10,
              running: 7,
              stopped: 3
            }
          },
          timestamp: new Date().toISOString()
        }
      }
    ];

    res.json(createAPIResponse(events));
  })
);

export default router;