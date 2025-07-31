/**
 * React hook for managing cached user data and reducing unnecessary API calls
 */

import { useQuery } from 'convex/react';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/convex/_generated/api';
import { AuthStorage, type StoredUserData } from './auth-storage';

export interface UseUserDataOptions {
  enableCache?: boolean;
  refetchOnMount?: boolean;
  refetchInterval?: number;
}

export function useUserData(options: UseUserDataOptions = {}) {
  const {
    enableCache = true,
    refetchOnMount = false,
    refetchInterval,
  } = options;

  const [cachedData, setCachedData] = useState<StoredUserData | null>(null);
  const [skipServerFetch, setSkipServerFetch] = useState(false);

  // Always fetch from server, but we'll use cache when available
  const serverData = useQuery(api.users.getCurrentUser);

  // Initialize cached data on mount
  useEffect(() => {
    if (enableCache) {
      const cached = AuthStorage.getCachedUserData();
      if (cached) {
        setCachedData(cached);
        if (!refetchOnMount) {
          setSkipServerFetch(true);
        }
      }
    }
  }, [enableCache, refetchOnMount]);

  // Update cache when server data changes
  useEffect(() => {
    if (serverData && enableCache) {
      const dataToStore = {
        id: serverData._id,
        email: serverData.email,
        name: serverData.name,
        role: serverData.role,
        teamId: serverData.teamId,
        profileImage: serverData.profileImage,
        preferences: serverData.preferences,
        lastActiveAt: serverData.lastActiveAt,
      };

      AuthStorage.storeUserData(dataToStore);
      setCachedData({ ...dataToStore, cachedAt: Date.now() });
      setSkipServerFetch(false);
    }
  }, [serverData, enableCache]);

  // Set up refetch interval
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      const interval = setInterval(() => {
        setSkipServerFetch(false);
      }, refetchInterval);

      return () => clearInterval(interval);
    }
  }, [refetchInterval]);

  // Manually trigger refetch
  const refetch = useCallback(() => {
    setSkipServerFetch(false);
    if (enableCache) {
      AuthStorage.clearUserData();
      setCachedData(null);
    }
  }, [enableCache]);

  // Update last active timestamp
  const updateLastActive = useCallback(() => {
    if (enableCache) {
      AuthStorage.updateLastActive();
      const updated = AuthStorage.getCachedUserData();
      if (updated) {
        setCachedData(updated);
      }
    }
  }, [enableCache]);

  // Determine which data to return - prefer cache if available and valid
  const userData =
    enableCache && cachedData && skipServerFetch ? cachedData : serverData;
  const isLoading = serverData === undefined && (!enableCache || !cachedData);
  const hasCache = enableCache && cachedData !== null;

  return {
    data: userData,
    isLoading,
    hasCache,
    refetch,
    updateLastActive,
    cacheStatus: enableCache ? AuthStorage.getCacheStatus() : null,
  };
}

/**
 * Hook specifically for checking if user is authenticated
 * Uses cache first to avoid unnecessary API calls
 */
export function useIsAuthenticated() {
  const { data, isLoading } = useUserData({
    enableCache: true,
    refetchOnMount: false,
  });

  return {
    isAuthenticated: !!data,
    isLoading,
    user: data,
  };
}

/**
 * Hook for user preferences with cache optimization
 */
export function useUserPreferences() {
  const { data, isLoading, updateLastActive } = useUserData({
    enableCache: true,
    refetchOnMount: false,
  });

  const preferences = data?.preferences || {
    emailNotifications: true,
    theme: 'system' as const,
    timezone: 'UTC',
  };

  return {
    preferences,
    isLoading,
    updateLastActive,
  };
}
