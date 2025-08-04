import { apiClient } from './api';
import { AppTemplate, AppCategory, DeployConfig, PaginatedResponse, SearchParams } from '../types';

export class AppService {
  async getApps(params?: SearchParams): Promise<PaginatedResponse<AppTemplate>> {
    const response = await apiClient.get<PaginatedResponse<AppTemplate>>('/apps', params);
    return response.data || { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
  }

  async getApp(id: string): Promise<AppTemplate> {
    const response = await apiClient.get<AppTemplate>(`/apps/${id}`);
    if (!response.data) {
      throw new Error('App not found');
    }
    return response.data;
  }

  async getCategories(): Promise<AppCategory[]> {
    const response = await apiClient.get<AppCategory[]>('/apps/categories');
    return response.data || [];
  }

  async searchApps(query: string, filters?: Partial<SearchParams>): Promise<AppTemplate[]> {
    const params = { query, ...filters };
    const response = await apiClient.get<PaginatedResponse<AppTemplate>>('/apps', params);
    return response.data?.data || [];
  }

  async deployApp(appId: string, config: DeployConfig): Promise<any> {
    const response = await apiClient.post(`/apps/${appId}/deploy`, config);
    return response.data;
  }

  async getPopularApps(limit: number = 10): Promise<AppTemplate[]> {
    const response = await apiClient.get<AppTemplate[]>('/apps/popular', { limit });
    return response.data || [];
  }

  async getRecentApps(limit: number = 10): Promise<AppTemplate[]> {
    const response = await apiClient.get<AppTemplate[]>('/apps/recent', { limit });
    return response.data || [];
  }

  async validateTemplate(template: Partial<AppTemplate>): Promise<boolean> {
    const response = await apiClient.post<{ valid: boolean }>('/apps/validate', template);
    return response.data?.valid || false;
  }
}

export const appService = new AppService();