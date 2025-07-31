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

// Create a new thread with enhanced validation
export const createThread = mutation({
  args: {
    subject: v.string(),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.array(v.string()),
    participants: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
        type: v.union(
          v.literal('to'),
          v.literal('cc'),
          v.literal('bcc'),
          v.literal('from')
        ),
      })
    ),
    priority: v.optional(
      v.union(
        v.literal('urgent'),
        v.literal('high'),
        v.literal('normal'),
        v.literal('low')
      )
    ),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id('threads'),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate and sanitize input data
    const sanitizedSubject = sanitizeString(args.subject, 500);
    const sanitizedMessageId = sanitizeString(args.messageId, 200);

    // Validate participants
    if (!args.participants || args.participants.length === 0) {
      throw new Error('At least one participant is required');
    }

    // Validate email addresses in participants
    for (const participant of args.participants) {
      if (!isValidEmail(participant.email)) {
        throw new Error(`Invalid email address: ${participant.email}`);
      }
    }

    // Check for duplicate message ID in the same team
    const existingThread = await ctx.db
      .query('threads')
      .withIndex('by_message_id', (q) => q.eq('messageId', sanitizedMessageId))
      .filter((q) => q.eq(q.field('teamId'), currentUser.teamId))
      .first();

    if (existingThread) {
      throw new Error('Thread with this message ID already exists');
    }

    // Sanitize participants
    const sanitizedParticipants = args.participants.map((p) => ({
      email: sanitizeString(p.email, 200),
      name: p.name ? sanitizeString(p.name, 100) : undefined,
      type: p.type,
    }));

    // Get team information
    if (!currentUser.teamId) {
      throw new Error('User is not associated with a team');
    }

    const team = await ctx.db.get(currentUser.teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Sanitize tags
    const sanitizedTags = (args.tags || [])
      .map((tag) => sanitizeString(tag, 50))
      .filter((tag) => tag.length > 0)
      .slice(0, 10); // Limit to 10 tags

    // Create search content for full-text search
    const searchContent = [
      sanitizedSubject,
      ...sanitizedParticipants.map((p) => p.name || p.email),
      ...sanitizedTags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const threadId = await ctx.db.insert('threads', {
      subject: sanitizedSubject,
      messageId: sanitizedMessageId,
      inReplyTo: args.inReplyTo
        ? sanitizeString(args.inReplyTo, 200)
        : undefined,
      references: args.references
        ? args.references.map((ref: string) => sanitizeString(ref, 200))
        : [],
      participants: sanitizedParticipants,
      teamId: currentUser.teamId,
      status: 'unread',
      priority: 'normal',
      tags: sanitizedTags,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      searchContent,
    });

    return threadId;
  },
});

// List threads for the current user's team with optimized pagination
export const listThreads = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('unread'),
        v.literal('read'),
        v.literal('replied'),
        v.literal('closed'),
        v.literal('archived')
      )
    ),
    assignedToMe: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()), // For cursor-based pagination
    sortBy: v.optional(
      v.union(
        v.literal('lastMessage'),
        v.literal('created'),
        v.literal('priority'),
        v.literal('subject')
      )
    ),
  },
  returns: v.object({
    threads: v.array(
      v.object({
        _id: v.id('threads'),
        _creationTime: v.number(),
        subject: v.string(),
        messageId: v.string(),
        inReplyTo: v.optional(v.string()),
        references: v.array(v.string()),
        participants: v.array(
          v.object({
            email: v.string(),
            name: v.optional(v.string()),
            type: v.union(
              v.literal('to'),
              v.literal('cc'),
              v.literal('bcc'),
              v.literal('from')
            ),
          })
        ),
        teamId: v.id('teams'),
        assignedTo: v.optional(v.id('users')),
        status: v.union(
          v.literal('unread'),
          v.literal('read'),
          v.literal('replied'),
          v.literal('closed'),
          v.literal('archived')
        ),
        priority: v.union(
          v.literal('urgent'),
          v.literal('high'),
          v.literal('normal'),
          v.literal('low')
        ),
        tags: v.array(v.string()),
        lastMessageAt: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
        summary: v.optional(
          v.object({
            content: v.string(),
            generatedAt: v.number(),
            model: v.string(),
          })
        ),
        classification: v.optional(
          v.object({
            category: v.string(),
            priority: v.union(
              v.literal('urgent'),
              v.literal('high'),
              v.literal('normal'),
              v.literal('low')
            ),
            confidence: v.number(),
            generatedAt: v.number(),
          })
        ),
      })
    ),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = Math.min(args.limit || 25, 100); // Optimize default limit
    const sortBy = args.sortBy || 'lastMessage';

    // Choose optimal index based on filters
    let query;

    if (args.status && args.assignedToMe) {
      // Use compound index for both filters
      query = ctx.db
        .query('threads')
        .withIndex('by_team_and_assignee', (q: any) =>
          q.eq('teamId', currentUser.teamId).eq('assignedTo', currentUser._id)
        )
        .filter((q) => q.eq(q.field('status'), args.status));
    } else if (args.status) {
      // Use status-specific index
      query = ctx.db
        .query('threads')
        .withIndex('by_team_and_status', (q: any) =>
          q.eq('teamId', currentUser.teamId).eq('status', args.status)
        );
    } else if (args.assignedToMe) {
      // Use assignment-specific index
      query = ctx.db
        .query('threads')
        .withIndex('by_team_and_assignee', (q: any) =>
          q.eq('teamId', currentUser.teamId).eq('assignedTo', currentUser._id)
        );
    } else {
      // Use general team index with optimal sorting
      if (sortBy === 'lastMessage') {
        query = ctx.db
          .query('threads')
          .withIndex('by_last_message')
          .filter((q) => q.eq(q.field('teamId'), currentUser.teamId));
      } else {
        query = ctx.db
          .query('threads')
          .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId));
      }
    }

    // Apply sorting
    const sortOrder = sortBy === 'subject' ? 'asc' : 'desc';
    const threads = await query.order(sortOrder).take(limit);

    // Add pagination metadata
    const hasMore = threads.length === limit;
    const nextCursor = hasMore
      ? threads[threads.length - 1]._id.toString()
      : undefined;

    return {
      threads,
      hasMore,
      nextCursor,
      total: threads.length, // For now, we'll calculate this more efficiently later
    };
  },
});

// Get a specific thread
export const getThread = query({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.union(
    v.object({
      _id: v.id('threads'),
      _creationTime: v.number(),
      subject: v.string(),
      messageId: v.string(),
      inReplyTo: v.optional(v.string()),
      references: v.array(v.string()),
      participants: v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
          type: v.union(
            v.literal('to'),
            v.literal('cc'),
            v.literal('bcc'),
            v.literal('from')
          ),
        })
      ),
      teamId: v.id('teams'),
      assignedTo: v.optional(v.id('users')),
      status: v.union(
        v.literal('unread'),
        v.literal('read'),
        v.literal('replied'),
        v.literal('closed'),
        v.literal('archived')
      ),
      priority: v.union(
        v.literal('urgent'),
        v.literal('high'),
        v.literal('normal'),
        v.literal('low')
      ),
      tags: v.array(v.string()),
      lastMessageAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      summary: v.optional(
        v.object({
          content: v.string(),
          generatedAt: v.number(),
          model: v.string(),
        })
      ),
      classification: v.optional(
        v.object({
          category: v.string(),
          priority: v.union(
            v.literal('urgent'),
            v.literal('high'),
            v.literal('normal'),
            v.literal('low')
          ),
          confidence: v.number(),
          generatedAt: v.number(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      return null;
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('asc')
      .collect();

    return { ...thread, messages };
  },
});

export const updateSummary = mutation({
  args: {
    threadId: v.id('threads'),
    summary: v.string(),
    actionItems: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    await ctx.db.patch(args.threadId, {
      summary: {
        content: args.summary,
        generatedAt: Date.now(),
        model: 'llama3-8b-8192', // or the model used
      },
      updatedAt: Date.now(),
    });
  },
});

// Update thread status
export const updateThreadStatus = mutation({
  args: {
    threadId: v.id('threads'),
    status: v.union(
      v.literal('unread'),
      v.literal('read'),
      v.literal('replied'),
      v.literal('closed'),
      v.literal('archived')
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    await ctx.db.patch(args.threadId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Assign thread to user
export const assignThread = mutation({
  args: {
    threadId: v.id('threads'),
    assigneeId: v.optional(v.id('users')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // If assigneeId is provided, verify they're on the same team
    if (args.assigneeId) {
      const assignee = await ctx.db.get(args.assigneeId);
      if (!assignee || assignee.teamId !== currentUser.teamId) {
        throw new Error('Invalid assignee');
      }
    }

    await ctx.db.patch(args.threadId, {
      assignedTo: args.assigneeId,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Get thread by ID (for email.ts)
export const getById = query({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.union(
    v.object({
      _id: v.id('threads'),
      subject: v.string(),
      messageId: v.string(),
      references: v.array(v.string()),
      teamId: v.id('teams'),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      return null;
    }

    return {
      _id: thread._id,
      subject: thread.subject,
      messageId: thread.messageId,
      references: thread.references,
      teamId: thread.teamId,
    };
  },
});

// Update thread status (for email.ts)
export const updateStatus = mutation({
  args: {
    threadId: v.id('threads'),
    status: v.union(
      v.literal('unread'),
      v.literal('read'),
      v.literal('replied'),
      v.literal('closed'),
      v.literal('archived')
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    await ctx.db.patch(args.threadId, {
      status: args.status,
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    });

    return null;
  },
});

// Find thread by message ID (for email threading)
export const findByMessageId = query({
  args: {
    messageId: v.string(),
    teamId: v.id('teams'),
  },
  returns: v.union(
    v.object({
      _id: v.id('threads'),
      subject: v.string(),
      messageId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // First check if the messageId matches the thread's original messageId
    const threadByMessageId = await ctx.db
      .query('threads')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
      .filter((q) => q.eq(q.field('teamId'), args.teamId))
      .first();

    if (threadByMessageId) {
      return {
        _id: threadByMessageId._id,
        subject: threadByMessageId.subject,
        messageId: threadByMessageId.messageId,
      };
    }

    // If not found, check if any message in any thread has this messageId
    const message = await ctx.db
      .query('messages')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
      .first();

    if (message) {
      const thread = await ctx.db.get(message.threadId);
      if (thread && thread.teamId === args.teamId) {
        return {
          _id: thread._id,
          subject: thread.subject,
          messageId: thread.messageId,
        };
      }
    }

    return null;
  },
});

// Update thread classification
export const updateClassification = mutation({
  args: {
    threadId: v.id('threads'),
    classification: v.object({
      category: v.string(),
      priority: v.union(
        v.literal('urgent'),
        v.literal('high'),
        v.literal('normal'),
        v.literal('low')
      ),
      confidence: v.number(),
      generatedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    await ctx.db.patch(args.threadId, {
      classification: args.classification,
      priority: args.classification.priority, // Also update the main priority field
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Enhanced search threads with full-text search and advanced filtering (OPTIMIZED)
export const searchThreads = query({
  args: {
    searchTerm: v.string(),
    status: v.optional(
      v.union(
        v.literal('unread'),
        v.literal('read'),
        v.literal('replied'),
        v.literal('closed'),
        v.literal('archived')
      )
    ),
    priority: v.optional(
      v.union(
        v.literal('urgent'),
        v.literal('high'),
        v.literal('normal'),
        v.literal('low')
      )
    ),
    assignedTo: v.optional(v.id('users')),
    participant: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    dateRange: v.optional(
      v.object({
        startDate: v.number(),
        endDate: v.number(),
      })
    ),
    sortBy: v.optional(
      v.union(
        v.literal('relevance'),
        v.literal('newest'),
        v.literal('oldest'),
        v.literal('priority'),
        v.literal('subject')
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id('threads'),
        _creationTime: v.number(),
        subject: v.string(),
        participants: v.array(
          v.object({
            email: v.string(),
            name: v.optional(v.string()),
            type: v.union(
              v.literal('to'),
              v.literal('cc'),
              v.literal('bcc'),
              v.literal('from')
            ),
          })
        ),
        status: v.union(
          v.literal('unread'),
          v.literal('read'),
          v.literal('replied'),
          v.literal('closed'),
          v.literal('archived')
        ),
        priority: v.union(
          v.literal('urgent'),
          v.literal('high'),
          v.literal('normal'),
          v.literal('low')
        ),
        assignedTo: v.optional(v.id('users')),
        tags: v.array(v.string()),
        lastMessageAt: v.number(),
        createdAt: v.number(),
        snippet: v.optional(v.string()),
        matchType: v.optional(
          v.union(
            v.literal('subject'),
            v.literal('content'),
            v.literal('participant')
          )
        ),
        relevanceScore: v.optional(v.number()),
      })
    ),
    total: v.number(),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = Math.min(args.limit || 20, 50); // Reduced for better performance
    const sortBy = args.sortBy || 'relevance';

    let searchResults: any[] = [];

    // Optimize search strategy based on filters
    if (args.searchTerm.trim()) {
      // Use search index with filters for better performance
      const searchQuery = ctx.db
        .query('threads')
        .withSearchIndex('search_content', (q: any) => {
          let query = q
            .search('searchContent', args.searchTerm)
            .eq('teamId', currentUser.teamId);

          // Apply filters at the index level for better performance
          if (args.status) {
            query = query.eq('status', args.status);
          }
          if (args.priority) {
            query = query.eq('priority', args.priority);
          }
          if (args.assignedTo) {
            query = query.eq('assignedTo', args.assignedTo);
          }

          return query;
        });

      searchResults = await searchQuery.take(limit * 2); // Get extra for filtering
    } else {
      // Use optimized index for non-search queries
      let query;

      if (args.status && args.assignedTo) {
        query = ctx.db
          .query('threads')
          .withIndex('by_team_and_assignee', (q: any) =>
            q.eq('teamId', currentUser.teamId).eq('assignedTo', args.assignedTo)
          )
          .filter((q) => q.eq(q.field('status'), args.status));
      } else if (args.status) {
        query = ctx.db
          .query('threads')
          .withIndex('by_team_and_status', (q: any) =>
            q.eq('teamId', currentUser.teamId).eq('status', args.status)
          );
      } else if (args.assignedTo) {
        query = ctx.db
          .query('threads')
          .withIndex('by_team_and_assignee', (q: any) =>
            q.eq('teamId', currentUser.teamId).eq('assignedTo', args.assignedTo)
          );
      } else {
        query = ctx.db
          .query('threads')
          .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId));
      }

      searchResults = await query.order('desc').take(limit * 2);
    }

    // Apply remaining filters efficiently
    let filteredResults = searchResults;

    // Only apply filters that weren't handled at the index level
    if (!args.searchTerm) {
      if (args.priority && !args.status) {
        filteredResults = filteredResults.filter(
          (thread) => thread.priority === args.priority
        );
      }
    }

    if (args.participant) {
      filteredResults = filteredResults.filter((thread) =>
        thread.participants.some(
          (p: any) =>
            p.email.toLowerCase().includes(args.participant!.toLowerCase()) ||
            (p.name &&
              p.name.toLowerCase().includes(args.participant!.toLowerCase()))
        )
      );
    }

    if (args.tags && args.tags.length > 0) {
      filteredResults = filteredResults.filter((thread) =>
        args.tags!.some((tag) => thread.tags.includes(tag))
      );
    }

    if (args.dateRange) {
      filteredResults = filteredResults.filter(
        (thread) =>
          thread.lastMessageAt >= args.dateRange!.startDate &&
          thread.lastMessageAt <= args.dateRange!.endDate
      );
    }

    // Optimized sorting
    if (sortBy !== 'relevance' || !args.searchTerm.trim()) {
      filteredResults.sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return b.lastMessageAt - a.lastMessageAt;
          case 'oldest':
            return a.lastMessageAt - b.lastMessageAt;
          case 'priority':
            const priorityOrder: Record<string, number> = {
              urgent: 4,
              high: 3,
              normal: 2,
              low: 1,
            };
            return (
              (priorityOrder[b.priority] || 0) -
              (priorityOrder[a.priority] || 0)
            );
          case 'subject':
            return a.subject.localeCompare(b.subject);
          default:
            return b.lastMessageAt - a.lastMessageAt;
        }
      });
    }

    // Efficient pagination
    const paginatedResults = filteredResults.slice(0, limit);
    const hasMore = filteredResults.length > limit;
    const nextCursor = hasMore
      ? paginatedResults[paginatedResults.length - 1]._id.toString()
      : undefined;

    // Generate optimized snippets
    const enhancedResults = paginatedResults.map((thread) => {
      let snippet = thread.subject;
      let matchType = 'subject';
      let relevanceScore = 1;

      if (args.searchTerm.trim()) {
        const searchTerm = args.searchTerm.toLowerCase();

        // Quick relevance scoring
        if (thread.subject.toLowerCase().includes(searchTerm)) {
          relevanceScore = thread.subject.toLowerCase().startsWith(searchTerm)
            ? 1.0
            : 0.8;
          matchType = 'subject';
        } else {
          // Check participants
          const participantMatch = thread.participants.find(
            (p: any) =>
              p.email.toLowerCase().includes(searchTerm) ||
              (p.name && p.name.toLowerCase().includes(searchTerm))
          );

          if (participantMatch) {
            snippet = `From: ${participantMatch.name || participantMatch.email}`;
            matchType = 'participant';
            relevanceScore = 0.7;
          } else {
            relevanceScore = 0.6;
          }
        }
      }

      return {
        _id: thread._id,
        _creationTime: thread._creationTime,
        subject: thread.subject,
        participants: thread.participants,
        status: thread.status,
        priority: thread.priority,
        assignedTo: thread.assignedTo,
        tags: thread.tags,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
        snippet,
        matchType: matchType as 'subject' | 'content' | 'participant',
        relevanceScore,
      };
    });

    return {
      results: enhancedResults,
      total: filteredResults.length,
      hasMore,
      nextCursor,
    };
  },
});

// Search within messages for more detailed content search
export const searchMessages = query({
  args: {
    searchTerm: v.string(),
    threadId: v.optional(v.id('threads')),
    direction: v.optional(v.union(v.literal('inbound'), v.literal('outbound'))),
    participant: v.optional(v.string()),
    dateRange: v.optional(
      v.object({
        startDate: v.number(),
        endDate: v.number(),
      })
    ),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id('messages'),
        _creationTime: v.number(),
        threadId: v.id('threads'),
        subject: v.string(),
        from: v.object({
          email: v.string(),
          name: v.optional(v.string()),
        }),
        textContent: v.optional(v.string()),
        direction: v.union(v.literal('inbound'), v.literal('outbound')),
        createdAt: v.number(),
        snippet: v.optional(v.string()),
        matchType: v.optional(
          v.union(
            v.literal('subject'),
            v.literal('content'),
            v.literal('participant')
          )
        ),
        relevanceScore: v.optional(v.number()),
      })
    ),
    total: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = Math.min(args.limit || 20, 100);
    const offset = args.offset || 0;

    // Get threads for this team first
    const teamThreads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .collect();

    const teamThreadIds = teamThreads.map((t) => t._id);

    let searchResults: any[] = [];

    // Use full-text search on messages
    if (args.searchTerm.trim()) {
      searchResults = await ctx.db
        .query('messages')
        .withSearchIndex('search_content', (q: any) =>
          q.search('searchContent', args.searchTerm)
        )
        .take(1000);

      // Filter to only messages from team threads
      searchResults = searchResults.filter((msg) =>
        teamThreadIds.includes(msg.threadId)
      );
    } else {
      // Get all messages for team threads
      const allMessages: any[] = [];
      for (const threadId of teamThreadIds.slice(0, 50)) {
        // Limit for performance
        const messages = await ctx.db
          .query('messages')
          .withIndex('by_thread', (q: any) => q.eq('threadId', threadId))
          .collect();
        allMessages.push(...messages);
      }
      searchResults = allMessages;
    }

    // Apply filters
    let filteredResults = searchResults;

    if (args.threadId) {
      filteredResults = filteredResults.filter(
        (message) => message.threadId === args.threadId
      );
    }

    if (args.direction) {
      filteredResults = filteredResults.filter(
        (message) => message.direction === args.direction
      );
    }

    if (args.participant) {
      filteredResults = filteredResults.filter(
        (message) =>
          message.from.email
            .toLowerCase()
            .includes(args.participant!.toLowerCase()) ||
          (message.from.name &&
            message.from.name
              .toLowerCase()
              .includes(args.participant!.toLowerCase())) ||
          message.to?.some(
            (p: any) =>
              p.email.toLowerCase().includes(args.participant!.toLowerCase()) ||
              (p.name &&
                p.name.toLowerCase().includes(args.participant!.toLowerCase()))
          )
      );
    }

    if (args.dateRange) {
      filteredResults = filteredResults.filter(
        (message) =>
          message.createdAt >= args.dateRange!.startDate &&
          message.createdAt <= args.dateRange!.endDate
      );
    }

    // Sort by relevance/recency
    filteredResults.sort((a, b) => b.createdAt - a.createdAt);

    // Calculate pagination
    const total = filteredResults.length;
    const paginatedResults = filteredResults.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Generate snippets and match information
    const enhancedResults = paginatedResults.map((message) => {
      let snippet = '';
      let matchType = 'content';
      let relevanceScore = 1;

      if (args.searchTerm.trim()) {
        const searchTerm = args.searchTerm.toLowerCase();

        // Check subject match
        if (message.subject.toLowerCase().includes(searchTerm)) {
          snippet = message.subject;
          matchType = 'subject';
          relevanceScore = 1.0;
        }
        // Check content match
        else if (
          message.textContent &&
          message.textContent.toLowerCase().includes(searchTerm)
        ) {
          const contentIndex = message.textContent
            .toLowerCase()
            .indexOf(searchTerm);
          const start = Math.max(0, contentIndex - 50);
          const end = Math.min(
            message.textContent.length,
            contentIndex + args.searchTerm.length + 50
          );
          snippet = '...' + message.textContent.slice(start, end) + '...';
          matchType = 'content';
          relevanceScore = 0.9;
        }
        // Check participant match
        else if (
          message.from.email.toLowerCase().includes(searchTerm) ||
          (message.from.name &&
            message.from.name.toLowerCase().includes(searchTerm))
        ) {
          snippet = `From: ${message.from.name || message.from.email}`;
          matchType = 'participant';
          relevanceScore = 0.8;
        } else {
          snippet =
            message.textContent?.slice(0, 100) + '...' || message.subject;
          relevanceScore = 0.6;
        }
      } else {
        snippet = message.textContent?.slice(0, 100) + '...' || message.subject;
      }

      return {
        _id: message._id,
        _creationTime: message._creationTime,
        threadId: message.threadId,
        subject: message.subject,
        from: message.from,
        textContent: message.textContent,
        direction: message.direction,
        createdAt: message.createdAt,
        snippet,
        matchType: matchType as 'subject' | 'content' | 'participant',
        relevanceScore,
      };
    });

    return {
      results: enhancedResults,
      total,
      hasMore,
    };
  },
});

// Get search suggestions based on user's search history and content
export const getSearchSuggestions = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = args.limit || 10;
    const query = args.query.toLowerCase().trim();

    if (!query) return [];

    const suggestions = new Set<string>();

    // Get suggestions from thread subjects
    const threads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .take(500);

    threads.forEach((thread) => {
      if (thread.subject.toLowerCase().includes(query)) {
        suggestions.add(thread.subject);
      }

      // Add participant suggestions
      thread.participants.forEach((p: any) => {
        if (
          p.email.toLowerCase().includes(query) ||
          (p.name && p.name.toLowerCase().includes(query))
        ) {
          suggestions.add(p.email);
          if (p.name) suggestions.add(p.name);
        }
      });

      // Add tag suggestions
      thread.tags.forEach((tag: string) => {
        if (tag.toLowerCase().includes(query)) {
          suggestions.add(tag);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  },
});

// Enhanced search with faceted filtering and better performance
export const enhancedSearchThreads = query({
  args: {
    searchTerm: v.string(),
    filters: v.optional(
      v.object({
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        assignedTo: v.optional(v.id('users')),
        tags: v.optional(v.array(v.string())),
      })
    ),
    sortBy: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id('threads'),
        subject: v.string(),
        participants: v.array(
          v.object({
            email: v.string(),
            name: v.optional(v.string()),
            type: v.string(),
          })
        ),
        status: v.string(),
        priority: v.string(),
        assignedTo: v.optional(v.id('users')),
        tags: v.array(v.string()),
        lastMessageAt: v.number(),
        createdAt: v.number(),
        messageCount: v.number(),
        snippet: v.optional(v.string()),
        relevanceScore: v.number(),
      })
    ),
    total: v.number(),
    facets: v.object({
      statusCounts: v.object({}),
      priorityCounts: v.object({}),
      tagCounts: v.object({}),
    }),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = Math.min(args.limit || 20, 100);
    const offset = args.offset || 0;
    const filters = args.filters || {};

    // Get threads using search or filter
    let threads: any[] = [];
    if (args.searchTerm.trim()) {
      threads = await ctx.db
        .query('threads')
        .withSearchIndex('search_content', (q: any) =>
          q
            .search('searchContent', args.searchTerm)
            .eq('teamId', currentUser.teamId)
        )
        .take(500);
    } else {
      threads = await ctx.db
        .query('threads')
        .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
        .order('desc')
        .take(500);
    }

    // Apply filters
    if (filters.status) {
      threads = threads.filter((t) => t.status === filters.status);
    }
    if (filters.priority) {
      threads = threads.filter((t) => t.priority === filters.priority);
    }
    if (filters.assignedTo) {
      threads = threads.filter((t) => t.assignedTo === filters.assignedTo);
    }
    if (filters.tags && filters.tags.length > 0) {
      threads = threads.filter((t) =>
        filters.tags!.some((tag) => t.tags.includes(tag))
      );
    }

    // Calculate relevance scores and enhance results
    const enhancedThreads = await Promise.all(
      threads.map(async (thread) => {
        let relevanceScore = 1.0;
        const searchTerm = args.searchTerm.toLowerCase();

        if (searchTerm) {
          if (thread.subject.toLowerCase().includes(searchTerm)) {
            relevanceScore += 2.0;
          }
          if (
            thread.participants.some(
              (p: any) =>
                p.email.toLowerCase().includes(searchTerm) ||
                (p.name && p.name.toLowerCase().includes(searchTerm))
            )
          ) {
            relevanceScore += 1.5;
          }
        }

        // Get message count
        const messages = await ctx.db
          .query('messages')
          .withIndex('by_thread', (q: any) => q.eq('threadId', thread._id))
          .take(100);

        const messageCount = messages.length;
        const snippet = thread.subject;

        return {
          ...thread,
          messageCount,
          snippet,
          relevanceScore,
        };
      })
    );

    // Sort results
    const sortBy = args.sortBy || 'relevance';
    enhancedThreads.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.lastMessageAt - a.lastMessageAt;
        case 'oldest':
          return a.lastMessageAt - b.lastMessageAt;
        case 'relevance':
        default:
          return b.relevanceScore - a.relevanceScore;
      }
    });

    // Calculate facets
    const facets = {
      statusCounts: {} as Record<string, number>,
      priorityCounts: {} as Record<string, number>,
      tagCounts: {} as Record<string, number>,
    };

    enhancedThreads.forEach((thread) => {
      facets.statusCounts[thread.status] =
        (facets.statusCounts[thread.status] || 0) + 1;
      facets.priorityCounts[thread.priority] =
        (facets.priorityCounts[thread.priority] || 0) + 1;
      thread.tags.forEach((tag: string) => {
        facets.tagCounts[tag] = (facets.tagCounts[tag] || 0) + 1;
      });
    });

    const total = enhancedThreads.length;
    const paginatedResults = enhancedThreads.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      facets,
    };
  },
});

// Get popular search terms and suggestions
export const getPopularSearchTerms = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      term: v.string(),
      count: v.number(),
      lastUsed: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = args.limit || 10;

    const searchHistory = await ctx.db
      .query('searchHistory')
      .withIndex('by_user', (q: any) => q.eq('userId', currentUser._id))
      .order('desc')
      .take(100);

    const termCounts = new Map<string, { count: number; lastUsed: number }>();

    searchHistory.forEach((h) => {
      if (h.query.trim()) {
        const existing = termCounts.get(h.query) || { count: 0, lastUsed: 0 };
        termCounts.set(h.query, {
          count: existing.count + 1,
          lastUsed: Math.max(existing.lastUsed, h.createdAt),
        });
      }
    });

    return Array.from(termCounts.entries())
      .map(([term, data]) => ({
        term,
        count: data.count,
        lastUsed: data.lastUsed,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});

// Delete a thread and all its messages
export const deleteThread = mutation({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // First delete all messages in the thread
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_thread', (q: any) => q.eq('threadId', args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all comments in the thread
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_thread', (q: any) => q.eq('threadId', args.threadId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Finally delete the thread itself
    await ctx.db.delete(args.threadId);

    return null;
  },
});

// Get all available tags from threads in the team
export const getAvailableTags = query({
  args: {},
  async handler(ctx) {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const threads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .collect();

    // Collect all unique tags
    const tagsSet = new Set<string>();
    threads.forEach((thread) => {
      thread.tags.forEach((tag) => {
        if (tag.trim()) {
          tagsSet.add(tag.trim());
        }
      });
    });

    // Return sorted array of tags
    return Array.from(tagsSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  },
});
