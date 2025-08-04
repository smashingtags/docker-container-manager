import { create } from 'zustand';
import { Container, ContainerConfig } from '../types';

interface ContainerState {
  containers: Container[];
  selectedContainer: Container | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setContainers: (containers: Container[]) => void;
  addContainer: (container: Container) => void;
  updateContainer: (id: string, updates: Partial<Container>) => void;
  removeContainer: (id: string) => void;
  setSelectedContainer: (container: Container | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useContainerStore = create<ContainerState>((set, get) => ({
  containers: [],
  selectedContainer: null,
  loading: false,
  error: null,

  setContainers: (containers) => set({ containers }),
  
  addContainer: (container) => set((state) => ({
    containers: [...state.containers, container]
  })),
  
  updateContainer: (id, updates) => set((state) => ({
    containers: state.containers.map(container =>
      container.id === id ? { ...container, ...updates } : container
    ),
    selectedContainer: state.selectedContainer?.id === id 
      ? { ...state.selectedContainer, ...updates }
      : state.selectedContainer
  })),
  
  removeContainer: (id) => set((state) => ({
    containers: state.containers.filter(container => container.id !== id),
    selectedContainer: state.selectedContainer?.id === id ? null : state.selectedContainer
  })),
  
  setSelectedContainer: (container) => set({ selectedContainer: container }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  clearError: () => set({ error: null })
}));