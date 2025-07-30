'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdvancedFilterOptions } from './AdvancedFilters';

interface AdvancedFiltersIntegratedProps {
  filters: AdvancedFilterOptions;
  onChange: (filters: AdvancedFilterOptions) => void;
  onApply: () => void;
  onClear: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  teamId?: string;
}

export function AdvancedFiltersIntegrated({
  filters,
  onChange,
  onApply,
  onClear,
  isExpanded = false,
  onToggleExpanded,
  teamId,
}: AdvancedFiltersIntegratedProps) {
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get team members for assignee dropdown
  const teamMembers = useQuery(api.users.getTeamMembers, {});

  // Get available tags from search analytics
  const searchAnalytics = useQuery(api.search.getSearchAnalytics, {});

  const updateFilter = <K extends keyof AdvancedFilterOptions>(
    key: K,
    value: AdvancedFilterOptions[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const handleApplyFilters = () => {
    if (filters.dateRange === 'custom' && customStartDate && customEndDate) {
      // Custom date range will be handled in the parent component
      // Just pass the custom dates through the existing filter structure
    }
    onApply();
  };

  const handleClearFilters = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setShowCustomDateRange(false);
    onClear();
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== '' && value !== false
  );

  if (!isExpanded) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-200">
        <button
          onClick={onToggleExpanded}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
          <span>Advanced Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear All
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Advanced Filters</h3>
        <button
          onClick={onToggleExpanded}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) =>
              updateFilter('status', (e.target.value as any) || undefined)
            }
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={filters.priority || ''}
            onChange={(e) =>
              updateFilter('priority', (e.target.value as any) || undefined)
            }
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Assignee
          </label>
          <select
            value={filters.assignedTo || ''}
            onChange={(e) =>
              updateFilter('assignedTo', e.target.value || undefined)
            }
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {teamMembers?.map((member: any) => (
              <option key={member._id} value={member._id}>
                {member.name || member.email}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Date Range
          </label>
          <select
            value={filters.dateRange || ''}
            onChange={(e) => {
              const value = e.target.value as any;
              updateFilter('dateRange', value || undefined);
              setShowCustomDateRange(value === 'custom');
            }}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {/* Participant Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Participant
          </label>
          <input
            type="text"
            value={filters.participant || ''}
            onChange={(e) =>
              updateFilter('participant', e.target.value || undefined)
            }
            placeholder="Email address"
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            value={filters.sortBy || 'newest'}
            onChange={(e) => updateFilter('sortBy', e.target.value as any)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Priority</option>
            <option value="subject">Subject A-Z</option>
          </select>
        </div>
      </div>

      {/* Custom Date Range */}
      {showCustomDateRange && (
        <div className="mt-4 p-3 border border-gray-200 rounded bg-white">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Options */}
      <div className="mt-4 space-y-2">
        <label className="flex items-center text-sm text-gray-700">
          <input
            type="checkbox"
            checked={filters.hasAttachments || false}
            onChange={(e) =>
              updateFilter('hasAttachments', e.target.checked || undefined)
            }
            className="mr-2 rounded"
          />
          Has attachments
        </label>

        <label className="flex items-center text-sm text-gray-700">
          <input
            type="checkbox"
            checked={filters.assignedToMe || false}
            onChange={(e) =>
              updateFilter('assignedToMe', e.target.checked || undefined)
            }
            className="mr-2 rounded"
          />
          Assigned to me
        </label>
      </div>

      {/* Tags */}
      {searchAnalytics?.topQueries && searchAnalytics.topQueries.length > 0 && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Popular Search Terms
          </label>
          <div className="flex flex-wrap gap-2">
            {searchAnalytics.topQueries.slice(0, 10).map((term: any) => (
              <button
                key={term.query}
                onClick={() => {
                  const currentTags = filters.tags || [];
                  const newTags = currentTags.includes(term.query)
                    ? currentTags.filter((t) => t !== term.query)
                    : [...currentTags, term.query];
                  updateFilter(
                    'tags',
                    newTags.length > 0 ? newTags : undefined
                  );
                }}
                className={`px-2 py-1 text-xs rounded-full border ${
                  filters.tags?.includes(term.query)
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {term.query} ({term.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          {hasActiveFilters ? 'Filters applied' : 'No filters applied'}
        </span>
        <div className="space-x-2">
          <button
            onClick={handleClearFilters}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Clear All
          </button>
          <button
            onClick={handleApplyFilters}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
