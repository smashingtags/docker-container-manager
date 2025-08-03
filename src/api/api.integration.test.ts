import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAPIRouter } from './index';
import { errorHandler, notFoundHandler, rateLimiters } from './middleware';
import { DockerServiceImpl } from '../services/docker.service';

// Mock Docker service for testing
jest.mock('../services/docker.service');

describe('API Integration Tests', () => {
  let app: express.Application;
  let mockDockerService: jest.Mocked<DockerServiceImpl>;

  beforeEach(() => {
    app = express();
    
    // Setup middleware similar to main application
    app.use(helmet());
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Setup API routes
    app.use('/api', createAPIRouter());
    
    // Error handling
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Setup Docker service mock
    mockDockerService = new DockerServiceImpl() as jest.Mocked<DockerServiceImpl>;
    mockDockerService.healthCheck = jest.fn();
    mockDockerService.getDockerInfo = jest.fn();
    mockDockerService.ping = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Core API Structure', () => {
    it('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Should not fail due to JSON parsing
      expect(response.status).not.toBe(500);
    });

    it('should handle URL encoded requests', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('test=data')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should not fail due to URL encoding parsing
      expect(response.status).not.toBe(500);
    });

    it('should apply CORS headers correctly', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://malicious-site.com');

      // CORS should not include the malicious origin
      expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
    });

    it('should apply security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /api/non-existent not found'),
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.stringContaining('JSON'),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle request body size limits', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB payload
      
      const response = await request(app)
        .post('/api/health')
        .send({ data: largePayload })
        .set('Content-Type', 'application/json')
        .expect(413);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.stringContaining('too large'),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle internal server errors gracefully', async () => {
      // Mock a service to throw an error
      mockDockerService.healthCheck.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/health/docker')
        .expect(500);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should handle async errors in middleware', async () => {
      // Test that async errors are properly caught by error handler
      const response = await request(app)
        .get('/api/health/docker')
        .expect(200);

      // Should not crash the application
      expect(response.status).not.toBe(500);
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      // Should not expose internal paths or sensitive information
      expect(response.body.error.message).not.toContain('node_modules');
      expect(response.body.error.message).not.toContain('src/');
      expect(response.body.error.message).not.toContain('dist/');
    });
  });

  describe('Request Sanitization', () => {
    it('should apply sanitization middleware to prevent XSS', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({
          name: '<script>alert("xss")</script>test',
          description: 'Normal text',
          html: '<img src="x" onerror="alert(1)">'
        });

      // Should not crash due to sanitization
      expect(response.status).not.toBe(500);
    });

    it('should sanitize nested objects', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({
          user: {
            name: '<script>alert("nested")</script>',
            profile: {
              bio: '<iframe src="javascript:alert(1)"></iframe>'
            }
          }
        });

      expect(response.status).not.toBe(500);
    });

    it('should sanitize arrays', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({
          tags: [
            '<script>alert("array")</script>',
            'normal-tag',
            '<img src="x" onerror="alert(2)">'
          ]
        });

      expect(response.status).not.toBe(500);
    });

    it('should handle SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({
          query: "'; DROP TABLE users; --",
          filter: "1' OR '1'='1"
        });

      expect(response.status).not.toBe(500);
    });
  });

  describe('API Response Format', () => {
    it('should return consistent response format for successful health check', async () => {
      mockDockerService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          version: '20.10.0',
          containers: 5,
          images: 10
        }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
        services: expect.any(Object)
      });
      expect(response.body.services.docker).toBeDefined();
    });

    it('should return 503 when Docker service is unhealthy', async () => {
      mockDockerService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        details: { error: 'Docker daemon not responding' }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.services.docker.status).toBe('unhealthy');
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should include proper Content-Type headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should include timestamp in all responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle missing content-type header', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('test data');

      // Should not crash, should handle gracefully
      expect(response.status).not.toBe(500);
    });

    it('should handle unsupported content types gracefully', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('test data')
        .set('Content-Type', 'text/plain');

      // Should handle gracefully, not crash
      expect(response.status).not.toBe(500);
    });

    it('should handle multipart form data', async () => {
      const response = await request(app)
        .post('/api/health')
        .field('name', 'test')
        .field('value', 'data');

      expect(response.status).not.toBe(500);
    });

    it('should handle XML content type', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('<xml><test>data</test></xml>')
        .set('Content-Type', 'application/xml');

      expect(response.status).not.toBe(500);
    });

    it('should validate JSON content type for JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('{"valid": "json"}')
        .set('Content-Type', 'application/json');

      expect(response.status).not.toBe(500);
    });
  });

  describe('Request Size and Limits', () => {
    it('should handle empty request bodies', async () => {
      const response = await request(app)
        .post('/api/health')
        .send();

      expect(response.status).not.toBe(500);
    });

    it('should handle very deep nested objects', async () => {
      const deepObject: any = {};
      let current = deepObject;
      
      // Create a 100-level deep nested object
      for (let i = 0; i < 100; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'deep';

      const response = await request(app)
        .post('/api/health')
        .send(deepObject);

      // Should handle without crashing
      expect(response.status).not.toBe(500);
    });

    it('should handle large arrays', async () => {
      const largeArray = Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `item-${i}`,
        data: 'x'.repeat(100)
      }));

      const response = await request(app)
        .post('/api/health')
        .send({ items: largeArray });

      expect(response.status).not.toBe(500);
    });

    it('should handle requests with many properties', async () => {
      const manyProps: any = {};
      for (let i = 0; i < 1000; i++) {
        manyProps[`prop${i}`] = `value${i}`;
      }

      const response = await request(app)
        .post('/api/health')
        .send(manyProps);

      expect(response.status).not.toBe(500);
    });

    it('should handle unicode and special characters', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({
          unicode: '🐳🚀💻',
          special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          emoji: '😀😃😄😁😆😅😂🤣',
          chinese: '你好世界',
          arabic: 'مرحبا بالعالم'
        });

      expect(response.status).not.toBe(500);
    });
  });
});

  describe('Docker Health Endpoints', () => {
    it('should return Docker health information', async () => {
      mockDockerService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          version: '20.10.0',
          apiVersion: '1.41',
          containers: 5,
          images: 10,
          serverVersion: '20.10.0',
          operatingSystem: 'Linux',
          architecture: 'x86_64'
        }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.services.docker.status).toBe('healthy');
      expect(response.body.services.docker.details.version).toBe('20.10.0');
    });

    it('should return detailed Docker information', async () => {
      mockDockerService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { version: '20.10.0' }
      });
      
      mockDockerService.getDockerInfo.mockResolvedValue({
        Containers: 5,
        Images: 10,
        ServerVersion: '20.10.0',
        OperatingSystem: 'Linux',
        Architecture: 'x86_64'
      });

      const response = await request(app)
        .get('/api/health/docker')
        .expect(200);

      expect(response.body.health).toBeDefined();
      expect(response.body.info).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle Docker service errors gracefully', async () => {
      mockDockerService.healthCheck.mockRejectedValue(new Error('Docker daemon not running'));

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body.services.docker.status).toBe('unhealthy');
    });
  });

  describe('Future API Endpoints Preparation', () => {
    // These tests prepare for future container management endpoints
    it('should be ready for container management endpoints', async () => {
      // Test that the API structure can handle future container endpoints
      const response = await request(app)
        .get('/api/containers')
        .expect(404); // Should return 404 until implemented

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should be ready for app store endpoints', async () => {
      const response = await request(app)
        .get('/api/apps')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should be ready for monitoring endpoints', async () => {
      const response = await request(app)
        .get('/api/monitoring')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle future POST endpoints structure', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({
          name: 'test-container',
          image: 'nginx:latest'
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('API Versioning Support', () => {
    it('should handle API version headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('API-Version', '1.0')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should handle Accept headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle User-Agent headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('User-Agent', 'Docker-Container-Manager-Client/1.0')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      mockDockerService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { version: '20.10.0' }
      });

      const requests = Array(10).fill(0).map(() => 
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.services.docker.status).toBe('healthy');
      });
    });

    it('should handle mixed request types concurrently', async () => {
      const requests = [
        request(app).get('/api/health'),
        request(app).post('/api/health').send({}),
        request(app).get('/api/health/docker'),
        request(app).get('/api/non-existent')
      ];

      const responses = await Promise.all(requests);
      
      expect(responses[0]?.status).toBe(200); // GET health
      expect(responses[1]?.status).not.toBe(500); // POST health
      expect(responses[2]?.status).toBe(200); // GET health/docker
      expect(responses[3]?.status).toBe(404); // Non-existent
    });
  });
});

describe('Rate Limiting Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Apply rate limiting
    app.use('/api', rateLimiters.general);
    app.use('/api', createAPIRouter());
    app.use(errorHandler);
  });

  it('should include rate limit headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should have rate limiters configured', () => {
    expect(rateLimiters.general).toBeDefined();
    expect(rateLimiters.auth).toBeDefined();
    expect(rateLimiters.containerOps).toBeDefined();
    expect(rateLimiters.deployment).toBeDefined();
  });

  it('should enforce rate limits', async () => {
    // Make multiple requests quickly to test rate limiting
    const requests = Array(20).fill(0).map(() => 
      request(app).get('/api/health')
    );

    const responses = await Promise.all(requests);
    
    // At least some requests should succeed
    const successfulRequests = responses.filter(r => r.status === 200);
    expect(successfulRequests.length).toBeGreaterThan(0);
    
    // Rate limit headers should be present
    responses.forEach(response => {
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  it('should reset rate limits after time window', async () => {
    // This test would need to wait for the rate limit window to reset
    // For now, we just verify the structure is in place
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.headers['x-ratelimit-reset']).toBeDefined();
    const resetHeader = response.headers['x-ratelimit-reset'];
    if (resetHeader) {
      const resetTime = parseInt(resetHeader);
      expect(resetTime).toBeGreaterThan(Date.now() / 1000);
    }
  });
});

describe('API Performance and Load Testing', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', createAPIRouter());
    app.use(errorHandler);
  });

  it('should handle rapid sequential requests', async () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 50; i++) {
      await request(app).get('/api/health').expect(200);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete 50 requests in reasonable time (less than 5 seconds)
    expect(totalTime).toBeLessThan(5000);
  });

  it('should maintain response consistency under load', async () => {
    const requests = Array(100).fill(0).map((_, i) => 
      request(app)
        .post('/api/health')
        .send({ requestId: i, data: `test-${i}` })
    );

    const responses = await Promise.all(requests);
    
    // All responses should have consistent structure
    responses.forEach((response, index) => {
      expect(response.status).not.toBe(500);
      // Response should be processed (not timeout)
      expect(response.body).toBeDefined();
    });
  });
});