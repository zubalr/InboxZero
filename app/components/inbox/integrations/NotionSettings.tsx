import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface NotionSettingsProps {
  teamId: Id<'teams'>;
}

export function NotionSettings({ teamId }: NotionSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  const storeCredentials = useMutation(api.integrations.storeNotionCredentialsPublic);
  const notionIntegration = useQuery(api.integrations.getNotionIntegration, { teamId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await storeCredentials({
      teamId,
      apiKey,
      databaseId,
    });
    alert('Notion settings saved!');
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Notion Integration</h3>
      {notionIntegration?.isActive ? (
        <p className="text-green-600">Notion is connected.</p>
      ) : (
        <p className="text-gray-500">Connect to Notion to create tasks directly from your inbox.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium">Notion API Key</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="v..."
            className="w-full p-2 border rounded mt-1"
          />
        </div>
        <div>
          <label htmlFor="databaseId" className="block text-sm font-medium">Notion Database ID</label>
          <input
            type="text"
            id="databaseId"
            value={databaseId}
            onChange={(e) => setDatabaseId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full p-2 border rounded mt-1"
          />
        </div>
        <button type="submit" className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save Settings
        </button>
      </form>
    </div>
  );
}
