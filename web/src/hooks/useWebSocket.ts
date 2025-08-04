import { useEffect, useCallback, useRef } from 'react';
import { websocketService } from '../services';
import { ContainerEvent, MetricsEvent } from '../types';
import { useContainerStore } from '../stores';

export const useWebSocket = () => {
  const { updateContainer, addContainer, removeContainer } = useContainerStore();
  const isInitialized = useRef(false);

  const connect = useCallback(async () => {
    try {
      await websocketService.connect();
      
      // Join general rooms for container updates
      websocketService.joinRoom('containers');
      websocketService.joinRoom('metrics');
      
      console.log('WebSocket connected and joined rooms');
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  const subscribeToContainer = useCallback((containerId: string) => {
    websocketService.subscribeToContainer(containerId);
  }, []);

  const unsubscribeFromContainer = useCallback((containerId: string) => {
    websocketService.unsubscribeFromContainer(containerId);
  }, []);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up container event listeners
    const handleContainerEvent = (event: ContainerEvent) => {
      const { type, data } = event;
      console.log('Container event received:', type, data);
      
      switch (type) {
        case 'container:status':
          if (data.containerId && data.status) {
            updateContainer(data.containerId, { 
              status: data.status as any,
              // Update any other fields that might have changed
            });
          }
          break;
        case 'container:created':
          // Handle new container creation - would need full container data
          console.log('New container created:', data);
          break;
        case 'container:started':
          if (data.containerId) {
            updateContainer(data.containerId, { status: 'running' });
          }
          break;
        case 'container:stopped':
          if (data.containerId) {
            updateContainer(data.containerId, { status: 'stopped' });
          }
          break;
        case 'container:removed':
          if (data.containerId) {
            removeContainer(data.containerId);
          }
          break;
        case 'container:logs':
          // Handle log updates if needed
          console.log('Container logs:', data);
          break;
        default:
          console.log('Unhandled container event:', type);
          break;
      }
    };

    // Set up metrics event listeners
    const handleMetricsEvent = (event: MetricsEvent) => {
      const { type, data } = event;
      
      if (type === 'metrics:container' && data.containerId && data.metrics) {
        updateContainer(data.containerId, { stats: data.metrics });
      } else if (type === 'metrics:system') {
        // Handle system-wide metrics if needed
        console.log('System metrics:', data);
      }
    };

    websocketService.onContainerEvent(handleContainerEvent);
    websocketService.onMetricsEvent(handleMetricsEvent);

    return () => {
      websocketService.disconnect();
      isInitialized.current = false;
    };
  }, [updateContainer, addContainer, removeContainer]);

  return {
    connect,
    disconnect,
    isConnected: websocketService.isConnected,
    joinRoom: websocketService.joinRoom.bind(websocketService),
    leaveRoom: websocketService.leaveRoom.bind(websocketService),
    subscribeToContainer,
    unsubscribeFromContainer,
    setMetricsInterval: websocketService.setMetricsInterval.bind(websocketService),
  };
};