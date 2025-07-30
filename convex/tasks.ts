import { mutation, action, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { getAuthUserId } from '@convex-dev/auth/server';
import { api } from './_generated/api';

// Helper function to get current user (used by queries and mutations)
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

// Internal task creation (used by actions)
export const createInternalTask = mutation({
  args: {
    teamId: v.id('teams'),
    createdById: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('cancelled')
    ),
    priority: v.union(
      v.literal('low'),
      v.literal('normal'),
      v.literal('high'),
      v.literal('urgent')
    ),
    externalIntegration: v.optional(
      v.object({
        platform: v.union(v.literal('notion'), v.literal('asana'), v.literal('clickup')),
        externalId: v.string(),
        externalUrl: v.string(),
        syncedAt: v.number(),
      })
    ),
    threadId: v.optional(v.id('threads')),
  },
  handler: async (ctx, args) => {
    if (!args.threadId) {
      throw new Error('threadId is required for task creation');
    }
    
    return ctx.db.insert('tasks', {
      createdById: args.createdById,
      title: args.title,
      description: args.description,
      status: args.status || 'pending',
      priority: args.priority || 'normal',
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      externalIntegration: args.externalIntegration,
      threadId: args.threadId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Create a task in Notion
export const createNotionTask: any = action({
  args: {
    teamId: v.id('teams'),
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get Notion integration configuration
    const integration = await ctx.runQuery(api.integrations.getByTeamAndPlatform, { 
      teamId: args.teamId,
      platform: 'notion' 
    });

    if (!integration || !integration.isActive) {
      throw new Error('Notion integration not configured');
    }

    // Get Notion database ID from integration configuration
    const databaseId = integration.configuration.databaseId;
    if (!databaseId) {
      throw new Error('Notion database ID not configured');
    }

    // Make API call to Notion
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.configuration.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: args.title } }] },
          Description: {
            rich_text: [{ text: { content: args.description || '' } }],
          },
          Status: { select: { name: 'To Do' } },
          Priority: { select: { name: 'Medium' } },
          ...(args.dueDate && {
            'Due Date': { date: { start: new Date(args.dueDate).toISOString() } },
          }),
          ...(args.assignedTo && {
            Assignee: { people: [{ id: args.assignedTo }] },
          }),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${error.message}`);
    }

    const data = await response.json();

    // Store task in our database using mutation
    const taskId = await ctx.runMutation(api.tasks.createInternalTask, {
      teamId: args.teamId,
      createdById: currentUser._id,
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      status: 'pending',
      priority: 'normal',
      externalIntegration: {
        platform: 'notion',
        externalId: data.id,
        externalUrl: data.url,
        syncedAt: Date.now(),
      },
      threadId: args.threadId, // Fixed to use actual threadId
    });

    return taskId;
  },
});

// Create a task in Asana
export const createAsanaTask: any = action({
  args: {
    teamId: v.id('teams'),
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get Asana integration configuration
    const integration = await ctx.runQuery(api.integrations.getByTeamAndPlatform, { 
      teamId: args.teamId,
      platform: 'asana' 
    });

    if (!integration || !integration.isActive) {
      throw new Error('Asana integration not configured');
    }

    // TODO: Implement Asana API call here
    // For now, just create the task in our database
    const taskId = await ctx.runMutation(api.tasks.createInternalTask, {
      teamId: args.teamId,
      createdById: currentUser._id,
      threadId: args.threadId,
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      status: 'pending',
      priority: 'normal',
    });

    return taskId;
  },
});

// Create a task in ClickUp
export const createClickUpTask: any = action({
  args: {
    teamId: v.id('teams'),
    threadId: v.id('threads'),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get ClickUp integration configuration
    const integration = await ctx.runQuery(api.integrations.getByTeamAndPlatform, { 
      teamId: args.teamId,
      platform: 'clickup' 
    });

    if (!integration || !integration.isActive) {
      throw new Error('ClickUp integration not configured');
    }

    // TODO: Implement ClickUp API call here
    // For now, just create the task in our database
    const taskId = await ctx.runMutation(api.tasks.createInternalTask, {
      teamId: args.teamId,
      createdById: currentUser._id,
      threadId: args.threadId,
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      status: 'pending',
      priority: 'normal',
    });

    return taskId;
  },
});

// Unified task creation interface
export const createTask = mutation({
  args: {
    teamId: v.id('teams'),
    threadId: v.id('threads'),
    platform: v.union(
      v.literal('notion'),
      v.literal('asana'),
      v.literal('clickup')
    ),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the user belongs to the team
    if (currentUser.teamId !== args.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    // Verify assignee belongs to the team if provided
    if (args.assignedTo) {
      const assignee = await ctx.db.get(args.assignedTo);
      if (!assignee || assignee.teamId !== args.teamId) {
        throw new Error('Invalid assignee: user does not belong to this team');
      }
    }

    // Create the task directly using the internal mutation
    const taskId = await ctx.db.insert('tasks', {
      threadId: args.threadId,
      createdById: currentUser._id,
      title: args.title,
      description: args.description,
      status: 'pending',
      priority: 'normal',
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return taskId;
  },
});

// Get all tasks for a team
export const listTasks = query({
  args: {
    teamId: v.id('teams'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('cancelled')
      )
    ),
    assignedTo: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the user belongs to the team
    if (currentUser.teamId !== args.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    let query = ctx.db
      .query('tasks')
      .withIndex('by_creator', (q: any) => q.eq('createdById', currentUser._id));

    // Filter by status if specified
    if (args.status) {
      query = ctx.db
        .query('tasks')
        .withIndex('by_status', (q: any) => q.eq('status', args.status));
    }

    // Filter by assignee if specified
    if (args.assignedTo) {
      query = ctx.db
        .query('tasks')
        .withIndex('by_assignee', (q: any) => q.eq('assignedTo', args.assignedTo));
    }

    const tasks = await query.order('desc').take(args.limit || 50);

    // Filter tasks by teamId in memory since we don't have teamId index
    return tasks.filter(task => {
      // For now, we'll need to get the creator's team
      // This is a temporary solution - proper indexing should be added
      return true; // Simplified for now
    });
  },
});

// Get a specific task
export const getTask = query({
  args: {
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return null;
    }

    // Verify the user belongs to the team by checking the creator
    const creator = await ctx.db.get(task.createdById);
    if (!creator || creator.teamId !== currentUser.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    return task;
  },
});

// Update task status
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id('tasks'),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('cancelled')
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify the user belongs to the team by checking the creator
    const creator = await ctx.db.get(task.createdById);
    if (!creator || creator.teamId !== currentUser.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.taskId;
  },
});

// Assign task to user
export const assignTask = mutation({
  args: {
    taskId: v.id('tasks'),
    assigneeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify the user belongs to the team by checking the creator
    const creator = await ctx.db.get(task.createdById);
    if (!creator || creator.teamId !== currentUser.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    // Verify assignee belongs to the team if provided
    if (args.assigneeId) {
      const assignee = await ctx.db.get(args.assigneeId);
      if (!assignee || assignee.teamId !== creator.teamId) {
        throw new Error('Invalid assignee: user does not belong to this team');
      }
    }

    await ctx.db.patch(args.taskId, {
      assignedTo: args.assigneeId,
      updatedAt: Date.now(),
    });

    return args.taskId;
  },
});

// Delete a task
export const deleteTask = mutation({
  args: {
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify the user belongs to the team by checking the creator
    const creator = await ctx.db.get(task.createdById);
    if (!creator || creator.teamId !== currentUser.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    await ctx.db.delete(args.taskId);
    return args.taskId;
  },
});

// Create task from thread
export const createTaskFromThread = mutation({
  args: {
    threadId: v.id('threads'),
    platform: v.union(
      v.literal('notion'),
      v.literal('asana'),
      v.literal('clickup')
    ),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Verify the user belongs to the team
    if (thread.teamId !== currentUser.teamId) {
      throw new Error('Access denied: user does not belong to this team');
    }

    // Verify assignee belongs to the team if provided
    if (args.assignedTo) {
      const assignee = await ctx.db.get(args.assignedTo);
      if (!assignee || assignee.teamId !== thread.teamId) {
        throw new Error('Invalid assignee: user does not belong to this team');
      }
    }

    // Create the task directly using the internal mutation
    const taskId = await ctx.db.insert('tasks', {
      threadId: thread._id,
      createdById: currentUser._id,
      title: args.title,
      description: args.description,
      status: 'pending',
      priority: 'normal',
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return taskId;
  },
});
