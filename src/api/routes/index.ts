import { Router } from 'express';

// Route modules will be implemented in later tasks
export function setupRoutes(): Router {
  const router = Router();

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] || '1.0.0'
      },
      timestamp: new Date().toISOString()
    });
  });

  // API info endpoint
  router.get('/info', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Docker Container Manager API',
        version: process.env['npm_package_version'] || '1.0.0',
        description: 'REST API for Docker container management platform'
      },
      timestamp: new Date().toISOString()
    });
  });

  return router;
}