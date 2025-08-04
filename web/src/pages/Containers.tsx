import React, { useState, useEffect } from 'react';
import { useContainers, useWebSocket } from '../hooks';
import { Container, ContainerConfig } from '../types';
import { ContainerList, ContainerDetail, ContainerConfigForm } from '../components/containers';

const Containers: React.FC = () => {
  const { 
    containers, 
    loading, 
    error, 
    startContainer, 
    stopContainer, 
    restartContainer, 
    deleteContainer,
    createContainer,
    selectContainer,
    selectedContainer,
    clearError
  } = useContainers();

  const { connect, disconnect, subscribeToContainer, unsubscribeFromContainer } = useWebSocket();

  const [showDetail, setShowDetail] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);

  // Connect to WebSocket on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Subscribe to container updates when a container is selected
  useEffect(() => {
    if (selectedContainer) {
      subscribeToContainer(selectedContainer.id);
      return () => unsubscribeFromContainer(selectedContainer.id);
    }
  }, [selectedContainer, subscribeToContainer, unsubscribeFromContainer]);

  const handleAction = async (containerId: string, action: string) => {
    switch (action) {
      case 'start':
        await startContainer(containerId);
        break;
      case 'stop':
        await stopContainer(containerId);
        break;
      case 'restart':
        await restartContainer(containerId);
        break;
      case 'delete':
        if (window.confirm('Are you sure you want to delete this container?')) {
          await deleteContainer(containerId);
          if (selectedContainer?.id === containerId) {
            setShowDetail(false);
            selectContainer(null);
          }
        }
        break;
    }
  };

  const handleSelectContainer = (container: Container | null) => {
    selectContainer(container);
    if (container) {
      setShowDetail(true);
    } else {
      setShowDetail(false);
    }
  };

  const handleEditContainer = (container: Container) => {
    setEditingContainer(container);
    setShowConfigForm(true);
    setShowDetail(false);
  };

  const handleCreateContainer = () => {
    setEditingContainer(null);
    setShowConfigForm(true);
  };

  const handleSaveConfig = async (config: ContainerConfig) => {
    try {
      if (editingContainer) {
        // For editing, we would need an update API endpoint
        // For now, just close the form
        console.log('Update container config:', config);
      } else {
        // Create new container
        await createContainer(config);
      }
      setShowConfigForm(false);
      setEditingContainer(null);
    } catch (error) {
      console.error('Failed to save container config:', error);
    }
  };

  const handleCancelConfig = () => {
    setShowConfigForm(false);
    setEditingContainer(null);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    selectContainer(null);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading containers</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={clearError}
                  className="bg-red-100 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Containers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your Docker containers
          </p>
        </div>
        <button
          onClick={handleCreateContainer}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Container
        </button>
      </div>

      {/* Container list */}
      <ContainerList
        containers={containers}
        onAction={handleAction}
        onSelectContainer={handleSelectContainer}
        selectedContainer={selectedContainer}
        loading={loading}
      />

      {/* Container detail modal */}
      {showDetail && selectedContainer && (
        <ContainerDetail
          container={selectedContainer}
          onAction={handleAction}
          onClose={handleCloseDetail}
          onEdit={handleEditContainer}
        />
      )}

      {/* Container configuration form modal */}
      {showConfigForm && (
        <ContainerConfigForm
          container={editingContainer || undefined}
          onSave={handleSaveConfig}
          onCancel={handleCancelConfig}
          isEditing={!!editingContainer}
        />
      )}
    </div>
  );
};

export default Containers;