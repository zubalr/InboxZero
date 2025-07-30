'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SearchBarEnhanced } from './SearchBarEnhanced';
import { AdvancedFiltersIntegrated } from './AdvancedFiltersIntegrated';
import { SearchResults } from './SearchResults';
import { SavedSearches } from './SavedSearches';
import { SearchAnalytics } from './SearchAnalytics';
import { useSearchState } from './useSearchState';
import { AdvancedFilterOptions } from './AdvancedFilters';

interface ComprehensiveSearchInterfaceProps {
  onThreadSelect: (threadId: string) => void;
  selectedThreadId?: string;
  teamId: string;
}

export function ComprehensiveSearchInterface({
  onThreadSelect,
  selectedThreadId,
  teamId,
}: ComprehensiveSearchInterfaceProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'analytics'>(
    'search'
  );

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
    api.threads.searchThreads,
    hasSearchCriteria
      ? {
          searchTerm: searchState.query || '',
          ...getCurrentFilters(),
          sortBy: searchState.sortBy || 'newest',
          limit: 50,
        }
      : 'skip'
  );

  const handleFilterChange = (filters: AdvancedFilterOptions) => {
    // Update search state with new filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        updateURL({ [key]: value });
      }
    });
  };

  const handleApplyFilters = () => {
    // Trigger search with current filters
    logCurrentSearch(enhancedResults?.total || 0);
    setShowAdvancedFilters(false);
  };

  const handleClearFilters = () => {
    clearSearch();
    setShowAdvancedFilters(false);
  };

  const handleSaveCurrentSearch = () => {
    // This will be handled by the SavedSearches component
    setShowSavedSearches(true);
  };

  const handleSelectSavedSearch = (search: any) => {
    applySavedSearch(search);
    setShowSavedSearches(false);
  };

  const currentFilters: AdvancedFilterOptions = {
    status: searchState.status as any,
    priority: searchState.priority as any,
    assignedTo: searchState.assignee,
    assignedToMe: false, // This needs to be derived from assignee
    dateRange: undefined, // Not in SearchState, needs to be added or derived
    hasAttachments: false, // Not in SearchState, needs to be added
    participant: searchState.participants,
    tags: searchState.tags,
    sortBy: searchState.sortBy as any,
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Search & Filter
        </h1>
        <p className="text-gray-600">
          Find emails, manage saved searches, and analyze your inbox patterns
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'search', label: 'Search', count: null },
            { id: 'saved', label: 'Saved Searches', count: null },
            { id: 'analytics', label: 'Analytics', count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <SearchBarEnhanced
              value={searchState.query || ''}
              onChange={(value) => updateURL({ query: value })}
              onSearch={() => logCurrentSearch(enhancedResults?.total || 0)}
              placeholder="Search emails, subjects, participants..."
              isLoading={isLoading}
              enableSuggestions={true}
            />

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`text-sm ${
                    hasActiveFilters || showAdvancedFilters
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Advanced Filters
                  {hasActiveFilters && (
                    <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </button>

                {hasSearchCriteria && (
                  <button
                    onClick={handleSaveCurrentSearch}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Save Search
                  </button>
                )}

                {(hasSearchCriteria || hasActiveFilters) && (
                  <button
                    onClick={clearSearch}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-500">
                {enhancedResults ? `${enhancedResults.total} results` : ''}
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <AdvancedFiltersIntegrated
              filters={currentFilters}
              onChange={handleFilterChange}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              isExpanded={showAdvancedFilters}
              onToggleExpanded={() =>
                setShowAdvancedFilters(!showAdvancedFilters)
              }
              teamId={teamId}
            />
          )}

          {/* Search Results */}
          {hasSearchCriteria && (
            <SearchResults
              results={enhancedResults?.results || []}
              onResultClick={(threadId) => {
                logResultClick(threadId);
                onThreadSelect(threadId);
              }}
              selectedThreadId={selectedThreadId}
              isLoading={isLoading}
              searchTerm={searchState.query || ''}
            />
          )}

          {/* Empty State */}
          {!hasSearchCriteria && !hasActiveFilters && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start searching
              </h3>
              <p className="text-gray-500 mb-4">
                Enter a search term or use advanced filters to find specific
                emails
              </p>
              <button
                onClick={() => setShowAdvancedFilters(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                Open Advanced Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saved Searches Tab */}
      {activeTab === 'saved' && (
        <SavedSearches
          onSelectSearch={handleSelectSavedSearch}
          currentQuery={searchState.query}
          currentFilters={currentFilters}
          onSaveCurrentSearch={handleSaveCurrentSearch}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && <SearchAnalytics />}
    </div>
  );
}
