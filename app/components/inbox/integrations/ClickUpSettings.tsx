'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface ClickUpSettingsProps {
  teamId: Id<'teams'>;
}

export function ClickUpSettings({ teamId }: ClickUpSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [teamIdValue, setTeamIdValue] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [listId, setListId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const storeCredentials = useMutation(
    api.integrations.storeClickUpCredentials
  );
  const testConnection = useMutation(api.integrations.testClickUpConnection);
  const clickupIntegration = useQuery(api.integrations.getClickUpIntegration, {
    teamId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    try {
      await storeCredentials({
        teamId,
        apiKey,
        clickupTeamId: teamIdValue,
        spaceId,
        listId,
      });

      // Test the connection after saving
      const result = await testConnection({ teamId });
      setTestResult({
        success: true,
        message: 'ClickUp integration configured and tested successfully!',
      });

      // Clear form
      setApiKey('');
      setTeamIdValue('');
      setSpaceId('');
      setListId('');
    } catch (error) {
      console.error('Error configuring ClickUp:', error);
      setTestResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to configure ClickUp integration',
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
          ClickUp Integration
        </h2>
        <p className="text-gray-600">
          Connect to ClickUp to create tasks directly from your inbox. You'll
          need a ClickUp API key.
        </p>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-medium text-gray-900">ClickUp</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                clickupIntegration?.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {clickupIntegration?.isActive ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              API Key *
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pk_..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate an API key in your ClickUp Settings → Apps → API Keys
            </p>
          </div>

          <div>
            <label
              htmlFor="teamIdValue"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Team ID *
            </label>
            <input
              type="text"
              id="teamIdValue"
              value={teamIdValue}
              onChange={(e) => setTeamIdValue(e.target.value)}
              placeholder="123456"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Find your Team ID in the ClickUp URL when viewing your workspace
            </p>
          </div>

          <div>
            <label
              htmlFor="spaceId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Space ID
            </label>
            <input
              type="text"
              id="spaceId"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              placeholder="123456 (optional)"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Default space where tasks will be created
            </p>
          </div>

          <div>
            <label
              htmlFor="listId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              List ID
            </label>
            <input
              type="text"
              id="listId"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              placeholder="123456 (optional)"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Default list where tasks will be created
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

            {clickupIntegration?.isActive && (
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
          How to get your ClickUp credentials:
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to your ClickUp Settings</li>
          <li>Click on "Apps" in the sidebar</li>
          <li>Click "API Keys"</li>
          <li>Generate a new API key</li>
          <li>Copy the API key and your team/space/list IDs from URLs</li>
        </ol>
      </div>

      {/* Current Configuration */}
      {clickupIntegration?.isActive && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Current Configuration
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Space ID: {clickupIntegration.configuration?.spaceId || 'Not set'}
            </div>
            <div>
              List ID: {clickupIntegration.configuration?.listId || 'Not set'}
            </div>
            <div>
              Last Updated:{' '}
              {new Date(clickupIntegration.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
