import { query } from './_generated/server';
import { v } from 'convex/values';

export const getAnalytics = query({
  args: {
    teamId: v.optional(v.id('teams')),
    since: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id('emailFeedback'),
      threadId: v.id('threads'),
      userId: v.id('users'),
      feedbackType: v.union(
        v.literal('summary_quality'),
        v.literal('reply_suggestion'),
        v.literal('priority_classification'),
        v.literal('general')
      ),
      rating: v.union(
        v.literal(1),
        v.literal(2),
        v.literal(3),
        v.literal(4),
        v.literal(5)
      ),
      comment: v.optional(v.string()),
      aiModel: v.optional(v.string()),
      aiResponse: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          feature: v.string(),
          version: v.string(),
          sessionId: v.string(),
        })
      ),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('emailFeedback')
      .withIndex('by_created', (q) => q.gte('createdAt', args.since));

    if (args.teamId) {
      // Filter by team through thread relationship
      const teamThreads = await ctx.db
        .query('threads')
        .withIndex('by_team', (q) => q.eq('teamId', args.teamId!))
        .collect();

      const threadIds = teamThreads.map((t) => t._id);
      const feedback = await query.collect();

      return feedback.filter((f) => threadIds.includes(f.threadId));
    }

    return await query.collect();
  },
});
