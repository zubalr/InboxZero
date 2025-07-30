import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

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

/**
 * Update user presence status and current activity
 */
export const updatePresence = mutation({
  args: {
    status: v.union(
      v.literal('online'),
      v.literal('idle'),
      v.literal('busy'),
      v.literal('offline')
    ),
    threadId: v.optional(v.id('threads')),
    activity: v.optional(
      v.object({
        type: v.union(
          v.literal('viewing_thread'),
          v.literal('composing_reply'),
          v.literal('adding_comment')
        ),
        threadId: v.optional(v.id('threads')),
      })
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const now = Date.now();

    // Check if user already has a presence record
    const existingPresence = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', currentUser._id))
      .first();

    const presenceData = {
      userId: currentUser._id,
      threadId: args.threadId,
      status: args.status,
      currentActivity: args.activity,
      lastSeenAt: now,
      updatedAt: now,
    };

    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, presenceData);
      return existingPresence._id;
    } else {
      return await ctx.db.insert('presence', presenceData);
    }
  },
});

/**
 * Get presence information for users viewing a specific thread
 */
export const listForThread = query({
  args: {
    threadId: v.id('threads'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // Get all presence records for this thread (active in last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const presenceRecords = await ctx.db
      .query('presence')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .filter((q) => q.gt(q.field('lastSeenAt'), fiveMinutesAgo))
      .collect();

    // Get user information for each presence record
    const presenceWithUsers = await Promise.all(
      presenceRecords.map(async (presence) => {
        const user = await ctx.db.get(presence.userId);
        if (!user) return null;

        return {
          _id: presence._id,
          status: presence.status,
          currentActivity: presence.currentActivity,
          lastSeenAt: presence.lastSeenAt,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,
          },
        };
      })
    );

    return presenceWithUsers.filter(Boolean);
  },
});

/**
 * Get all active users in the team (for general presence indicators)
 */
export const listActiveUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get all presence records for team members (active in last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    // First get all team members
    const teamMembers = await ctx.db
      .query('users')
      .withIndex('by_team', (q) => q.eq('teamId', currentUser.teamId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    // Get presence for each team member
    const activePresence = await Promise.all(
      teamMembers.map(async (user) => {
        const presence = await ctx.db
          .query('presence')
          .withIndex('by_user', (q) => q.eq('userId', user._id))
          .filter((q) => q.gt(q.field('lastSeenAt'), tenMinutesAgo))
          .first();

        if (!presence) return null;

        return {
          _id: presence._id,
          status: presence.status,
          currentActivity: presence.currentActivity,
          lastSeenAt: presence.lastSeenAt,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,
          },
        };
      })
    );

    return activePresence.filter(Boolean);
  },
});

/**
 * Clean up old presence records (should be called periodically)
 */
export const cleanupOldPresence = mutation({
  args: {},
  handler: async (ctx) => {
    // Remove presence records older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    const oldRecords = await ctx.db
      .query('presence')
      .filter((q) => q.lt(q.field('lastSeenAt'), oneHourAgo))
      .collect();

    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }

    return { cleaned: oldRecords.length };
  },
});