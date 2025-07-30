'use client';

import { useState } from 'react';
import { FilterDropdown } from './FilterDropdown';

export interface AdvancedFilterOptions {
  status?: 'unread' | 'read' | 'replied' | 'closed' | 'archived';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  assignedToMe?: boolean;
  assignedTo?: string;
  dateRange?: 'today' | 'week' | 'month' | 'custom';
  hasAttachments?: boolean;
  participant?: string;
  tags?: string[];
  sortBy?: 'newest' | 'oldest' | 'priority' | 'subject';
}

interface AdvancedFiltersProps {
  filters: AdvancedFilterOptions;
  onChange: (filters: AdvancedFilterOptions) => void;
  teamMembers?: Array<{ _id: string; name: string; email: string }>;
  availableTags?: string[];
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function AdvancedFilters({
  filters,
  onChange,
  teamMembers = [],
  availableTags = [],
  isExpanded = false,
  onToggleExpanded,
}: AdvancedFiltersProps) {
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);

  const updateFilter = <K extends keyof AdvancedFilterOptions>(
    key: K,
    value: AdvancedFilterOptions[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const statusOptions = [
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
    { value: 'replied', label: 'Replied' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
  ];

  const priorityOptions = [
    { value: 'urgent', label: '🔴 Urgent' },
    { value: 'high', label: '🟠 High' },
    { value: 'normal', label: '🟡 Normal' },
    { value: 'low', label: '🟢 Low' },
  ];

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'priority', label: 'By Priority' },
    { value: 'subject', label: 'By Subject' },
  ];

  const assigneeOptions = teamMembers.map((member) => ({
    value: member._id,
    label: member.name,
  }));

  const clearAllFilters = () => {
    onChange({});
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== null && value !== false
  );

  return (
    <div className="border-t border-gray-200 pt-4">
      {/* Toggle Button */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onToggleExpanded}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className={`mr-2 h-4 w-4 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Advanced Filters
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Row 1: Status, Priority, Assignment */}
          <div className="flex flex-wrap gap-3">
            <FilterDropdown
              label="Status"
              value={filters.status}
              onChange={(value) => updateFilter('status', value as any)}
              options={statusOptions}
            />

            <FilterDropdown
              label="Priority"
              value={filters.priority}
              onChange={(value) => updateFilter('priority', value as any)}
              options={priorityOptions}
            />

            <FilterDropdown
              label="Assigned To"
              value={filters.assignedTo}
              onChange={(value) => updateFilter('assignedTo', value)}
              options={assigneeOptions}
            />

            <button
              onClick={() =>
                updateFilter('assignedToMe', !filters.assignedToMe)
              }
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                filters.assignedToMe
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Assigned to me
            </button>
          </div>

          {/* Row 2: Date Range, Sort */}
          <div className="flex flex-wrap gap-3">
            <FilterDropdown
              label="Date Range"
              value={filters.dateRange}
              onChange={(value) => {
                updateFilter('dateRange', value as any);
                setShowCustomDateRange(value === 'custom');
              }}
              options={dateRangeOptions}
            />

            <FilterDropdown
              label="Sort By"
              value={filters.sortBy}
              onChange={(value) => updateFilter('sortBy', value as any)}
              options={sortOptions}
            />

            <button
              onClick={() =>
                updateFilter('hasAttachments', !filters.hasAttachments)
              }
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                filters.hasAttachments
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              📎 Has Attachments
            </button>
          </div>

          {/* Custom Date Range */}
          {showCustomDateRange && (
            <div className="flex gap-3 items-center">
              <label className="text-sm text-gray-700">From:</label>
              <input
                type="date"
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <label className="text-sm text-gray-700">To:</label>
              <input
                type="date"
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Row 3: Participant Search */}
          <div className="flex gap-3 items-center">
            <label className="text-sm text-gray-700 whitespace-nowrap">
              Participant:
            </label>
            <input
              type="email"
              placeholder="Search by email address..."
              value={filters.participant || ''}
              onChange={(e) =>
                updateFilter('participant', e.target.value || undefined)
              }
              className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Row 4: Tags (if available) */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Tags:</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const currentTags = filters.tags || [];
                      const newTags = currentTags.includes(tag)
                        ? currentTags.filter((t) => t !== tag)
                        : [...currentTags, tag];
                      updateFilter(
                        'tags',
                        newTags.length > 0 ? newTags : undefined
                      );
                    }}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      filters.tags?.includes(tag)
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
