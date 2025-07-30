import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Search Functions', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('search.threads', () => {
    it('should find threads by subject text', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      // Create threads with different subjects
      const thread1Id = await t.mutation(api.threads.create, {
        subject: 'Project Alpha Discussion',
        teamId,
        messageId: 'msg-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Discussion about project alpha',
      });

      const thread2Id = await t.mutation(api.threads.create, {
        subject: 'Beta Release Planning',
        teamId,
        messageId: 'msg-2',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Planning for beta release',
      });

      const thread3Id = await t.mutation(api.threads.create, {
        subject: 'Alpha Testing Results',
        teamId,
        messageId: 'msg-3',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Results from alpha testing',
      });

      // Search for "alpha"
      const results = await t.query(api.search.threads, {
        userId,
        query: 'alpha',
      });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.subject)).toContain(
        'Project Alpha Discussion'
      );
      expect(results.map((r) => r.subject)).toContain('Alpha Testing Results');
    });

    it('should find threads by message content', async () => {
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
        subject: 'General Discussion',
        teamId,
        messageId: 'msg-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message',
      });

      // Add message with specific content
      await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'test@test.com',
        toEmails: ['sender@example.com'],
        subject: 'Re: General Discussion',
        textBody: 'We need to implement the new authentication system',
        messageId: 'reply-1',
        sentAt: Date.now(),
        isOutbound: true,
      });

      // Search for content in messages
      const results = await t.query(api.search.threads, {
        userId,
        query: 'authentication',
      });

      expect(results).toHaveLength(1);
      expect(results[0].subject).toBe('General Discussion');
    });

    it('should filter by priority', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      // Create threads with different priorities
      const urgentThreadId = await t.mutation(api.threads.create, {
        subject: 'Urgent Issue',
        teamId,
        messageId: 'urgent-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Urgent message',
      });

      await t.mutation(api.threads.updatePriority, {
        threadId: urgentThreadId,
        priority: 'urgent',
      });

      const normalThreadId = await t.mutation(api.threads.create, {
        subject: 'Normal Issue',
        teamId,
        messageId: 'normal-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Normal message',
      });

      // Search with priority filter
      const urgentResults = await t.query(api.search.threads, {
        userId,
        query: 'issue',
        filters: {
          priority: 'urgent',
        },
      });

      expect(urgentResults).toHaveLength(1);
      expect(urgentResults[0].subject).toBe('Urgent Issue');

      // Search without filter should return both
      const allResults = await t.query(api.search.threads, {
        userId,
        query: 'issue',
      });

      expect(allResults).toHaveLength(2);
    });

    it('should filter by assignee', async () => {
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

      // Create assigned thread
      const assignedThreadId = await t.mutation(api.threads.create, {
        subject: 'Assigned Task',
        teamId,
        messageId: 'assigned-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Task message',
      });

      await t.mutation(api.threads.assign, {
        threadId: assignedThreadId,
        assigneeId,
      });

      // Create unassigned thread
      const unassignedThreadId = await t.mutation(api.threads.create, {
        subject: 'Unassigned Task',
        teamId,
        messageId: 'unassigned-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Task message',
      });

      // Search with assignee filter
      const assignedResults = await t.query(api.search.threads, {
        userId,
        query: 'task',
        filters: {
          assigneeId,
        },
      });

      expect(assignedResults).toHaveLength(1);
      expect(assignedResults[0].subject).toBe('Assigned Task');
    });

    it('should filter by status', async () => {
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
      const readThreadId = await t.mutation(api.threads.create, {
        subject: 'Read Thread',
        teamId,
        messageId: 'read-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Read message',
      });

      await t.mutation(api.threads.updateStatus, {
        threadId: readThreadId,
        status: 'read',
      });

      const unreadThreadId = await t.mutation(api.threads.create, {
        subject: 'Unread Thread',
        teamId,
        messageId: 'unread-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Unread message',
      });

      // Search with status filter
      const readResults = await t.query(api.search.threads, {
        userId,
        query: 'thread',
        filters: {
          status: 'read',
        },
      });

      expect(readResults).toHaveLength(1);
      expect(readResults[0].subject).toBe('Read Thread');
    });

    it('should return empty results for non-matching query', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      await t.mutation(api.threads.create, {
        subject: 'Test Thread',
        teamId,
        messageId: 'test-1',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Test message',
      });

      const results = await t.query(api.search.threads, {
        userId,
        query: 'nonexistent',
      });

      expect(results).toEqual([]);
    });
  });
});
