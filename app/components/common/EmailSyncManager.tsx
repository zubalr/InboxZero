import React, { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { Card, Button, Badge, Avatar, LoadingSpinner, EmptyState, designTokens, animations } from '../ui/DesignSystem';

interface SyncStatus {
  accountId: Id<'emailAccounts'>;
  provider: 'gmail' | 'outlook';
  email: string;
  lastSync?: number;
  isActive: boolean;
  syncStatus: 'active' | 'connected' | 'error' | 'disabled';
  syncError?: string;
  messagesSynced?: number;
}

type EmailAccount = Doc<'emailAccounts'>;

export function EmailSyncManager() {
  const accounts = useQuery(api.emailAccountMutations.getUserEmailAccounts);
  const triggerSync = useAction(api.emailProviders.triggerManualSync);
  const setupGmailWebhook = useAction(api.emailSync.setupGmailWebhook);
  const setupOutlookWebhook = useAction(api.emailSync.setupOutlookWebhook);
  const refreshTokens = useAction(api.emailSync.refreshAccountTokens);

  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [settingUpWebhook, setSettingUpWebhook] = useState<Set<string>>(
    new Set()
  );

  const handleManualSync = async (accountId: Id<'emailAccounts'>) => {
    setSyncing((prev) => new Set([...prev, accountId]));
    try {
      await triggerSync({ accountId });
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setSyncing((prev) => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const handleSetupWebhook = async (
    accountId: Id<'emailAccounts'>,
    provider: 'gmail' | 'outlook'
  ) => {
    setSettingUpWebhook((prev) => new Set([...prev, accountId]));
    try {
      if (provider === 'gmail') {
        await setupGmailWebhook({ accountId });
      } else {
        await setupOutlookWebhook({ accountId });
      }
    } catch (error) {
      console.error('Webhook setup failed:', error);
    } finally {
      setSettingUpWebhook((prev) => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const handleRefreshTokens = async (accountId: Id<'emailAccounts'>) => {
    try {
      await refreshTokens({ accountId });
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700 bg-green-100 border-green-200';
      case 'connected':
        return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'error':
        return 'text-red-700 bg-red-100 border-red-200';
      case 'disabled':
        return 'text-gray-700 bg-gray-100 border-gray-200';
      default:
        return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    }
  };

  if (!accounts) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="animate-pulse p-6">
            <div className="h-8 bg-gray-200 rounded-lg mb-4 w-1/3"></div>
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Email Synchronization Management
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Monitor and manage email synchronization for connected accounts
              </p>
            </div>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
              <svg
                className="h-8 w-8 text-gray-400"
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
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No connected accounts
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Connect Gmail or Outlook accounts to start synchronization and
              manage your emails efficiently.
            </p>
            <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Connect Account
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {accounts.map((account: EmailAccount) => (
              <div
                key={account._id}
                className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 relative">
                      {account.provider === 'gmail' ? (
                        <div className="relative">
                          <svg
                            className="w-8 h-8 sm:w-10 sm:h-10"
                            viewBox="0 0 24 24"
                          >
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
                          {account.syncStatus === 'active' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <svg
                            className="w-8 h-8 sm:w-10 sm:h-10"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="#0078D4"
                              d="M23.5 12c0-6.33-5.17-11.5-11.5-11.5S.5 5.67.5 12 5.67 23.5 12 23.5 23.5 18.33 23.5 12zm-6.84 4.11c0 .59-.48 1.07-1.07 1.07H8.41c-.59 0-1.07-.48-1.07-1.07V7.89c0-.59.48-1.07 1.07-1.07h7.18c.59 0 1.07.48 1.07 1.07v8.22z"
                            />
                          </svg>
                          {account.syncStatus === 'active' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {account.displayName || account.email}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            account.syncStatus
                          )}`}
                        >
                          {account.syncStatus === 'active' && '🟢 Active'}
                          {account.syncStatus === 'connected' && '🔵 Connected'}
                          {account.syncStatus === 'error' && '🔴 Error'}
                          {account.syncStatus === 'disabled' && '⚫ Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {account.email}
                      </p>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Last sync: {formatLastSync(account.lastSyncAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => handleManualSync(account._id)}
                        disabled={syncing.has(account._id) || !account.isActive}
                        className="group inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {syncing.has(account._id) ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500"
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
                            Syncing...
                          </>
                        ) : (
                          <>
                            <svg
                              className="-ml-1 mr-2 h-4 w-4 group-hover:rotate-180 transition-transform duration-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            <span className="hidden sm:inline">Sync Now</span>
                            <span className="sm:hidden">Sync</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() =>
                          handleSetupWebhook(account._id, account.provider)
                        }
                        disabled={
                          settingUpWebhook.has(account._id) || !account.isActive
                        }
                        className="inline-flex items-center justify-center px-3 py-2 border border-green-300 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {settingUpWebhook.has(account._id) ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-600"
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
                            Setting up...
                          </>
                        ) : (
                          <>
                            <svg
                              className="-ml-1 mr-2 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            <span className="hidden sm:inline">
                              Real-time Sync
                            </span>
                            <span className="sm:hidden">Real-time</span>
                          </>
                        )}
                      </button>

                      {account.syncStatus === 'error' && (
                        <button
                          onClick={() => handleRefreshTokens(account._id)}
                          className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow"
                        >
                          <svg
                            className="-ml-1 mr-2 h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                          Refresh Auth
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {account.syncError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-red-800">
                          Synchronization Error
                        </h4>
                        <p className="mt-1 text-sm text-red-700">
                          {account.syncError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {account.settings?.webhookConfig && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-green-800">
                          Real-time Sync Enabled
                        </h4>
                        <p className="mt-1 text-sm text-green-700">
                          Push notifications are active for instant email
                          synchronization
                          {account.provider === 'gmail' &&
                            account.settings.webhookConfig.historyId && (
                              <span className="block mt-1 text-xs text-green-600">
                                History ID:{' '}
                                {account.settings.webhookConfig.historyId}
                              </span>
                            )}
                          {account.provider === 'outlook' &&
                            account.settings.webhookConfig.subscriptionId && (
                              <span className="block mt-1 text-xs text-green-600">
                                Subscription:{' '}
                                {account.settings.webhookConfig.subscriptionId}
                              </span>
                            )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Statistics */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Synchronization Statistics
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Overview of your email synchronization status
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 text-center border border-green-200">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {
                    accounts.filter(
                      (a: EmailAccount) =>
                        a.syncStatus === 'active' ||
                        a.syncStatus === 'connected'
                    ).length
                  }
                </div>
                <div className="text-sm font-medium text-green-700 mt-1">
                  Active Accounts
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Syncing emails
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-6 text-center border border-red-200">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {
                    accounts.filter(
                      (a: EmailAccount) => a.syncStatus === 'error'
                    ).length
                  }
                </div>
                <div className="text-sm font-medium text-red-700 mt-1">
                  Accounts with Errors
                </div>
                <div className="text-xs text-red-600 mt-1">Need attention</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 text-center border border-blue-200">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {
                    accounts.filter(
                      (a: EmailAccount) => a.settings?.webhookConfig
                    ).length
                  }
                </div>
                <div className="text-sm font-medium text-blue-700 mt-1">
                  Real-time Enabled
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Push notifications
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
