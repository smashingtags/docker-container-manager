import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io } from 'socket.io-client';
import { WebSocketServiceImpl } from './websocket.service';
import { WebSocketRoom, ClientSubscription } from '@/types';

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let websocketService: WebSocketServiceImpl;
  let clientSocket: any;
  let serverSocket: any;

  beforeEach(async () => {
    // Create HTTP server
    httpServer = new HTTPServer();
    
    // Initialize WebSocket service
    websocketService = new WebSocketServiceImpl(httpServer);
    await websocketService.initialize();

    // Start server on random port
    const port = await new Promise<number>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        }
      });
    });

    // Create client connection
    clientSocket = io(`http://localhost:${port}`);
    
    // Wait for connection
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
    });

    // Get server socket reference
    const io = (websocketService as any).io as SocketIOServer;
    serverSocket = Array.from(io.sockets.sockets.values())[0];
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    await websocketService.destroy();
    
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('Connection Management', () => {
    it('should handle client connections', () => {
      expect(websocketService.getConnectedClients()).toBe(1);
    });

    it('should send connection confirmation', (done) => {
      clientSocket.on('connected', (data: any) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('clientId');
        expect(typeof data.clientId).toBe('string');
        done();
      });
    });

    it('should handle client disconnections', async () => {
      expect(websocketService.getConnectedClients()).toBe(1);
      
      clientSocket.disconnect();
      
      // Wait for disconnection to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(websocketService.getConnectedClients()).toBe(0);
    });
  });

  describe('Room Management', () => {
    it('should handle room subscriptions', (done) => {
      const subscription: ClientSubscription = {
        rooms: ['containers', 'metrics'],
        containerId: 'test-container'
      };

      clientSocket.emit('subscribe', subscription);
      
      setTimeout(() => {
        expect(websocketService.getClientsInRoom('containers')).toBe(1);
        expect(websocketService.getClientsInRoom('metrics')).toBe(1);
        done();
      }, 50);
    });

    it('should handle room unsubscriptions', (done) => {
      const subscription: ClientSubscription = {
        rooms: ['containers', 'metrics'],
        containerId: 'test-container'
      };

      clientSocket.emit('subscribe', subscription);
      
      setTimeout(() => {
        clientSocket.emit('unsubscribe', ['containers']);
        
        setTimeout(() => {
          expect(websocketService.getClientsInRoom('containers')).toBe(0);
          expect(websocketService.getClientsInRoom('metrics')).toBe(1);
          done();
        }, 50);
      }, 50);
    });

    it('should handle container-specific subscriptions', (done) => {
      const containerId = 'test-container-123';
      
      clientSocket.emit('subscribe-container', containerId);
      
      setTimeout(() => {
        expect(websocketService.getClientsInRoom(`container:${containerId}`)).toBe(1);
        done();
      }, 50);
    });

    it('should handle log streaming subscriptions', (done) => {
      const containerId = 'test-container-123';
      
      clientSocket.emit('subscribe-logs', containerId);
      
      setTimeout(() => {
        expect(websocketService.getClientsInRoom(`logs:${containerId}`)).toBe(1);
        done();
      }, 50);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all clients', (done) => {
      const testEvent = {
        timestamp: new Date().toISOString(),
        clientId: 'test-client'
      };

      clientSocket.on('connected', (data: any) => {
        expect(data).toEqual(testEvent);
        done();
      });

      websocketService.broadcast('connected', testEvent);
    });

    it('should broadcast to specific rooms', (done) => {
      const testEvent = {
        containerId: 'test-container',
        containerName: 'test-name',
        timestamp: new Date().toISOString()
      };

      // Subscribe to containers room
      clientSocket.emit('join-room', 'containers');
      
      setTimeout(() => {
        clientSocket.on('container:created', (data: any) => {
          expect(data).toEqual(testEvent);
          done();
        });

        websocketService.broadcastToRoom('containers', 'container:created', testEvent);
      }, 50);
    });

    it('should not broadcast to clients not in room', (done) => {
      const testEvent = {
        containerId: 'test-container',
        containerName: 'test-name',
        timestamp: new Date().toISOString()
      };

      let eventReceived = false;

      clientSocket.on('container:created', () => {
        eventReceived = true;
      });

      websocketService.broadcastToRoom('containers', 'container:created', testEvent);
      
      setTimeout(() => {
        expect(eventReceived).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Metrics Streaming', () => {
    it('should start metrics streaming when clients subscribe', (done) => {
      clientSocket.emit('start-metrics');
      
      setTimeout(() => {
        expect(websocketService.getClientsInRoom('metrics')).toBe(1);
        // Check if metrics streaming is active (private method, so we test indirectly)
        done();
      }, 50);
    });

    it('should stop metrics streaming when no clients are subscribed', (done) => {
      clientSocket.emit('start-metrics');
      
      setTimeout(() => {
        clientSocket.emit('stop-metrics');
        
        setTimeout(() => {
          expect(websocketService.getClientsInRoom('metrics')).toBe(0);
          done();
        }, 50);
      }, 50);
    });
  });

  describe('Error Handling', () => {
    it('should handle socket errors gracefully', (done) => {
      clientSocket.on('error', (errorData: any) => {
        expect(errorData).toHaveProperty('timestamp');
        expect(errorData).toHaveProperty('error');
        expect(errorData.error).toHaveProperty('code');
        expect(errorData.error).toHaveProperty('message');
        done();
      });

      // Simulate an error
      serverSocket.emit('error', new Error('Test error'));
    });

    it('should emit disconnection events', (done) => {
      let disconnectionEventReceived = false;

      // Listen for disconnection broadcast (this would be received by other clients)
      const originalBroadcast = websocketService.broadcast;
      websocketService.broadcast = jest.fn((event, data) => {
        if (event === 'disconnected') {
          disconnectionEventReceived = true;
          expect(data).toHaveProperty('timestamp');
          expect(data).toHaveProperty('clientId');
          expect(data).toHaveProperty('reason');
        }
        originalBroadcast.call(websocketService, event, data);
      });

      clientSocket.disconnect();
      
      setTimeout(() => {
        expect(disconnectionEventReceived).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Event Emitter Integration', () => {
    it('should emit metrics collection events', (done) => {
      websocketService.on('metrics:collect', () => {
        done();
      });

      websocketService.startMetricsStreaming();
      
      // Wait for first metrics collection event
      setTimeout(() => {
        websocketService.stopMetricsStreaming();
      }, 6000); // Metrics collect every 5 seconds
    }, 10000);

    it('should handle metrics collection events', (done) => {
      let eventEmitted = false;

      websocketService.on('metrics:collect', () => {
        eventEmitted = true;
      });

      websocketService.startMetricsStreaming();
      
      setTimeout(() => {
        websocketService.stopMetricsStreaming();
        expect(eventEmitted).toBe(true);
        done();
      }, 6000);
    }, 10000);
  });
});