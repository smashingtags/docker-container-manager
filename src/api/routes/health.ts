import { Router, Request, Response } from 'express';
import { DockerServiceImpl } from '../../services/docker.service';

const router = Router();
const dockerService = new DockerServiceImpl();

// Initialize Docker service
dockerService.initialize().catch(console.error);

/**
 * GET /api/health
 * Returns the health status of the Docker daemon and application
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const dockerHealth = await dockerService.healthCheck();
    
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        docker: dockerHealth
      }
    };

    const statusCode = dockerHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        docker: {
          status: 'unhealthy',
          details: { error: 'Health check failed' }
        }
      }
    });
  }
});

/**
 * GET /api/health/docker
 * Returns detailed Docker daemon information
 */
router.get('/docker', async (req: Request, res: Response) => {
  try {
    const [healthCheck, dockerInfo] = await Promise.all([
      dockerService.healthCheck(),
      dockerService.getDockerInfo()
    ]);

    res.json({
      health: healthCheck,
      info: dockerInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;