import { action, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { z } from 'zod';
import { generateObject, generateText } from './lib/ai';
import { Doc } from './_generated/dataModel';

const classificationSchema = z.object({
  category: z
    .enum([
      'urgent_request',
      'important_announcement',
      'product_update',
      'promotional_offer',
      'social_notification',
      'general_inquiry',
      'spam',
      'other',
    ])
    .describe('The category of the email.'),
  priority: z
    .enum(['urgent', 'high', 'normal', 'low'])
    .describe('The priority of the email.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('The confidence score of the classification, from 0 to 1.'),
});

export const classifyEmailPriority = action({
  args: {
    threadId: v.id('threads'),
    messageContent: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    category: v.optional(v.string()),
    priority: v.optional(v.string()),
    confidence: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const result = await generateObject({
        prompt: args.messageContent,
        schema: classificationSchema,
      });

      await ctx.runMutation(api.threads.updateClassification, {
        threadId: args.threadId,
        classification: {
          ...result,
          generatedAt: Date.now(),
        },
      });

      return { success: true, ...result };
    } catch (error) {
      console.error('Error classifying email priority:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const summarySchema = z.object({
  summary: z.string().describe('A concise summary of the email thread.'),
  actionItems: z
    .array(z.string())
    .describe('A list of action items from the email thread.'),
});

export const generateSummary = action({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.object({
    success: v.boolean(),
    summary: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const thread = await ctx.runQuery(api.threads.getThread, {
        threadId: args.threadId,
      });
      if (!thread) {
        throw new Error('Thread not found');
      }

      const messageContent: string = thread.messages
        .map((m: any) => m.textContent ?? '')
        .join('\n\n');

      const result = await generateObject({
        prompt: `Summarize the following email thread and extract any action items:\n\n${messageContent}`,
        schema: summarySchema,
      });

      await ctx.runMutation(api.threads.updateSummary, {
        threadId: args.threadId,
        summary: result.summary,
        actionItems: result.actionItems,
      });

      return { success: true, ...result };
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export const generateReply = action({
  args: {
    threadId: v.id('threads'),
    tone: v.union(
      v.literal('formal'),
      v.literal('friendly'),
      v.literal('short'),
      v.literal('detailed')
    ),
    context: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    reply: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const thread = await ctx.runQuery(api.threads.getThread, {
        threadId: args.threadId,
      });
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Get the conversation context
      const messageContent: string = thread.messages
        .map(
          (m: any) =>
            `From: ${m.from.email}\nTo: ${m.to.map((t: any) => t.email).join(', ')}\nSubject: ${m.subject}\n\n${m.textContent ?? m.htmlContent ?? ''}`
        )
        .join('\n\n---\n\n');

      // Define tone-specific instructions
      const toneInstructions = {
        formal:
          'Write in a professional, formal tone. Use proper business language and maintain a respectful distance.',
        friendly:
          'Write in a warm, friendly tone. Be personable and approachable while remaining professional.',
        short:
          'Write a brief, concise response. Get straight to the point without unnecessary details.',
        detailed:
          'Write a comprehensive, detailed response. Provide thorough explanations and cover all relevant points.',
      };

      const systemPrompt = `You are an AI assistant helping to draft email replies. 
${toneInstructions[args.tone]}

Generate a professional email reply based on the conversation context. 
${args.context ? `Additional context: ${args.context}` : ''}

Return only the email body content, without subject line or signatures.`;

      const reply = await generateText({
        prompt: `Please draft a reply to this email conversation:\n\n${messageContent}`,
        system: systemPrompt,
      });

      return { success: true, reply };
    } catch (error) {
      console.error('Error generating reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Save user feedback for AI-generated summaries
 */
export const saveSummaryFeedback = mutation({
  args: {
    threadId: v.id('threads'),
    feedback: v.union(
      v.literal('helpful'),
      v.literal('not_helpful'),
      v.literal('edited')
    ),
    summaryVersion: v.number(),
    editedContent: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    try {
      // Get current user (we'll need to add auth context)
      const userId = await ctx.auth.getUserIdentity();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get the user record
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', userId.email!))
        .first();

      if (!user) {
        throw new Error('User not found');
      }

      // Store feedback in emailFeedback table using correct schema
      await ctx.db.insert('emailFeedback', {
        threadId: args.threadId,
        userId: user._id,
        feedbackType: 'summary_quality',
        rating:
          args.feedback === 'helpful'
            ? 5
            : args.feedback === 'not_helpful'
              ? 1
              : 3,
        comment:
          args.feedback === 'edited' ? 'User edited the summary' : undefined,
        aiResponse: args.editedContent,
        metadata: {
          feature: 'summary',
          version: '1.0.0',
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        createdAt: Date.now(),
      });

      // Update thread with user feedback
      if (args.feedback === 'edited' && args.editedContent) {
        await ctx.db.patch(args.threadId, {
          summary: {
            content: args.editedContent,
            generatedAt: args.summaryVersion,
            model: 'gpt-4o',
          },
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving summary feedback:', error);
      throw error;
    }
  },
});

/**
 * Save user feedback for AI-generated replies
 */
export const saveReplyFeedback = mutation({
  args: {
    threadId: v.id('threads'),
    replyContent: v.string(),
    tone: v.union(
      v.literal('formal'),
      v.literal('friendly'),
      v.literal('short'),
      v.literal('detailed')
    ),
    feedback: v.union(
      v.literal('helpful'),
      v.literal('not_helpful'),
      v.literal('used')
    ),
    timestamp: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    try {
      // Get current user
      const userId = await ctx.auth.getUserIdentity();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get the user record
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', userId.email!))
        .first();

      if (!user) {
        throw new Error('User not found');
      }

      await ctx.db.insert('emailFeedback', {
        threadId: args.threadId,
        userId: user._id,
        feedbackType: 'reply_suggestion',
        rating: args.feedback === 'helpful' || args.feedback === 'used' ? 5 : 1,
        comment: `Reply suggestion feedback: ${args.feedback}`,
        aiResponse: args.replyContent,
        metadata: {
          feature: 'reply_generation',
          version: '1.0.0',
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        createdAt: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error saving reply feedback:', error);
      throw error;
    }
  },
});

/**
 * Get AI usage analytics for a team
 */
export const getAIUsageAnalytics = query({
  args: {
    teamId: v.optional(v.id('teams')),
    days: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    period: v.optional(v.string()),
    summaryStats: v.optional(
      v.object({
        generated: v.number(),
        helpful: v.number(),
        notHelpful: v.number(),
        edited: v.number(),
      })
    ),
    replyStats: v.optional(
      v.object({
        generated: v.number(),
        used: v.number(),
        helpful: v.number(),
        notHelpful: v.number(),
        byTone: v.object({
          formal: v.number(),
          friendly: v.number(),
          short: v.number(),
          detailed: v.number(),
        }),
      })
    ),
    totalInteractions: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const days = args.days || 30;
      const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

      // Query feedback directly
      let feedbackQuery = ctx.db
        .query('emailFeedback')
        .withIndex('by_created', (q) => q.gte('createdAt', cutoffDate));

      const allFeedback = await feedbackQuery.collect();

      // Filter by team if provided
      let feedback = allFeedback;
      if (args.teamId) {
        const teamThreads = await ctx.db
          .query('threads')
          .withIndex('by_team', (q) => q.eq('teamId', args.teamId!))
          .collect();
        const threadIds = teamThreads.map((t) => t._id);
        feedback = allFeedback.filter((f) => threadIds.includes(f.threadId));
      }

      const summaryStats = {
        generated: 0,
        helpful: 0,
        notHelpful: 0,
        edited: 0,
      };

      const replyStats = {
        generated: 0,
        used: 0,
        helpful: 0,
        notHelpful: 0,
        byTone: {
          formal: 0,
          friendly: 0,
          short: 0,
          detailed: 0,
        },
      };

      feedback.forEach((item) => {
        if (item.feedbackType === 'summary_quality') {
          summaryStats.generated++;
          if (item.rating >= 4) summaryStats.helpful++;
          else if (item.rating <= 2) summaryStats.notHelpful++;
          if (item.comment?.includes('edited')) summaryStats.edited++;
        } else if (item.feedbackType === 'reply_suggestion') {
          replyStats.generated++;
          if (item.comment?.includes('used')) replyStats.used++;
          else if (item.rating >= 4) replyStats.helpful++;
          else if (item.rating <= 2) replyStats.notHelpful++;
        }
      });

      return {
        success: true,
        period: `${days} days`,
        summaryStats,
        replyStats,
        totalInteractions: feedback.length,
      };
    } catch (error) {
      console.error('Error getting AI analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
