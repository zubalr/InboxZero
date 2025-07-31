'use client';

import { useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, Badge, Avatar, Button, designTokens, animations } from '../ui/DesignSystem';

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

export function ModernMessageList({ messages, currentUser }: MessageListProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md text-center border-dashed border-2 border-gray-300 bg-white/60">
          <div className="w-16 h-16 mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.405L3 21l2.595-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
          <p className="text-gray-500">This conversation doesn't have any messages yet.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50/50 to-white">
      {messages.map((message, index) => (
        <ModernMessageItem
          key={message._id}
          message={message}
          currentUser={currentUser}
          isFirst={index === 0}
          isLast={index === messages.length - 1}
          index={index}
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
  index: number;
}

function ModernMessageItem({
  message,
  currentUser,
  isFirst,
  isLast,
  index,
}: MessageItemProps) {
  const [showFullContent, setShowFullContent] = useState(isLast);
  const [showHeaders, setShowHeaders] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isLast);

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

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        relative transition-all duration-300 
        ${isFromCurrentUser || isOutbound ? 'ml-12' : 'mr-12'}
        ${animations.fadeIn}
      `}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Message Card */}
      <Card
        className={`
          ${isFromCurrentUser || isOutbound
            ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200/50'
            : 'bg-white border-gray-200'
          }
          ${isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}
          transition-all duration-200 overflow-hidden
        `}
        padding="none"
      >
        {/* Message Header */}
        <div className="px-6 py-4 border-b border-gray-100/80 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar
                name={message.from.name || message.from.email}
                size="md"
                className={`ring-2 ${
                  isFromCurrentUser || isOutbound 
                    ? 'ring-blue-200' 
                    : 'ring-gray-200'
                } shadow-sm`}
              />
              
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {message.from.name || message.from.email}
                  </p>
                  
                  {/* Direction Badge */}
                  <Badge 
                    variant={isOutbound ? "primary" : "secondary"} 
                    size="sm"
                    className="text-xs"
                  >
                    {isOutbound ? '↗️ Sent' : '↙️ Received'}
                  </Badge>
                </div>
                
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatTime(message._creationTime)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Delivery Status */}
              {message.deliveryStatus && isOutbound && (
                <div className="flex items-center space-x-1">
                  {getDeliveryStatusIcon(message.deliveryStatus.status)}
                  <span className="text-xs text-gray-600 capitalize">
                    {message.deliveryStatus.status}
                  </span>
                </div>
              )}

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>

              {/* More Actions */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHeaders(!showHeaders)}
                className="p-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Headers (Expanded) */}
          {showHeaders && isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/50 rounded-lg p-3">
              <div className="text-xs text-gray-600 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium text-gray-800">To:</span>{' '}
                    {message.to.map((t) => t.name || t.email).join(', ')}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Message ID:</span>{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">{message.messageId}</code>
                  </div>
                </div>
                {message.deliveryStatus?.errorMessage && (
                  <div className="text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    <span className="font-medium">Error:</span>{' '}
                    {message.deliveryStatus.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message Content */}
        {isExpanded && (
          <div className="px-6 py-4">
            {message.htmlContent ? (
              <div
                className="prose prose-sm max-w-none prose-blue"
                dangerouslySetInnerHTML={{ __html: message.htmlContent }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {showFullContent ? textContent : displayContent}
              </div>
            )}

            {/* Show More/Less Button */}
            {isLongMessage && !message.htmlContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullContent(!showFullContent)}
                className="mt-3 text-blue-600 hover:text-blue-800"
              >
                {showFullContent ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Show less
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show more
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Collapsed Preview */}
        {!isExpanded && (
          <div className="px-6 py-3 bg-gray-50/30">
            <p className="text-sm text-gray-600 line-clamp-2">
              {textContent.substring(0, 100)}...
            </p>
          </div>
        )}

        {/* Action Buttons (for expanded messages) */}
        {isExpanded && isLast && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <Button variant="primary" size="sm">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply
              </Button>
              
              <Button variant="outline" size="sm">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.405L3 21l2.595-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
                Forward
              </Button>
              
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Message Flow Indicator */}
      <div
        className={`absolute top-6 ${
          isFromCurrentUser || isOutbound ? 'right-0 mr-3' : 'left-0 ml-3'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full shadow-sm ${
            isFromCurrentUser || isOutbound 
              ? 'bg-gradient-to-r from-blue-400 to-indigo-500' 
              : 'bg-gradient-to-r from-gray-400 to-gray-500'
          }`}
        />
      </div>

      {/* Connection Line (between messages) */}
      {!isLast && (
        <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
          <div className="w-0.5 h-6 bg-gradient-to-b from-gray-300 to-transparent"></div>
        </div>
      )}
    </div>
  );
}
