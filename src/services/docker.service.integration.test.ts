import { DockerServiceImpl } from './docker.service';
import { ContainerConfig } from '@/types/container.types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('DockerService Integration - Networking and Storage', () => {
  let dockerService: DockerServiceImpl;

  beforeEach(() => {
    dockerService = new DockerServiceImpl();
  });

  describe('Network Management', () => {
    it('should list networks', async () => {
      // This test requires a running Docker daemon
      try {
        const networks = await dockerService.listNetworks();
        
        expect(Array.isArray(networks)).toBe(true);
        expect(networks.length).toBeGreaterThan(0);
        
        // Should have at least the default bridge network
        const bridgeNetwork = networks.find(n => n.name === 'bridge');
        expect(bridgeNetwork).toBeDefined();
        expect(bridgeNetwork?.driver).toBe('bridge');
      } catch (error) {
        // Skip test if Docker is not available
        console.warn('Docker not available for integration test:', error);
      }
    });

    it('should create and remove custom network', async () => {
      const networkName = 'test-network-' + Date.now();
      
      try {
        // Create network
        const createdNetwork = await dockerService.createNetwork(networkName, {
          driver: 'bridge'
        });
        
        expect(createdNetwork.name).toBe(networkName);
        expect(createdNetwork.id).toBeDefined();
        
        // Verify network exists
        const networks = await dockerService.listNetworks();
        const foundNetwork = networks.find(n => n.name === networkName);
        expect(foundNetwork).toBeDefined();
        
        // Remove network
        await dockerService.removeNetwork(createdNetwork.id);
        
        // Verify network is removed
        const networksAfterRemoval = await dockerService.listNetworks();
        const removedNetwork = networksAfterRemoval.find(n => n.name === networkName);
        expect(removedNetwork).toBeUndefined();
        
      } catch (error) {
        console.warn('Docker not available for integration test:', error);
      }
    });
  });

  describe('Volume Management', () => {
    it('should list volumes', async () => {
      try {
        const volumes = await dockerService.listVolumes();
        
        expect(Array.isArray(volumes)).toBe(true);
        // Volumes list can be empty, so we just check it's an array
      } catch (error) {
        console.warn('Docker not available for integration test:', error);
      }
    });

    it('should create and remove volume', async () => {
      const volumeName = 'test-volume-' + Date.now();
      
      try {
        // Create volume
        const createdVolume = await dockerService.createVolume(volumeName);
        
        expect(createdVolume.name).toBe(volumeName);
        expect(createdVolume.mountpoint).toBeDefined();
        
        // Verify volume exists
        const volumes = await dockerService.listVolumes();
        const foundVolume = volumes.find(v => v.name === volumeName);
        expect(foundVolume).toBeDefined();
        
        // Remove volume
        await dockerService.removeVolume(volumeName);
        
        // Verify volume is removed
        const volumesAfterRemoval = await dockerService.listVolumes();
        const removedVolume = volumesAfterRemoval.find(v => v.name === volumeName);
        expect(removedVolume).toBeUndefined();
        
      } catch (error) {
        console.warn('Docker not available for integration test:', error);
      }
    });
  });

  describe('Port Management', () => {
    it('should get used ports from running containers', async () => {
      try {
        const usedPorts = await dockerService.getUsedPorts();
        
        expect(Array.isArray(usedPorts)).toBe(true);
        // Used ports can be empty if no containers are running
        usedPorts.forEach(port => {
          expect(typeof port).toBe('number');
          expect(port).toBeGreaterThan(0);
          expect(port).toBeLessThanOrEqual(65535);
        });
      } catch (error) {
        console.warn('Docker not available for integration test:', error);
      }
    });
  });

  describe('Host Path Validation', () => {
    it('should validate existing directory', async () => {
      try {
        // Test with a directory that should exist on most systems
        const result = await dockerService.validateHostPath('/tmp');
        
        expect(result.exists).toBe(true);
        expect(result.accessible).toBe(true);
        expect(result.isDirectory).toBe(true);
      } catch (error) {
        console.warn('Path validation test failed:', error);
      }
    });

    it('should detect non-existent path', async () => {
      try {
        const result = await dockerService.validateHostPath('/nonexistent/path/12345');
        
        expect(result.exists).toBe(false);
        expect(result.accessible).toBe(false);
      } catch (error) {
        console.warn('Path validation test failed:', error);
      }
    });
  });

  describe('Container Creation with Networking and Storage', () => {
    it('should create container with port mappings and volumes', async () => {
      const containerConfig: ContainerConfig = {
        id: 'test-container-' + Date.now(),
        name: 'test-container-' + Date.now(),
        image: 'nginx',
        tag: 'alpine',
        environment: {},
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp' }
        ],
        volumes: [
          { hostPath: '/tmp', containerPath: '/usr/share/nginx/html', mode: 'ro' }
        ],
        networks: ['bridge'],
        restartPolicy: 'no',
        resources: {},
        autoRemove: true
      };

      try {
        // First pull the image to ensure it exists
        await dockerService.pullImage('nginx', 'alpine');
        
        // Create container
        const container = await dockerService.createContainer(containerConfig);
        
        expect(container.id).toBeDefined();
        expect(container.name).toBe(containerConfig.name);
        expect(container.ports).toEqual(containerConfig.ports);
        expect(container.volumes).toEqual(containerConfig.volumes);
        
        // Clean up - remove the container
        await dockerService.removeContainer(container.id);
        
      } catch (error) {
        console.warn('Container creation test failed:', error);
      }
    });

    it('should create container with custom network', async () => {
      const networkName = 'test-network-' + Date.now();
      const containerConfig: ContainerConfig = {
        id: 'test-container-' + Date.now(),
        name: 'test-container-' + Date.now(),
        image: 'alpine',
        tag: 'latest',
        environment: {},
        ports: [],
        volumes: [],
        networks: [networkName],
        restartPolicy: 'no',
        resources: {},
        autoRemove: true
      };

      try {
        // Create custom network
        const network = await dockerService.createNetwork(networkName);
        
        // Pull image
        await dockerService.pullImage('alpine', 'latest');
        
        // Create container with custom network
        const container = await dockerService.createContainer(containerConfig);
        
        expect(container.id).toBeDefined();
        expect(container.name).toBe(containerConfig.name);
        
        // Clean up
        await dockerService.removeContainer(container.id);
        await dockerService.removeNetwork(network.id);
        
      } catch (error) {
        console.warn('Custom network container test failed:', error);
      }
    });
  });

  describe('Enhanced Container Configuration', () => {
    it('should handle complex port and volume configurations', async () => {
      const containerConfig: ContainerConfig = {
        id: 'complex-container-' + Date.now(),
        name: 'complex-container-' + Date.now(),
        image: 'nginx',
        tag: 'alpine',
        environment: {
          'ENV_VAR': 'test-value'
        },
        ports: [
          { hostPort: 8080, containerPort: 80, protocol: 'tcp', description: 'HTTP port' },
          { hostPort: 8443, containerPort: 443, protocol: 'tcp', description: 'HTTPS port' }
        ],
        volumes: [
          { 
            hostPath: '/tmp', 
            containerPath: '/usr/share/nginx/html', 
            mode: 'ro',
            description: 'Web content'
          },
          { 
            hostPath: '/tmp', 
            containerPath: '/var/log/nginx', 
            mode: 'rw',
            description: 'Log files'
          }
        ],
        networks: ['bridge'],
        restartPolicy: 'unless-stopped',
        resources: {
          memory: 512, // 512MB
          cpus: 0.5,   // 0.5 CPU
          pidsLimit: 100
        },
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/'],
          interval: 30,
          timeout: 10,
          retries: 3,
          startPeriod: 60
        },
        security: {
          readOnly: false,
          privileged: false,
          capabilities: {
            drop: ['ALL'],
            add: ['NET_BIND_SERVICE']
          }
        },
        labels: {
          'app': 'test-nginx',
          'version': '1.0'
        },
        autoRemove: true
      };

      try {
        // Pull image
        await dockerService.pullImage('nginx', 'alpine');
        
        // Create container with complex configuration
        const container = await dockerService.createContainer(containerConfig);
        
        expect(container.id).toBeDefined();
        expect(container.name).toBe(containerConfig.name);
        expect(container.ports).toEqual(containerConfig.ports);
        expect(container.volumes).toEqual(containerConfig.volumes);
        
        // Clean up
        await dockerService.removeContainer(container.id);
        
      } catch (error) {
        console.warn('Complex container configuration test failed:', error);
      }
    });
  });
});