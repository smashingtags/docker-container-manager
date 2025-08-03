import request from 'supertest';
import express from 'express';
import Joi from 'joi';
import { validate, sanitize, commonSchemas } from './validation.middleware';

describe('Validation Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Request Validation', () => {
    it('should validate request body successfully', async () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required()
      });

      app.post('/test', validate({ body: schema }), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', age: 25 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ name: 'John', age: 25 });
    });

    it('should reject invalid request body', async () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required()
      });

      app.post('/test', validate({ body: schema }), (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: 'John' }) // Missing age
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.stringContaining('age')
          ])
        }
      });
    });

    it('should validate query parameters', async () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).required(),
        limit: Joi.number().integer().min(1).max(100).required()
      });

      app.get('/test', validate({ query: schema }), (req, res) => {
        res.json({ success: true, query: req.query });
      });

      const response = await request(app)
        .get('/test?page=1&limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid query parameters', async () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).required(),
        limit: Joi.number().integer().min(1).max(100).required()
      });

      app.get('/test', validate({ query: schema }), (req, res) => {
        res.json({ success: true, query: req.query });
      });

      const response = await request(app)
        .get('/test?page=0&limit=200') // Invalid values
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate route parameters', async () => {
      const schema = Joi.object({
        id: Joi.string().uuid().required()
      });

      app.get('/test/:id', validate({ params: schema }), (req, res) => {
        res.json({ success: true, params: req.params });
      });

      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/test/${validUuid}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate headers', async () => {
      const schema = Joi.object({
        'x-api-key': Joi.string().required()
      }).unknown(true); // Allow other headers

      app.get('/test', validate({ headers: schema }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle multiple validation errors', async () => {
      const bodySchema = Joi.object({
        name: Joi.string().required()
      });
      
      const querySchema = Joi.object({
        page: Joi.number().integer().min(1).required()
      });

      app.post('/test', validate({ body: bodySchema, query: querySchema }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test?page=0') // Invalid query
        .send({}) // Missing required body field
        .expect(400);

      expect(response.body.error.details).toHaveLength(2);
    });
  });

  describe('Common Schemas', () => {
    it('should validate ID schema', async () => {
      const paramsSchema = Joi.object({
        id: commonSchemas.id
      });
      
      app.get('/test/:id', validate({ params: paramsSchema }), (req, res) => {
        res.json({ success: true, id: req.params['id'] });
      });

      await request(app)
        .get('/test/valid-id')
        .expect(200);

      await request(app)
        .get('/test/') // Empty ID
        .expect(404); // Route won't match

      // Test with very long ID
      const longId = 'a'.repeat(101);
      await request(app)
        .get(`/test/${longId}`)
        .expect(400);
    });

    it('should validate pagination schema', async () => {
      app.get('/test', validate({ query: commonSchemas.pagination }), (req, res) => {
        res.json({ success: true, query: req.query });
      });

      // Valid pagination
      await request(app)
        .get('/test?page=1&limit=20')
        .expect(200);

      // Default values should work
      await request(app)
        .get('/test')
        .expect(200);

      // Invalid pagination
      await request(app)
        .get('/test?page=0&limit=200')
        .expect(400);
    });

    it('should validate search schema', async () => {
      app.get('/test', validate({ query: commonSchemas.search }), (req, res) => {
        res.json({ success: true, query: req.query });
      });

      // Valid search
      await request(app)
        .get('/test?q=docker&category=web')
        .expect(200);

      // Empty query should work
      await request(app)
        .get('/test')
        .expect(200);

      // Very long search query should fail
      const longQuery = 'a'.repeat(201);
      await request(app)
        .get(`/test?q=${longQuery}`)
        .expect(400);
    });
  });

  describe('Sanitization', () => {
    beforeEach(() => {
      app.use(sanitize);
    });

    it('should remove script tags from request body', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          name: '<script>alert("xss")</script>John',
          description: 'Normal text'
        })
        .expect(200);

      expect(response.body.data.name).toBe('John');
      expect(response.body.data.description).toBe('Normal text');
    });

    it('should trim whitespace from strings', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          name: '  John  ',
          description: '  A description  '
        })
        .expect(200);

      expect(response.body.data.name).toBe('John');
      expect(response.body.data.description).toBe('A description');
    });

    it('should sanitize nested objects', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          user: {
            name: '<script>alert("xss")</script>John',
            profile: {
              bio: '  Bio text  '
            }
          }
        })
        .expect(200);

      expect(response.body.data.user.name).toBe('John');
      expect(response.body.data.user.profile.bio).toBe('Bio text');
    });

    it('should sanitize arrays', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          tags: [
            '<script>alert("xss")</script>tag1',
            '  tag2  ',
            'normal-tag'
          ]
        })
        .expect(200);

      expect(response.body.data.tags).toEqual(['tag1', 'tag2', 'normal-tag']);
    });

    it('should sanitize query parameters', async () => {
      app.get('/test', (req, res) => {
        res.json({ success: true, query: req.query });
      });

      const response = await request(app)
        .get('/test?name=<script>alert("xss")</script>John&description=  Normal  ')
        .expect(200);

      expect(response.body.query.name).toBe('John');
      expect(response.body.query.description).toBe('Normal');
    });

    it('should preserve non-string values', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          name: 'John',
          age: 25,
          active: true,
          scores: [95, 87, 92],
          metadata: null
        })
        .expect(200);

      expect(response.body.data).toEqual({
        name: 'John',
        age: 25,
        active: true,
        scores: [95, 87, 92],
        metadata: null
      });
    });
  });
});