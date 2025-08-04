import React from 'react';
import { Container } from '../../types';

interface ContainerCardProps {
  container: Container;
  onAction: (containerId: string, action: string) => void;
  onSelect: (container: Container) => void;
  isSelected?: boolean;
}

const ContainerCard: React.FC<ContainerCardProps> = ({
  container,
  onAction,
  onSelect,
  isSelected = false
}) => {
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'restarting':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onSelect(container)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(container.status)}`}></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{container.name}</h3>
              <p className="text-sm text-gray-500">{container.image}</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(container.status)}`}>
            {container.status}
          </span>
        </div>

        {/* Stats */}
        {container.stats && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">CPU</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {container.stats.cpu.toFixed(1)}%
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Memory</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {container.stats.memory.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* Ports */}
        {container.ports.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ports</div>
            <div className="flex flex-wrap gap-2">
              {container.ports.slice(0, 3).map((port, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  {port.hostPort}:{port.containerPort}/{port.protocol}
                </span>
              ))}
              {container.ports.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                  +{container.ports.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Created date */}
        <div className="text-xs text-gray-500 mb-4">
          Created {formatDate(container.created)}
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {container.status === 'stopped' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(container.id, 'start');
              }}
              className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Start
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(container.id, 'stop');
              }}
              className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Stop
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction(container.id, 'restart');
            }}
            className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContainerCard;