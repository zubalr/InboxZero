// Performance monitoring and analytics queries
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { performanceMonitor, queryCache } from './lib/cache';

// Helper function to get current user
async function getCurrentUserFromAuth(ctx: any) {
  const identity = await getAuthUserId(ctx);
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const authUser = await ctx.db.get(identity);
  if (!authUser) {
    throw new Error('Auth user not found');
  }

  const currentUser = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', authUser.email))
    .first();

  if (!currentUser) {
    throw new Error('User profile not found');
  }

  return currentUser;
}

// Get query performance metrics
export const getQueryPerformance = query({
  args: {
    queryName: v.optional(v.string()),
    timeRange: v.optional(v.number()), // milliseconds
  },
  returns: v.object({
    averageDuration: v.optional(v.number()),
    cacheHitRate: v.optional(v.number()),
    totalQueries: v.number(),
    slowQueries: v.number(),
    slowestQueries: v.array(
      v.object({
        queryName: v.string(),
        duration: v.number(),
        cacheHit: v.boolean(),
        resultCount: v.optional(v.number()),
        timestamp: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view performance metrics
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const performance = performanceMonitor.getAveragePerformance(
      args.queryName,
      args.timeRange
    );

    const slowestQueries = performanceMonitor.getSlowestQueries(
      10,
      args.timeRange
    );

    return {
      averageDuration: performance?.averageDuration,
      cacheHitRate: performance?.cacheHitRate,
      totalQueries: performance?.totalQueries || 0,
      slowQueries: performance?.slowQueries || 0,
      slowestQueries,
    };
  },
});

// Get cache statistics
export const getCacheStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    active: v.number(),
    expired: v.number(),
    hitRate: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view cache stats
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const stats = queryCache.getStats();
    const performance = performanceMonitor.getAveragePerformance();

    return {
      ...stats,
      hitRate: performance?.cacheHitRate || 0,
    };
  },
});

// Clear cache (admin only)
export const clearCache = mutation({
  args: {
    pattern: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to clear cache
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    if (args.pattern) {
      queryCache.deletePattern(args.pattern);
    } else {
      queryCache.clear();
    }

    return null;
  },
});

// Get database query analysis
export const getDatabaseAnalytics = query({
  args: {
    timeRange: v.optional(v.number()),
  },
  returns: v.object({
    threadQueries: v.object({
      total: v.number(),
      averageDuration: v.number(),
      slowQueries: v.number(),
    }),
    messageQueries: v.object({
      total: v.number(),
      averageDuration: v.number(),
      slowQueries: v.number(),
    }),
    searchQueries: v.object({
      total: v.number(),
      averageDuration: v.number(),
      slowQueries: v.number(),
    }),
    indexUsage: v.array(
      v.object({
        indexName: v.string(),
        usage: v.number(),
        efficiency: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view database analytics
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const timeRange = args.timeRange || 24 * 60 * 60 * 1000; // Default 24 hours

    // Get performance metrics for different query types
    const threadPerf = performanceMonitor.getAveragePerformance(
      'threads',
      timeRange
    );
    const messagePerf = performanceMonitor.getAveragePerformance(
      'messages',
      timeRange
    );
    const searchPerf = performanceMonitor.getAveragePerformance(
      'search',
      timeRange
    );

    // Mock index usage data (in production, this would come from database metrics)
    const indexUsage = [
      { indexName: 'by_team', usage: 85, efficiency: 92 },
      { indexName: 'by_team_and_status', usage: 65, efficiency: 88 },
      { indexName: 'by_team_and_assignee', usage: 45, efficiency: 90 },
      { indexName: 'search_content', usage: 30, efficiency: 75 },
      { indexName: 'by_last_message', usage: 70, efficiency: 95 },
    ];

    return {
      threadQueries: {
        total: threadPerf?.totalQueries || 0,
        averageDuration: threadPerf?.averageDuration || 0,
        slowQueries: threadPerf?.slowQueries || 0,
      },
      messageQueries: {
        total: messagePerf?.totalQueries || 0,
        averageDuration: messagePerf?.averageDuration || 0,
        slowQueries: messagePerf?.slowQueries || 0,
      },
      searchQueries: {
        total: searchPerf?.totalQueries || 0,
        averageDuration: searchPerf?.averageDuration || 0,
        slowQueries: searchPerf?.slowQueries || 0,
      },
      indexUsage,
    };
  },
});

// Optimize database queries (admin only)
export const optimizeQueries = mutation({
  args: {
    queryType: v.union(
      v.literal('threads'),
      v.literal('messages'),
      v.literal('search'),
      v.literal('all')
    ),
  },
  returns: v.object({
    optimized: v.number(),
    cacheCleared: v.boolean(),
    indexesAnalyzed: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to optimize queries
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    // Clear relevant cache patterns
    const patterns = [];
    switch (args.queryType) {
      case 'threads':
        patterns.push('threads:*');
        break;
      case 'messages':
        patterns.push('messages:*');
        break;
      case 'search':
        patterns.push('search:*');
        break;
      case 'all':
        patterns.push('*');
        break;
    }

    for (const pattern of patterns) {
      queryCache.deletePattern(pattern);
    }

    // In a real implementation, this would trigger database optimization
    // For now, we'll simulate the optimization
    const optimized = patterns.length;
    const cacheCleared = true;
    const indexesAnalyzed = 5;

    return {
      optimized,
      cacheCleared,
      indexesAnalyzed,
    };
  },
});
