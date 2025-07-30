import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

// Mock AI service responses
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

describe('AI Functions', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
    vi.clearAllMocks();
  });

  describe('ai.generateSummary', () => {
    it('should generate summary for thread with multiple messages', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'This thread discusses project timeline and deliverables.',
      });

      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Project Discussion',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'sender@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Initial message about project',
      });

      // Add more messages
      await t.mutation(api.messages.create, {
        threadId,
        fromEmail: 'test@test.com',
        toEmails: ['sender@example.com'],
        subject: 'Re: Project Discussion',
        textBody: 'Reply about timeline',
        messageId: 'reply-1',
        sentAt: Date.now(),
        isOutbound: true,
      });

      const summary = await t.action(api.ai.generateSummary, { threadId });

      expect(summary).toBe(
        'This thread discusses project timeline and deliverables.'
      );
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('project'),
        })
      );
    });

    it('should cache summary in thread record', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'Cached summary content',
      });

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
        textBody: 'Test message',
      });

      // Generate summary
      await t.action(api.ai.generateSummary, { threadId });

      // Check if summary was cached
      const thread = await t.query(api.threads.get, { threadId });
      expect(thread?.summary).toBe('Cached summary content');

      // Second call should use cached version
      const cachedSummary = await t.action(api.ai.generateSummary, {
        threadId,
      });
      expect(cachedSummary).toBe('Cached summary content');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('should handle AI service errors gracefully', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

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
        textBody: 'Test message',
      });

      await expect(
        t.action(api.ai.generateSummary, { threadId })
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('ai.generateReply', () => {
    it('should generate reply with specified tone', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'Thank you for your inquiry. We will review this matter promptly.',
      });

      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Customer Inquiry',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'I need help with my account',
      });

      const reply = await t.action(api.ai.generateReply, {
        threadId,
        tone: 'formal',
      });

      expect(reply).toBe(
        'Thank you for your inquiry. We will review this matter promptly.'
      );
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('formal'),
        })
      );
    });

    it('should include thread context in reply generation', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'Thanks! The meeting is confirmed for 2 PM.',
      });

      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Meeting Request',
        teamId,
        messageId: 'thread-message-id',
        fromEmail: 'colleague@example.com',
        toEmails: ['test@test.com'],
        textBody: 'Can we meet at 2 PM tomorrow?',
      });

      await t.action(api.ai.generateReply, {
        threadId,
        tone: 'friendly',
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Can we meet at 2 PM tomorrow?'),
        })
      );
    });
  });

  describe('ai.classifyPriority', () => {
    it('should classify urgent emails correctly', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'urgent',
      });

      const priority = await t.action(api.ai.classifyPriority, {
        messageContent:
          'URGENT: Server is down and customers cannot access the system!',
      });

      expect(priority).toBe('urgent');
    });

    it('should classify action required emails', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'action_required',
      });

      const priority = await t.action(api.ai.classifyPriority, {
        messageContent:
          'Please review and approve the attached contract by Friday.',
      });

      expect(priority).toBe('action_required');
    });

    it('should classify informational emails', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'info_only',
      });

      const priority = await t.action(api.ai.classifyPriority, {
        messageContent: 'FYI: The weekly newsletter has been published.',
      });

      expect(priority).toBe('info_only');
    });

    it('should handle classification errors', async () => {
      const { generateText } = await import('ai');
      const mockGenerateText = generateText as any;

      mockGenerateText.mockResolvedValue({
        text: 'invalid_priority',
      });

      // Should default to 'info_only' for invalid classifications
      const priority = await t.action(api.ai.classifyPriority, {
        messageContent: 'Some random message',
      });

      expect(priority).toBe('info_only');
    });
  });
});
