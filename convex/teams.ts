import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { Id } from './_generated/dataModel';

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

// Create a new team
export const createTeam = mutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
  },
  returns: v.id('teams'),
  handler: async (ctx, args) => {
    const teamId = await ctx.db.insert('teams', {
      name: args.name,
      domain: args.domain,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return teamId;
  },
});

// Find team by domain (for email ingestion)
export const findByDomain = query({
  args: {
    domain: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('teams'),
      name: v.string(),
      domain: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query('teams')
      .withIndex('by_domain', (q) => q.eq('domain', args.domain))
      .first();

    if (!team) {
      return null;
    }

    return {
      _id: team._id,
      name: team.name,
      domain: team.domain,
    };
  },
});

// Get current user's team
export const getCurrentTeam = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('teams'),
      _creationTime: v.number(),
      name: v.string(),
      domain: v.optional(v.string()),
      settings: v.optional(
        v.object({
          allowedDomains: v.array(v.string()),
          autoAssignRules: v.array(
            v.object({
              pattern: v.string(),
              assigneeId: v.id('users'),
            })
          ),
        })
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (
    ctx
  ): Promise<{
    _id: Id<'teams'>;
    _creationTime: number;
    name: string;
    domain?: string;
    settings?: {
      allowedDomains: string[];
      autoAssignRules: {
        pattern: string;
        assigneeId: Id<'users'>;
      }[];
    };
    createdAt: number;
    updatedAt: number;
  } | null> => {
    try {
      const currentUser = await getCurrentUserFromAuth(ctx);
      if (!currentUser.teamId) {
        return null;
      }
      const team = await ctx.db.get(currentUser.teamId);
      if (!team || team._id.toString().startsWith('users/')) {
        // Safety check to ensure we got a team, not a user
        return null;
      }
      return team as any; // Type assertion to avoid the mismatch
    } catch (error) {
      return null;
    }
  },
});

// Update team settings
export const updateTeamSettings = mutation({
  args: {
    settings: v.object({
      allowedDomains: v.array(v.string()),
      autoAssignRules: v.array(
        v.object({
          pattern: v.string(),
          assigneeId: v.id('users'),
        })
      ),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Check if user is admin
    if (currentUser.role !== 'admin') {
      throw new Error('Only team admins can update settings');
    }

    await ctx.db.patch(currentUser.teamId, {
      settings: args.settings,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Add domain to team
export const addDomain = mutation({
  args: {
    domain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Check if user is admin
    if (currentUser.role !== 'admin') {
      throw new Error('Only team admins can add domains');
    }

    // Check if domain is already taken
    const existingTeam = await ctx.db
      .query('teams')
      .withIndex('by_domain', (q) => q.eq('domain', args.domain))
      .first();

    if (existingTeam && existingTeam._id !== currentUser.teamId) {
      throw new Error('Domain is already associated with another team');
    }

    await ctx.db.patch(currentUser.teamId, {
      domain: args.domain,
      updatedAt: Date.now(),
    });

    return null;
  },
});
