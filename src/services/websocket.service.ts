import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ServiceInterface } from '@/types';

export interface WebSocketService extends ServiceInterface {
  broadcast(event: string, data: any): void;
  broadcastToRoom(room: string, event: string, data: any): void;
  getConnectedClients(): number;
}

export class WebSocketServiceImpl implements WebSocketService {
  private io: SocketIOServer | null = null;
  private httpServer: HTTPServer;

  constructor(httpServer: HTTPServer) {
    this.httpServer = httpServer;
  }

  async initialize(): Promise<void> {
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env['FRONTEND_URL'] || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
  }

  async destroy(): Promise<void> {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }

  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  broadcastToRoom(room: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  getConnectedClients(): number {
    return this.io ? this.io.sockets.sockets.size : 0;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-room', (room: string) => {
        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        console.log(`Client ${socket.id} left room: ${room}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
}