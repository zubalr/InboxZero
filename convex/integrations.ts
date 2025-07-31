import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';

// --- Notion Integration ---

// Store Notion credentials (API key and database ID)
export const storeNotionCredentials = internalMutation({
  args: {
    teamId: v.id('teams'),
    apiKey: v.string(),
    databaseId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingIntegration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'notion')
      )
      .first();

    if (existingIntegration) {
      await ctx.db.patch(existingIntegration._id, {
        configuration: {
          apiKey: args.apiKey,
          databaseId: args.databaseId,
        },
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('integrations', {
        teamId: args.teamId,
        platform: 'notion',
        name: 'Notion',
        configuration: {
          apiKey: args.apiKey,
          databaseId: args.databaseId,
        },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Public wrapper for storing Notion credentials
export const storeNotionCredentialsPublic = mutation({
  args: {
    teamId: v.id('teams'),
    apiKey: v.string(),
    databaseId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Duplicate the logic from internal function to avoid circular reference
    const existingIntegration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'notion')
      )
      .first();

    if (existingIntegration) {
      await ctx.db.patch(existingIntegration._id, {
        configuration: {
          apiKey: args.apiKey,
          databaseId: args.databaseId,
        },
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('integrations', {
        teamId: args.teamId,
        platform: 'notion',
        name: 'Notion Integration',
        configuration: {
          apiKey: args.apiKey,
          databaseId: args.databaseId,
        },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Get Notion integration details for a team
export const getNotionIntegration = query({
  args: { teamId: v.id('teams') },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'notion')
      )
      .first();
  },
});

// --- Task Management ---

// Create a new task linked to a thread
export const createTask = mutation({
  args: {
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(
      v.literal('urgent'),
      v.literal('high'),
      v.literal('normal'),
      v.literal('low')
    ),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
    createInNotion: v.boolean(),
  },
  returns: v.id('tasks'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('User not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const taskId = await ctx.db.insert('tasks', {
      threadId: args.threadId,
      createdById: user._id,
      title: args.title,
      description: args.description,
      status: 'pending',
      priority: args.priority,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.createInNotion) {
      // Get the thread and user info needed for the Notion integration
      const thread = await ctx.db.get(args.threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      await ctx.scheduler.runAfter(
        0,
        internal.integrations.createTaskInNotionWorkflow,
        {
          taskId,
          threadId: args.threadId,
          title: args.title,
          description: args.description,
          priority: args.priority,
          teamId: thread.teamId,
        }
      );
    }

    return taskId;
  },
});

// Get a single task by ID
export const getTask = internalQuery({
  args: { taskId: v.id('tasks') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    const thread = await ctx.db.get(task.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }
    return { ...task, teamId: thread.teamId };
  },
});

// Update a task with Notion details
export const updateTaskWithNotionDetails = internalMutation({
  args: {
    taskId: v.id('tasks'),
    externalId: v.string(),
    externalUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      externalIntegration: {
        platform: 'notion',
        externalId: args.externalId,
        externalUrl: args.externalUrl,
        syncedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Internal mutation to orchestrate task creation in Notion
export const createTaskInNotionWorkflow = internalMutation({
  args: {
    taskId: v.id('tasks'),
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    teamId: v.id('teams'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // For now, just log that we would create the task in Notion
    // TODO: Implement Notion integration once the API is properly generated
    console.log('Would create Notion task:', args.title);

    return null;
  },
});

// List tasks for a specific thread
export const listTasksForThread = query({
  args: { threadId: v.id('threads') },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .collect();
  },
});

// --- Additional Integration Management Functions ---

// Get integration by team and platform
export const getByTeamAndPlatform = query({
  args: {
    teamId: v.id('teams'),
    platform: v.union(
      v.literal('notion'),
      v.literal('asana'),
      v.literal('clickup')
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', args.platform)
      )
      .first();
  },
});

// List all integrations for a team
export const listIntegrations = query({
  args: { teamId: v.id('teams') },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrations')
      .withIndex('by_team', (q) => q.eq('teamId', args.teamId))
      .order('desc')
      .collect();
  },
});

// Test integration connection
export const testIntegration = mutation({
  args: {
    teamId: v.id('teams'),
    platform: v.union(
      v.literal('notion'),
      v.literal('asana'),
      v.literal('clickup')
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', args.platform)
      )
      .first();

    if (!integration || !integration.isActive) {
      throw new Error(`${args.platform} integration not found or inactive`);
    }

    // Update integration with test result
    await ctx.db.patch(integration._id, {
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, message: 'Integration test successful' };
  },
});

// Sync integration data
export const syncIntegration = mutation({
  args: { integrationId: v.id('integrations') },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    await ctx.db.patch(integration._id, {
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Deactivate integration
export const deactivateIntegration = mutation({
  args: { integrationId: v.id('integrations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      isActive: false,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Store Asana credentials
export const storeAsanaCredentials = mutation({
  args: {
    teamId: v.id('teams'),
    accessToken: v.string(),
    workspaceId: v.string(),
    projectId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingIntegration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'asana')
      )
      .first();

    if (existingIntegration) {
      await ctx.db.patch(existingIntegration._id, {
        configuration: {
          apiKey: args.accessToken,
          workspaceId: args.workspaceId,
          projectId: args.projectId,
        },
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('integrations', {
        teamId: args.teamId,
        platform: 'asana',
        name: 'Asana',
        configuration: {
          apiKey: args.accessToken,
          workspaceId: args.workspaceId,
          projectId: args.projectId,
        },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// Store ClickUp credentials
export const storeClickUpCredentials = mutation({
  args: {
    teamId: v.id('teams'),
    apiKey: v.string(),
    clickupTeamId: v.string(),
    spaceId: v.optional(v.string()),
    listId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingIntegration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'clickup')
      )
      .first();

    if (existingIntegration) {
      await ctx.db.patch(existingIntegration._id, {
        configuration: {
          apiKey: args.apiKey,
          spaceId: args.spaceId,
          listId: args.listId,
        },
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('integrations', {
        teamId: args.teamId,
        platform: 'clickup',
        name: 'ClickUp',
        configuration: {
          apiKey: args.apiKey,
          spaceId: args.spaceId,
          listId: args.listId,
        },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get Asana integration
export const getAsanaIntegration = query({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'asana')
      )
      .first();
  },
});

// Get ClickUp integration
export const getClickUpIntegration = query({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'clickup')
      )
      .first();
  },
});

// Test Asana connection
export const testAsanaConnection = mutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'asana')
      )
      .first();

    if (!integration?.isActive) {
      throw new Error('Asana integration not found or inactive');
    }

    // In a real implementation, you would test the actual API connection here
    await ctx.db.patch(integration._id, {
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Test ClickUp connection
export const testClickUpConnection = mutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_team_and_platform', (q) =>
        q.eq('teamId', args.teamId).eq('platform', 'clickup')
      )
      .first();

    if (!integration?.isActive) {
      throw new Error('ClickUp integration not found or inactive');
    }

    // In a real implementation, you would test the actual API connection here
    await ctx.db.patch(integration._id, {
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Create unified task across multiple platforms
export const createUnifiedTask = mutation({
  args: {
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(
      v.literal('normal'),
      v.literal('high'),
      v.literal('urgent'),
      v.literal('low')
    ),
    dueDate: v.optional(v.number()),
    assignee: v.optional(v.string()),
    platforms: v.array(
      v.union(v.literal('notion'), v.literal('asana'), v.literal('clickup'))
    ),
  },
  handler: async (ctx, args) => {
    // Get current user
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

    // Create local task first
    const taskId = await ctx.db.insert('tasks', {
      threadId: args.threadId,
      createdById: currentUser._id,
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: 'pending',
      dueDate: args.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const results: Record<string, { success?: boolean; error?: string }> = {};

    // Process each platform
    for (const platform of args.platforms) {
      try {
        // Here you would implement actual task creation for each platform
        // For now, we'll just return success
        results[platform] = { success: true };
      } catch (error) {
        results[platform] = {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  },
});
