import { action, mutation } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

/**
 * Batch process multiple inbound emails
 * This is useful for handling email imports or bulk processing
 */
export const batchProcessEmails = action({
  args: {
    emails: v.array(
      v.object({
        from: v.string(),
        to: v.string(),
        subject: v.string(),
        message_id: v.string(),
      })
    ), // Array of email webhook data
    maxConcurrent: v.optional(v.number()), // Max concurrent processing
  },
  handler: async (ctx, args) => {
    const { emails, maxConcurrent = 5 } = args;
    const results: any[] = [];
    const errors: any[] = [];

    console.log(`Starting batch processing of ${emails.length} emails`);

    // Process emails in batches to avoid overwhelming the system
    for (let i = 0; i < emails.length; i += maxConcurrent) {
      const batch = emails.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (emailData, index) => {
        try {
          const result = await ctx.runAction(
            api.emailIngestion.processInboundEmail,
            {
              emailData,
            }
          );

          return {
            index: i + index,
            success: true,
            result,
            messageId: emailData.message_id,
          };
        } catch (error) {
          return {
            index: i + index,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            messageId: emailData.message_id,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      }

      // Add a small delay between batches to prevent rate limiting
      if (i + maxConcurrent < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const summary = {
      totalEmails: emails.length,
      successful: results.length,
      failed: errors.length,
      successRate: (results.length / emails.length) * 100,
    };

    console.log(`Batch processing completed:`, summary);

    return {
      summary,
      results,
      errors,
      message: `Processed ${emails.length} emails: ${results.length} successful, ${errors.length} failed`,
    };
  },
});

/**
 * Batch update thread statuses
 */
export const batchUpdateThreadStatus = mutation({
  args: {
    threadIds: v.array(v.id('threads')),
    status: v.union(
      v.literal('unread'),
      v.literal('read'),
      v.literal('replied'),
      v.literal('closed'),
      v.literal('archived')
    ),
  },
  handler: async (ctx, args) => {
    const { threadIds, status } = args;
    const results: any[] = [];
    const errors: any[] = [];

    for (const threadId of threadIds) {
      try {
        await ctx.db.patch(threadId, {
          status,
          updatedAt: Date.now(),
        });

        results.push({ threadId, success: true });
      } catch (error) {
        errors.push({
          threadId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      summary: {
        total: threadIds.length,
        successful: results.length,
        failed: errors.length,
      },
      results,
      errors,
    };
  },
});

/**
 * Batch assign threads to users
 */
export const batchAssignThreads = mutation({
  args: {
    threadIds: v.array(v.id('threads')),
    assigneeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const { threadIds, assigneeId } = args;
    const results: any[] = [];
    const errors: any[] = [];

    for (const threadId of threadIds) {
      try {
        await ctx.db.patch(threadId, {
          assignedTo: assigneeId,
          updatedAt: Date.now(),
        });

        results.push({ threadId, success: true });
      } catch (error) {
        errors.push({
          threadId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      summary: {
        total: threadIds.length,
        successful: results.length,
        failed: errors.length,
      },
      results,
      errors,
    };
  },
});

/**
 * Clean up old threads and messages
 * This helps maintain database performance
 */
export const cleanupOldData = action({
  args: {
    olderThanDays: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    threadsToCleanup: v.array(
      v.object({
        threadId: v.id('threads'),
        lastMessageAt: v.number(),
      })
    ),
    messagesDeleted: v.number(),
    threadsDeleted: v.number(),
    dryRun: v.boolean(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    threadsToCleanup: Array<{
      threadId: Id<'threads'>;
      lastMessageAt: number;
    }>;
    messagesDeleted: number;
    threadsDeleted: number;
    dryRun: boolean;
  }> => {
    const { olderThanDays, dryRun = true } = args;
    const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    try {
      // Find old threads
      const oldThreadsResult = await ctx.runQuery(api.threads.listThreads, {
        limit: 1000, // Process in batches
      });
      const oldThreads = oldThreadsResult.threads;

      const threadsToCleanup: Array<{
        threadId: Id<'threads'>;
        lastMessageAt: number;
      }> = oldThreads
        .filter(
          (thread: any) =>
            thread.lastMessageAt < cutoffDate && thread.status === 'archived'
        )
        .map((thread: any) => ({
          threadId: thread._id,
          lastMessageAt: thread.lastMessageAt,
        }));
      if (dryRun) {
        return {
          dryRun: true,
          threadsToCleanup: threadsToCleanup,
          messagesDeleted: 0,
          threadsDeleted: 0,
        };
      }

      // Actually perform cleanup
      let cleanedThreads = 0;
      let cleanedMessages = 0;

      if (!dryRun) {
        // Delete old threads (and their messages) one by one
        for (const threadToDelete of threadsToCleanup) {
          try {
            // Call the delete thread mutation
            await ctx.runMutation(api.threads.deleteThread, {
              threadId: threadToDelete.threadId,
            });
            cleanedThreads++;
          } catch (error) {
            console.error(
              `Failed to delete thread ${threadToDelete.threadId}:`,
              error
            );
          }
        }
      }

      return {
        dryRun: dryRun,
        threadsToCleanup: threadsToCleanup.map((t: any) => ({
          threadId: t.threadId,
          lastMessageAt: t.lastMessageAt,
        })),
        messagesDeleted: cleanedMessages,
        threadsDeleted: cleanedThreads,
      };
    } catch (error) {
      return {
        dryRun: dryRun,
        threadsToCleanup: [],
        messagesDeleted: 0,
        threadsDeleted: 0,
      };
    }
  },
});

/**
 * Validate data integrity across threads and messages
 */
export const validateDataIntegrity = action({
  args: {
    teamId: v.optional(v.id('teams')),
  },
  returns: v.object({
    issues: v.array(
      v.object({
        type: v.string(),
        threadId: v.id('threads'),
        subject: v.string(),
        message: v.string(),
      })
    ),
    threadsChecked: v.number(),
    messagesChecked: v.number(),
  }),
  handler: async (ctx, args) => {
    const issues: Array<{
      type: string;
      threadId: Id<'threads'>;
      subject: string;
      message: string;
    }> = [];
    let threadsChecked = 0;
    let messagesChecked = 0;

    try {
      // Get threads to check
      const threadsResult = await ctx.runQuery(api.threads.listThreads, {
        limit: 1000,
      });
      const threads = threadsResult.threads;

      for (const thread of threads) {
        threadsChecked++;

        // Check if thread has messages
        const messagesResult = await ctx.runQuery(api.messages.listForThread, {
          threadId: thread._id,
        });
        const messages = messagesResult.messages;

        messagesChecked += messages.length;

        // Check for orphaned threads (no messages)
        if (messages.length === 0) {
          issues.push({
            type: 'orphaned_thread',
            threadId: thread._id,
            subject: thread.subject || 'No subject',
            message: 'Thread has no messages',
          });
        }

        // Check for inconsistent lastMessageAt
        if (messages.length > 0) {
          const latestMessage = messages.reduce((latest: any, msg: any) =>
            msg.createdAt > latest.createdAt ? msg : latest
          );

          if (Math.abs(thread.lastMessageAt - latestMessage.createdAt) > 1000) {
            issues.push({
              type: 'inconsistent_timestamp',
              threadId: thread._id,
              subject: thread.subject || 'No subject',
              message: `Thread timestamp mismatch: thread=${new Date(thread.lastMessageAt).toISOString()}, actual=${new Date(latestMessage.createdAt).toISOString()}`,
            });
          }
        }

        // Check for duplicate message IDs within thread
        const messageIds = messages.map((m: any) => m.messageId);
        const uniqueMessageIds = new Set(messageIds);
        if (messageIds.length !== uniqueMessageIds.size) {
          issues.push({
            type: 'duplicate_message_ids',
            threadId: thread._id,
            subject: thread.subject || 'No subject',
            message: `Found ${messageIds.length - uniqueMessageIds.size} duplicate message IDs`,
          });
        }
      }

      return {
        issues,
        threadsChecked,
        messagesChecked,
      };
    } catch (error) {
      return {
        issues: [],
        threadsChecked: 0,
        messagesChecked: 0,
      };
    }
  },
});
