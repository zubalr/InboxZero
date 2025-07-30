import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

// Validation and sanitization helpers
function sanitizeString(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

// Create a new message in a thread with enhanced validation
export const create = mutation({
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
    headers: v.object({
      date: v.string(),
    }),
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

    // Verify thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (currentUser.teamId !== thread.teamId) {
      throw new Error('Access denied');
    }

    // Validate and sanitize input data
    const sanitizedMessageId = sanitizeString(args.messageId, 200);
    const sanitizedSubject = sanitizeString(args.subject, 500);

    // Check for duplicate message ID in the same thread
    const existingMessage = await ctx.db
      .query('messages')
      .withIndex('by_message_id', (q) => q.eq('messageId', sanitizedMessageId))
      .filter((q) => q.eq(q.field('threadId'), args.threadId))
      .first();

    if (existingMessage) {
      throw new Error('Message with this ID already exists in thread');
    }

    // Validate email addresses
    if (!isValidEmail(args.from.email)) {
      throw new Error(`Invalid from email address: ${args.from.email}`);
    }

    for (const recipient of args.to) {
      if (!isValidEmail(recipient.email)) {
        throw new Error(`Invalid to email address: ${recipient.email}`);
      }
    }

    if (args.cc) {
      for (const recipient of args.cc) {
        if (!isValidEmail(recipient.email)) {
          throw new Error(`Invalid cc email address: ${recipient.email}`);
        }
      }
    }

    if (args.bcc) {
      for (const recipient of args.bcc) {
        if (!isValidEmail(recipient.email)) {
          throw new Error(`Invalid bcc email address: ${recipient.email}`);
        }
      }
    }

    // Sanitize content (limit size to prevent abuse)
    const sanitizedTextContent = args.textContent
      ? sanitizeString(args.textContent, 100000)
      : undefined;
    const sanitizedHtmlContent = args.htmlContent
      ? sanitizeString(args.htmlContent, 200000)
      : undefined;

    // Create search content for full-text search
    const searchContent = [
      sanitizedSubject,
      sanitizedTextContent || '',
      args.from.email,
      args.from.name || '',
      args.to.map((t) => `${t.email} ${t.name || ''}`).join(' '),
      args.cc?.map((c) => `${c.email} ${c.name || ''}`).join(' ') || '',
    ]
      .join(' ')
      .toLowerCase();

    // Atomic operation: Create message and update thread
    const messageId = await ctx.db.insert('messages', {
      threadId: args.threadId,
      messageId: sanitizedMessageId,
      inReplyTo: args.inReplyTo
        ? sanitizeString(args.inReplyTo, 200)
        : undefined,
      references: args.references
        .map((ref) => sanitizeString(ref, 200))
        .slice(0, 50),
      from: {
        email: args.from.email.toLowerCase().trim(),
        name: args.from.name ? sanitizeString(args.from.name, 100) : undefined,
      },
      to: args.to.map((recipient) => ({
        email: recipient.email.toLowerCase().trim(),
        name: recipient.name ? sanitizeString(recipient.name, 100) : undefined,
      })),
      cc: args.cc?.map((recipient) => ({
        email: recipient.email.toLowerCase().trim(),
        name: recipient.name ? sanitizeString(recipient.name, 100) : undefined,
      })),
      bcc: args.bcc?.map((recipient) => ({
        email: recipient.email.toLowerCase().trim(),
        name: recipient.name ? sanitizeString(recipient.name, 100) : undefined,
      })),
      subject: sanitizedSubject,
      textContent: sanitizedTextContent,
      htmlContent: sanitizedHtmlContent,
      attachments: undefined, // Will be implemented later
      headers: {
        date: args.headers.date,
        deliveredTo: undefined,
        returnPath: undefined,
        received: [],
      },
      direction: args.direction,
      deliveryStatus: args.deliveryStatus,
      searchContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update thread's last message timestamp and status
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
      // Update status based on direction
      status: args.direction === 'outbound' ? 'replied' : 'unread',
    });

    return messageId;
  },
});

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
      args.to.map((t) => `${t.email} ${t.name || ''}`).join(' '),
    ]
      .join(' ')
      .toLowerCase();

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

// Get messages for a thread with pagination
export const listForThread = query({
  args: {
    threadId: v.id('threads'),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  returns: v.object({
    messages: v.array(
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
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = Math.min(args.limit || 50, 200); // Optimize for large threads
    const order = args.order || 'asc';

    // Verify thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (currentUser.teamId !== thread.teamId) {
      throw new Error('Access denied');
    }

    // Get messages with optimized pagination
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_thread_and_created', (q) =>
        q.eq('threadId', args.threadId)
      )
      .order(order)
      .take(limit);

    // Calculate pagination metadata
    const hasMore = messages.length === limit;
    const nextCursor = hasMore
      ? messages[messages.length - 1]._id.toString()
      : undefined;

    // Get total count efficiently (only when needed)
    let total = messages.length;
    if (hasMore) {
      // For large threads, we'll estimate or calculate total separately
      const allMessages = await ctx.db
        .query('messages')
        .withIndex('by_thread_and_created', (q) =>
          q.eq('threadId', args.threadId)
        )
        .collect();
      total = allMessages.length;
    }

    return {
      messages,
      hasMore,
      nextCursor,
      total,
    };
  },
});

// Find message by Resend ID
export const findByResendId = query({
  args: {
    resendId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('messages'),
      threadId: v.id('threads'),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Note: We need to add resendId field to messages schema
    // For now, we'll search by messageId which should contain the Resend ID for outbound messages
    const message = await ctx.db
      .query('messages')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.resendId))
      .filter((q) => q.eq(q.field('direction'), 'outbound'))
      .first();

    if (!message) {
      return null;
    }

    return {
      _id: message._id,
      threadId: message.threadId,
    };
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

// Delete a message
export const deleteMessage = mutation({
  args: {
    messageId: v.id('messages'),
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

    // Delete the message
    await ctx.db.delete(args.messageId);

    return null;
  },
});
