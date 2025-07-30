// Query result caching utilities for performance optimization
import { v } from 'convex/values';

// Cache configuration
export const CACHE_CONFIG = {
  // Thread list cache duration (5 minutes)
  THREAD_LIST_TTL: 5 * 60 * 1000,

  // Search results cache duration (2 minutes)
  SEARCH_RESULTS_TTL: 2 * 60 * 1000,

  // User presence cache duration (30 seconds)
  PRESENCE_TTL: 30 * 1000,

  // AI summary cache duration (1 hour)
  AI_SUMMARY_TTL: 60 * 60 * 1000,

  // Team members cache duration (10 minutes)
  TEAM_MEMBERS_TTL: 10 * 60 * 1000,
};

// Cache key generators
export const generateCacheKey = {
  threadList: (teamId: string, filters: any) =>
    `threads:${teamId}:${JSON.stringify(filters)}`,

  searchResults: (teamId: string, query: string, filters: any) =>
    `search:${teamId}:${query}:${JSON.stringify(filters)}`,

  threadMessages: (threadId: string, limit: number) =>
    `messages:${threadId}:${limit}`,

  userPresence: (threadId: string) => `presence:${threadId}`,

  teamMembers: (teamId: string) => `team:${teamId}:members`,

  aiSummary: (threadId: string) => `ai:summary:${threadId}`,
};

// Cache invalidation patterns
export const CACHE_INVALIDATION = {
  // When a new message is added to a thread
  onNewMessage: (threadId: string, teamId: string) => [
    `threads:${teamId}:*`,
    `messages:${threadId}:*`,
    `search:${teamId}:*`,
  ],

  // When thread status/assignment changes
  onThreadUpdate: (threadId: string, teamId: string) => [
    `threads:${teamId}:*`,
    `search:${teamId}:*`,
  ],

  // When user presence changes
  onPresenceUpdate: (threadId: string) => [`presence:${threadId}`],

  // When team membership changes
  onTeamUpdate: (teamId: string) => [`team:${teamId}:*`, `threads:${teamId}:*`],
};

// Simple in-memory cache implementation
// Note: In production, consider using Redis or similar
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();

  set(key: string, data: any, ttl: number) {
    const expires = Date.now() + ttl;
    this.cache.set(key, { data, expires });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Pattern-based deletion for cache invalidation
  deletePattern(pattern: string) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expires) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
    };
  }
}

// Global cache instance
export const queryCache = new MemoryCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      queryCache.cleanup();
    },
    5 * 60 * 1000
  );
}

// Cache wrapper for queries
export function withCache<T>(
  key: string,
  ttl: number,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to get from cache first
      const cached = queryCache.get(key);
      if (cached !== null) {
        resolve(cached);
        return;
      }

      // Execute query and cache result
      const result = await queryFn();
      queryCache.set(key, result, ttl);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// Cache invalidation helper
export function invalidateCache(patterns: string[]) {
  for (const pattern of patterns) {
    queryCache.deletePattern(pattern);
  }
}

// Performance monitoring
export interface QueryPerformanceMetrics {
  queryName: string;
  duration: number;
  cacheHit: boolean;
  resultCount?: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: QueryPerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  recordQuery(
    queryName: string,
    duration: number,
    cacheHit: boolean,
    resultCount?: number
  ) {
    this.metrics.push({
      queryName,
      duration,
      cacheHit,
      resultCount,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(queryName?: string, timeRange?: number) {
    let filtered = this.metrics;

    if (queryName) {
      filtered = filtered.filter((m) => m.queryName === queryName);
    }

    if (timeRange) {
      const cutoff = Date.now() - timeRange;
      filtered = filtered.filter((m) => m.timestamp > cutoff);
    }

    return filtered;
  }

  getAveragePerformance(queryName?: string, timeRange?: number) {
    const metrics = this.getMetrics(queryName, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const cacheHits = metrics.filter((m) => m.cacheHit).length;

    return {
      averageDuration: totalDuration / metrics.length,
      cacheHitRate: (cacheHits / metrics.length) * 100,
      totalQueries: metrics.length,
      slowQueries: metrics.filter((m) => m.duration > 1000).length,
    };
  }

  getSlowestQueries(limit = 10, timeRange?: number) {
    const metrics = this.getMetrics(undefined, timeRange);
    return metrics.sort((a, b) => b.duration - a.duration).slice(0, limit);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Performance monitoring wrapper
export function withPerformanceMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  cacheKey?: string
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let cacheHit = false;

    try {
      // Check cache if key provided
      if (cacheKey) {
        const cached = queryCache.get(cacheKey);
        if (cached !== null) {
          cacheHit = true;
          const duration = Date.now() - startTime;
          performanceMonitor.recordQuery(queryName, duration, cacheHit);
          resolve(cached);
          return;
        }
      }

      // Execute query
      const result = await queryFn();
      const duration = Date.now() - startTime;

      // Record metrics
      const resultCount = Array.isArray(result) ? result.length : undefined;
      performanceMonitor.recordQuery(
        queryName,
        duration,
        cacheHit,
        resultCount
      );

      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordQuery(queryName, duration, cacheHit);
      reject(error);
    }
  });
}
