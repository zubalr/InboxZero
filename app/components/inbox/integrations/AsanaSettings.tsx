'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface AsanaSettingsProps {
  teamId: Id<'teams'>;
}

export function AsanaSettings({ teamId }: AsanaSettingsProps) {
  const [accessToken, setAccessToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const storeCredentials = useMutation(api.integrations.storeAsanaCredentials);
  const testConnection = useMutation(api.integrations.testAsanaConnection);
  const asanaIntegration = useQuery(api.integrations.getAsanaIntegration, {
    teamId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    try {
      await storeCredentials({
        teamId,
        accessToken,
        workspaceId,
        projectId,
      });

      // Test the connection after saving
      const result = await testConnection({ teamId });
      setTestResult({
        success: true,
        message: 'Asana integration configured and tested successfully!',
      });

      // Clear form
      setAccessToken('');
      setWorkspaceId('');
      setProjectId('');
    } catch (error) {
      console.error('Error configuring Asana:', error);
      setTestResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to configure Asana integration',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await testConnection({ teamId });
      setTestResult({ success: true, message: 'Connection test successful!' });
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : 'Connection test failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Asana Integration
        </h2>
        <p className="text-gray-600">
          Connect to Asana to create tasks directly from your inbox. You'll need
          an Asana Personal Access Token.
        </p>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-medium text-gray-900">Asana</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                asanaIntegration?.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {asanaIntegration?.isActive ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="accessToken"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Personal Access Token *
            </label>
            <input
              type="password"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="0/..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Create a Personal Access Token in your Asana Account Settings →
              Apps → Manage Developer Apps
            </p>
          </div>

          <div>
            <label
              htmlFor="workspaceId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Workspace ID *
            </label>
            <input
              type="text"
              id="workspaceId"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="1234567890123456"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Find your Workspace ID in the URL when viewing Asana in your
              browser
            </p>
          </div>

          <div>
            <label
              htmlFor="projectId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Default Project ID
            </label>
            <input
              type="text"
              id="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="1234567890123456 (optional)"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Default project where tasks will be created
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>

            {asanaIntegration?.isActive && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </form>

        {/* Test Result */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-md ${
              testResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <p
              className={`text-sm ${
                testResult.success ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {testResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Integration Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          How to get your Asana credentials:
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to your Asana Account Settings</li>
          <li>Click on "Apps" in the sidebar</li>
          <li>Click "Manage Developer Apps"</li>
          <li>Create a new Personal Access Token</li>
          <li>Copy the token and your workspace/project IDs</li>
        </ol>
      </div>

      {/* Current Configuration */}
      {asanaIntegration?.isActive && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Current Configuration
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Workspace ID:{' '}
              {asanaIntegration.configuration?.workspaceId || 'Not set'}
            </div>
            <div>
              Project ID:{' '}
              {asanaIntegration.configuration?.projectId || 'Not set'}
            </div>
            <div>
              Last Updated:{' '}
              {new Date(asanaIntegration.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
