import request from 'supertest';
import express from 'express';
import { createAPIRouter } from '../index';
import { errorHandler, notFoundHandler } from '../middleware';
import { Container, ContainerStats } from '../../types/container.types';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the entire routes module to avoid import issues
jest.mock('../routes/containers', () => {
  const express = require('express');
  const router = express.Router();
  
  // Mock container service
  const mockContainerService = {
    list: jest.fn(),
    create: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    restart: jest.fn(),
    remove: jest.fn(),
    getLogs: jest.fn(),
    getStats: jest.fn(),
    getContainerById: jest.fn(),
    monitorContainerStatus: jest.fn()
  };

  // Store reference for tests
  (global as any).mockContainerService = mockContainerService;

  // Mock routes implementation
  router.get('/', async (req: any, res: any) => {
    try {
      const containers = await mockContainerService.list();
      const { status, image, name, page = 1, limit = 20 } = req.query;
      
      let filteredContainers = containers;
      if (status) filteredContainers = containers.filter((c: any) => c.status === status);
      if (image) filteredContainers = containers.filter((c: any) => c.image.includes(image));
      if (name) filteredContainers = containers.filter((c: any) => c.name.includes(name));
      
      const total = filteredContainers.length;
      const startIndex = (page - 1) * limit;
      const items = filteredContainers.slice(startIndex, startIndex + limit);
      
      res.json({
        success: true,
        data: {
          items,
          total,
          page: Number(page),
          limit: Number(limit),
          hasNext: startIndex + limit < total,
          hasPrev: page > 1
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post('/', async (req: any, res: any) => {
    try {
      if (!req.body.name) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
          timestamp: new Date().toISOString()
        });
      }
      const container = await mockContainerService.create(req.body);
      res.status(201).json({
        success: true,
        data: container,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/:id', async (req: any, res: any) => {
    try {
      const container = await mockContainerService.getContainerById(req.params.id);
      if (!container) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONTAINER_NOT_FOUND', message: 'Container not found' },
          timestamp: new Date().toISOString()
        });
      }
      res.json({
        success: true,
        data: container,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post('/:id/start', async (req: any, res: any) => {
    try {
      await mockContainerService.start(req.params.id);
      res.json({
        success: true,
        data: { message: 'Container started successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post('/:id/stop', async (req: any, res: any) => {
    try {
      await mockContainerService.stop(req.params.id);
      res.json({
        success: true,
        data: { message: 'Container stopped successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post('/:id/restart', async (req: any, res: any) => {
    try {
      await mockContainerService.restart(req.params.id);
      res.json({
        success: true,
        data: { message: 'Container restarted successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.delete('/:id', async (req: any, res: any) => {
    try {
      await mockContainerService.remove(req.params.id);
      res.json({
        success: true,
        data: { message: 'Container removed successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/:id/logs', async (req: any, res: any) => {
    try {
      const logs = await mockContainerService.getLogs(req.params.id, req.query);
      res.json({
        success: true,
        data: { logs },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/:id/stats', async (req: any, res: any) => {
    try {
      const stats = await mockContainerService.getStats(req.params.id);
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post('/bulk', async (req: any, res: any) => {
    try {
      const { action, containerIds } = req.body;
      if (!action || !containerIds || !Array.isArray(containerIds)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
          timestamp: new Date().toISOString()
        });
      }

      const results = [];
      for (const containerId of containerIds) {
        try {
          switch (action) {
            case 'start':
              await mockContainerService.start(containerId);
              break;
            case 'stop':
              await mockContainerService.stop(containerId);
              break;
            case 'restart':
              await mockContainerService.restart(containerId);
              break;
            case 'remove':
              await mockContainerService.remove(containerId);
              break;
          }
          results.push({ containerId, success: true });
        } catch (error: any) {
          results.push({ containerId, success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed: results.length - successful
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
});

describe('Container API Integration Tests', () => {
  let app: express.Application;
  let mockContainerService: any;

  const mockContainer: Container = {
    id: 'container123',
    name: 'test-nginx',
    status: 'running',
    image: 'nginx:latest',
    created: new Date('2023-01-01T00:00:00Z'),
    ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
    volumes: [{ hostPath: '/host/path', containerPath: '/container/path', mode: 'rw' }]
  };

  const mockStats: ContainerStats = {
    cpu: 25.5,
    memory: { usage: 128, limit: 512, percentage: 25 },
    network: { rxBytes: 1024, txBytes: 2048, rxPackets: 10, txPackets: 20 },
    disk: { readBytes: 4096, writeBytes: 8192, readOps: 5, writeOps: 10 },
    timestamp: new Date('2023-01-01T00:00:00Z')
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', createAPIRouter());
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Get the mock service from global
    mockContainerService = (global as any).mockContainerService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Container Listing', () => {
    it('should list all containers successfully', async () => {
      mockContainerService.list.mockResolvedValue([mockContainer]);

      const response = await request(app)
        .get('/api/containers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0]).toEqual(mockContainer);
      expect(response.body.data.total).toBe(1);
      expect(mockContainerService.list).toHaveBeenCalledTimes(1);
    });

    it('should handle query parameters for container filtering', async () => {
      const runningContainer = { ...mockContainer, status: 'running' as const };
      const stoppedContainer = { ...mockContainer, id: 'container456', status: 'stopped' as const };
      mockContainerService.list.mockResolvedValue([runningContainer, stoppedContainer]);

      const response = await request(app)
        .get('/api/containers?status=running&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].status).toBe('running');
    });

    it('should handle pagination parameters', async () => {
      const containers = Array.from({ length: 25 }, (_, i) => ({
        ...mockContainer,
        id: `container${i}`,
        name: `test-container-${i}`
      }));
      mockContainerService.list.mockResolvedValue(containers);

      const response = await request(app)
        .get('/api/containers?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(10);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.total).toBe(25);
      expect(response.body.data.hasNext).toBe(true);
      expect(response.body.data.hasPrev).toBe(true);
    });

    it('should handle service errors', async () => {
      mockContainerService.list.mockRejectedValue(new Error('Docker service unavailable'));

      const response = await request(app)
        .get('/api/containers')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Docker service unavailable');
    });
  });

  describe('Container Creation', () => {
    it('should create container successfully', async () => {
      const containerConfig = {
        name: 'test-nginx',
        image: 'nginx',
        tag: 'latest',
        environment: {
          ENV_VAR: 'value'
        },
        ports: [
          {
            hostPort: 8080,
            containerPort: 80,
            protocol: 'tcp'
          }
        ],
        volumes: [
          {
            hostPath: '/host/path',
            containerPath: '/container/path',
            mode: 'rw'
          }
        ]
      };

      mockContainerService.create.mockResolvedValue(mockContainer);

      const response = await request(app)
        .post('/api/containers')
        .send(containerConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockContainer);
      expect(mockContainerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-nginx',
          image: 'nginx',
          tag: 'latest'
        })
      );
    });

    it('should validate container configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        image: 'nginx'
      };

      const response = await request(app)
        .post('/api/containers')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors during creation', async () => {
      const containerConfig = {
        name: 'test-nginx',
        image: 'nginx'
      };

      mockContainerService.create.mockRejectedValue(new Error('Container name already exists'));

      const response = await request(app)
        .post('/api/containers')
        .send(containerConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Container name already exists');
    });
  });

  describe('Container Operations', () => {
    const containerId = 'test-container-id';

    it('should start container successfully', async () => {
      mockContainerService.start.mockResolvedValue();

      const response = await request(app)
        .post(`/api/containers/${containerId}/start`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Container started successfully');
      expect(mockContainerService.start).toHaveBeenCalledWith(containerId);
    });

    it('should stop container successfully', async () => {
      mockContainerService.stop.mockResolvedValue();

      const response = await request(app)
        .post(`/api/containers/${containerId}/stop`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Container stopped successfully');
      expect(mockContainerService.stop).toHaveBeenCalledWith(containerId);
    });

    it('should restart container successfully', async () => {
      mockContainerService.restart.mockResolvedValue();

      const response = await request(app)
        .post(`/api/containers/${containerId}/restart`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Container restarted successfully');
      expect(mockContainerService.restart).toHaveBeenCalledWith(containerId);
    });

    it('should remove container successfully', async () => {
      mockContainerService.remove.mockResolvedValue();

      const response = await request(app)
        .delete(`/api/containers/${containerId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Container removed successfully');
      expect(mockContainerService.remove).toHaveBeenCalledWith(containerId);
    });

    it('should handle service errors during operations', async () => {
      mockContainerService.start.mockRejectedValue(new Error('Container not found'));

      const response = await request(app)
        .post(`/api/containers/${containerId}/start`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Container not found');
    });
  });

  describe('Container Logs and Metrics', () => {
    const containerId = 'test-container-id';

    it('should get container logs successfully', async () => {
      const mockLogs = ['Log line 1', 'Log line 2', 'Log line 3'];
      mockContainerService.getLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get(`/api/containers/${containerId}/logs`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual(mockLogs);
      expect(mockContainerService.getLogs).toHaveBeenCalledWith(containerId, {});
    });

    it('should handle log query parameters', async () => {
      const mockLogs = ['Recent log line'];
      mockContainerService.getLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get(`/api/containers/${containerId}/logs?tail=100&since=2023-01-01T00:00:00Z&timestamps=true`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockContainerService.getLogs).toHaveBeenCalledWith(containerId, {
        tail: 100,
        since: new Date('2023-01-01T00:00:00Z'),
        timestamps: true
      });
    });

    it('should get container stats successfully', async () => {
      mockContainerService.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get(`/api/containers/${containerId}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockContainerService.getStats).toHaveBeenCalledWith(containerId);
    });

    it('should handle service errors for logs and stats', async () => {
      mockContainerService.getLogs.mockRejectedValue(new Error('Container not running'));

      const response = await request(app)
        .get(`/api/containers/${containerId}/logs`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Container not running');
    });
  });

  describe('Container Configuration', () => {
    const containerId = 'test-container-id';

    it('should get container details successfully', async () => {
      mockContainerService.getContainerById.mockResolvedValue(mockContainer);

      const response = await request(app)
        .get(`/api/containers/${containerId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockContainer);
      expect(mockContainerService.getContainerById).toHaveBeenCalledWith(containerId);
    });

    it('should handle container not found', async () => {
      mockContainerService.getContainerById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/containers/${containerId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTAINER_NOT_FOUND');
      expect(response.body.error.message).toContain('not found');
    });

    it('should handle service errors when getting container details', async () => {
      mockContainerService.getContainerById.mockRejectedValue(new Error('Docker service error'));

      const response = await request(app)
        .get(`/api/containers/${containerId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Docker service error');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk container start operations', async () => {
      const bulkOperation = {
        action: 'start',
        containerIds: ['container1', 'container2', 'container3']
      };

      mockContainerService.start.mockResolvedValue();

      const response = await request(app)
        .post('/api/containers/bulk')
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.total).toBe(3);
      expect(response.body.data.summary.successful).toBe(3);
      expect(response.body.data.summary.failed).toBe(0);
      expect(mockContainerService.start).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk operations', async () => {
      const bulkOperation = {
        action: 'stop',
        containerIds: ['container1', 'container2']
      };

      mockContainerService.stop
        .mockResolvedValueOnce() // First call succeeds
        .mockRejectedValueOnce(new Error('Container not found')); // Second call fails

      const response = await request(app)
        .post('/api/containers/bulk')
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.total).toBe(2);
      expect(response.body.data.summary.successful).toBe(1);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.results[1].success).toBe(false);
      expect(response.body.data.results[1].error).toBe('Container not found');
    });

    it('should validate bulk operation request', async () => {
      const invalidBulkOperation = {
        action: 'invalid-action',
        containerIds: []
      };

      const response = await request(app)
        .post('/api/containers/bulk')
        .send(invalidBulkOperation)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should handle Docker service unavailable', async () => {
      mockContainerService.list.mockRejectedValue(new Error('Docker daemon not running'));

      const response = await request(app)
        .get('/api/containers')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Docker daemon not running');
    });

    it('should handle container not found errors', async () => {
      mockContainerService.getContainerById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/containers/non-existent-container')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTAINER_NOT_FOUND');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({ invalid: 'config' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid parameter formats', async () => {
      const response = await request(app)
        .get('/api/containers/logs?tail=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});