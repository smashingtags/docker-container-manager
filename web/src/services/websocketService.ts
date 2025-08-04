import io from 'socket.io-client';
import { WebSocketEvent, ContainerEvent, MetricsEvent } from '../types';

export class WebSocketService {
  private socket: any | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string = process.env.REACT_APP_WS_URL || 'http://localhost:3000') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason: any) => {
        console.log('WebSocket disconnected:', reason);
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(console.error);
      }, delay);
    }
  }

  // Room management
  joinRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join', room);
    }
  }

  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave', room);
    }
  }

  // Event listeners
  onContainerEvent(callback: (event: ContainerEvent) => void): void {
    if (!this.socket) return;

    const containerEvents = [
      'container:status',
      'container:created',
      'container:started',
      'container:stopped',
      'container:removed',
      'container:logs'
    ];

    containerEvents.forEach(eventType => {
      this.socket!.on(eventType, (data: any) => {
        callback({
          type: eventType as ContainerEvent['type'],
          data,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  onMetricsEvent(callback: (event: MetricsEvent) => void): void {
    if (!this.socket) return;

    const metricsEvents = ['metrics:container', 'metrics:system'];

    metricsEvents.forEach(eventType => {
      this.socket!.on(eventType, (data: any) => {
        callback({
          type: eventType as MetricsEvent['type'],
          data,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  onEvent(eventType: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(eventType, callback);
    }
  }

  offEvent(eventType: string, callback?: (data: any) => void): void {
    if (this.socket) {
      this.socket.off(eventType, callback);
    }
  }

  // Emit events
  emit(eventType: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(eventType, data);
    }
  }

  // Subscription preferences
  setMetricsInterval(interval: number): void {
    this.emit('preferences', { metricsInterval: interval });
  }

  subscribeToContainer(containerId: string): void {
    this.joinRoom(`container:${containerId}`);
    this.joinRoom(`logs:${containerId}`);
  }

  unsubscribeFromContainer(containerId: string): void {
    this.leaveRoom(`container:${containerId}`);
    this.leaveRoom(`logs:${containerId}`);
  }

  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();