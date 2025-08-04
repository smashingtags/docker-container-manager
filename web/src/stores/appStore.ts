import { create } from 'zustand';
import { AppTemplate, AppCategory } from '../types';

interface AppStoreState {
  apps: AppTemplate[];
  categories: AppCategory[];
  selectedApp: AppTemplate | null;
  selectedCategory: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  
  // Actions
  setApps: (apps: AppTemplate[]) => void;
  setCategories: (categories: AppCategory[]) => void;
  setSelectedApp: (app: AppTemplate | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Computed getters
  getFilteredApps: () => AppTemplate[];
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  apps: [],
  categories: [],
  selectedApp: null,
  selectedCategory: null,
  searchQuery: '',
  loading: false,
  error: null,

  setApps: (apps) => set({ apps }),
  
  setCategories: (categories) => set({ categories }),
  
  setSelectedApp: (app) => set({ selectedApp: app }),
  
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  clearError: () => set({ error: null }),
  
  getFilteredApps: () => {
    const { apps, selectedCategory, searchQuery } = get();
    
    let filtered = apps;
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(app => app.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }
}));