import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores';
import { appService } from '../services';
import { AppTemplate, DeployConfig, SearchParams } from '../types';

export const useApps = () => {
  const {
    apps,
    categories,
    selectedApp,
    selectedCategory,
    searchQuery,
    loading,
    error,
    setApps,
    setCategories,
    setSelectedApp,
    setSelectedCategory,
    setSearchQuery,
    setLoading,
    setError,
    clearError,
    getFilteredApps
  } = useAppStore();

  const fetchApps = useCallback(async (params?: SearchParams) => {
    try {
      setLoading(true);
      clearError();
      const response = await appService.getApps(params);
      setApps(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch apps');
    } finally {
      setLoading(false);
    }
  }, [setApps, setLoading, setError, clearError]);

  const fetchCategories = useCallback(async () => {
    try {
      const fetchedCategories = await appService.getCategories();
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, [setCategories]);

  const searchApps = useCallback(async (query: string, filters?: Partial<SearchParams>) => {
    try {
      setLoading(true);
      clearError();
      const results = await appService.searchApps(query, filters);
      setApps(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search apps');
    } finally {
      setLoading(false);
    }
  }, [setApps, setLoading, setError, clearError]);

  const deployApp = useCallback(async (appId: string, config: DeployConfig): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      await appService.deployApp(appId, config);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy app');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearError]);

  const selectApp = useCallback((app: AppTemplate | null) => {
    setSelectedApp(app);
  }, [setSelectedApp]);

  const selectCategory = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, [setSelectedCategory]);

  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  // Auto-fetch data on mount
  useEffect(() => {
    fetchApps();
    fetchCategories();
  }, [fetchApps, fetchCategories]);

  // Filter apps when search query or category changes
  const filteredApps = getFilteredApps();

  return {
    apps,
    categories,
    selectedApp,
    selectedCategory,
    searchQuery,
    loading,
    error,
    filteredApps,
    fetchApps,
    searchApps,
    deployApp,
    selectApp,
    selectCategory,
    updateSearchQuery,
    clearError
  };
};