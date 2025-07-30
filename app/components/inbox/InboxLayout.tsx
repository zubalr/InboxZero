'use client';

import { useState, useEffect } from 'react';
import { ThreadList } from './ThreadList';
import { ThreadView } from './ThreadView';
import { EnhancedSearchInterface } from './EnhancedSearchInterface';
import { SearchAnalytics } from './SearchAnalytics';
import { GlobalPresence } from './PresenceIndicator';
import { useSearchState } from './useSearchState';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  InboxErrorBoundary,
  SearchErrorBoundary,
  ThreadErrorBoundary,
} from '../common/ErrorBoundary';
import { FullPageLoading } from '../common/SkeletonLoaders';
import { ConnectionStatus, OfflineBanner } from '../common/ConnectionStatus';
import { ErrorMessage, useErrorHandler } from '../common/ErrorMessages';

export interface ThreadFilters {
  status?: 'unread' | 'read' | 'replied' | 'closed' | 'archived';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  assignedToMe?: boolean;
  searchTerm?: string;
}

export function InboxLayout() {
  const [selectedThreadId, setSelectedThreadId] =
    useState<Id<'threads'> | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'search' | 'analytics'>(
    'inbox'
  );

  const {
    searchState,
    updateURL,
    clearSearch,
    hasActiveFilters,
    hasSearchCriteria,
  } = useSearchState();

  const { error, handleError, clearError } = useErrorHandler();
  const currentUser = useQuery(api.users.getCurrentUser);
  const teamMembers = useQuery(api.users.getTeamMembers);

  if (!currentUser) {
    return <FullPageLoading />;
  }

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId as Id<'threads'>);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <ConnectionStatus />
      <OfflineBanner />

      {/* Navigation Header */}
      <div className="w-full flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-xl font-semibold text-gray-900">
                InboxZero AI
              </h1>

              {/* View Mode Tabs */}
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('inbox')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'inbox'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => setViewMode('search')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'search'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'analytics'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>

            <GlobalPresence />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {viewMode === 'search' ? (
            /* Enhanced Search Interface */
            <SearchErrorBoundary>
              <EnhancedSearchInterface
                onThreadSelect={handleThreadSelect}
                selectedThreadId={selectedThreadId || undefined}
              />
            </SearchErrorBoundary>
          ) : viewMode === 'analytics' ? (
            /* Analytics Dashboard */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Search Analytics
                  </h2>
                  <p className="text-gray-600">
                    Insights into your team's search patterns and email
                    discovery habits.
                  </p>
                </div>
                <SearchAnalytics className="mb-6" />
              </div>
            </div>
          ) : (
            /* Traditional Inbox View */
            <>
              {/* Sidebar with thread list */}
              <div className="w-1/3 min-w-[400px] bg-white border-r border-gray-200 flex flex-col">
                <InboxErrorBoundary>
                  <ThreadList
                    filters={{
                      status: searchState.status as any,
                      priority: searchState.priority as any,
                      assignedToMe: searchState.assignee === currentUser._id,
                      searchTerm: searchState.query,
                    }}
                    selectedThreadId={selectedThreadId}
                    onThreadSelect={setSelectedThreadId}
                    teamMembers={teamMembers || []}
                  />
                </InboxErrorBoundary>
              </div>

              {/* Main content area */}
              <div className="flex-1 flex flex-col">
                {selectedThreadId ? (
                  <ThreadErrorBoundary>
                    <ThreadView
                      threadId={selectedThreadId}
                      teamId={currentUser.teamId!}
                      onClose={() => setSelectedThreadId(null)}
                    />
                  </ThreadErrorBoundary>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Select a thread to view
                      </h3>
                      <p className="text-gray-500">
                        Choose a conversation from the list to see messages and
                        collaborate with your team.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
