import { Request, Response, NextFunction } from 'express';
import { createAPIResponse } from '@/api';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class MemoryStore {
  private store: RateLimitStore = {};

  increment(key: string): { totalHits: number; resetTime: number } {
    const now = Date.now();
    const record = this.store[key];

    if (!record || now > record.resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + (60 * 1000) // Default 1 minute window
      };
      return { totalHits: 1, resetTime: this.store[key].resetTime };
    }

    record.count++;
    return { totalHits: record.count, resetTime: record.resetTime };
  }

  decrement(key: string): void {
    const record = this.store[key];
    if (record && record.count > 0) {
      record.count--;
    }
  }

  resetKey(key: string): void {
    delete this.store[key];
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const record = this.store[key];
      if (record && record.resetTime <= now) {
        delete this.store[key];
      }
    });
  }
}

const defaultStore = new MemoryStore();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  defaultStore.cleanup();
}, 5 * 60 * 1000);

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const { totalHits, resetTime } = defaultStore.increment(key);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - totalHits).toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    });

    if (totalHits > maxRequests) {
      const response = createAPIResponse(undefined, {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        details: {
          limit: maxRequests,
          windowMs,
          resetTime: new Date(resetTime).toISOString()
        }
      });

      res.status(429).json(response);
      return;
    }

    // Handle response to potentially decrement counter for failed requests
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        
        if (
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400)
        ) {
          defaultStore.decrement(key);
        }
        
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Predefined rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
    message: 'Too many API requests, please try again later'
  }),

  // Strict rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true
  }),

  // Container operations rate limit
  containerOps: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 container operations per minute
    message: 'Too many container operations, please slow down'
  }),

  // App deployment rate limit
  deployment: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5, // 5 deployments per 5 minutes
    message: 'Too many deployment requests, please wait before deploying again'
  })
};