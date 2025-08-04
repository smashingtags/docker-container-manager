import express, { Router } from 'express';
import { APIResponse } from '@/types/api.types';
import { sanitize } from './middleware/validation.middleware';
import healthRoutes from './routes/health';
import containerRoutes from './routes/containers';
import appstoreRoutes from './routes/appstore';
import websocketRoutes from './routes/websocket';

export interface APIModule {
  registerRoutes(router: Router): void;
  middleware?: express.RequestHandler[];
}

export function createAPIRouter(): Router {
  const router = Router();
  
  // Apply sanitization middleware to all API routes
  router.use(sanitize);
  
  // Register health routes
  router.use('/health', healthRoutes);
  
  // Register container management routes
  router.use('/containers', containerRoutes);
  
  // Register app store routes
  router.use('/apps', appstoreRoutes);
  
  // Register WebSocket routes
  router.use('/websocket', websocketRoutes);
  
  // Future route modules will be registered here
  // Example: router.use('/monitoring', monitoringRoutes);
  
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