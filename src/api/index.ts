import express, { Router } from 'express';
import { APIResponse } from '@/types/api.types';
import healthRoutes from './routes/health';

export interface APIModule {
  registerRoutes(router: Router): void;
  middleware?: express.RequestHandler[];
}

export function createAPIRouter(): Router {
  const router = Router();
  
  // Register health routes
  router.use('/health', healthRoutes);
  
  return router;
}

export function createAPIResponse<T>(data?: T, error?: any): APIResponse<T> {
  if (error) {
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        details: error.details,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

export function asyncHandler(fn: Function) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}