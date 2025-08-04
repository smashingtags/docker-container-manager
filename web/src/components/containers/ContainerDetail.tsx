import React, { useState, useEffect, useCallback } from 'react';
import { Container, ContainerStats } from '../../types';
import { containerService } from '../../services';

interface ContainerDetailProps {
  container: Container;
  onAction: (containerId: string, action: string) => void;
  onClose: () => void;
  onEdit: (container: Container) => void;
}

const ContainerDetail: React.FC<ContainerDetailProps> = ({
  container,
  onAction,
  onClose,
  onEdit
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'stats' | 'config'>('overview');
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<ContainerStats | null>(container.stats || null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const containerLogs = await containerService.getContainerLogs(container.id, { tail: 100 });
      setLogs(containerLogs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [container.id]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const containerStats = await containerService.getContainerStats(container.id);
      setStats(containerStats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, [container.id]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, container.id, fetchLogs, fetchStats]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'restarting':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'logs', name: 'Logs', icon: '📝' },
    { id: 'stats', name: 'Stats', icon: '📈' },
    { id: 'config', name: 'Configuration', icon: '⚙️' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${getStatusColor(container.status)}`}></div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{container.name}</h2>
              <p className="text-sm text-gray-500">{container.image}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(container)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3 mb-6">
          {container.status === 'stopped' ? (
            <button
              onClick={() => onAction(container.id, 'start')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Start Container
            </button>
          ) : (
            <button
              onClick={() => onAction(container.id, 'stop')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Stop Container
            </button>
          )}
          <button
            onClick={() => onAction(container.id, 'restart')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Restart
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this container?')) {
                onAction(container.id, 'delete');
                onClose();
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="min-h-96">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Container Info</h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="text-sm text-gray-900 capitalize">{container.status}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Image</dt>
                      <dd className="text-sm text-gray-900">{container.image}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-sm text-gray-900">{formatDate(container.created)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Container ID</dt>
                      <dd className="text-sm text-gray-900 font-mono">{container.id.substring(0, 12)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Resource usage */}
                {stats && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Resource Usage</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">CPU Usage</dt>
                        <dd className="text-sm text-gray-900">{stats.cpu.toFixed(2)}%</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Memory Usage</dt>
                        <dd className="text-sm text-gray-900">
                          {formatBytes(stats.memory.usage)} / {formatBytes(stats.memory.limit)} ({stats.memory.percentage.toFixed(1)}%)
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Network RX</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.network.rxBytes)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Network TX</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.network.txBytes)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

              {/* Ports */}
              {container.ports.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Port Mappings</h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host Port</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Container Port</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Protocol</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {container.ports.map((port, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{port.hostPort}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{port.containerPort}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{port.protocol}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{port.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Volumes */}
              {container.volumes.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Volume Mounts</h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host Path</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Container Path</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {container.volumes.map((volume, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{volume.hostPath}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{volume.containerPath}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{volume.mode}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{volume.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Container Logs</h3>
                <button
                  onClick={fetchLogs}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                ) : (
                  <div className="text-gray-500">No logs available</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Performance Statistics</h3>
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">CPU & Memory</h4>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">CPU Usage</dt>
                        <dd className="text-sm text-gray-900">{stats.cpu.toFixed(2)}%</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Memory Usage</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.memory.usage)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Memory Limit</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.memory.limit)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Memory Percentage</dt>
                        <dd className="text-sm text-gray-900">{stats.memory.percentage.toFixed(1)}%</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Network & Disk</h4>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Network RX</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.network.rxBytes)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Network TX</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.network.txBytes)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Disk Read</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.disk.readBytes)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Disk Write</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(stats.disk.writeBytes)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No statistics available
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Container Configuration</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                  {JSON.stringify({
                    id: container.id,
                    name: container.name,
                    image: container.image,
                    status: container.status,
                    created: container.created,
                    ports: container.ports,
                    volumes: container.volumes
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContainerDetail;