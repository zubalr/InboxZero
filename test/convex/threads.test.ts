import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Threads Functions', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('threads.list', () => {
    it('should return empty array when no threads exist', async () => {
      const threads = await t.query(api.threads.list, {});
      expect(threads).toEqual([]);
    });

    it('should return threads for authenticated user team', async () => {
      // Create test data
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
        messageId: 'test-message-id',
        fromEmail: 'sender@example.com',
        fromName: 'Sender Name',
        toEmails: ['test@test.com'],
        htmlBody: '<p>Test message</p>',
        textBody: 'Test message',
      });

      // Test query
      const threads = await t.query(api.threads.list, { userId });
      expect(threads).toHaveLength(1);
      expect(threads[0].subject).toBe('Test Thread');
      expect(threads[0].teamId).toBe(teamId);
    });

    it('should filter threads by status', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      // Create threads with different statuses
      await t.mutation(api.threads.create, {
        subject: 'Unread Thread',
        teamId,
        messageId: 'unread-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Unread message',
      });

      const readThreadId = await t.mutation(api.threads.create, {
        subject: 'Read Thread',
        teamId,
        messageId: 'read-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Read message',
      });

      await t.mutation(api.threads.updateStatus, {
        threadId: readThreadId,
        status: 'read',
      });

      // Test filtering
      const unreadThreads = await t.query(api.threads.list, {
        userId,
        status: 'unread',
      });
      expect(unreadThreads).toHaveLength(1);
      expect(unreadThreads[0].subject).toBe('Unread Thread');

      const readThreads = await t.query(api.threads.list, {
        userId,
        status: 'read',
      });
      expect(readThreads).toHaveLength(1);
      expect(readThreads[0].subject).toBe('Read Thread');
    });
  });

  describe('threads.assign', () => {
    it('should assign thread to user', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const assigneeId = await t.mutation(api.users.create, {
        email: 'assignee@test.com',
        name: 'Assignee User',
        teamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'test-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Test message',
      });

      // Assign thread
      await t.mutation(api.threads.assign, {
        threadId,
        assigneeId,
      });

      // Verify assignment
      const thread = await t.query(api.threads.get, { threadId });
      expect(thread?.assigneeId).toBe(assigneeId);
    });

    it('should throw error when assigning to non-team member', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const otherTeamId = await t.mutation(api.teams.create, {
        name: 'Other Team',
        domain: 'other.com',
      });

      const outsideUserId = await t.mutation(api.users.create, {
        email: 'outside@other.com',
        name: 'Outside User',
        teamId: otherTeamId,
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'test-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Test message',
      });

      // Should throw error
      await expect(
        t.mutation(api.threads.assign, {
          threadId,
          assigneeId: outsideUserId,
        })
      ).rejects.toThrow();
    });
  });

  describe('threads.updatePriority', () => {
    it('should update thread priority', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'test-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Test message',
      });

      // Update priority
      await t.mutation(api.threads.updatePriority, {
        threadId,
        priority: 'urgent',
      });

      // Verify update
      const thread = await t.query(api.threads.get, { threadId });
      expect(thread?.priority).toBe('urgent');
    });

    it('should validate priority values', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'test-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Test message',
      });

      // Should throw error for invalid priority
      await expect(
        t.mutation(api.threads.updatePriority, {
          threadId,
          priority: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });
});
