import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface ConnectedAccount {
  _id: string;
  provider: 'gmail' | 'outlook';
  email: string;
  displayName?: string;
  isActive: boolean;
  syncStatus: 'active' | 'error' | 'disabled';
  syncError?: string;
  lastSyncAt?: number;
}

export function EmailAccountManager() {
  const accounts = useQuery(api.emailProviders.getUserEmailAccounts) as
    | ConnectedAccount[]
    | undefined;
  const disconnectAccount = useMutation(
    api.emailProviders.disconnectEmailAccount
  );

  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const handleConnectGmail = () => {
    const state = btoa(
      JSON.stringify({ provider: 'gmail', timestamp: Date.now() })
    );
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: `${window.location.origin}/auth/callback`,
      scope:
        'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleConnectOutlook = () => {
    const state = btoa(
      JSON.stringify({ provider: 'outlook', timestamp: Date.now() })
    );
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
      redirect_uri: `${window.location.origin}/auth/callback`,
      scope:
        'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access',
      response_type: 'code',
      state,
    });

    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await disconnectAccount({ accountId: accountId as any });
    } catch (error) {
      console.error('Failed to disconnect account:', error);
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (status: string, error?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Active
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ⚠ Error
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            ○ Disabled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Connected Email Accounts
          </h3>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-4">
              Connect your Gmail or Outlook accounts to start managing your
              emails directly through InboxZero.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={handleConnectGmail}
                disabled={isConnecting === 'gmail'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting === 'gmail' ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Connect Gmail
                  </>
                )}
              </button>

              <button
                onClick={handleConnectOutlook}
                disabled={isConnecting === 'outlook'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting === 'outlook' ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M23.5 12c0-6.33-5.17-11.5-11.5-11.5S.5 5.67.5 12 5.67 23.5 12 23.5 23.5 18.33 23.5 12zm-6.84 4.11c0 .59-.48 1.07-1.07 1.07H8.41c-.59 0-1.07-.48-1.07-1.07V7.89c0-.59.48-1.07 1.07-1.07h7.18c.59 0 1.07.48 1.07 1.07v8.22z"
                      />
                    </svg>
                    Connect Outlook
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connected Accounts List */}
          {accounts && accounts.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">
                Your Connected Accounts
              </h4>
              {accounts.map((account) => (
                <div
                  key={account._id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {account.provider === 'gmail' ? (
                          <svg className="w-8 h-8" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC04"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        ) : (
                          <svg className="w-8 h-8" viewBox="0 0 24 24">
                            <path
                              fill="#0078D4"
                              d="M23.5 12c0-6.33-5.17-11.5-11.5-11.5S.5 5.67.5 12 5.67 23.5 12 23.5 23.5 18.33 23.5 12zm-6.84 4.11c0 .59-.48 1.07-1.07 1.07H8.41c-.59 0-1.07-.48-1.07-1.07V7.89c0-.59.48-1.07 1.07-1.07h7.18c.59 0 1.07.48 1.07 1.07v8.22z"
                            />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {account.displayName || account.email}
                        </div>
                        <div className="text-sm text-gray-500">
                          {account.email}
                        </div>
                        <div className="text-xs text-gray-400">
                          Last sync: {formatLastSync(account.lastSyncAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {getStatusBadge(account.syncStatus, account.syncError)}

                      <button
                        onClick={() => handleDisconnect(account._id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {account.syncError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="text-sm text-red-600">
                        <strong>Sync Error:</strong> {account.syncError}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No email accounts connected
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Connect your Gmail or Outlook account to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
