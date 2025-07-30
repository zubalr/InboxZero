'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState } from 'react';

interface SearchAnalyticsProps {
  className?: string;
}

export function SearchAnalytics({ className }: SearchAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');

  // Get popular search terms
  const popularTerms = useQuery(api.threads.getPopularSearchTerms, {
    limit: 10,
  });

  // Get search history insights
  const searchInsights = useQuery(api.search.getSearchInsights, {
    timeframe,
  });

  // Get saved searches
  const savedSearches = useQuery(api.search.getSavedSearches, {});

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case 'day':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      default:
        return 'This Week';
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Search Analytics
          </h3>
          <div className="flex items-center space-x-2">
            <select
              value={timeframe}
              onChange={(e) =>
                setTimeframe(e.target.value as 'day' | 'week' | 'month')
              }
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Search Overview */}
        {searchInsights && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(searchInsights.totalSearches)}
              </div>
              <div className="text-sm text-gray-500">Total Searches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(searchInsights.uniqueTerms)}
              </div>
              <div className="text-sm text-gray-500">Unique Terms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {searchInsights.avgResultsPerSearch.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Avg Results</div>
            </div>
          </div>
        )}

        {/* Popular Search Terms */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Popular Search Terms ({getTimeframeLabel(timeframe)})
          </h4>
          {popularTerms && popularTerms.length > 0 ? (
            <div className="space-y-2">
              {popularTerms.map((term: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <span className="text-sm text-gray-900">{term.term}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {term.count} searches
                    </span>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${(term.count / (popularTerms[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No search data for {getTimeframeLabel(timeframe).toLowerCase()}
            </div>
          )}
        </div>

        {/* Search Patterns */}
        {searchInsights && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Search Patterns
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Most Active Hour</span>
                <span className="font-medium">
                  {searchInsights.peakHour}:00 - {searchInsights.peakHour + 1}
                  :00
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Search Length</span>
                <span className="font-medium">
                  {searchInsights.avgSearchLength.toFixed(1)} words
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-medium text-green-600">
                  {(searchInsights.successRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Saved Searches Quick Access */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Recent Saved Searches
          </h4>
          {savedSearches && savedSearches.length > 0 ? (
            <div className="space-y-2">
              {savedSearches.slice(0, 5).map((search: any) => (
                <div
                  key={search._id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {search.name}
                    </div>
                    {search.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {search.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-xs text-gray-500">
                      {search.executionCount} uses
                    </span>
                    <button className="text-blue-600 hover:text-blue-700">
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
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No saved searches yet
            </div>
          )}
        </div>

        {/* Search Tips */}
        <div className="bg-blue-50 rounded-md p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Search Tips
          </h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Use quotes for exact phrases: "urgent project"</li>
            <li>• Search by participant: from:john@company.com</li>
            <li>• Combine terms: meeting AND budget</li>
            <li>• Use wildcards: proj* for project, projects, etc.</li>
            <li>• Filter by date: after:2024-01-01</li>
          </ul>
        </div>

        {/* Performance Insights */}
        {searchInsights &&
          searchInsights.slowQueries &&
          searchInsights.slowQueries.length > 0 && (
            <div className="bg-yellow-50 rounded-md p-3">
              <h4 className="text-sm font-medium text-yellow-900 mb-2">
                Performance Insights
              </h4>
              <div className="text-xs text-yellow-800">
                <p className="mb-1">
                  Some recent searches took longer than usual:
                </p>
                <ul className="space-y-1">
                  {searchInsights.slowQueries
                    .slice(0, 3)
                    .map((query: any, index: number) => (
                      <li key={index}>
                        • "{query.term}" ({query.duration}ms)
                      </li>
                    ))}
                </ul>
                <p className="mt-2 font-medium">
                  Tip: Try more specific terms or use filters to improve search
                  speed.
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
