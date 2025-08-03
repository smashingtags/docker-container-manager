import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createAPIResponse } from '@/api';

export interface ValidationOptions {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

export function validate(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (options.body) {
      const { error } = options.body.validate(req.body);
      if (error) {
        errors.push(`Body validation: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate query parameters
    if (options.query) {
      const { error } = options.query.validate(req.query);
      if (error) {
        errors.push(`Query validation: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate route parameters
    if (options.params) {
      const { error } = options.params.validate(req.params);
      if (error) {
        errors.push(`Params validation: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate headers
    if (options.headers) {
      const { error } = options.headers.validate(req.headers);
      if (error) {
        errors.push(`Headers validation: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      const response = createAPIResponse(undefined, {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors
      });
      
      res.status(400).json(response);
      return;
    }

    next();
  };
}

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().required().min(1).max(100),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('asc')
  }),
  search: Joi.object({
    q: Joi.string().optional().min(1).max(200),
    category: Joi.string().optional().min(1).max(50)
  })
};

// Sanitization middleware
export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize string inputs to prevent XSS
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}