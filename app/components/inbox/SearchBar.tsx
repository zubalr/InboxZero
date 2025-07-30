'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface SearchSuggestion {
  suggestion: string;
  type: 'history' | 'participant' | 'subject' | 'tag';
  frequency?: number;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  isLoading?: boolean;
  enableSuggestions?: boolean;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search emails, subjects, participants...',
  onFocus,
  onBlur,
  isLoading = false,
  enableSuggestions = true,
  onSearch,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get search suggestions
  const suggestions = useQuery(
    api.search.getSearchSuggestions,
    enableSuggestions && internalValue.length >= 2
      ? { query: internalValue, limit: 8 }
      : 'skip'
  ) as SearchSuggestion[] | undefined;

  // Get popular search terms for empty input
  const popularTerms = useQuery(
    api.threads.getPopularSearchTerms,
    enableSuggestions && internalValue.length === 0 && focused
      ? { limit: 5 }
      : 'skip'
  );

  // Auto-complete suggestions
  const autoComplete = useQuery(
    api.search.getAutoCompleteSuggestions,
    enableSuggestions && internalValue.length >= 2
      ? { query: internalValue, context: 'general' }
      : 'skip'
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    (searchValue: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onChange(searchValue);
      }, 300);
    },
    [onChange]
  );

  // Update internal value when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    setSelectedSuggestionIndex(-1);
    debouncedSearch(newValue);

    const shouldShowSuggestions =
      enableSuggestions &&
      (newValue.length >= 2 || (newValue.length === 0 && focused));
    setShowSuggestions(shouldShowSuggestions);
  };

  // Handle focus
  const handleFocus = () => {
    setFocused(true);
    if (enableSuggestions) {
      setShowSuggestions(
        internalValue.length >= 2 || internalValue.length === 0
      );
    }
    onFocus?.();
  };

  // Handle blur
  const handleBlur = () => {
    setFocused(false);
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
    onBlur?.();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    const allSuggestions = [
      ...(popularTerms || []).map((t: any) => ({
        suggestion: t.term,
        type: 'history' as const,
        frequency: t.count,
      })),
      ...(suggestions || []),
      ...(autoComplete || []).map((s: any) => ({
        suggestion: s,
        type: 'general' as const,
      })),
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < allSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (
          selectedSuggestionIndex >= 0 &&
          allSuggestions[selectedSuggestionIndex]
        ) {
          handleSuggestionClick(
            allSuggestions[selectedSuggestionIndex].suggestion
          );
        } else if (onSearch) {
          onSearch(internalValue);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInternalValue(suggestion);
    onChange(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();

    if (onSearch) {
      onSearch(suggestion);
    }
  };

  // Clear search
  const clearSearch = () => {
    setInternalValue('');
    onChange('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    inputRef.current?.focus();
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'history':
        return '🕒';
      case 'participant':
        return '👤';
      case 'subject':
        return '📧';
      case 'tag':
        return '🏷️';
      default:
        return '🔍';
    }
  };

  // Get suggestion label
  const getSuggestionLabel = (type: string) => {
    switch (type) {
      case 'history':
        return 'Recent search';
      case 'participant':
        return 'Participant';
      case 'subject':
        return 'Subject';
      case 'tag':
        return 'Tag';
      default:
        return 'Suggestion';
    }
  };

  // Prepare all suggestions
  const allSuggestions = [
    ...(internalValue.length === 0 && popularTerms
      ? popularTerms.map((t: any) => ({
          suggestion: t.term,
          type: 'history' as const,
          frequency: t.count,
        }))
      : []),
    ...(suggestions || []),
    ...(internalValue.length >= 2 && autoComplete
      ? autoComplete.map((s: any) => ({
          suggestion: s,
          type: 'general' as const,
        }))
      : []),
  ];

  // Remove duplicates
  const uniqueSuggestions = allSuggestions.filter(
    (item, index, arr) =>
      arr.findIndex((i) => i.suggestion === item.suggestion) === index
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <svg
              className="animate-spin h-4 w-4 text-gray-400"
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
          ) : (
            <svg
              className="h-4 w-4 text-gray-400"
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
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors ${
            focused ? 'border-blue-500 ring-1 ring-blue-500' : ''
          }`}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
        />

        {internalValue && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
              aria-label="Clear search"
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
          </div>
        )}
      </div>

      {/* Enhanced Search Suggestions Dropdown */}
      {showSuggestions && uniqueSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-auto">
          <div className="py-1">
            {internalValue.length === 0 &&
              popularTerms &&
              popularTerms.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                    Recent Searches
                  </div>
                  {popularTerms.map((term: any, index: number) => (
                    <button
                      key={`popular-${index}`}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center justify-between ${
                        selectedSuggestionIndex === index ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => handleSuggestionClick(term.term)}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">🕒</span>
                        <span className="text-gray-900">{term.term}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {term.count} time{term.count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                  {(suggestions && suggestions.length > 0) ||
                  (autoComplete && autoComplete.length > 0) ? (
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-t">
                      Suggestions
                    </div>
                  ) : null}
                </>
              )}

            {suggestions &&
              suggestions.map((suggestion, index) => {
                const adjustedIndex =
                  internalValue.length === 0
                    ? (popularTerms?.length || 0) + index
                    : index;
                return (
                  <button
                    key={`suggestion-${index}`}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center justify-between ${
                      selectedSuggestionIndex === adjustedIndex
                        ? 'bg-gray-100'
                        : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion.suggestion)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">
                        {getSuggestionIcon(suggestion.type)}
                      </span>
                      <div>
                        <div className="text-gray-900">
                          {suggestion.suggestion}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getSuggestionLabel(suggestion.type)}
                        </div>
                      </div>
                    </div>
                    {suggestion.frequency && (
                      <span className="text-xs text-gray-500">
                        {suggestion.frequency}x
                      </span>
                    )}
                  </button>
                );
              })}

            {autoComplete &&
              autoComplete.map((completion: any, index: number) => {
                const adjustedIndex =
                  (popularTerms?.length || 0) +
                  (suggestions?.length || 0) +
                  index;
                return (
                  <button
                    key={`auto-${index}`}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center ${
                      selectedSuggestionIndex === adjustedIndex
                        ? 'bg-gray-100'
                        : ''
                    }`}
                    onClick={() => handleSuggestionClick(completion)}
                  >
                    <span className="mr-2">💡</span>
                    <span className="text-gray-700">{completion}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
