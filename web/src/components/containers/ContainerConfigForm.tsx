import React, { useState, useEffect } from 'react';
import { Container, ContainerConfig, PortMapping, VolumeMapping } from '../../types';

interface ContainerConfigFormProps {
  container?: Container;
  onSave: (config: ContainerConfig) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const ContainerConfigForm: React.FC<ContainerConfigFormProps> = ({
  container,
  onSave,
  onCancel,
  isEditing = false
}) => {
  const [config, setConfig] = useState<ContainerConfig>({
    id: container?.id || '',
    name: container?.name || '',
    image: container?.image || '',
    tag: 'latest',
    environment: {},
    ports: container?.ports || [],
    volumes: container?.volumes || [],
    networks: [],
    restartPolicy: { name: 'unless-stopped' },
    resources: {},
    healthCheck: undefined,
    security: undefined
  });

  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newPort, setNewPort] = useState<Partial<PortMapping>>({
    hostPort: 0,
    containerPort: 0,
    protocol: 'tcp'
  });
  const [newVolume, setNewVolume] = useState<Partial<VolumeMapping>>({
    hostPath: '',
    containerPath: '',
    mode: 'rw'
  });

  useEffect(() => {
    if (container) {
      setConfig(prev => ({
        ...prev,
        id: container.id,
        name: container.name,
        image: container.image,
        ports: container.ports,
        volumes: container.volumes
      }));
    }
  }, [container]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const addEnvironmentVariable = () => {
    if (newEnvKey && newEnvValue) {
      setConfig(prev => ({
        ...prev,
        environment: {
          ...prev.environment,
          [newEnvKey]: newEnvValue
        }
      }));
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvironmentVariable = (key: string) => {
    setConfig(prev => {
      const newEnv = { ...prev.environment };
      delete newEnv[key];
      return { ...prev, environment: newEnv };
    });
  };

  const addPort = () => {
    if (newPort.hostPort && newPort.containerPort) {
      setConfig(prev => ({
        ...prev,
        ports: [...prev.ports, newPort as PortMapping]
      }));
      setNewPort({ hostPort: 0, containerPort: 0, protocol: 'tcp' });
    }
  };

  const removePort = (index: number) => {
    setConfig(prev => ({
      ...prev,
      ports: prev.ports.filter((_, i) => i !== index)
    }));
  };

  const addVolume = () => {
    if (newVolume.hostPath && newVolume.containerPath) {
      setConfig(prev => ({
        ...prev,
        volumes: [...prev.volumes, newVolume as VolumeMapping]
      }));
      setNewVolume({ hostPath: '', containerPath: '', mode: 'rw' });
    }
  };

  const removeVolume = (index: number) => {
    setConfig(prev => ({
      ...prev,
      volumes: prev.volumes.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Container Configuration' : 'Create New Container'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Configuration */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Container Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Docker Image
                </label>
                <input
                  type="text"
                  value={config.image}
                  onChange={(e) => setConfig(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="nginx:latest"
                  required
                />
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Environment Variables</h3>
            
            {/* Existing environment variables */}
            {Object.entries(config.environment).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(config.environment).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <span className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm">
                      <span className="font-medium">{key}</span> = {value}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEnvironmentVariable(key)}
                      className="px-2 py-2 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new environment variable */}
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Variable name"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Variable value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addEnvironmentVariable}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
          </div>

          {/* Port Mappings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Port Mappings</h3>
            
            {/* Existing ports */}
            {config.ports.length > 0 && (
              <div className="mb-4 space-y-2">
                {config.ports.map((port, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm">
                      {port.hostPort}:{port.containerPort}/{port.protocol}
                      {port.description && <span className="text-gray-500 ml-2">({port.description})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePort(index)}
                      className="px-2 py-2 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new port */}
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Host port"
                value={newPort.hostPort || ''}
                onChange={(e) => setNewPort(prev => ({ ...prev, hostPort: parseInt(e.target.value) || 0 }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Container port"
                value={newPort.containerPort || ''}
                onChange={(e) => setNewPort(prev => ({ ...prev, containerPort: parseInt(e.target.value) || 0 }))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={newPort.protocol}
                onChange={(e) => setNewPort(prev => ({ ...prev, protocol: e.target.value as 'tcp' | 'udp' }))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newPort.description || ''}
                onChange={(e) => setNewPort(prev => ({ ...prev, description: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addPort}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
          </div>

          {/* Volume Mappings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Volume Mappings</h3>
            
            {/* Existing volumes */}
            {config.volumes.length > 0 && (
              <div className="mb-4 space-y-2">
                {config.volumes.map((volume, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-mono">
                      {volume.hostPath}:{volume.containerPath} ({volume.mode})
                      {volume.description && <span className="text-gray-500 ml-2 font-sans">({volume.description})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVolume(index)}
                      className="px-2 py-2 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new volume */}
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Host path"
                value={newVolume.hostPath}
                onChange={(e) => setNewVolume(prev => ({ ...prev, hostPath: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <input
                type="text"
                placeholder="Container path"
                value={newVolume.containerPath}
                onChange={(e) => setNewVolume(prev => ({ ...prev, containerPath: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <select
                value={newVolume.mode}
                onChange={(e) => setNewVolume(prev => ({ ...prev, mode: e.target.value as 'ro' | 'rw' }))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="rw">RW</option>
                <option value="ro">RO</option>
              </select>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newVolume.description || ''}
                onChange={(e) => setNewVolume(prev => ({ ...prev, description: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addVolume}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
          </div>

          {/* Restart Policy */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Restart Policy</h3>
            <select
              value={config.restartPolicy.name}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                restartPolicy: { ...prev.restartPolicy, name: e.target.value as any }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="no">No</option>
              <option value="always">Always</option>
              <option value="unless-stopped">Unless Stopped</option>
              <option value="on-failure">On Failure</option>
            </select>
          </div>

          {/* Form actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isEditing ? 'Save Changes' : 'Create Container'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContainerConfigForm;