import { useEffect, useCallback } from 'react';
import { useContainerStore } from '../stores';
import { containerService } from '../services';
import { Container, ContainerConfig } from '../types';

export const useContainers = () => {
  const {
    containers,
    selectedContainer,
    loading,
    error,
    setContainers,
    addContainer,
    updateContainer,
    removeContainer,
    setSelectedContainer,
    setLoading,
    setError,
    clearError
  } = useContainerStore();

  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      const fetchedContainers = await containerService.getContainers();
      setContainers(fetchedContainers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  }, [setContainers, setLoading, setError, clearError]);

  const createContainer = useCallback(async (config: ContainerConfig): Promise<Container | null> => {
    try {
      setLoading(true);
      clearError();
      const newContainer = await containerService.createContainer(config);
      addContainer(newContainer);
      return newContainer;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create container');
      return null;
    } finally {
      setLoading(false);
    }
  }, [addContainer, setLoading, setError, clearError]);

  const startContainer = useCallback(async (id: string): Promise<boolean> => {
    try {
      clearError();
      await containerService.startContainer(id);
      // Don't update status here - let WebSocket handle real-time updates
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start container');
      return false;
    }
  }, [setError, clearError]);

  const stopContainer = useCallback(async (id: string): Promise<boolean> => {
    try {
      clearError();
      await containerService.stopContainer(id);
      // Don't update status here - let WebSocket handle real-time updates
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop container');
      return false;
    }
  }, [setError, clearError]);

  const restartContainer = useCallback(async (id: string): Promise<boolean> => {
    try {
      clearError();
      await containerService.restartContainer(id);
      // Don't update status here - let WebSocket handle real-time updates
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart container');
      return false;
    }
  }, [setError, clearError]);

  const deleteContainer = useCallback(async (id: string): Promise<boolean> => {
    try {
      clearError();
      await containerService.removeContainer(id);
      // Don't remove from store here - let WebSocket handle real-time updates
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove container');
      return false;
    }
  }, [setError, clearError]);

  const selectContainer = useCallback((container: Container | null) => {
    setSelectedContainer(container);
  }, [setSelectedContainer]);

  const refreshContainer = useCallback(async (id: string) => {
    try {
      const container = await containerService.getContainer(id);
      updateContainer(id, container);
    } catch (err) {
      console.error('Failed to refresh container:', err);
    }
  }, [updateContainer]);

  // Auto-fetch containers on mount
  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  return {
    containers,
    selectedContainer,
    loading,
    error,
    fetchContainers,
    createContainer,
    startContainer,
    stopContainer,
    restartContainer,
    deleteContainer,
    selectContainer,
    refreshContainer,
    clearError
  };
};