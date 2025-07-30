'use client';

import { useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';

interface Message {
  _id: Id<'messages'>;
  _creationTime: number;
  threadId: Id<'threads'>;
  messageId: string;
  from: {
    email: string;
    name?: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  direction: 'inbound' | 'outbound';
  deliveryStatus?: {
    status: 'sent' | 'delivered' | 'failed';
    attempts: number;
    lastAttemptAt: number;
    errorMessage?: string;
  };
}

interface User {
  _id: Id<'users'>;
  email: string;
  name: string;
}

interface MessageListProps {
  messages: Message[];
  currentUser: User;
}

export function MessageList({ messages, currentUser }: MessageListProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 mb-4 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.405L3 21l2.595-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No messages in this thread</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {messages.map((message, index) => (
        <MessageItem
          key={message._id}
          message={message}
          currentUser={currentUser}
          isFirst={index === 0}
          isLast={index === messages.length - 1}
        />
      ))}
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  currentUser: User;
  isFirst: boolean;
  isLast: boolean;
}

function MessageItem({
  message,
  currentUser,
  isFirst,
  isLast,
}: MessageItemProps) {
  const [showFullContent, setShowFullContent] = useState(isLast);
  const [showHeaders, setShowHeaders] = useState(false);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isFromCurrentUser = message.from.email === currentUser.email;
  const isOutbound = message.direction === 'outbound';

  // Extract text content from HTML if needed
  const getTextContent = (message: Message) => {
    if (message.textContent) return message.textContent;
    if (message.htmlContent) {
      // Simple HTML to text conversion (in production, use a proper HTML parser)
      return message.htmlContent
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
    return '';
  };

  const textContent = getTextContent(message);
  const previewLength = 150;
  const isLongMessage = textContent.length > previewLength;
  const displayContent = showFullContent
    ? textContent
    : textContent.substring(0, previewLength) + (isLongMessage ? '...' : '');

  return (
    <div
      className={`relative ${
        isFromCurrentUser || isOutbound ? 'ml-12' : 'mr-12'
      }`}
    >
      <div
        className={`rounded-lg border ${
          isFromCurrentUser || isOutbound
            ? 'bg-blue-50 border-blue-200'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Message header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isFromCurrentUser || isOutbound
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {(message.from.name || message.from.email)
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {message.from.name || message.from.email}
                </p>
                <p className="text-xs text-gray-500">
                  {isOutbound ? 'Sent' : 'Received'}{' '}
                  {formatTime(message._creationTime)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {message.deliveryStatus && isOutbound && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    message.deliveryStatus.status === 'delivered'
                      ? 'bg-green-100 text-green-800'
                      : message.deliveryStatus.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {message.deliveryStatus.status}
                </span>
              )}

              <button
                onClick={() => setShowHeaders(!showHeaders)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {showHeaders && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">To:</span>{' '}
                  {message.to.map((t) => t.name || t.email).join(', ')}
                </div>
                <div>
                  <span className="font-medium">Message ID:</span>{' '}
                  {message.messageId}
                </div>
                {message.deliveryStatus?.errorMessage && (
                  <div className="text-red-600">
                    <span className="font-medium">Error:</span>{' '}
                    {message.deliveryStatus.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message content */}
        <div className="px-4 py-3">
          {message.htmlContent ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: message.htmlContent }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {displayContent}
            </div>
          )}

          {isLongMessage && !message.htmlContent && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              {showFullContent ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>

      {/* Message direction indicator */}
      <div
        className={`absolute top-4 ${
          isFromCurrentUser || isOutbound ? 'right-0 mr-2' : 'left-0 ml-2'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full ${
            isFromCurrentUser || isOutbound ? 'bg-blue-400' : 'bg-gray-400'
          }`}
        />
      </div>
    </div>
  );
}
