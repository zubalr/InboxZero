'use client';

import { useState } from 'react';

interface SearchResult {
  _id: string;
  subject: string;
  participants: Array<{
    email: string;
    name?: string;
    type: 'to' | 'cc' | 'bcc' | 'from';
  }>;
  status: 'unread' | 'read' | 'replied' | 'closed' | 'archived';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  lastMessageAt: number;
  snippet?: string;
  matchType?: 'subject' | 'content' | 'participant';
  relevanceScore?: number;
  tags?: string[];
  messageCount?: number;
  hasAttachments?: boolean;
}

interface SearchResultsProps {
  results: SearchResult[];
  searchTerm: string;
  isLoading: boolean;
  onResultClick: (threadId: string) => void;
  selectedThreadId?: string;
}

export function SearchResults({
  results,
  searchTerm,
  isLoading,
  onResultClick,
  selectedThreadId,
}: SearchResultsProps) {
  // Enhanced highlight function with better regex and context
  const highlightText = (text: string, term: string) => {
    if (!term.trim()) return text;

    // Split search term into words for better matching
    const searchWords = term
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (searchWords.length === 0) return text;

    // Create regex pattern for all search words
    const pattern = searchWords
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const isMatch = searchWords.some(
        (word) => part.toLowerCase() === word.toLowerCase()
      );

      return isMatch ? (
        <mark
          key={index}
          className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-medium"
        >
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  // Get snippet with context around matches
  const getEnhancedSnippet = (
    snippet: string,
    searchTerm: string,
    maxLength: number = 200
  ) => {
    if (!snippet || !searchTerm.trim()) return snippet;

    const searchWords = searchTerm.trim().toLowerCase().split(/\s+/);
    const lowerSnippet = snippet.toLowerCase();

    // Find the first match position
    let matchIndex = -1;
    for (const word of searchWords) {
      const index = lowerSnippet.indexOf(word);
      if (index !== -1) {
        matchIndex = index;
        break;
      }
    }

    if (matchIndex === -1) return snippet.substring(0, maxLength);

    // Calculate context window
    const contextBefore = 50;
    const contextAfter = maxLength - contextBefore;

    const start = Math.max(0, matchIndex - contextBefore);
    const end = Math.min(snippet.length, start + maxLength);

    let result = snippet.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) result = '...' + result;
    if (end < snippet.length) result = result + '...';

    return result;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'normal':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '🔴';
      case 'high':
        return '🟠';
      case 'normal':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      unread: 'bg-blue-100 text-blue-800',
      read: 'bg-gray-100 text-gray-800',
      replied: 'bg-green-100 text-green-800',
      closed: 'bg-purple-100 text-purple-800',
      archived: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          colors[status as keyof typeof colors] || colors.read
        }`}
      >
        {status}
      </span>
    );
  };

  const getMatchTypeIcon = (matchType?: string) => {
    switch (matchType) {
      case 'subject':
        return (
          <span
            className="inline-flex items-center text-blue-600"
            title="Subject match"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </span>
        );
      case 'content':
        return (
          <span
            className="inline-flex items-center text-green-600"
            title="Content match"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        );
      case 'participant':
        return (
          <span
            className="inline-flex items-center text-purple-600"
            title="Participant match"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center text-gray-600"
            title="General match"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Searching...
        </div>
      </div>
    );
  }

  if (!searchTerm) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p>Enter a search term to find emails</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p>No emails found for "{searchTerm}"</p>
        <p className="text-sm mt-1">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {/* Search Header */}
      <div className="px-6 py-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            {results.length} result{results.length !== 1 ? 's' : ''} for "
            {highlightText(searchTerm, searchTerm)}"
          </h3>
          <div className="text-xs text-gray-500">Sorted by relevance</div>
        </div>
      </div>

      {/* Search Results */}
      <div className="divide-y divide-gray-100">
        {results.map((result) => (
          <button
            key={result._id}
            onClick={() => onResultClick(result._id)}
            className={`w-full px-6 py-4 text-left hover:bg-gray-50 focus:bg-blue-50 focus:outline-none transition-colors border-l-4 ${
              selectedThreadId === result._id
                ? 'bg-blue-50 border-l-blue-500'
                : 'border-l-transparent hover:border-l-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center space-x-2 mb-2">
                  {getMatchTypeIcon(result.matchType)}

                  <span
                    className={`text-sm ${getPriorityColor(result.priority)}`}
                  >
                    {getPriorityIcon(result.priority)}
                  </span>

                  {getStatusBadge(result.status)}

                  {result.relevanceScore && result.relevanceScore > 0.7 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      High relevance
                    </span>
                  )}

                  {result.hasAttachments && (
                    <span
                      className="inline-flex items-center text-gray-500"
                      title="Has attachments"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </span>
                  )}

                  {result.messageCount && result.messageCount > 1 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {result.messageCount} messages
                    </span>
                  )}
                </div>

                {/* Subject */}
                <h4 className="text-sm font-medium text-gray-900 mb-2 leading-relaxed">
                  {highlightText(result.subject, searchTerm)}
                </h4>

                {/* Participants */}
                <div className="flex flex-wrap items-center text-xs text-gray-600 mb-2">
                  {result.participants.slice(0, 3).map((participant, index) => (
                    <span key={index} className="mr-3 flex items-center">
                      <span
                        className={`mr-1 ${
                          participant.type === 'from' ? 'font-medium' : ''
                        }`}
                      >
                        {participant.type === 'from'
                          ? 'From:'
                          : participant.type === 'to'
                            ? 'To:'
                            : participant.type === 'cc'
                              ? 'CC:'
                              : 'BCC:'}
                      </span>
                      <span className="truncate max-w-32">
                        {highlightText(
                          participant.name || participant.email,
                          searchTerm
                        )}
                      </span>
                    </span>
                  ))}
                  {result.participants.length > 3 && (
                    <span className="text-gray-500 text-xs">
                      +{result.participants.length - 3} more
                    </span>
                  )}
                </div>

                {/* Tags */}
                {result.tags && result.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {result.tags.slice(0, 4).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {highlightText(tag, searchTerm)}
                      </span>
                    ))}
                    {result.tags.length > 4 && (
                      <span className="text-xs text-gray-500">
                        +{result.tags.length - 4} more tags
                      </span>
                    )}
                  </div>
                )}

                {/* Enhanced Snippet */}
                {result.snippet && (
                  <div className="bg-gray-50 rounded-md p-2 mt-2">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {highlightText(
                        getEnhancedSnippet(result.snippet, searchTerm),
                        searchTerm
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="ml-4 flex-shrink-0 flex flex-col items-end text-right">
                {/* Timestamp */}
                <div className="text-xs text-gray-500 mb-1">
                  {formatDate(result.lastMessageAt)}
                </div>

                {/* Relevance Score */}
                {result.relevanceScore && (
                  <div className="text-xs text-gray-400">
                    {Math.round(result.relevanceScore * 100)}% match
                  </div>
                )}

                {/* Match type indicator */}
                {result.matchType && (
                  <div className="text-xs text-gray-500 mt-1 capitalize">
                    {result.matchType} match
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
