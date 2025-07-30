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

// Create a new message in a thread
export const createMessage = mutation({
  args: {
    threadId: v.id('threads'),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.array(v.string()),
    from: v.object({
      email: v.string(),
      name: v.optional(v.string()),
    }),
    to: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
      })
    ),
    cc: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      )
    ),
    bcc: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      )
    ),
    subject: v.string(),
    textContent: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    direction: v.union(v.literal('inbound'), v.literal('outbound')),
    deliveryStatus: v.optional(
      v.object({
        status: v.union(
          v.literal('sent'),
          v.literal('delivered'),
          v.literal('failed')
        ),
        errorMessage: v.optional(v.string()),
        attempts: v.number(),
        lastAttemptAt: v.number(),
      })
    ),
  },
  returns: v.id('messages'),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    if (!currentUser.teamId) {
      throw new Error('User is not part of a team');
    }

    // Verify thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (currentUser.teamId !== thread.teamId) {
      throw new Error('Access denied');
    }

    // Create the message
    const searchContent = [
      args.subject || '',
      args.textContent || '',
      args.from.email,
      args.from.name || '',
      args.to.map(t => `${t.email} ${t.name || ''}`).join(' '),
    ].join(' ').toLowerCase();

    const messageId = await ctx.db.insert('messages', {
      ...args,
      headers: {
        date: new Date().toISOString(),
        received: [],
      },
      searchContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update thread's last message timestamp
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Get messages for a thread
export const listForThread = query({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.array(
    v.object({
      _id: v.id('messages'),
      _creationTime: v.number(),
      threadId: v.id('threads'),
      messageId: v.string(),
      inReplyTo: v.optional(v.string()),
      references: v.array(v.string()),
      from: v.object({
        email: v.string(),
        name: v.optional(v.string()),
      }),
      to: v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      ),
      cc: v.optional(
        v.array(
          v.object({
            email: v.string(),
            name: v.optional(v.string()),
          })
        )
      ),
      bcc: v.optional(
        v.array(
          v.object({
            email: v.string(),
            name: v.optional(v.string()),
          })
        )
      ),
      subject: v.string(),
      textContent: v.optional(v.string()),
      htmlContent: v.optional(v.string()),
      direction: v.union(v.literal('inbound'), v.literal('outbound')),
      deliveryStatus: v.optional(
        v.object({
          status: v.union(
            v.literal('sent'),
            v.literal('delivered'),
            v.literal('failed')
          ),
          errorMessage: v.optional(v.string()),
          attempts: v.number(),
          lastAttemptAt: v.number(),
        })
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (currentUser.teamId !== thread.teamId) {
      throw new Error('Access denied');
    }

    // Get messages ordered by creation time
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_thread_and_created', (q) =>
        q.eq('threadId', args.threadId)
      )
      .collect();

    return messages;
  },
});

// Update delivery status of a message
export const updateDeliveryStatus = mutation({
  args: {
    messageId: v.id('messages'),
    status: v.union(
      v.literal('sent'),
      v.literal('delivered'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user has access to this message's thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (currentUser.teamId !== thread.teamId) {
      throw new Error('Access denied');
    }

    // Update delivery status
    const currentStatus = message.deliveryStatus || {
      status: 'sent',
      attempts: 1,
      lastAttemptAt: Date.now(),
    };

    await ctx.db.patch(args.messageId, {
      deliveryStatus: {
        ...currentStatus,
        status: args.status,
        errorMessage: args.errorMessage,
        attempts: currentStatus.attempts + 1,
        lastAttemptAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return null;
  },
});
