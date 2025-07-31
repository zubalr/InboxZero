'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ThreadFilters } from './InboxLayout';
import { Card, Badge, Avatar, LoadingSpinner, EmptyState, designTokens, animations } from '../ui/DesignSystem';
import { useState } from 'react';

interface ThreadListProps {
  filters: ThreadFilters;
  selectedThreadId: Id<'threads'> | null;
  onThreadSelect: (threadId: Id<'threads'>) => void;
  teamMembers: any[];
}

export function ModernThreadList({
  filters,
  selectedThreadId,
  onThreadSelect,
  teamMembers,
}: ThreadListProps) {
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);
  
  const { data: threads, isLoading } = useQuery(api.threads.list, {
    filters: {
      status: filters.status,
      priority: filters.priority,
      assignedToMe: filters.assignedToMe,
      searchTerm: filters.searchTerm,
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header Skeleton */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="h-6 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-2/3"></div>
        </div>
        
        {/* Thread List Skeleton */}
        <div className="flex-1 p-2 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                    <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-8"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <EmptyState
          icon={
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2a2 2 0 012 2v1m0 0v2a2 2 0 01-2 2h-2m0 0v.01" />
            </svg>
          }
          title="No conversations found"
          description={filters.searchTerm ? "No threads match your search criteria" : "Your inbox is empty. Great job staying on top of things!"}
          action={filters.searchTerm ? {
            label: "Clear filters",
            onClick: () => {/* Clear filters logic */}
          } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white/60 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Conversations
          </h3>
          <Badge variant="secondary" size="sm">
            {threads.length}
          </Badge>
        </div>
        
        {filters.searchTerm && (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm text-gray-600">
              Searching for: <span className="font-medium">"{filters.searchTerm}"</span>
            </span>
          </div>
        )}
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {threads.map((thread: any, index: number) => (
          <ModernThreadListItem
            key={thread._id}
            thread={thread}
            isSelected={selectedThreadId === thread._id}
            onSelect={() => onThreadSelect(thread._id)}
            teamMembers={teamMembers}
            isHovered={hoveredThread === thread._id}
            onHover={setHoveredThread}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface ThreadListItemProps {
  thread: any;
  isSelected: boolean;
  onSelect: () => void;
  teamMembers: any[];
  isHovered: boolean;
  onHover: (id: string | null) => void;
  index: number;
}

function ModernThreadListItem({
  thread,
  isSelected,
  onSelect,
  teamMembers,
  isHovered,
  onHover,
  index,
}: ThreadListItemProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      if (days < 7) {
        return `${days}d`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return 'now';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-500' };
      case 'normal':
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', dot: 'bg-gray-500' };
      case 'low':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', dot: 'bg-gray-500' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
      case 'read':
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
      case 'replied':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      case 'closed':
        return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
      case 'archived':
        return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    }
  };

  const fromParticipant = thread.participants.find((p: any) => p.type === 'from');
  const assignedUser = thread.assignedTo
    ? teamMembers.find((member) => member._id === thread.assignedTo)
    : null;
  
  const priorityColors = getPriorityColor(thread.priority);
  const statusColors = getStatusColor(thread.status);

  return (
    <div
      className={`
        relative p-4 rounded-xl border cursor-pointer transition-all duration-200 group
        ${isSelected 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md transform scale-[1.02] ring-1 ring-blue-200' 
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg hover:bg-gray-50/50'
        }
        ${animations.fadeIn}
      `}
      onClick={onSelect}
      onMouseEnter={() => onHover(thread._id)}
      onMouseLeave={() => onHover(null)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Priority Indicator */}
      <div 
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${priorityColors.dot} ${isSelected ? 'opacity-100' : 'opacity-60'}`}
      />

      {/* Unread Indicator */}
      {thread.status === 'unread' && (
        <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
      )}

      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar
            name={fromParticipant?.name || fromParticipant?.email}
            size="md"
            className="ring-2 ring-white shadow-sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h4 className={`text-sm font-semibold truncate ${
              thread.status === 'unread' ? 'text-gray-900' : 'text-gray-700'
            }`}>
              {thread.subject || '(No Subject)'}
            </h4>
            <div className="flex items-center space-x-2 ml-2">
              <span className="text-xs text-gray-500 font-medium">
                {formatTime(thread.lastMessageAt)}
              </span>
            </div>
          </div>

          {/* Sender Info */}
          <p className="text-xs text-gray-600 mb-2 truncate">
            From: <span className="font-medium">{fromParticipant?.name || fromParticipant?.email}</span>
          </p>

          {/* Preview */}
          {thread.summary?.content && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
              💡 {thread.summary.content}
            </p>
          )}

          {/* Badges Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Priority Badge */}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityColors.bg} ${priorityColors.text} ${priorityColors.border}`}>
                {thread.priority === 'urgent' && '🔥'}
                {thread.priority === 'high' && '⚡'}
                {thread.priority === 'normal' && '📄'}
                {thread.priority === 'low' && '📝'}
                <span className="ml-1">{thread.priority}</span>
              </span>

              {/* Status Badge */}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                {thread.status === 'unread' && '●'}
                {thread.status === 'read' && '○'}
                {thread.status === 'replied' && '↗️'}
                {thread.status === 'closed' && '✓'}
                {thread.status === 'archived' && '📦'}
                <span className="ml-1">{thread.status}</span>
              </span>

              {/* Tags */}
              {thread.tags && thread.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  {thread.tags.slice(0, 2).map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                    >
                      {tag}
                    </span>
                  ))}
                  {thread.tags.length > 2 && (
                    <span className="text-xs text-gray-500 font-medium">
                      +{thread.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Assigned User */}
            {assignedUser && (
              <div className="flex items-center space-x-1">
                <Avatar
                  name={assignedUser.name}
                  size="sm"
                  className="ring-1 ring-gray-200"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover Actions */}
      {isHovered && !isSelected && (
        <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
