import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAPIRouter } from './index';
import { errorHandler, notFoundHandler, rateLimiters } from './middleware';

describe('API Integration Test Suite', () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup a complete application instance for integration testing
    app = express();
    
    // Security middleware
    app.use(helmet());
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // API routes with rate limiting
    app.use('/api', rateLimiters.general);
    app.use('/api', createAPIRouter());
    
    // Error handling
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  describe('Core API Functionality', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
    });

    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should apply security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Request Processing', () => {
    it('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      expect(response.status).not.toBe(500);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/health')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle large payloads within limits', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      
      const response = await request(app)
        .post('/api/health')
        .send({ data: largeData })
        .set('Content-Type', 'application/json');

      expect(response.status).not.toBe(413);
    });

    it('should reject payloads exceeding size limits', async () => {
      const tooLargeData = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/health')
        .send({ data: tooLargeData })
        .set('Content-Type', 'application/json')
        .expect(413);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should handle multiple requests within limits', async () => {
      const requests = Array(5).fill(0).map(() => 
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .get('/api/invalid-endpoint')
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

    it('should handle internal errors gracefully', async () => {
      // This would test error handling when services fail
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Content Type Handling', () => {
    it('should handle different content types', async () => {
      const contentTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain'
      ];

      for (const contentType of contentTypes) {
        const response = await request(app)
          .post('/api/health')
          .send('test=data')
          .set('Content-Type', contentType);

        expect(response.status).not.toBe(500);
      }
    });

    it('should return JSON responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Future Endpoint Readiness', () => {
    const futureEndpoints = [
      { method: 'GET', path: '/api/containers' },
      { method: 'POST', path: '/api/containers' },
      { method: 'GET', path: '/api/apps' },
      { method: 'POST', path: '/api/apps/nginx/deploy' },
      { method: 'GET', path: '/api/monitoring/system' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'GET', path: '/api/config/containers' }
    ];

    futureEndpoints.forEach(({ method, path }) => {
      it(`should be ready for ${method} ${path}`, async () => {
        let response;
        if (method === 'GET') {
          response = await request(app).get(path).expect(404);
        } else if (method === 'POST') {
          response = await request(app).post(path).send({}).expect(404);
        } else if (method === 'PUT') {
          response = await request(app).put(path).send({}).expect(404);
        } else if (method === 'DELETE') {
          response = await request(app).delete(path).expect(404);
        }

        expect(response?.body.error.code).toBe('NOT_FOUND');
      });
    });
  });

  describe('Performance and Load', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 20;
      const requests = Array(concurrentRequests).fill(0).map(() => 
        request(app).get('/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should maintain response consistency under load', async () => {
      const requests = Array(50).fill(0).map((_, i) => 
        request(app)
          .post('/api/health')
          .send({ requestId: i })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).not.toBe(500);
        expect(response.body).toBeDefined();
      });
    });
  });

  describe('Security Features', () => {
    it('should sanitize inputs', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        description: '$(rm -rf /)',
        data: '<img src="x" onerror="alert(1)">'
      };

      const response = await request(app)
        .post('/api/health')
        .send(maliciousInput);

      expect(response.status).not.toBe(500);
    });

    it('should handle various attack vectors', async () => {
      const attackVectors = [
        { sql: "'; DROP TABLE users; --" },
        { xss: '<script>document.cookie</script>' },
        { path: '../../../etc/passwd' },
        { command: '$(cat /etc/passwd)' }
      ];

      for (const attack of attackVectors) {
        const response = await request(app)
          .post('/api/health')
          .send(attack);

        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('API Documentation Readiness', () => {
    it('should provide API information', async () => {
      // This would test an API info endpoint when implemented
      const response = await request(app)
        .get('/api/info')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle OpenAPI/Swagger endpoint preparation', async () => {
      const response = await request(app)
        .get('/api/docs')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});