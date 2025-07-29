import request from 'supertest';
import express from 'express';

// Mock the Docker service before importing the routes
const mockDockerService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({
    status: 'healthy',
    details: {
      version: '20.10.0',
      apiVersion: '1.41',
      containers: 5,
      images: 10,
      serverVersion: '20.10.0',
      operatingSystem: 'Ubuntu 20.04',
      architecture: 'x86_64'
    }
  }),
  getDockerInfo: jest.fn().mockResolvedValue({
    Containers: 5,
    Images: 10,
    ServerVersion: '20.10.0'
  })
};

jest.mock('../../services/docker.service', () => ({
  DockerServiceImpl: jest.fn().mockImplementation(() => mockDockerService)
}));

import healthRoutes from './health';

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        services: {
          docker: {
            status: 'healthy',
            details: expect.any(Object)
          }
        }
      });
    });

    it('should return 503 when Docker is unhealthy', async () => {
      // Mock unhealthy Docker
      mockDockerService.healthCheck.mockResolvedValueOnce({
        status: 'unhealthy',
        details: { error: 'Docker daemon not responding' }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.services.docker.status).toBe('unhealthy');
    });
  });

  describe('GET /api/health/docker', () => {
    it('should return detailed Docker information', async () => {
      const response = await request(app)
        .get('/api/health/docker')
        .expect(200);

      expect(response.body).toMatchObject({
        health: {
          status: 'healthy',
          details: expect.any(Object)
        },
        info: expect.any(Object),
        timestamp: expect.any(String)
      });
    });

    it('should handle Docker service errors', async () => {
      // Mock Docker service error
      mockDockerService.healthCheck.mockRejectedValueOnce(new Error('Docker connection failed'));

      const response = await request(app)
        .get('/api/health/docker')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Docker connection failed',
        timestamp: expect.any(String)
      });
    });
  });
});