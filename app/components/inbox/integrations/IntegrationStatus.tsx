'use client';

import { useState } from 'react';
import { Id } from '@/convex/_generated/dataModel';

interface Integration {
  _id: Id<'integrations'>;
  platform: 'notion' | 'asana' | 'clickup';
  name: string;
  isActive: boolean;
  configuration: any;
  lastSyncAt?: number;
  syncStatus?: 'success' | 'error' | 'pending';
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

interface IntegrationStatusProps {
  integration: Integration;
  onTest: () => void;
  onSync: () => void;
  onDeactivate: () => void;
  isTesting: boolean;
}

export function IntegrationStatus({
  integration,
  onTest,
  onSync,
  onDeactivate,
  isTesting,
}: IntegrationStatusProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'notion':
        return '📝';
      case 'asana':
        return '✅';
      case 'clickup':
        return '📋';
      default:
        return '🔗';
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">
            {getPlatformIcon(integration.platform)}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">{integration.name}</h4>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  integration.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {integration.isActive ? 'Active' : 'Inactive'}
              </span>
              {integration.syncStatus && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                    integration.syncStatus
                  )}`}
                >
                  {integration.syncStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={onSync}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Sync
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
          <button
            onClick={onDeactivate}
            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
          >
            Deactivate
          </button>
        </div>
      </div>

      {/* Details Section */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Last Sync:</span>
              <span className="ml-2 text-gray-600">
                {formatLastSync(integration.lastSyncAt)}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-600">
                {new Date(integration.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Updated:</span>
              <span className="ml-2 text-gray-600">
                {new Date(integration.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Platform:</span>
              <span className="ml-2 text-gray-600 capitalize">
                {integration.platform}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {integration.syncStatus === 'error' && integration.errorMessage && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {integration.errorMessage}
              </p>
            </div>
          )}

          {/* Configuration Preview (masked) */}
          <div className="mt-3">
            <span className="font-medium text-gray-700">Configuration:</span>
            <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
              {Object.keys(integration.configuration || {}).length > 0 ? (
                <div>
                  {Object.keys(integration.configuration).map((key) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{'*'.repeat(8)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                'No configuration'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
