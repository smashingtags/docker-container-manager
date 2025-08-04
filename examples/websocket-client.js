// Example WebSocket client for Docker Container Manager
// This demonstrates how to connect and subscribe to real-time updates

const io = require('socket.io-client');

class DockerContainerManagerClient {
  constructor(serverUrl = 'http://localhost:3001') {
    this.socket = io(serverUrl);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to Docker Container Manager');
      console.log('Client ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
    });

    this.socket.on('connected', (data) => {
      console.log('🔗 Connection confirmed:', data);
    });

    // Container events
    this.socket.on('container:status', (data) => {
      console.log('📦 Container status changed:', {
        container: data.containerName,
        status: `${data.previousStatus} → ${data.status}`,
        time: new Date(data.timestamp).toLocaleTimeString()
      });
    });

    this.socket.on('container:created', (data) => {
      console.log('🆕 Container created:', data.containerName);
    });

    this.socket.on('container:started', (data) => {
      console.log('▶️ Container started:', data.containerName);
    });

    this.socket.on('container:stopped', (data) => {
      console.log('⏹️ Container stopped:', data.containerName);
    });

    this.socket.on('container:removed', (data) => {
      console.log('🗑️ Container removed:', data.containerName);
    });

    // Metrics events
    this.socket.on('metrics:system', (data) => {
      console.log('📊 System metrics:', {
        cpu: `${data.metrics.cpu.usage.toFixed(1)}%`,
        memory: `${data.metrics.memory.percentage.toFixed(1)}%`,
        containers: `${data.metrics.containers.running}/${data.metrics.containers.total} running`,
        time: new Date(data.timestamp).toLocaleTimeString()
      });
    });

    this.socket.on('metrics:container', (data) => {
      console.log('📈 Container metrics:', {
        container: data.containerName,
        cpu: `${data.metrics.cpu.toFixed(1)}%`,
        memory: `${data.metrics.memory.percentage.toFixed(1)}%`,
        time: new Date(data.timestamp).toLocaleTimeString()
      });
    });

    // Log events
    this.socket.on('container:logs', (data) => {
      console.log('📝 Container logs:', {
        container: data.containerName,
        logs: data.logs.length,
        time: new Date(data.timestamp).toLocaleTimeString()
      });
      
      // Print actual log lines
      data.logs.forEach(log => {
        console.log(`   ${data.containerName}: ${log}`);
      });
    });

    // Error events
    this.socket.on('error', (data) => {
      console.error('❌ Error:', data.error.message);
    });
  }

  // Subscribe to general container updates
  subscribeToContainers() {
    console.log('🔔 Subscribing to container updates...');
    this.socket.emit('join-room', 'containers');
  }

  // Subscribe to system metrics
  subscribeToMetrics() {
    console.log('📊 Subscribing to system metrics...');
    this.socket.emit('start-metrics');
  }

  // Subscribe to specific container updates
  subscribeToContainer(containerId) {
    console.log(`🔔 Subscribing to container: ${containerId}`);
    this.socket.emit('subscribe-container', containerId);
  }

  // Subscribe to container logs
  subscribeToLogs(containerId) {
    console.log(`📝 Subscribing to logs: ${containerId}`);
    this.socket.emit('subscribe-logs', containerId);
  }

  // Unsubscribe from metrics
  unsubscribeFromMetrics() {
    console.log('🔕 Unsubscribing from metrics...');
    this.socket.emit('stop-metrics');
  }

  // Disconnect
  disconnect() {
    console.log('👋 Disconnecting...');
    this.socket.disconnect();
  }
}

// Example usage
if (require.main === module) {
  console.log('🚀 Starting Docker Container Manager WebSocket Client Example');
  console.log('Press Ctrl+C to exit\n');

  const client = new DockerContainerManagerClient();

  // Subscribe to different types of updates
  setTimeout(() => {
    client.subscribeToContainers();
    client.subscribeToMetrics();
  }, 1000);

  // Example: Subscribe to specific container (replace with actual container ID)
  // setTimeout(() => {
  //   client.subscribeToContainer('your-container-id-here');
  //   client.subscribeToLogs('your-container-id-here');
  // }, 2000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    client.disconnect();
    process.exit(0);
  });
}

module.exports = DockerContainerManagerClient;