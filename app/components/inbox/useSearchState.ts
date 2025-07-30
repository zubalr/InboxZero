'use client';

import {
  useRouter,
  useSearchParams as useNextSearchParams,
  usePathname,
} from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export interface SearchState {
  query: string;
  status?: string;
  priority?: string;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  participants?: string;
  sortBy?: string;
  searchType?: 'threads' | 'messages';
}

export interface SearchResults {
  results: any[];
  total: number;
  hasMore: boolean;
}

export function useSearchState() {
  const router = useRouter();
  const searchParams = useNextSearchParams();
  const pathname = usePathname();

  const logSearch = useMutation(api.search.logSearch);
  const logSearchClick = useMutation(api.search.logSearchClick);

  const [searchState, setSearchState] = useState<SearchState>(() => {
    return {
      query: searchParams.get('q') || '',
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      assignee: searchParams.get('assignee') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      participants: searchParams.get('participants') || undefined,
      sortBy: searchParams.get('sortBy') || 'relevance',
      searchType:
        (searchParams.get('searchType') as 'threads' | 'messages') || 'threads',
    };
  });

  const [searchResults, setSearchResults] = useState<SearchResults>({
    results: [],
    total: 0,
    hasMore: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentSearchHistoryId, setCurrentSearchHistoryId] = useState<
    string | null
  >(null);

  // Generate a session ID for search analytics
  const [sessionId] = useState(
    () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  );

  // Update URL when search state changes
  const updateURL = useCallback(
    (newState: Partial<SearchState>) => {
      const updatedState = { ...searchState, ...newState };
      setSearchState(updatedState);

      const params = new URLSearchParams();

      // Only add non-empty values to URL
      if (updatedState.query?.trim()) {
        params.set('q', updatedState.query.trim());
      }
      if (updatedState.status) {
        params.set('status', updatedState.status);
      }
      if (updatedState.priority) {
        params.set('priority', updatedState.priority);
      }
      if (updatedState.assignee) {
        params.set('assignee', updatedState.assignee);
      }
      if (updatedState.startDate) {
        params.set('startDate', updatedState.startDate);
      }
      if (updatedState.endDate) {
        params.set('endDate', updatedState.endDate);
      }
      if (updatedState.tags && updatedState.tags.length > 0) {
        params.set('tags', updatedState.tags.join(','));
      }
      if (updatedState.participants) {
        params.set('participants', updatedState.participants);
      }
      if (updatedState.sortBy && updatedState.sortBy !== 'relevance') {
        params.set('sortBy', updatedState.sortBy);
      }
      if (updatedState.searchType && updatedState.searchType !== 'threads') {
        params.set('searchType', updatedState.searchType);
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      router.replace(newUrl);
    },
    [searchState, pathname, router]
  );

  // Clear all search state
  const clearSearch = useCallback(() => {
    setSearchState({
      query: '',
      tags: [],
      sortBy: 'relevance',
      searchType: 'threads',
    });
    setSearchResults({ results: [], total: 0, hasMore: false });
    router.replace(pathname);
  }, [pathname, router]);

  // Apply a saved search
  const applySavedSearch = useCallback(
    (savedSearch: {
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
    }) => {
      const newState: SearchState = {
        query: savedSearch.query,
        status: savedSearch.filters.status,
        priority: savedSearch.filters.priority,
        assignee: savedSearch.filters.assignedTo,
        participants: savedSearch.filters.participant,
        tags: savedSearch.filters.tags || [],
        sortBy: savedSearch.filters.sortBy || 'relevance',
        searchType: 'threads',
      };

      if (savedSearch.filters.dateRange) {
        newState.startDate = new Date(savedSearch.filters.dateRange.startDate)
          .toISOString()
          .split('T')[0];
        newState.endDate = new Date(savedSearch.filters.dateRange.endDate)
          .toISOString()
          .split('T')[0];
      }

      updateURL(newState);
    },
    [updateURL]
  );

  // Get current filters for API calls
  const getCurrentFilters = useCallback(() => {
    const filters: any = {};

    if (searchState.status) filters.status = searchState.status;
    if (searchState.priority) filters.priority = searchState.priority;
    if (searchState.assignee) filters.assignedTo = searchState.assignee;
    if (searchState.participants)
      filters.participant = searchState.participants;
    if (searchState.tags && searchState.tags.length > 0)
      filters.tags = searchState.tags;
    if (searchState.sortBy) filters.sortBy = searchState.sortBy;

    if (searchState.startDate && searchState.endDate) {
      filters.dateRange = {
        startDate: new Date(searchState.startDate).getTime(),
        endDate: new Date(searchState.endDate).getTime(),
      };
    }

    return filters;
  }, [searchState]);

  // Log search for analytics
  const logCurrentSearch = useCallback(
    async (resultsCount: number) => {
      try {
        const historyId = await logSearch({
          query: searchState.query,
          filters: JSON.stringify(getCurrentFilters()),
          resultsCount,
          sessionId,
        });
        setCurrentSearchHistoryId(historyId);
      } catch (error) {
        console.warn('Failed to log search:', error);
      }
    },
    [searchState.query, getCurrentFilters, sessionId, logSearch]
  );

  // Log search result click
  const logResultClick = useCallback(
    async (threadId: string) => {
      if (currentSearchHistoryId) {
        try {
          await logSearchClick({
            historyId: currentSearchHistoryId as any,
            threadId: threadId as any,
          });
        } catch (error) {
          console.warn('Failed to log search click:', error);
        }
      }
    },
    [currentSearchHistoryId, logSearchClick]
  );

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return !!(
      searchState.status ||
      searchState.priority ||
      searchState.assignee ||
      searchState.participants ||
      (searchState.tags && searchState.tags.length > 0) ||
      searchState.startDate ||
      searchState.endDate
    );
  }, [searchState]);

  // Check if search has any criteria
  const hasSearchCriteria = useCallback(() => {
    return !!(searchState.query?.trim() || hasActiveFilters());
  }, [searchState.query, hasActiveFilters]);

  return {
    // State
    searchState,
    searchResults,
    isLoading,
    sessionId,

    // Actions
    updateURL,
    clearSearch,
    applySavedSearch,
    getCurrentFilters,
    logCurrentSearch,
    logResultClick,

    // Computed
    hasActiveFilters: hasActiveFilters(),
    hasSearchCriteria: hasSearchCriteria(),

    // Setters
    setSearchResults,
    setIsLoading,
  };
}
