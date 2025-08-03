import request from 'supertest';
import express from 'express';
import { rateLimit, rateLimiters } from './rateLimit.middleware';

describe('Rate Limit Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 5
      });

      app.use('/test', limiter);
      app.get('/test', (_req, res) => {
        res.json({ success: true });
      });

      // Make first request
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      const remaining = response.headers['x-ratelimit-remaining'];
      expect(remaining).toBeDefined();
      if (remaining) {
        expect(parseInt(remaining)).toBeLessThan(5);
      }
    });

    it('should block requests exceeding limit', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 1, // Very low limit for testing
        message: 'Custom rate limit message'
      });

      app.use('/test-block', limiter);
      app.get('/test-block', (_req, res) => {
        res.json({ success: true });
      });

      // Make first request (should succeed)
      await request(app).get('/test-block').expect(200);

      // Second request should be blocked
      const response = await request(app)
        .get('/test-block')
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Custom rate limit message',
          details: {
            limit: 1,
            windowMs: 60 * 1000
          }
        }
      });
    });

    it('should include rate limit headers', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000,
        maxRequests: 10
      });

      app.use('/test-headers', limiter);
      app.get('/test-headers', (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test-headers')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      
      // Verify reset time is a valid ISO string
      const resetTimeHeader = response.headers['x-ratelimit-reset'];
      expect(resetTimeHeader).toBeDefined();
      if (resetTimeHeader) {
        const resetTime = new Date(resetTimeHeader);
        expect(resetTime.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should handle different IPs separately', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      app.use('/test-ip', limiter);
      app.get('/test-ip', (_req, res) => {
        res.json({ success: true });
      });

      // First IP makes a request
      await request(app)
        .get('/test-ip')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      // Different IP should still work
      await request(app)
        .get('/test-ip')
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(200);
    });
  });

  describe('Skip Options', () => {
    it('should have skip options available', () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000,
        maxRequests: 2,
        skipSuccessfulRequests: true
      });

      expect(typeof limiter).toBe('function');
    });
  });

  describe('Predefined Rate Limiters', () => {
    it('should have general rate limiter', () => {
      expect(rateLimiters.general).toBeDefined();
      expect(typeof rateLimiters.general).toBe('function');
    });

    it('should have auth rate limiter', () => {
      expect(rateLimiters.auth).toBeDefined();
      expect(typeof rateLimiters.auth).toBe('function');
    });

    it('should have container operations rate limiter', () => {
      expect(rateLimiters.containerOps).toBeDefined();
      expect(typeof rateLimiters.containerOps).toBe('function');
    });

    it('should have deployment rate limiter', () => {
      expect(rateLimiters.deployment).toBeDefined();
      expect(typeof rateLimiters.deployment).toBe('function');
    });

    it('should apply auth rate limiter correctly', async () => {
      app.use('/auth', rateLimiters.auth);
      app.post('/auth/login', (_req, res) => {
        res.json({ success: true });
      });

      // Should allow initial requests
      await request(app).post('/auth/login').expect(200);
      
      // Headers should be present
      const response = await request(app).post('/auth/login').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing IP address gracefully', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000,
        maxRequests: 5
      });

      app.use('/test-error', limiter);
      app.get('/test-error', (_req, res) => {
        res.json({ success: true });
      });

      // Request without explicit IP should still work
      const response = await request(app)
        .get('/test-error')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should not crash with different keys', async () => {
      const limiter = rateLimit({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      app.use('/test-memory', limiter);
      app.get('/test-memory', (_req, res) => {
        res.json({ success: true });
      });

      // Make a few requests from different IPs
      await request(app)
        .get('/test-memory')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      await request(app)
        .get('/test-memory')
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(200);

      // Should not crash or consume excessive memory
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });
});