import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Comments Functions', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('comments.listForThread', () => {
    it('should return comments for a thread in chronological order', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      // Add comments
      const comment1Id = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'First comment',
      });

      const comment2Id = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'Second comment',
      });

      // Get comments
      const comments = await t.query(api.comments.listForThread, { threadId });

      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe('First comment');
      expect(comments[1].content).toBe('Second comment');
      expect(comments[0].userId).toBe(userId);
    });

    it('should return empty array for thread with no comments', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const comments = await t.query(api.comments.listForThread, { threadId });
      expect(comments).toEqual([]);
    });
  });

  describe('comments.add', () => {
    it('should add comment to thread', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const commentId = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'Test comment content',
      });

      const comment = await t.query(api.comments.get, { commentId });
      expect(comment).toBeDefined();
      expect(comment?.content).toBe('Test comment content');
      expect(comment?.userId).toBe(userId);
      expect(comment?.threadId).toBe(threadId);
    });

    it('should validate comment content', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      // Should throw error for empty content
      await expect(
        t.mutation(api.comments.add, {
          threadId,
          userId,
          content: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('comments.addReaction', () => {
    it('should add emoji reaction to comment', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const commentId = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'Test comment',
      });

      // Add reaction
      await t.mutation(api.comments.addReaction, {
        commentId,
        userId,
        emoji: '👍',
      });

      const comment = await t.query(api.comments.get, { commentId });
      expect(comment?.reactions).toHaveLength(1);
      expect(comment?.reactions[0].emoji).toBe('👍');
      expect(comment?.reactions[0].userIds).toContain(userId);
    });

    it('should toggle reaction when user reacts with same emoji', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const commentId = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'Test comment',
      });

      // Add reaction
      await t.mutation(api.comments.addReaction, {
        commentId,
        userId,
        emoji: '👍',
      });

      // Add same reaction again (should remove)
      await t.mutation(api.comments.addReaction, {
        commentId,
        userId,
        emoji: '👍',
      });

      const comment = await t.query(api.comments.get, { commentId });
      expect(comment?.reactions).toHaveLength(0);
    });
  });

  describe('comments.edit', () => {
    it('should allow user to edit their own comment', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const commentId = await t.mutation(api.comments.add, {
        threadId,
        userId,
        content: 'Original comment',
      });

      // Edit comment
      await t.mutation(api.comments.edit, {
        commentId,
        userId,
        content: 'Edited comment',
      });

      const comment = await t.query(api.comments.get, { commentId });
      expect(comment?.content).toBe('Edited comment');
    });

    it('should prevent user from editing others comments', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId1 = await t.mutation(api.users.create, {
        email: 'user1@test.com',
        name: 'User 1',
        teamId,
      });

      const userId2 = await t.mutation(api.users.create, {
        email: 'user2@test.com',
        name: 'User 2',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      const commentId = await t.mutation(api.comments.add, {
        threadId,
        userId: userId1,
        content: 'Original comment',
      });

      // Should throw error when different user tries to edit
      await expect(
        t.mutation(api.comments.edit, {
          commentId,
          userId: userId2,
          content: 'Malicious edit',
        })
      ).rejects.toThrow();
    });
  });
});
