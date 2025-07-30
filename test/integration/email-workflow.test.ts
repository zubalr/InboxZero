import { describe, it, expect, beforeEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'

// Mock external services
vi.mock('ai', () => ({
  generateText: vi.fn()
}))

vi.mock('@convex-dev/resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'resend-id-123' })
    }
  }))
}))

describe('Email Workflow Integration Tests', () => {
  let t: ReturnType<typeof convexTest>

  beforeEach(() => {
    t = convexTest(schema)
    vi.clearAllMocks()
  })

  describe('Complete Email Ingestion Flow', () => {
    it('should process incoming email and create thread with message', async () => {
      // Setup team and user
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      const userId = await t.mutation(api.users.create, {
        email: 'support@test.com',
        name: 'Support User',
        teamId
      })

      // Simulate webhook payload for incoming email
      const emailData = {
        from: 'customer@example.com',
        to: ['support@test.com'],
        subject: 'Need help with account',
        html: '<p>I cannot access my account. Please help.</p>',
        text: 'I cannot access my account. Please help.',
        'message-id': 'incoming-email-123',
        date: new Date().toISOString()
      }

      // Process email through webhook handler
      const threadId = await t.mutation(api.threads.create, {
        subject: emailData.subject,
        teamId,
        messageId: emailData['message-id'],
        fromEmail: emailData.from,
        toEmails: emailData.to,
        htmlBody: emailData.html,
        textBody: emailData.text
      })

      // Verify thread was created
      const thread = await t.query(api.threads.get, { threadId })
      expect(thread).toBeDefined()
      expect(thread?.subject).toBe('Need help with account')
      expect(thread?.status).toBe('unread')

      // Verify message was created
      const messages = await t.query(api.messages.listForThread, { threadId })
      expect(messages).toHaveLength(1)
      expect(messages[0].fromEmail).toBe('customer@example.com')
      expect(messages[0].textBody).toBe('I cannot access my account. Please help.')
    })
  })    it
('should handle email threading correctly', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      // Create initial thread
      const originalThreadId = await t.mutation(api.threads.create, {
        subject: 'Original Subject',
        teamId,
        messageId: 'original-msg-123',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'Original message'
      })

      // Create reply message that should be threaded
      const replyMessageId = await t.mutation(api.messages.create, {
        threadId: originalThreadId,
        fromEmail: 'support@test.com',
        toEmails: ['customer@example.com'],
        subject: 'Re: Original Subject',
        textBody: 'Thank you for contacting us',
        messageId: 'reply-msg-456',
        inReplyTo: 'original-msg-123',
        sentAt: Date.now(),
        isOutbound: true
      })

      // Create customer reply
      const customerReplyId = await t.mutation(api.messages.create, {
        threadId: originalThreadId,
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        subject: 'Re: Original Subject',
        textBody: 'Thanks for the quick response',
        messageId: 'customer-reply-789',
        inReplyTo: 'reply-msg-456',
        sentAt: Date.now() + 1000
      })

      // Verify all messages are in the same thread
      const messages = await t.query(api.messages.listForThread, { 
        threadId: originalThreadId 
      })
      
      expect(messages).toHaveLength(3)
      expect(messages[0].messageId).toBe('original-msg-123')
      expect(messages[1].messageId).toBe('reply-msg-456')
      expect(messages[1].isOutbound).toBe(true)
      expect(messages[2].messageId).toBe('customer-reply-789')
    })

    it('should process AI classification and summarization', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = generateText as any
      
      // Mock AI responses
      mockGenerateText
        .mockResolvedValueOnce({ text: 'urgent' }) // Priority classification
        .mockResolvedValueOnce({ text: 'Customer needs urgent help with account access issues.' }) // Summary

      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      // Create thread
      const threadId = await t.mutation(api.threads.create, {
        subject: 'URGENT: Cannot access account',
        teamId,
        messageId: 'urgent-msg-123',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'URGENT: I cannot access my account and need immediate help!'
      })

      // Classify priority
      const priority = await t.action(api.ai.classifyPriority, {
        messageContent: 'URGENT: I cannot access my account and need immediate help!'
      })

      // Update thread priority
      await t.mutation(api.threads.updatePriority, {
        threadId,
        priority: priority as any
      })

      // Generate summary
      const summary = await t.action(api.ai.generateSummary, { threadId })

      // Verify results
      const thread = await t.query(api.threads.get, { threadId })
      expect(thread?.priority).toBe('urgent')
      expect(thread?.summary).toBe('Customer needs urgent help with account access issues.')
      expect(summary).toBe('Customer needs urgent help with account access issues.')
    })
  })

  describe('Team Collaboration Flow', () => {
    it('should handle complete collaboration workflow', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      const user1Id = await t.mutation(api.users.create, {
        email: 'user1@test.com',
        name: 'User One',
        teamId
      })

      const user2Id = await t.mutation(api.users.create, {
        email: 'user2@test.com',
        name: 'User Two',
        teamId
      })

      // Create thread
      const threadId = await t.mutation(api.threads.create, {
        subject: 'Customer Issue',
        teamId,
        messageId: 'issue-msg-123',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'I have a problem with my order'
      })

      // User 1 assigns thread to User 2
      await t.mutation(api.threads.assign, {
        threadId,
        assigneeId: user2Id
      })

      // User 1 adds internal comment
      const comment1Id = await t.mutation(api.comments.add, {
        threadId,
        userId: user1Id,
        content: 'This looks like a shipping issue. Can you handle it?'
      })

      // User 2 adds reaction to comment
      await t.mutation(api.comments.addReaction, {
        commentId: comment1Id,
        userId: user2Id,
        emoji: '👍'
      })

      // User 2 adds reply comment
      const comment2Id = await t.mutation(api.comments.add, {
        threadId,
        userId: user2Id,
        content: 'Sure, I will look into the shipping details and respond.'
      })

      // Update presence for both users
      await t.mutation(api.presence.update, {
        threadId,
        userId: user1Id
      })

      await t.mutation(api.presence.update, {
        threadId,
        userId: user2Id
      })

      // Verify final state
      const thread = await t.query(api.threads.get, { threadId })
      expect(thread?.assigneeId).toBe(user2Id)

      const comments = await t.query(api.comments.listForThread, { threadId })
      expect(comments).toHaveLength(2)
      expect(comments[0].reactions).toHaveLength(1)
      expect(comments[0].reactions[0].emoji).toBe('👍')

      const presence = await t.query(api.presence.listForThread, { threadId })
      expect(presence).toHaveLength(2)
    })
  })

  describe('Email Sending Flow', () => {
    it('should send reply email with proper threading', async () => {
      const mockResend = {
        emails: {
          send: vi.fn().mockResolvedValue({ id: 'resend-id-123' })
        }
      }

      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      const userId = await t.mutation(api.users.create, {
        email: 'support@test.com',
        name: 'Support User',
        teamId
      })

      // Create original thread
      const threadId = await t.mutation(api.threads.create, {
        subject: 'Customer Question',
        teamId,
        messageId: 'customer-msg-123',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'What are your business hours?'
      })

      // Send reply
      await t.action(api.email.sendReply, {
        threadId,
        content: 'Our business hours are 9 AM to 5 PM, Monday through Friday.',
        recipients: ['customer@example.com']
      })

      // Verify reply message was created
      const messages = await t.query(api.messages.listForThread, { threadId })
      const replyMessage = messages.find(m => m.isOutbound)
      
      expect(replyMessage).toBeDefined()
      expect(replyMessage?.textBody).toBe('Our business hours are 9 AM to 5 PM, Monday through Friday.')
      expect(replyMessage?.toEmails).toContain('customer@example.com')
      expect(replyMessage?.isOutbound).toBe(true)
    })
  })

  describe('Search and Filtering Integration', () => {
    it('should search across threads and messages', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com'
      })

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId
      })

      // Create multiple threads with different content
      const thread1Id = await t.mutation(api.threads.create, {
        subject: 'Payment Processing Issue',
        teamId,
        messageId: 'payment-msg-1',
        fromEmail: 'customer1@example.com',
        toEmails: ['support@test.com'],
        textBody: 'My payment was declined'
      })

      const thread2Id = await t.mutation(api.threads.create, {
        subject: 'Account Access Problem',
        teamId,
        messageId: 'access-msg-1',
        fromEmail: 'customer2@example.com',
        toEmails: ['support@test.com'],
        textBody: 'Cannot login to my account'
      })

      // Add messages with searchable content
      await t.mutation(api.messages.create, {
        threadId: thread1Id,
        fromEmail: 'support@test.com',
        toEmails: ['customer1@example.com'],
        subject: 'Re: Payment Processing Issue',
        textBody: 'Please check your credit card details',
        messageId: 'payment-reply-1',
        sentAt: Date.now(),
        isOutbound: true
      })

      // Search for "payment"
      const paymentResults = await t.query(api.search.threads, {
        userId,
        query: 'payment'
      })

      expect(paymentResults).toHaveLength(1)
      expect(paymentResults[0].subject).toBe('Payment Processing Issue')

      // Search for "account"
      const accountResults = await t.query(api.search.threads, {
        userId,
        query: 'account'
      })

      expect(accountResults).toHaveLength(1)
      expect(accountResults[0].subject).toBe('Account Access Problem')

      // Search for "credit card" (should find in message content)
      const creditResults = await t.query(api.search.threads, {
        userId,
        query: 'credit card'
      })

      expect(creditResults).toHaveLength(1)
      expect(creditResults[0].subject).toBe('Payment Processing Issue')
    })
  })
})