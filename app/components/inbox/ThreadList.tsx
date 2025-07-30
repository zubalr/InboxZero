'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ThreadFilters } from './InboxLayout';

interface ThreadListProps {
  filters: ThreadFilters;
  selectedThreadId: Id<'threads'> | null;
  onThreadSelect: (threadId: Id<'threads'>) => void;
  teamMembers: Array<{
    _id: Id<'users'>;
    name: string;
    email: string;
  }>;
}

export function ThreadList({
  filters,
  selectedThreadId,
  onThreadSelect,
  teamMembers,
}: ThreadListProps) {
  const threadsResult = useQuery(api.threads.listThreads, {
    status: filters.status,
    assignedToMe: filters.assignedToMe,
    limit: 25, // Reduced for better performance
    sortBy: 'lastMessage',
  });

  const threads = threadsResult?.threads;

  if (threads === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-400"
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
        <p className="text-sm text-gray-500">No threads found</p>
        {filters.status && (
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your filters
          </p>
        )}
      </div>
    );
  }

  // Filter threads by search term on the client side for real-time filtering
  const filteredThreads = filters.searchTerm
    ? threads.filter(
        (thread: any) =>
          thread.subject
            .toLowerCase()
            .includes(filters.searchTerm!.toLowerCase()) ||
          thread.participants.some(
            (p: any) =>
              p.email
                .toLowerCase()
                .includes(filters.searchTerm!.toLowerCase()) ||
              p.name?.toLowerCase().includes(filters.searchTerm!.toLowerCase())
          )
      )
    : threads;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.map((thread: any) => (
          <ThreadListItem
            key={thread._id}
            thread={thread}
            isSelected={selectedThreadId === thread._id}
            onSelect={() => onThreadSelect(thread._id)}
            teamMembers={teamMembers}
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
  teamMembers: Array<{
    _id: Id<'users'>;
    name: string;
    email: string;
  }>;
}

function ThreadListItem({
  thread,
  isSelected,
  onSelect,
  teamMembers,
}: ThreadListItemProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return 'now';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-gray-100 text-gray-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread':
        return 'bg-blue-100 text-blue-800';
      case 'read':
        return 'bg-gray-100 text-gray-800';
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-purple-100 text-purple-800';
      case 'archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const fromParticipant = thread.participants.find(
    (p: any) => p.type === 'from'
  );
  const assignedUser = thread.assignedTo
    ? teamMembers.find((member) => member._id === thread.assignedTo)
    : null;

  return (
    <div
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-medium truncate ${
              thread.status === 'unread' ? 'text-gray-900' : 'text-gray-700'
            }`}
          >
            {thread.subject || '(No Subject)'}
          </h3>
          <p className="text-xs text-gray-500 truncate mt-1">
            From: {fromParticipant?.name || fromParticipant?.email}
          </p>
        </div>
        <div className="flex flex-col items-end ml-2">
          <span className="text-xs text-gray-500">
            {formatTime(thread.lastMessageAt)}
          </span>
          {thread.status === 'unread' && (
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
              thread.priority
            )}`}
          >
            {thread.priority}
          </span>
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
              thread.status
            )}`}
          >
            {thread.status}
          </span>
          {thread.tags.length > 0 && (
            <div className="flex gap-1">
              {thread.tags.slice(0, 2).map((tag: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                >
                  {tag}
                </span>
              ))}
              {thread.tags.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{thread.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {assignedUser && (
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">
                {assignedUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {thread.summary && (
        <p className="text-xs text-gray-600 mt-2 truncate">
          💡 {thread.summary.content}
        </p>
      )}
    </div>
  );
}
