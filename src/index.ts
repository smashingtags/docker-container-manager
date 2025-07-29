import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { createAPIRouter } from '@/api';
import { errorHandler, notFoundHandler } from '@/api/middleware';
import { DockerServiceImpl } from '@/services/docker.service';
import { DatabaseServiceImpl } from '@/services/database.service';
import { WebSocketServiceImpl } from '@/services/websocket.service';
import { logger } from '@/utils/logger';

class Application {
  private app: express.Application;
  private server: any;
  private dockerService: DockerServiceImpl;
  private databaseService: DatabaseServiceImpl;
  private websocketService: WebSocketServiceImpl;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    
    // Initialize services
    this.dockerService = new DockerServiceImpl();
    this.databaseService = new DatabaseServiceImpl();
    this.websocketService = new WebSocketServiceImpl(this.server);
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createAPIRouter());

    // Error handling
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private async initializeServices(): Promise<void> {
    try {
      logger.info('Initializing services...');
      
      await this.databaseService.initialize();
      logger.info('Database service initialized');
      
      await this.dockerService.initialize();
      logger.info('Docker service initialized');
      
      await this.websocketService.initialize();
      logger.info('WebSocket service initialized');
      
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      // Initialize services first
      await this.initializeServices();

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();

      // Start server
      const port = process.env['PORT'] || 3001;
      this.server.listen(port, () => {
        logger.info(`Docker Container Manager API started on port ${port}`);
        logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        // Close server
        if (this.server) {
          this.server.close();
        }

        // Cleanup services
        await this.websocketService.destroy();
        await this.dockerService.destroy();
        await this.databaseService.destroy();

        logger.info('Application shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});