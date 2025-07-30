import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Messages Functions', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('messages.listForThread', () => {
    it('should return messages for a thread in chronological order', async () => {
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

      // Add multiple messages
      const message1Id = await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        subject: 'Test Thread',
        textBody: 'First message',
        messageId: 'msg-1',
        sentAt: Date.now() - 2000,
      });

      const message2Id = await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'test@test.com',
        toEmails: ['sender@example.com'],
        subject: 'Re: Test Thread',
        textBody: 'Reply message',
        messageId: 'msg-2',
        inReplyTo: 'msg-1',
        sentAt: Date.now() - 1000,
        isOutbound: true,
      });

      const message3Id = await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        subject: 'Re: Test Thread',
        textBody: 'Final message',
        messageId: 'msg-3',
        inReplyTo: 'msg-2',
        sentAt: Date.now(),
      });

      // Get messages
      const messages = await t.query(api.messages.listForThread, { threadId });

      expect(messages).toHaveLength(3);
      expect(messages[0].textBody).toBe('First message');
      expect(messages[1].textBody).toBe('Reply message');
      expect(messages[1].isOutbound).toBe(true);
      expect(messages[2].textBody).toBe('Final message');
    });

    it('should return empty array for non-existent thread', async () => {
      const messages = await t.query(api.messages.listForThread, {
        threadId: 'non-existent' as any,
      });
      expect(messages).toEqual([]);
    });
  });

  describe('messages.create', () => {
    it('should create message with required fields', async () => {
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

      const messageId = await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        subject: 'Test Message',
        textBody: 'Test message content',
        messageId: 'unique-message-id',
        sentAt: Date.now(),
      });

      const message = await t.query(api.messages.get, { messageId });
      expect(message).toBeDefined();
      expect(message?.fromEmail).toBe('sender@example.com');
      expect(message?.textBody).toBe('Test message content');
      expect(message?.isOutbound).toBe(false);
    });

    it('should handle HTML and text content', async () => {
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

      const messageId = await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        subject: 'HTML Message',
        htmlBody: '<p>HTML <strong>content</strong></p>',
        textBody: 'HTML content',
        messageId: 'html-message-id',
        sentAt: Date.now(),
      });

      const message = await t.query(api.messages.get, { messageId });
      expect(message?.htmlBody).toBe('<p>HTML <strong>content</strong></p>');
      expect(message?.textBody).toBe('HTML content');
    });

    it('should validate email addresses', async () => {
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

      // Should throw error for invalid email
      await expect(
        t.mutation(api.messages.create, {
          threadId,
          fromEmail: 'invalid-email',
          toEmails: ['test@test.com'],
          subject: 'Test Message',
          textBody: 'Test content',
          messageId: 'test-id',
          sentAt: Date.now(),
        })
      ).rejects.toThrow();
    });
  });

  describe('messages.markAsRead', () => {
    it('should mark thread as read for user', async () => {
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

      // Mark as read
      await t.mutation(api.messages.markAsRead, {
        threadId,
        userId,
      });

      // Verify thread status updated
      const thread = await t.query(api.threads.get, { threadId });
      expect(thread?.status).toBe('read');
    });
  });
});
