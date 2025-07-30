import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

// Create user profile after authentication
export const createUserProfile = mutation({
  args: {
    name: v.string(),
    teamId: v.optional(v.id('teams')),
    email: v.string(),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingUser) {
      throw new Error('User already exists');
    }

    // If no teamId provided, create a new team
    let teamId = args.teamId;
    if (!teamId) {
      teamId = await ctx.db.insert('teams', {
        name: `${args.name}'s Team`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Create user profile
    const userId = await ctx.db.insert('users', {
      email: args.email,
      name: args.name,
      teamId,
      role: args.teamId ? 'member' : 'admin', // Admin if creating new team
      isActive: true,
      lastActiveAt: Date.now(),
    });

    return userId;
  },
});

// Get current user profile
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      email: v.string(),
      name: v.string(),
      profileImage: v.optional(v.string()),
      teamId: v.optional(v.id('teams')),
      role: v.union(
        v.literal('admin'),
        v.literal('member'),
        v.literal('viewer')
      ),
      isActive: v.boolean(),
      lastActiveAt: v.number(),
      preferences: v.optional(
        v.object({
          emailNotifications: v.boolean(),
          theme: v.union(
            v.literal('light'),
            v.literal('dark'),
            v.literal('system')
          ),
          timezone: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      return null;
    }

    // Find user by auth identity
    const authUser = await ctx.db.get(identity);
    if (!authUser) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .first();

    return user;
  },
});

// Update user's last active timestamp
export const updateLastActive = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const authUser = await ctx.db.get(identity);
    if (!authUser) {
      throw new Error('Auth user not found');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        lastActiveAt: Date.now(),
      });
    }

    return null;
  },
});

// Get team members for assignment dropdowns
export const getTeamMembers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('users'),
      name: v.string(),
      email: v.string(),
      role: v.union(
        v.literal('admin'),
        v.literal('member'),
        v.literal('viewer')
      ),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx) => {
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
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .first();

    if (!currentUser) {
      throw new Error('User profile not found');
    }

    const teamMembers = await ctx.db
      .query('users')
      .withIndex('by_team_and_active', (q) =>
        q.eq('teamId', currentUser.teamId).eq('isActive', true)
      )
      .collect();

    return teamMembers.map((member) => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      role: member.role,
      isActive: member.isActive,
    }));
  },
});

// Update user preferences
export const updateUserPreferences = mutation({
  args: {
    preferences: v.object({
      emailNotifications: v.boolean(),
      theme: v.union(
        v.literal('light'),
        v.literal('dark'),
        v.literal('system')
      ),
      timezone: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const authUser = await ctx.db.get(identity);
    if (!authUser) {
      throw new Error('Auth user not found');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email))
      .first();

    if (!user) {
      throw new Error('User profile not found');
    }

    await ctx.db.patch(user._id, {
      preferences: args.preferences,
    });

    return null;
  },
});
