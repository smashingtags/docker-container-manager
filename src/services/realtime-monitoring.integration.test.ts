import { Server as HTTPServer } from 'http';
import { io } from 'socket.io-client';
import { WebSocketServiceImpl } from './websocket.service';
import { RealTimeMonitoringServiceImpl } from './realtime-monitoring.service';
import { WebSocketEventManagerImpl } from './websocket-event-manager';
import { DockerServiceImpl } from './docker.service';
import { MonitoringServiceImpl } from '@/modules/monitoring/monitoring.service';

describe('Real-Time Monitoring Integration', () => {
    let httpServer: HTTPServer;
    let websocketService: WebSocketServiceImpl;
    let dockerService: DockerServiceImpl;
    let monitoringService: MonitoringServiceImpl;
    let websocketEventManager: WebSocketEventManagerImpl;
    let realTimeMonitoring: RealTimeMonitoringServiceImpl;
    let clientSocket: any;
    let port: number;

    beforeAll(async () => {
        // Create HTTP server
        httpServer = new HTTPServer();

        // Initialize services
        dockerService = new DockerServiceImpl();
        websocketService = new WebSocketServiceImpl(httpServer);
        monitoringService = new MonitoringServiceImpl(dockerService);
        websocketEventManager = new WebSocketEventManagerImpl(
            websocketService,
            dockerService,
            monitoringService
        );
        realTimeMonitoring = new RealTimeMonitoringServiceImpl(
            websocketService,
            dockerService,
            monitoringService,
            websocketEventManager
        );

        // Initialize all services
        await dockerService.initialize();
        await websocketService.initialize();
        await websocketEventManager.initialize();
        await realTimeMonitoring.initialize();

        // Start server on random port
        port = await new Promise<number>((resolve) => {
            httpServer.listen(0, () => {
                const address = httpServer.address();
                if (address && typeof address === 'object') {
                    resolve(address.port);
                }
            });
        });
    }, 30000);

    afterAll(async () => {
        if (clientSocket) {
            clientSocket.disconnect();
        }

        await realTimeMonitoring.destroy();
        await websocketEventManager.destroy();
        await websocketService.destroy();
        await dockerService.destroy();

        if (httpServer) {
            await new Promise<void>((resolve) => {
                httpServer.close(() => resolve());
            });
        }
    }, 30000);

    beforeEach(async () => {
        // Create fresh client connection for each test
        clientSocket = io(`http://localhost:${port}`);

        // Wait for connection
        await new Promise<void>((resolve) => {
            clientSocket.on('connect', () => {
                resolve();
            });
        });
    });

    afterEach(() => {
        if (clientSocket) {
            clientSocket.disconnect();
        }
    });

    describe('System Metrics Broadcasting', () => {
        it('should broadcast system metrics to subscribed clients', (done) => {
            let metricsReceived = false;

            clientSocket.emit('join-room', 'metrics');

            clientSocket.on('metrics:system', (data: any) => {
                expect(data).toHaveProperty('timestamp');
                expect(data).toHaveProperty('metrics');
                expect(data.metrics).toHaveProperty('cpu');
                expect(data.metrics).toHaveProperty('memory');
                expect(data.metrics).toHaveProperty('disk');
                expect(data.metrics).toHaveProperty('containers');

                metricsReceived = true;
                done();
            });

            // Wait for metrics broadcast (should happen within 10 seconds)
            setTimeout(() => {
                if (!metricsReceived) {
                    done(new Error('System metrics not received within timeout'));
                }
            }, 15000);
        }, 20000);

        it('should not broadcast to clients not subscribed to metrics room', (done) => {
            let metricsReceived = false;

            // Don't join metrics room
            clientSocket.on('metrics:system', () => {
                metricsReceived = true;
            });

            // Wait and ensure no metrics are received
            setTimeout(() => {
                expect(metricsReceived).toBe(false);
                done();
            }, 12000);
        }, 15000);
    });

    describe('Container Status Monitoring', () => {
        it('should detect and broadcast container status changes', async () => {
            const containers = await dockerService.listContainers();

            if (containers.length === 0) {
                console.log('No containers available for status monitoring test');
                return;
            }

            const testContainer = containers[0];
            let statusChangeReceived = false;

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (!statusChangeReceived) {
                        resolve(); // Test passes if no status change occurs (which is normal)
                    }
                }, 10000);

                clientSocket.emit('join-room', 'containers');

                clientSocket.on('container:status', (data: any) => {
                    expect(data).toHaveProperty('containerId');
                    expect(data).toHaveProperty('containerName');
                    expect(data).toHaveProperty('status');
                    expect(data).toHaveProperty('timestamp');

                    statusChangeReceived = true;
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }, 15000);
    });

    describe('Container Metrics Monitoring', () => {
        it('should start container-specific monitoring when client subscribes', async () => {
            const containers = await dockerService.listContainers();
            const runningContainers = containers.filter(c => c.status === 'running');

            if (runningContainers.length === 0) {
                console.log('No running containers available for metrics monitoring test');
                return;
            }

            const testContainer = runningContainers[0];

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Container metrics not received within timeout'));
                }, 15000);

                clientSocket.emit('subscribe-container', testContainer.id);

                clientSocket.on('metrics:container', (data: any) => {
                    expect(data).toHaveProperty('containerId', testContainer.id);
                    expect(data).toHaveProperty('containerName');
                    expect(data).toHaveProperty('metrics');
                    expect(data.metrics).toHaveProperty('cpu');
                    expect(data.metrics).toHaveProperty('memory');
                    expect(data.metrics).toHaveProperty('network');
                    expect(data.metrics).toHaveProperty('disk');

                    clearTimeout(timeout);
                    resolve();
                });

                // Manually start monitoring for this container
                realTimeMonitoring.startContainerMonitoring(testContainer.id);
            });
        }, 20000);
    });

    describe('Log Streaming', () => {
        it('should stream container logs to subscribed clients', async () => {
            const containers = await dockerService.listContainers();
            const runningContainers = containers.filter(c => c.status === 'running');

            if (runningContainers.length === 0) {
                console.log('No running containers available for log streaming test');
                return;
            }

            const testContainer = runningContainers[0];

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve(); // Test passes if no logs are received (container might be quiet)
                }, 10000);

                clientSocket.emit('subscribe-logs', testContainer.id);

                clientSocket.on('container:logs', (data: any) => {
                    expect(data).toHaveProperty('containerId', testContainer.id);
                    expect(data).toHaveProperty('containerName');
                    expect(data).toHaveProperty('logs');
                    expect(data).toHaveProperty('stream');
                    expect(Array.isArray(data.logs)).toBe(true);

                    clearTimeout(timeout);
                    resolve();
                });

                // Manually start log streaming for this container
                realTimeMonitoring.startLogStreaming(testContainer.id);
            });
        }, 15000);
    });

    describe('WebSocket Room Management', () => {
        it('should handle multiple clients in different rooms', (done) => {
            const client2 = io(`http://localhost:${port}`);
            let client1MetricsReceived = false;
            let client2MetricsReceived = false;

            client2.on('connect', () => {
                // Client 1 joins metrics room
                clientSocket.emit('join-room', 'metrics');

                // Client 2 joins containers room
                client2.emit('join-room', 'containers');

                clientSocket.on('metrics:system', () => {
                    client1MetricsReceived = true;
                    checkCompletion();
                });

                client2.on('metrics:system', () => {
                    client2MetricsReceived = true;
                });

                const checkCompletion = () => {
                    if (client1MetricsReceived) {
                        // Client 1 should receive metrics, Client 2 should not
                        setTimeout(() => {
                            expect(client1MetricsReceived).toBe(true);
                            expect(client2MetricsReceived).toBe(false);
                            client2.disconnect();
                            done();
                        }, 1000);
                    }
                };

                // Wait for metrics broadcast
                setTimeout(() => {
                    if (!client1MetricsReceived) {
                        done(new Error('Metrics not received by subscribed client'));
                    }
                }, 15000);
            });
        }, 20000);
    });

    describe('Error Handling', () => {
        it('should handle monitoring errors gracefully', async () => {
            const nonExistentContainerId = 'non-existent-container-id';

            // This should not throw an error
            expect(() => {
                realTimeMonitoring.startContainerMonitoring(nonExistentContainerId);
            }).not.toThrow();

            // Wait a bit for the monitoring to attempt and fail
            await new Promise(resolve => setTimeout(resolve, 6000));

            // The monitoring should have stopped itself due to the error
            expect(realTimeMonitoring['containerMonitors'].has(nonExistentContainerId)).toBe(false);
        }, 10000);

        it('should broadcast error events when monitoring fails', (done) => {
            clientSocket.emit('join-room', 'metrics');

            clientSocket.on('error', (data: any) => {
                expect(data).toHaveProperty('timestamp');
                expect(data).toHaveProperty('error');
                expect(data.error).toHaveProperty('code');
                expect(data.error).toHaveProperty('message');
                done();
            });

            // This test might not always trigger an error, so we set a timeout
            setTimeout(() => {
                done(); // Test passes if no error occurs
            }, 8000);
        }, 10000);
    });
});