import { ContainerServiceImpl } from './container.service';
import { DockerServiceImpl } from '@/services/docker.service';
import { ContainerConfig } from '@/types/container.types';

// Integration tests that test the container service with a real Docker service
// These tests require Docker to be running and are skipped in CI environments
describe('ContainerService Integration', () => {
  let containerService: ContainerServiceImpl;
  let dockerService: DockerServiceImpl;
  
  const testContainerConfig: ContainerConfig = {
    id: 'test-integration-container',
    name: 'test-integration-container',
    image: 'hello-world',
    tag: 'latest',
    environment: {},
    ports: [],
    volumes: [],
    networks: ['bridge'],
    restartPolicy: 'no',
    resources: {
      memory: 128,
      cpus: 0.1
    }
  };

  beforeAll(async () => {
    // Skip integration tests if Docker is not available
    dockerService = new DockerServiceImpl();
    
    try {
      await dockerService.initialize();
      containerService = new ContainerServiceImpl(dockerService);
    } catch (error) {
      console.log('Docker not available, skipping integration tests');
      return;
    }
  });

  afterAll(async () => {
    if (dockerService) {
      // Clean up any test containers
      try {
        const containers = await dockerService.listContainers();
        const testContainers = containers.filter(c => 
          c.name.includes('test-integration')
        );
        
        for (const container of testContainers) {
          try {
            await dockerService.removeContainer(container.id);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      
      await dockerService.destroy();
    }
  });

  // Skip all tests if Docker is not available
  const itSkipIfNoDocker = process.env['CI'] ? it.skip : it;

  describe('container lifecycle operations', () => {
    itSkipIfNoDocker('should create, start, stop, and remove a container', async () => {
      if (!containerService) {
        return;
      }

      // Create container
      const createdContainer = await containerService.create(testContainerConfig);
      expect(createdContainer.name).toBe(testContainerConfig.name);
      expect(createdContainer.status).toBe('created');

      // Start container
      await containerService.start(createdContainer.id);
      
      // Wait a moment for container to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check container is running by listing containers
      const containers = await containerService.list();
      const runningContainer = containers.find(c => c.id === createdContainer.id);
      expect(runningContainer).toBeDefined();
      
      // Stop container
      await containerService.stop(createdContainer.id);
      
      // Remove container
      await containerService.remove(createdContainer.id);
      
      // Verify container is removed
      const finalContainers = await containerService.list();
      const removedContainer = finalContainers.find(c => c.id === createdContainer.id);
      expect(removedContainer).toBeUndefined();
    }, 30000); // 30 second timeout for Docker operations

    itSkipIfNoDocker('should get container logs', async () => {
      if (!containerService) {
        return;
      }

      // Create and start a container that produces logs
      const logTestConfig = {
        ...testContainerConfig,
        name: 'test-logs-container',
        image: 'alpine',
        tag: 'latest',
        command: ['echo', 'Hello from container logs test']
      };

      const container = await containerService.create(logTestConfig);
      await containerService.start(container.id);
      
      // Wait for container to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get logs
      const logs = await containerService.getLogs(container.id);
      expect(logs.length).toBeGreaterThan(0);
      
      // Clean up
      await containerService.remove(container.id);
    }, 30000);

    itSkipIfNoDocker('should handle container name conflicts', async () => {
      if (!containerService) {
        return;
      }

      // Create first container
      const container1 = await containerService.create(testContainerConfig);
      
      // Try to create second container with same name
      await expect(containerService.create(testContainerConfig))
        .rejects.toThrow('already exists');
      
      // Clean up
      await containerService.remove(container1.id);
    }, 30000);
  });

  describe('error handling', () => {
    itSkipIfNoDocker('should handle invalid container operations', async () => {
      if (!containerService) {
        return;
      }

      const invalidContainerId = 'non-existent-container-id';
      
      // Try to start non-existent container
      await expect(containerService.start(invalidContainerId))
        .rejects.toThrow();
      
      // Try to stop non-existent container
      await expect(containerService.stop(invalidContainerId))
        .rejects.toThrow();
      
      // Try to get logs from non-existent container
      await expect(containerService.getLogs(invalidContainerId))
        .rejects.toThrow();
    }, 15000);

    itSkipIfNoDocker('should handle invalid container configuration', async () => {
      if (!containerService) {
        return;
      }

      const invalidConfig = {
        ...testContainerConfig,
        name: '', // Invalid empty name
        image: '' // Invalid empty image
      };

      await expect(containerService.create(invalidConfig))
        .rejects.toThrow('Invalid container configuration');
    }, 15000);
  });

  describe('real-time monitoring capabilities', () => {
    itSkipIfNoDocker('should provide container status updates', async () => {
      if (!containerService) {
        return;
      }

      // Create container
      const container = await containerService.create(testContainerConfig);
      
      // Check initial status
      let containers = await containerService.list();
      let currentContainer = containers.find(c => c.id === container.id);
      expect(currentContainer?.status).toBe('created');
      
      // Start container
      await containerService.start(container.id);
      
      // Wait and check status again
      await new Promise(resolve => setTimeout(resolve, 1000));
      containers = await containerService.list();
      currentContainer = containers.find(c => c.id === container.id);
      
      // Container should have completed (hello-world exits immediately)
      expect(['running', 'exited']).toContain(currentContainer?.status);
      
      // Clean up
      await containerService.remove(container.id);
    }, 30000);
  });
});