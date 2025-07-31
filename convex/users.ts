import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  validateEmail,
  validateName,
  validateTimezone,
  withErrorHandling,
  safeDbOperation,
} from './lib/errors';

// Internal function to create user profile (called by auth system)
export const createUserProfileInternal = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    teamId: v.optional(v.id('teams')),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    try {
      console.log('Creating user profile internally for:', args.email);

      // Validate inputs
      validateEmail(args.email);
      const trimmedName = validateName(args.name);

      // Check if user already exists
      const existingUser = await safeDbOperation(
        () =>
          ctx.db
            .query('users')
            .withIndex('by_email', (q) =>
              q.eq('email', args.email.toLowerCase().trim())
            )
            .first(),
        'check existing user'
      );

      if (existingUser) {
        console.log('User profile already exists for:', args.email);
        return existingUser._id;
      }

      // If no teamId provided, create a new team
      let teamId = args.teamId;
      if (!teamId) {
        teamId = await safeDbOperation(
          () =>
            ctx.db.insert('teams', {
              name: `${trimmedName}'s Team`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }),
          'create team'
        );
      } else {
        // Verify team exists if provided
        const team = await safeDbOperation(
          () => ctx.db.get(teamId!),
          'verify team'
        );
        if (!team) {
          throw new NotFoundError('Team');
        }
      }

      // Create user profile with all required fields
      const userId = await safeDbOperation(
        () =>
          ctx.db.insert('users', {
            email: args.email.toLowerCase().trim(),
            name: trimmedName,
            teamId,
            role: args.teamId ? 'member' : 'admin', // Admin if creating new team
            isActive: true,
            lastActiveAt: Date.now(),
            preferences: {
              emailNotifications: true,
              theme: 'system',
              timezone: 'UTC',
            },
          }),
        'create user'
      );

      console.log('Successfully created user profile internally:', {
        userId,
        email: args.email,
        name: trimmedName,
        teamId,
      });

      return userId;
    } catch (error) {
      console.error('Failed to create user profile internally:', error);
      throw error;
    }
  },
});

// Create user profile after authentication
export const createUserProfile = mutation({
  args: {
    name: v.string(),
    teamId: v.optional(v.id('teams')),
    email: v.string(),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    try {
      console.log('Starting user profile creation for:', args.email);

      // Get authenticated user ID with better error handling
      const identity = await getAuthUserId(ctx);
      if (!identity) {
        console.error('No authenticated user found for profile creation');
        throw new AuthenticationError(
          'User must be authenticated to create profile'
        );
      }

      console.log(
        'Creating profile for authenticated user:',
        identity,
        'with email:',
        args.email
      );

      // Validate inputs
      validateEmail(args.email);
      const trimmedName = validateName(args.name);

      // Check if user already exists
      const existingUser = await safeDbOperation(
        () =>
          ctx.db
            .query('users')
            .withIndex('by_email', (q) =>
              q.eq('email', args.email.toLowerCase().trim())
            )
            .first(),
        'check existing user'
      );

      if (existingUser) {
        console.log('User profile already exists for:', args.email);
        // Update last active timestamp and return existing user ID
        await safeDbOperation(
          () =>
            ctx.db.patch(existingUser._id, {
              lastActiveAt: Date.now(),
              isActive: true,
            }),
          'update existing user last active'
        );
        return existingUser._id;
      }

      // If no teamId provided, create a new team
      let teamId = args.teamId;
      if (!teamId) {
        teamId = await safeDbOperation(
          () =>
            ctx.db.insert('teams', {
              name: `${trimmedName}'s Team`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }),
          'create team'
        );
      } else {
        // Verify team exists if provided
        const team = await safeDbOperation(
          () => ctx.db.get(teamId!),
          'verify team'
        );
        if (!team) {
          throw new NotFoundError('Team');
        }
      }

      // Create user profile with all required fields
      const userId = await safeDbOperation(
        () =>
          ctx.db.insert('users', {
            email: args.email.toLowerCase().trim(),
            name: trimmedName,
            teamId,
            role: args.teamId ? 'member' : 'admin', // Admin if creating new team
            isActive: true,
            lastActiveAt: Date.now(),
            preferences: {
              emailNotifications: true,
              theme: 'system',
              timezone: 'UTC',
            },
          }),
        'create user'
      );

      console.log('Successfully created user profile:', {
        userId,
        email: args.email,
        name: trimmedName,
        teamId,
      });

      return userId;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      if (
        error instanceof ValidationError ||
        error instanceof ConflictError ||
        error instanceof NotFoundError ||
        error instanceof AuthenticationError
      ) {
        throw error;
      }
      throw new Error(
        `Failed to create user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
      lastActiveAt: v.float64(),
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
    try {
      const identity = await getAuthUserId(ctx);
      if (!identity) {
        return null;
      }

      // Find user by auth identity
      const authUser = await ctx.db.get(identity);
      if (!authUser) {
        console.error('Auth user not found for identity:', identity);
        return null;
      }

      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', authUser.email))
        .first();

      if (!user) {
        return null;
      }

      // Ensure all required fields are present and properly typed
      return {
        _id: user._id,
        email: user.email,
        name: user.name,
        profileImage: user.profileImage,
        teamId: user.teamId,
        role: user.role,
        isActive: user.isActive,
        lastActiveAt: user.lastActiveAt,
        preferences: user.preferences || {
          emailNotifications: true,
          theme: 'system' as const,
          timezone: 'UTC',
        },
      };
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  },
});

// Update user's last active timestamp
export const updateLastActive = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    try {
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
          isActive: true, // Ensure user is marked as active
        });
      } else {
        console.error('User profile not found for email:', authUser.email);
      }

      return null;
    } catch (error) {
      console.error('Failed to update last active:', error);
      // Don't throw - this should be non-blocking
      return null;
    }
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
    try {
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

      if (!currentUser.teamId) {
        // User has no team, return empty array
        return [];
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
    } catch (error) {
      console.error('Failed to get team members:', error);
      return [];
    }
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
    try {
      const identity = await getAuthUserId(ctx);
      if (!identity) {
        throw new AuthenticationError();
      }

      const authUser = await ctx.db.get(identity);
      if (!authUser) {
        throw new AuthenticationError('Auth user not found');
      }

      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', authUser.email))
        .first();

      if (!user) {
        throw new NotFoundError('User profile');
      }

      // Validate timezone
      validateTimezone(args.preferences.timezone);

      await ctx.db.patch(user._id, {
        preferences: args.preferences,
        lastActiveAt: Date.now(),
      });

      return null;
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      if (
        error instanceof ValidationError ||
        error instanceof AuthenticationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new Error(
        `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
});

/**
 * Internal function to get user by email
 */
export const getUserByEmailInternal = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
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
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', args.email))
        .first();

      return user ?? null;
    } catch (error) {
      console.error('Failed to get user by email (internal):', error);
      return null;
    }
  },
});

/**
 * Internal function to update user activity
 */
export const updateUserActivityInternal = internalMutation({
  args: {
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        console.error(`User not found: ${args.userId}`);
        return null;
      }

      await ctx.db.patch(args.userId, {
        lastActiveAt: Date.now(),
        isActive: true,
      });
    } catch (error) {
      console.error('Failed to update user activity (internal):', error);
      // Don't throw - this should be non-blocking
    }
    return null;
  },
});
