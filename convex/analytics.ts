// User analytics and usage tracking
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { logger } from './lib/logging';

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

// Track user events
export const trackEvent = mutation({
  args: {
    event: v.string(),
    properties: v.optional(v.record(v.string(), v.any())),
    sessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Log the event
    logger.logUserAction(args.event, currentUser._id, currentUser.teamId, {
      properties: args.properties,
      sessionId: args.sessionId,
    });

    // Store in database for analytics (optional - could use external service)
    await ctx.db.insert('userEvents', {
      userId: currentUser._id,
      teamId: currentUser.teamId,
      event: args.event,
      properties: args.properties || {},
      sessionId: args.sessionId,
      timestamp: Date.now(),
    });

    return null;
  },
});

// Track page views
export const trackPageView = mutation({
  args: {
    page: v.string(),
    referrer: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    logger.logUserAction('page_view', currentUser._id, currentUser.teamId, {
      page: args.page,
      referrer: args.referrer,
      sessionId: args.sessionId,
      metadata: args.metadata,
    });

    await ctx.db.insert('pageViews', {
      userId: currentUser._id,
      teamId: currentUser.teamId,
      page: args.page,
      referrer: args.referrer,
      sessionId: args.sessionId,
      metadata: args.metadata || {},
      timestamp: Date.now(),
    });

    return null;
  },
});

// Track feature usage
export const trackFeatureUsage = mutation({
  args: {
    feature: v.string(),
    action: v.string(),
    duration: v.optional(v.number()),
    success: v.optional(v.boolean()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    logger.logUserAction(
      `feature_${args.feature}_${args.action}`,
      currentUser._id,
      currentUser.teamId,
      {
        feature: args.feature,
        action: args.action,
        duration: args.duration,
        success: args.success,
        metadata: args.metadata,
      }
    );

    await ctx.db.insert('featureUsage', {
      userId: currentUser._id,
      teamId: currentUser.teamId,
      feature: args.feature,
      action: args.action,
      duration: args.duration,
      success: args.success,
      metadata: args.metadata || {},
      timestamp: Date.now(),
    });

    return null;
  },
});

// Get user analytics dashboard
export const getUserAnalytics = query({
  args: {
    timeRange: v.optional(v.number()), // milliseconds
    userId: v.optional(v.id('users')),
  },
  returns: v.object({
    totalEvents: v.number(),
    totalPageViews: v.number(),
    totalSessions: v.number(),
    averageSessionDuration: v.number(),
    topPages: v.array(
      v.object({
        page: v.string(),
        views: v.number(),
      })
    ),
    topFeatures: v.array(
      v.object({
        feature: v.string(),
        usage: v.number(),
        successRate: v.number(),
      })
    ),
    activityByHour: v.array(v.number()),
    activityByDay: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view other users' analytics
    const targetUserId = args.userId || currentUser._id;
    if (args.userId && currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const timeRange = args.timeRange || 30 * 24 * 60 * 60 * 1000; // Default 30 days
    const cutoff = Date.now() - timeRange;

    // Get events
    const events = await ctx.db
      .query('userEvents')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), targetUserId),
          q.gte(q.field('timestamp'), cutoff)
        )
      )
      .collect();

    // Get page views
    const pageViews = await ctx.db
      .query('pageViews')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), targetUserId),
          q.gte(q.field('timestamp'), cutoff)
        )
      )
      .collect();

    // Get feature usage
    const featureUsage = await ctx.db
      .query('featureUsage')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), targetUserId),
          q.gte(q.field('timestamp'), cutoff)
        )
      )
      .collect();

    // Calculate sessions
    const sessions = new Map<string, { start: number; end: number }>();
    [...pageViews, ...events].forEach((item) => {
      if (item.sessionId) {
        const existing = sessions.get(item.sessionId);
        if (existing) {
          existing.start = Math.min(existing.start, item.timestamp);
          existing.end = Math.max(existing.end, item.timestamp);
        } else {
          sessions.set(item.sessionId, {
            start: item.timestamp,
            end: item.timestamp,
          });
        }
      }
    });

    const totalSessions = sessions.size;
    const averageSessionDuration =
      totalSessions > 0
        ? Array.from(sessions.values()).reduce(
            (sum, session) => sum + (session.end - session.start),
            0
          ) / totalSessions
        : 0;

    // Top pages
    const pageCount = new Map<string, number>();
    pageViews.forEach((pv) => {
      pageCount.set(pv.page, (pageCount.get(pv.page) || 0) + 1);
    });
    const topPages = Array.from(pageCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, views]) => ({ page, views }));

    // Top features
    const featureCount = new Map<string, { total: number; success: number }>();
    featureUsage.forEach((fu) => {
      const existing = featureCount.get(fu.feature) || { total: 0, success: 0 };
      existing.total++;
      if (fu.success !== false) existing.success++;
      featureCount.set(fu.feature, existing);
    });
    const topFeatures = Array.from(featureCount.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([feature, stats]) => ({
        feature,
        usage: stats.total,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
      }));

    // Activity by hour (24 hours)
    const activityByHour = new Array(24).fill(0);
    [...pageViews, ...events].forEach((item) => {
      const hour = new Date(item.timestamp).getHours();
      activityByHour[hour]++;
    });

    // Activity by day (last 7 days)
    const activityByDay = new Array(7).fill(0);
    const now = new Date();
    [...pageViews, ...events].forEach((item) => {
      const itemDate = new Date(item.timestamp);
      const daysDiff = Math.floor(
        (now.getTime() - itemDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysDiff < 7) {
        activityByDay[6 - daysDiff]++;
      }
    });

    return {
      totalEvents: events.length,
      totalPageViews: pageViews.length,
      totalSessions,
      averageSessionDuration,
      topPages,
      topFeatures,
      activityByHour,
      activityByDay,
    };
  },
});

// Get team analytics
export const getTeamAnalytics = query({
  args: {
    timeRange: v.optional(v.number()),
  },
  returns: v.object({
    totalUsers: v.number(),
    activeUsers: v.number(),
    totalThreads: v.number(),
    totalMessages: v.number(),
    averageResponseTime: v.number(),
    topUsers: v.array(
      v.object({
        userId: v.id('users'),
        name: v.string(),
        activity: v.number(),
      })
    ),
    featureAdoption: v.array(
      v.object({
        feature: v.string(),
        users: v.number(),
        adoptionRate: v.number(),
      })
    ),
    systemHealth: v.object({
      errorRate: v.number(),
      averageResponseTime: v.number(),
      uptime: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view team analytics
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const timeRange = args.timeRange || 30 * 24 * 60 * 60 * 1000; // Default 30 days
    const cutoff = Date.now() - timeRange;

    // Get team users
    const teamUsers = await ctx.db
      .query('users')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .collect();

    // Get active users (users with activity in time range)
    const activeUserIds = new Set<string>();
    const userEvents = await ctx.db
      .query('userEvents')
      .filter((q) =>
        q.and(
          q.eq(q.field('teamId'), currentUser.teamId),
          q.gte(q.field('timestamp'), cutoff)
        )
      )
      .collect();

    userEvents.forEach((event) => activeUserIds.add(event.userId));

    // Get threads and messages
    const threads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .collect();

    const recentMessages = await ctx.db
      .query('messages')
      .filter((q) => q.gte(q.field('createdAt'), cutoff))
      .collect();

    const teamMessages = recentMessages.filter((msg) =>
      threads.some((thread) => thread._id === msg.threadId)
    );

    // Calculate average response time (mock calculation)
    const averageResponseTime =
      teamMessages.length > 0
        ? teamMessages.reduce(
            (sum, msg) => sum + (msg.createdAt - (msg.createdAt - 3600000)),
            0
          ) / teamMessages.length
        : 0;

    // Top users by activity
    const userActivity = new Map<string, number>();
    userEvents.forEach((event) => {
      userActivity.set(event.userId, (userActivity.get(event.userId) || 0) + 1);
    });

    const topUsers = Array.from(userActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, activity]) => {
        const user = teamUsers.find((u) => u._id === userId);
        return {
          userId: userId as any,
          name: user?.name || 'Unknown',
          activity,
        };
      });

    // Feature adoption
    const featureUsage = await ctx.db
      .query('featureUsage')
      .filter((q) =>
        q.and(
          q.eq(q.field('teamId'), currentUser.teamId),
          q.gte(q.field('timestamp'), cutoff)
        )
      )
      .collect();

    const featureUsers = new Map<string, Set<string>>();
    featureUsage.forEach((fu) => {
      if (!featureUsers.has(fu.feature)) {
        featureUsers.set(fu.feature, new Set());
      }
      featureUsers.get(fu.feature)!.add(fu.userId);
    });

    const featureAdoption = Array.from(featureUsers.entries())
      .map(([feature, users]) => ({
        feature,
        users: users.size,
        adoptionRate:
          teamUsers.length > 0 ? (users.size / teamUsers.length) * 100 : 0,
      }))
      .sort((a, b) => b.adoptionRate - a.adoptionRate);

    // System health (from logger)
    const logStats = logger.getLogStats(timeRange);

    return {
      totalUsers: teamUsers.length,
      activeUsers: activeUserIds.size,
      totalThreads: threads.length,
      totalMessages: teamMessages.length,
      averageResponseTime,
      topUsers,
      featureAdoption,
      systemHealth: {
        errorRate: logStats.errorRate,
        averageResponseTime:
          logStats.topFunctions.length > 0
            ? logStats.topFunctions.reduce((sum, f) => sum + f.avgDuration, 0) /
              logStats.topFunctions.length
            : 0,
        uptime: 99.9, // Mock uptime - in production, calculate from monitoring data
      },
    };
  },
});

// Get system logs (admin only)
export const getSystemLogs = query({
  args: {
    level: v.optional(v.number()),
    functionName: v.optional(v.string()),
    timeRange: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      timestamp: v.number(),
      level: v.number(),
      message: v.string(),
      functionName: v.optional(v.string()),
      userId: v.optional(v.string()),
      teamId: v.optional(v.string()),
      duration: v.optional(v.number()),
      context: v.optional(v.record(v.string(), v.any())),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to view system logs
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    const logs = logger.getLogs({
      level: args.level,
      functionName: args.functionName,
      startTime: args.timeRange ? Date.now() - args.timeRange : undefined,
      limit: args.limit,
    });

    return logs.map((log) => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      functionName: log.functionName,
      userId: log.userId,
      teamId: log.teamId,
      duration: log.duration,
      context: log.context,
    }));
  },
});

// Export analytics data
export const exportAnalytics = query({
  args: {
    type: v.union(v.literal('user'), v.literal('team'), v.literal('logs')),
    format: v.union(v.literal('json'), v.literal('csv')),
    timeRange: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Only allow admins to export analytics
    if (currentUser.role !== 'admin') {
      throw new Error('Access denied: Admin role required');
    }

    switch (args.type) {
      case 'logs':
        return logger.exportLogs(args.format);

      case 'user':
      case 'team':
        // In a real implementation, this would export user/team analytics
        // For now, return a placeholder
        const data = { type: args.type, exported: new Date().toISOString() };
        return args.format === 'csv'
          ? Object.entries(data)
              .map(([k, v]) => `${k},${v}`)
              .join('\n')
          : JSON.stringify(data, null, 2);

      default:
        throw new Error('Invalid export type');
    }
  },
});
