'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SearchBarEnhanced } from './SearchBarEnhanced';
import { AdvancedFilters } from './AdvancedFilters';
import { SearchResults } from './SearchResults';
import { SavedSearches } from './SavedSearches';
import { useSearchState } from './useSearchState';

interface EnhancedSearchInterfaceProps {
  onThreadSelect: (threadId: string) => void;
  selectedThreadId?: string;
}

export function EnhancedSearchInterface({
  onThreadSelect,
  selectedThreadId,
}: EnhancedSearchInterfaceProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);

  const {
    searchState,
    searchResults,
    isLoading,
    updateURL,
    clearSearch,
    applySavedSearch,
    getCurrentFilters,
    logCurrentSearch,
    logResultClick,
    hasActiveFilters,
    hasSearchCriteria,
    setSearchResults,
    setIsLoading,
  } = useSearchState();

  // Enhanced search with the new backend function
  const enhancedResults = useQuery(
    api.threads.enhancedSearchThreads,
    hasSearchCriteria
      ? {
          searchTerm: searchState.query || '',
          filters: {
            status: searchState.status as
              | 'unread'
              | 'read'
              | 'replied'
              | 'closed'
              | 'archived'
              | undefined,
            priority: searchState.priority as
              | 'urgent'
              | 'high'
              | 'normal'
              | 'low'
              | undefined,
            assignedTo: searchState.assignee as any,
            tags:
              searchState.tags && searchState.tags.length > 0
                ? searchState.tags
                : undefined,
          },
          sortBy:
            (searchState.sortBy as
              | 'subject'
              | 'priority'
              | 'newest'
              | 'oldest'
              | undefined) || 'relevance',
          limit: 20,
          offset: 0,
        }
      : 'skip'
  );

  // Get team members for filters
  const teamMembers = useQuery(api.users.getTeamMembers, {});

  // Get available tags
  const availableTags = useQuery(api.threads.getAvailableTags, {});

  // Handle search input change
  const handleSearchChange = (query: string) => {
    updateURL({ query });
  };

  // Handle search execution
  const handleSearch = async (query: string) => {
    if (!query.trim() && !hasActiveFilters) return;

    setIsLoading(true);
    try {
      // The search will be triggered by the useQuery hook
      if (enhancedResults) {
        setSearchResults({
          results: enhancedResults.results,
          total: enhancedResults.total,
          hasMore: false,
        });

        // Log the search
        await logCurrentSearch(enhancedResults.total);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle thread selection
  const handleThreadSelect = async (threadId: string) => {
    await logResultClick(threadId);
    onThreadSelect(threadId);
  };

  // Handle filter changes
  const handleFilterChange = (filters: any) => {
    updateURL(filters);
  };

  // Handle saved search selection
  const handleSavedSearchSelect = (savedSearch: any) => {
    applySavedSearch(savedSearch);
    setShowSavedSearches(false);
  };

  // Handle save current search
  const handleSaveCurrentSearch = () => {
    // This will be handled by the SavedSearches component
    setShowSavedSearches(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-4">
        {/* Main Search Bar */}
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <SearchBarEnhanced
              value={searchState.query}
              onChange={handleSearchChange}
              onSearch={handleSearch}
              isLoading={isLoading}
              enableSuggestions={true}
              placeholder="Search emails, participants, subjects..."
            />
          </div>

          {/* Search Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2 rounded-md border transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Advanced Filters"
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
            </button>

            <button
              onClick={() => setShowSavedSearches(!showSavedSearches)}
              className="p-2 rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors"
              title="Saved Searches"
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
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>

            {hasSearchCriteria && (
              <button
                onClick={clearSearch}
                className="p-2 rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors"
                title="Clear Search"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <AdvancedFilters
            filters={{
              status: searchState.status as
                | 'unread'
                | 'read'
                | 'replied'
                | 'closed'
                | 'archived'
                | undefined,
              priority: searchState.priority as
                | 'urgent'
                | 'high'
                | 'normal'
                | 'low'
                | undefined,
              assignedTo: searchState.assignee,
              participant: searchState.participants,
              tags: searchState.tags || [],
              dateRange:
                searchState.startDate && searchState.endDate
                  ? 'custom'
                  : undefined,
              sortBy: searchState.sortBy as
                | 'subject'
                | 'priority'
                | 'newest'
                | 'oldest'
                | undefined,
            }}
            onChange={handleFilterChange}
            teamMembers={teamMembers || []}
            availableTags={availableTags || []}
            isExpanded={showAdvancedFilters}
            onToggleExpanded={() =>
              setShowAdvancedFilters(!showAdvancedFilters)
            }
          />
        )}

        {/* Search Summary */}
        {hasSearchCriteria && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {enhancedResults ? (
                <>
                  <span className="font-medium">{enhancedResults.total}</span>{' '}
                  result
                  {enhancedResults.total !== 1 ? 's' : ''} found
                  {searchState.query && (
                    <>
                      {' '}
                      for "
                      <span className="font-medium">{searchState.query}</span>"
                    </>
                  )}
                </>
              ) : (
                'Searching...'
              )}
            </div>

            {enhancedResults && enhancedResults.total > 0 && (
              <button
                onClick={handleSaveCurrentSearch}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Save Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar and Results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Saved Searches Sidebar */}
        {showSavedSearches && (
          <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
            <SavedSearches
              onSelectSearch={handleSavedSearchSelect}
              currentQuery={searchState.query}
              currentFilters={getCurrentFilters()}
              onSaveCurrentSearch={handleSaveCurrentSearch}
            />
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-hidden">
          {hasSearchCriteria ? (
            <SearchResults
              results={enhancedResults?.results || []}
              searchTerm={searchState.query}
              isLoading={isLoading}
              onResultClick={handleThreadSelect}
              selectedThreadId={selectedThreadId}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <svg
                className="h-16 w-16 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Search your emails</p>
                <p className="text-sm max-w-sm">
                  Use the search bar above to find emails by content,
                  participants, subjects, or use advanced filters.
                </p>
              </div>

              {/* Quick actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowSavedSearches(true)}
                  className="block text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View saved searches
                </button>
                <button
                  onClick={() => setShowAdvancedFilters(true)}
                  className="block text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Open advanced filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Performance Info */}
      {enhancedResults && hasSearchCriteria && (
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              {enhancedResults.facets && (
                <>
                  <span>
                    Status:{' '}
                    {Object.entries(enhancedResults.facets.statusCounts).length}{' '}
                    types
                  </span>
                  <span>
                    Priority:{' '}
                    {
                      Object.entries(enhancedResults.facets.priorityCounts)
                        .length
                    }{' '}
                    levels
                  </span>
                  <span>
                    Tags:{' '}
                    {Object.entries(enhancedResults.facets.tagCounts).length}{' '}
                    unique
                  </span>
                </>
              )}
            </div>
            <div>Advanced search powered by Convex</div>
          </div>
        </div>
      )}
    </div>
  );
}
