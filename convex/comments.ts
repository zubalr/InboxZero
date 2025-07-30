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

/**
 * Add a new comment to a thread
 */
export const addComment = mutation({
  args: {
    threadId: v.id('threads'),
    content: v.string(),
    parentCommentId: v.optional(v.id('comments')),
  },
  returns: v.id('comments'),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (args.content.length > 5000) {
      throw new Error('Comment content too long (max 5000 characters)');
    }

    // If replying to a comment, verify parent exists
    if (args.parentCommentId) {
      const parentComment = await ctx.db.get(args.parentCommentId);
      if (!parentComment || parentComment.threadId !== args.threadId) {
        throw new Error('Parent comment not found or invalid');
      }
    }

    const commentId = await ctx.db.insert('comments', {
      threadId: args.threadId,
      authorId: currentUser._id,
      content: args.content.trim(),
      parentCommentId: args.parentCommentId,
      isEdited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return commentId;
  },
});

/**
 * List comments for a thread
 */
export const listForThread = query({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.array(
    v.object({
      _id: v.id('comments'),
      _creationTime: v.number(),
      threadId: v.id('threads'),
      authorId: v.id('users'),
      content: v.string(),
      parentCommentId: v.optional(v.id('comments')),
      reactions: v.optional(
        v.array(
          v.object({
            emoji: v.string(),
            userId: v.id('users'),
            createdAt: v.number(),
          })
        )
      ),
      isEdited: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      user: v.object({
        _id: v.id('users'),
        name: v.string(),
        email: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // Get all comments for the thread
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('asc')
      .collect();

    // Get user information for each comment
    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.authorId);
        if (!user) {
          throw new Error('Comment author not found');
        }
        return {
          ...comment,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        };
      })
    );

    return commentsWithUsers;
  },
});

/**
 * Update a comment
 */
export const updateComment = mutation({
  args: {
    commentId: v.id('comments'),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Verify user owns the comment
    if (comment.authorId !== currentUser._id) {
      throw new Error('Not authorized to edit this comment');
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (args.content.length > 5000) {
      throw new Error('Comment content too long (max 5000 characters)');
    }

    // Store edit history
    const editHistory = comment.editHistory || [];
    editHistory.push({
      content: comment.content,
      editedAt: Date.now(),
    });

    await ctx.db.patch(args.commentId, {
      content: args.content.trim(),
      isEdited: true,
      editHistory,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a comment
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id('comments'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Verify user owns the comment
    if (comment.authorId !== currentUser._id) {
      throw new Error('Not authorized to delete this comment');
    }

    // Delete any replies to this comment
    const replies = await ctx.db
      .query('comments')
      .withIndex('by_parent', (q) => q.eq('parentCommentId', args.commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    // Delete the comment
    await ctx.db.delete(args.commentId);

    return null;
  },
});

/**
 * Add emoji reaction to a comment
 */
export const addReaction = mutation({
  args: {
    commentId: v.id('comments'),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(comment.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    // Get current reactions
    const reactions = comment.reactions || [];

    // Check if user already reacted with this emoji
    const existingReactionIndex = reactions.findIndex(
      (r) => r.userId === currentUser._id && r.emoji === args.emoji
    );

    let newReactions;
    if (existingReactionIndex >= 0) {
      // Remove existing reaction (toggle off)
      newReactions = reactions.filter((_, i) => i !== existingReactionIndex);
    } else {
      // Add new reaction
      newReactions = [
        ...reactions,
        {
          emoji: args.emoji,
          userId: currentUser._id,
          createdAt: Date.now(),
        },
      ];
    }

    await ctx.db.patch(args.commentId, {
      reactions: newReactions,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Get comment count for a thread
 */
export const getCommentCount = query({
  args: {
    threadId: v.id('threads'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .collect();

    return comments.length;
  },
});

/**
 * Get recent comments for notifications
 */
export const getRecentComments = query({
  args: {
    threadId: v.id('threads'),
    since: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id('comments'),
      content: v.string(),
      createdAt: v.number(),
      user: v.object({
        _id: v.id('users'),
        name: v.string(),
        email: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify the thread exists and user has access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.teamId !== currentUser.teamId) {
      throw new Error('Thread not found or access denied');
    }

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .filter((q) => q.gt(q.field('createdAt'), args.since))
      .order('desc')
      .collect();

    // Get user information for each comment
    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.authorId);
        if (!user) {
          throw new Error('Comment author not found');
        }
        return {
          _id: comment._id,
          content: comment.content,
          createdAt: comment.createdAt,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        };
      })
    );

    return commentsWithUsers;
  },
});
