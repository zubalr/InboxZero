'use client';

import { useState } from 'react';
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
import { Card, Button, Badge, Avatar, designTokens, animations } from '../ui/DesignSystem';

export interface ThreadFilters {
  status?: 'unread' | 'read' | 'replied' | 'closed' | 'archived';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  assignedToMe?: boolean;
  searchTerm?: string;
}

export function ModernInboxLayout() {
  const [selectedThreadId, setSelectedThreadId] = useState<Id<'threads'> | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'search' | 'analytics'>('inbox');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  const unreadCount = useQuery(api.threads.getUnreadCount);

  if (!currentUser) {
    return <FullPageLoading />;
  }

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId as Id<'threads'>);
  };

  const navigationItems = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2a2 2 0 012 2v1m0 0v2a2 2 0 01-2 2h-2m0 0v.01" />
        </svg>
      ),
      count: unreadCount,
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <ConnectionStatus />
      <OfflineBanner />

      {/* Modern Sidebar Navigation */}
      <div className={`${sidebarCollapsed ? 'w-20' : 'w-72'} transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-xl`}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200/50">
          <div className={`flex items-center space-x-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  InboxZero
                </h1>
                <p className="text-xs text-gray-500">AI-Powered Email</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2"
          >
            <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        </div>

        {/* Navigation Items */}
        <div className="p-4 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id as any)}
              className={`
                w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} 
                px-4 py-3 rounded-xl transition-all duration-200 group
                ${viewMode === item.id
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-md border border-blue-200/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`${viewMode === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
                  {item.icon}
                </div>
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </div>
              {!sidebarCollapsed && item.count !== undefined && item.count > 0 && (
                <Badge variant="primary" size="sm" className="ml-auto">
                  {item.count > 99 ? '99+' : item.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* User Profile Section */}
        {!sidebarCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200/50 bg-white/60 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <Avatar 
                name={currentUser.name} 
                status="online" 
                size="md"
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentUser.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentUser.email}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="p-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Collapsed User Profile */}
        {sidebarCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200/50 bg-white/60 backdrop-blur-sm">
            <div className="flex justify-center">
              <Avatar 
                name={currentUser.name} 
                status="online" 
                size="md"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="h-full flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {viewMode}
              </h2>
              {hasActiveFilters && (
                <Badge variant="warning" size="sm" className="animate-pulse">
                  Filters Active
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="p-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.97 7.97 0 01-5.417-2.083A7.97 7.97 0 015 12a8 8 0 1110 8z" />
                  </svg>
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Button>
              </div>

              <GlobalPresence />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === 'search' ? (
            <SearchErrorBoundary>
              <EnhancedSearchInterface
                onThreadSelect={handleThreadSelect}
                selectedThreadId={selectedThreadId || undefined}
              />
            </SearchErrorBoundary>
          ) : viewMode === 'analytics' ? (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Analytics Header */}
                <Card gradient="secondary" className="border-0">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Email Analytics</h3>
                      <p className="text-gray-600">Insights into your team's email patterns and performance</p>
                    </div>
                  </div>
                </Card>

                <SearchAnalytics />
              </div>
            </div>
          ) : (
            <>
              {/* Thread List */}
              <div className="w-96 border-r border-gray-200/50 bg-white/60 backdrop-blur-sm">
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

              {/* Thread View */}
              <div className="flex-1 bg-white/40 backdrop-blur-sm">
                {selectedThreadId ? (
                  <ThreadErrorBoundary>
                    <ThreadView
                      threadId={selectedThreadId}
                      teamId={currentUser.teamId!}
                      onClose={() => setSelectedThreadId(null)}
                    />
                  </ThreadErrorBoundary>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Card className="max-w-md text-center border-dashed border-2 border-gray-300 bg-white/60">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Select a conversation
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Choose an email thread from the left to start reading and responding
                      </p>
                      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                        <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">⌘</kbd>
                        <span>+</span>
                        <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">K</kbd>
                        <span>to search</span>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute top-4 right-4 z-50">
          <Card className="bg-red-50 border-red-200 max-w-md">
            <ErrorMessage message={error} />
            <Button
              variant="error"
              size="sm"
              onClick={clearError}
              className="mt-2"
            >
              Dismiss
            </Button>
          </Card>
        </div>
      )}

      {/* Floating Action Button for Compose */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/25 hover:scale-105 transition-all duration-200 flex items-center justify-center group z-40">
        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
