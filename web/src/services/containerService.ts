import { apiClient } from './api';
import { Container, ContainerConfig, ContainerStats } from '../types';

export class ContainerService {
  async getContainers(): Promise<Container[]> {
    const response = await apiClient.get<Container[]>('/containers');
    return response.data || [];
  }

  async getContainer(id: string): Promise<Container> {
    const response = await apiClient.get<Container>(`/containers/${id}`);
    if (!response.data) {
      throw new Error('Container not found');
    }
    return response.data;
  }

  async createContainer(config: ContainerConfig): Promise<Container> {
    const response = await apiClient.post<Container>('/containers', config);
    if (!response.data) {
      throw new Error('Failed to create container');
    }
    return response.data;
  }

  async startContainer(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/start`);
  }

  async stopContainer(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/stop`);
  }

  async restartContainer(id: string): Promise<void> {
    await apiClient.post(`/containers/${id}/restart`);
  }

  async removeContainer(id: string): Promise<void> {
    await apiClient.delete(`/containers/${id}`);
  }

  async getContainerLogs(id: string, options?: { tail?: number; since?: string }): Promise<string[]> {
    const response = await apiClient.get<string[]>(`/containers/${id}/logs`, options);
    return response.data || [];
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    const response = await apiClient.get<ContainerStats>(`/containers/${id}/stats`);
    if (!response.data) {
      throw new Error('Failed to get container stats');
    }
    return response.data;
  }

  async bulkAction(containerIds: string[], action: 'start' | 'stop' | 'restart' | 'remove'): Promise<void> {
    await apiClient.post('/containers/bulk', {
      containerIds,
      action
    });
  }
}

export const containerService = new ContainerService();