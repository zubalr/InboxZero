'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface SavedSearch {
  _id: string;
  name: string;
  query: string;
  filters: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    participant?: string;
    tags?: string[];
    dateRange?: {
      startDate: number;
      endDate: number;
    };
    sortBy?: string;
  };
  isDefault: boolean;
  lastUsedAt: number;
  useCount: number;
  createdAt: number;
}

interface SavedSearchesProps {
  onSelectSearch: (search: SavedSearch) => void;
  currentQuery?: string;
  currentFilters?: any;
  onSaveCurrentSearch?: () => void;
}

export function SavedSearches({
  onSelectSearch,
  currentQuery = '',
  currentFilters = {},
  onSaveCurrentSearch,
}: SavedSearchesProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [isDefaultSearch, setIsDefaultSearch] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  const savedSearches = useQuery(api.search.getSavedSearches, {
    sortBy: 'lastUsed',
  });

  const saveSearch = useMutation(api.search.saveSearch);
  const useSavedSearch = useMutation(api.search.useSavedSearch);
  const deleteSavedSearch = useMutation(api.search.deleteSavedSearch);
  const updateSavedSearch = useMutation(api.search.updateSavedSearch);

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;

    try {
      await saveSearch({
        name: saveSearchName.trim(),
        query: currentQuery,
        filters: currentFilters,
        isDefault: isDefaultSearch,
      });
      setShowSaveModal(false);
      setSaveSearchName('');
      setIsDefaultSearch(false);
    } catch (error) {
      console.error('Error saving search:', error);
      // Handle error (show toast, etc.)
    }
  };

  const handleUseSearch = async (search: SavedSearch) => {
    try {
      await useSavedSearch({ searchId: search._id as any });
      onSelectSearch(search);
    } catch (error) {
      console.error('Error using saved search:', error);
    }
  };

  const handleDeleteSearch = async (searchId: string) => {
    if (confirm('Are you sure you want to delete this saved search?')) {
      try {
        await deleteSavedSearch({ searchId: searchId as any });
      } catch (error) {
        console.error('Error deleting search:', error);
      }
    }
  };

  const handleToggleDefault = async (search: SavedSearch) => {
    try {
      await updateSavedSearch({
        searchId: search._id as any,
        isDefault: !search.isDefault,
      });
    } catch (error) {
      console.error('Error updating search:', error);
    }
  };

  const formatFilters = (filters: SavedSearch['filters']) => {
    const parts: string[] = [];

    if (filters.status) parts.push(`Status: ${filters.status}`);
    if (filters.priority) parts.push(`Priority: ${filters.priority}`);
    if (filters.participant) parts.push(`Participant: ${filters.participant}`);
    if (filters.tags && filters.tags.length > 0) {
      parts.push(`Tags: ${filters.tags.join(', ')}`);
    }
    if (filters.dateRange) {
      const start = new Date(filters.dateRange.startDate).toLocaleDateString();
      const end = new Date(filters.dateRange.endDate).toLocaleDateString();
      parts.push(`Date: ${start} - ${end}`);
    }

    return parts.join(' • ');
  };

  const canSaveCurrentSearch =
    currentQuery.trim() || Object.keys(currentFilters).length > 0;

  if (!savedSearches) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Saved Searches</h3>
        {canSaveCurrentSearch && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Save Current
          </button>
        )}
      </div>

      {/* Saved searches list */}
      <div className="space-y-2">
        {savedSearches.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No saved searches yet
          </div>
        ) : (
          savedSearches.map((search: any) => (
            <div
              key={search._id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleUseSearch(search)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {search.name}
                    </span>
                    {search.isDefault && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                  </div>

                  {search.query && (
                    <div className="text-xs text-gray-600 mt-1">
                      "{search.query}"
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      Used {search.useCount} times
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(search.lastUsedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() =>
                      setExpandedSearch(
                        expandedSearch === search._id ? null : search._id
                      )
                    }
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Show details"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${
                        expandedSearch === search._id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleToggleDefault(search)}
                    className={`p-1 ${
                      search.isDefault
                        ? 'text-blue-600 hover:text-blue-700'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={
                      search.isDefault ? 'Remove as default' : 'Set as default'
                    }
                  >
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDeleteSearch(search._id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete search"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedSearch === search._id && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 space-y-1">
                    {search.query && (
                      <div>
                        <span className="font-medium">Query:</span> "
                        {search.query}"
                      </div>
                    )}

                    {formatFilters(search.filters) && (
                      <div>
                        <span className="font-medium">Filters:</span>{' '}
                        {formatFilters(search.filters)}
                      </div>
                    )}

                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(search.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Save search modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Save Search
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Name
                </label>
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Urgent emails from team"
                  autoFocus
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefaultSearch}
                  onChange={(e) => setIsDefaultSearch(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isDefault"
                  className="ml-2 text-sm text-gray-700"
                >
                  Set as default search
                </label>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-xs text-gray-600">
                  <div className="font-medium mb-1">Preview:</div>
                  {currentQuery && <div>Query: "{currentQuery}"</div>}
                  {formatFilters(currentFilters) && (
                    <div>Filters: {formatFilters(currentFilters)}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveSearchName('');
                  setIsDefaultSearch(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!saveSearchName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
