import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { ServiceInterface, WebSocketEvents, WebSocketRoom, ClientSubscription } from '@/types';
import { logger } from '@/utils/logger';

export interface WebSocketService extends ServiceInterface {
  // Broadcasting methods
  broadcast<K extends keyof WebSocketEvents>(event: K, data: WebSocketEvents[K]): void;
  broadcastToRoom<K extends keyof WebSocketEvents>(room: WebSocketRoom, event: K, data: WebSocketEvents[K]): void;
  
  // Client management
  getConnectedClients(): number;
  getClientsInRoom(room: WebSocketRoom): number;
  
  // Event emitter for internal communication
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  
  // Metrics streaming
  startMetricsStreaming(): void;
  stopMetricsStreaming(): void;
}

export class WebSocketServiceImpl extends EventEmitter implements WebSocketService {
  private io: SocketIOServer | null = null;
  private httpServer: HTTPServer;
  private clientSubscriptions: Map<string, ClientSubscription> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private isMetricsStreaming: boolean = false;

  constructor(httpServer: HTTPServer) {
    super();
    this.httpServer = httpServer;
  }

  async initialize(): Promise<void> {
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env['FRONTEND_URL'] || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized with Socket.IO');
  }

  async destroy(): Promise<void> {
    this.stopMetricsStreaming();
    this.clientSubscriptions.clear();
    
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    
    this.removeAllListeners();
    logger.info('WebSocket service destroyed');
  }

  broadcast<K extends keyof WebSocketEvents>(event: K, data: WebSocketEvents[K]): void {
    if (this.io) {
      this.io.emit(event, data);
      logger.debug(`Broadcasting event: ${String(event)}`, { clientCount: this.getConnectedClients() });
    }
  }

  broadcastToRoom<K extends keyof WebSocketEvents>(room: WebSocketRoom, event: K, data: WebSocketEvents[K]): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
      logger.debug(`Broadcasting to room ${room}: ${String(event)}`, { 
        clientCount: this.getClientsInRoom(room) 
      });
    }
  }

  getConnectedClients(): number {
    return this.io ? this.io.sockets.sockets.size : 0;
  }

  getClientsInRoom(room: WebSocketRoom): number {
    if (!this.io) return 0;
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }

  startMetricsStreaming(): void {
    if (this.isMetricsStreaming) return;
    
    this.isMetricsStreaming = true;
    this.metricsInterval = setInterval(() => {
      this.emit('metrics:collect');
    }, 5000); // Collect metrics every 5 seconds
    
    logger.info('Started metrics streaming');
  }

  stopMetricsStreaming(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.isMetricsStreaming = false;
    logger.info('Stopped metrics streaming');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      // Send connection confirmation
      socket.emit('connected', {
        timestamp: new Date().toISOString(),
        clientId: socket.id
      });

      // Handle room subscriptions
      socket.on('subscribe', (subscription: ClientSubscription) => {
        this.handleClientSubscription(socket, subscription);
      });

      socket.on('unsubscribe', (rooms: WebSocketRoom[]) => {
        this.handleClientUnsubscription(socket, rooms);
      });

      // Legacy support for simple room joining
      socket.on('join-room', (room: WebSocketRoom) => {
        socket.join(room);
        logger.debug(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('leave-room', (room: WebSocketRoom) => {
        socket.leave(room);
        logger.debug(`Client ${socket.id} left room: ${room}`);
      });

      // Handle container-specific subscriptions
      socket.on('subscribe-container', (containerId: string) => {
        const containerRoom: WebSocketRoom = `container:${containerId}`;
        socket.join(containerRoom);
        logger.debug(`Client ${socket.id} subscribed to container: ${containerId}`);
      });

      socket.on('unsubscribe-container', (containerId: string) => {
        const containerRoom: WebSocketRoom = `container:${containerId}`;
        socket.leave(containerRoom);
        logger.debug(`Client ${socket.id} unsubscribed from container: ${containerId}`);
      });

      // Handle log streaming subscriptions
      socket.on('subscribe-logs', (containerId: string) => {
        const logsRoom: WebSocketRoom = `logs:${containerId}`;
        socket.join(logsRoom);
        logger.debug(`Client ${socket.id} subscribed to logs: ${containerId}`);
      });

      socket.on('unsubscribe-logs', (containerId: string) => {
        const logsRoom: WebSocketRoom = `logs:${containerId}`;
        socket.leave(logsRoom);
        logger.debug(`Client ${socket.id} unsubscribed from logs: ${containerId}`);
      });

      // Handle metrics streaming requests
      socket.on('start-metrics', () => {
        socket.join('metrics');
        if (!this.isMetricsStreaming && this.getClientsInRoom('metrics') > 0) {
          this.startMetricsStreaming();
        }
        logger.debug(`Client ${socket.id} started metrics streaming`);
      });

      socket.on('stop-metrics', () => {
        socket.leave('metrics');
        if (this.getClientsInRoom('metrics') === 0) {
          this.stopMetricsStreaming();
        }
        logger.debug(`Client ${socket.id} stopped metrics streaming`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up subscriptions
        this.clientSubscriptions.delete(socket.id);
        
        // Stop metrics streaming if no clients are listening
        if (this.getClientsInRoom('metrics') === 0) {
          this.stopMetricsStreaming();
        }

        // Emit disconnection event
        this.broadcast('disconnected', {
          timestamp: new Date().toISOString(),
          clientId: socket.id,
          reason
        });
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error(`Socket error for client ${socket.id}:`, error);
        socket.emit('error', {
          timestamp: new Date().toISOString(),
          error: {
            code: 'SOCKET_ERROR',
            message: error.message,
            details: error.stack
          }
        });
      });
    });
  }

  private handleClientSubscription(socket: Socket, subscription: ClientSubscription): void {
    // Store client subscription preferences
    this.clientSubscriptions.set(socket.id, subscription);
    
    // Join requested rooms
    subscription.rooms.forEach(room => {
      socket.join(room);
      logger.debug(`Client ${socket.id} subscribed to room: ${room}`);
    });

    // If subscribing to metrics, start streaming if not already active
    if (subscription.rooms.includes('metrics') && !this.isMetricsStreaming) {
      this.startMetricsStreaming();
    }

    logger.info(`Client ${socket.id} updated subscriptions`, { 
      rooms: subscription.rooms,
      containerId: subscription.containerId 
    });
  }

  private handleClientUnsubscription(socket: Socket, rooms: WebSocketRoom[]): void {
    const currentSubscription = this.clientSubscriptions.get(socket.id);
    
    if (currentSubscription) {
      // Remove rooms from subscription
      const updatedRooms = currentSubscription.rooms.filter(room => !rooms.includes(room));
      
      // Update stored subscription
      this.clientSubscriptions.set(socket.id, {
        ...currentSubscription,
        rooms: updatedRooms
      });
    }

    // Leave the rooms
    rooms.forEach(room => {
      socket.leave(room);
      logger.debug(`Client ${socket.id} unsubscribed from room: ${room}`);
    });

    // Stop metrics streaming if no clients are listening
    if (rooms.includes('metrics') && this.getClientsInRoom('metrics') === 0) {
      this.stopMetricsStreaming();
    }

    logger.info(`Client ${socket.id} unsubscribed from rooms`, { rooms });
  }
}