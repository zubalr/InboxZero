'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ThreadActions } from './ThreadActions';
import { CommentsSidebar } from './CommentsSidebar';
import { PresenceIndicator } from './PresenceIndicator';
import { AISummary, SmartReply, PriorityClassification } from './AIFeatures';
import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';

interface ThreadViewProps {
  threadId: Id<'threads'>;
  teamId: Id<'teams'>;
  onClose: () => void;
}

export function ThreadView({ threadId, teamId, onClose }: ThreadViewProps) {
  const [showComments, setShowComments] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [generatedReply, setGeneratedReply] = useState('');

  const thread = useQuery(api.threads.getThread, { threadId });
  const updatePresence = useMutation(api.presence.updatePresence);

  // Update presence when viewing thread
  useEffect(() => {
    if (threadId) {
      updatePresence({
        status: 'online',
        threadId,
        activity: {
          type: 'viewing_thread',
          threadId,
        },
      });

      // Update presence every 30 seconds while viewing
      const interval = setInterval(() => {
        updatePresence({
          status: 'online',
          threadId,
          activity: {
            type: 'viewing_thread',
            threadId,
          },
        });
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [threadId, updatePresence]);
  const messages = useQuery(api.messages.listForThread, { threadId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const teamMembers = useQuery(api.users.getTeamMembers);

  if (
    thread === undefined ||
    messages === undefined ||
    currentUser === undefined
  ) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Thread not found
          </h3>
          <p className="text-gray-500">
            The requested thread could not be found.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to inbox
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const assignedUser = thread.assignedTo
    ? teamMembers?.find((member: any) => member._id === thread.assignedTo)
    : null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {thread.subject || '(No Subject)'}
              </h1>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Created: {formatDate(thread.createdAt)}</span>
              <span>Last activity: {formatDate(thread.lastMessageAt)}</span>
              {assignedUser && <span>Assigned to: {assignedUser.name}</span>}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(
                  thread.priority
                )}`}
              >
                {thread.priority} priority
              </span>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  thread.status === 'unread'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : thread.status === 'replied'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                {thread.status}
              </span>

              {thread.tags.map((tag: any, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-200"
                >
                  {tag}
                </span>
              ))}
            </div>

            {thread.summary && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-blue-900">
                    AI Summary
                  </span>
                </div>
                <p className="text-sm text-blue-800">
                  {thread.summary.content}
                </p>
              </div>
            )}
          </div>

          <ThreadActions
            thread={thread}
            teamId={teamId}
            onShowComments={() => setShowComments(!showComments)}
            showingComments={showComments}
            teamMembers={teamMembers || []}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* AI Features Sidebar */}
        {showAIFeatures && (
          <div className="w-80 border-r border-gray-200 bg-white p-4 overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">AI Tools</h3>

            <AISummary threadId={threadId} />

            <PriorityClassification
              threadId={threadId}
              existingClassification={thread?.classification}
            />

            <SmartReply
              threadId={threadId}
              onReplyGenerated={(reply) => {
                setGeneratedReply(reply);
                setShowComposer(true);
              }}
            />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <MessageList
              messages={messages.messages}
              currentUser={currentUser!}
            />
          </div>

          {/* Message composer */}
          {showComposer ? (
            <div className="flex-shrink-0 border-t border-gray-200 bg-white">
              <MessageComposer
                threadId={threadId}
                thread={thread}
                onCancel={() => {
                  setShowComposer(false);
                  setGeneratedReply('');
                }}
                onSent={() => {
                  setShowComposer(false);
                  setGeneratedReply('');
                }}
              />
            </div>
          ) : (
            <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => setShowComposer(true)}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Reply to thread
              </button>
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        {showComments && (
          <div className="w-80 border-l border-gray-200 bg-white">
            <CommentsSidebar threadId={threadId} />
          </div>
        )}
      </div>
    </div>
  );
}
