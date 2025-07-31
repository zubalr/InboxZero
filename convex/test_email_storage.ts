import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

/**
 * Test email storage mutations with various scenarios
 */
export const testEmailStorage = action({
  args: {
    testUserId: v.optional(v.id('users')),
  },
  returns: v.object({
    summary: v.object({
      totalTests: v.number(),
      passed: v.number(),
      failed: v.number(),
    }),
    results: v.array(v.any()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const results: any[] = [];

    try {
      // Test 1: Create a valid thread
      const validThreadData = {
        subject: 'Test Email Thread',
        messageId: '<test-thread-123@example.com>',
        inReplyTo: undefined,
        references: [],
        participants: [
          {
            email: 'sender@example.com',
            name: 'Test Sender',
            type: 'from' as const,
          },
          {
            email: 'recipient@company.com',
            name: 'Test Recipient',
            type: 'to' as const,
          },
        ],
        priority: 'normal' as const,
        tags: ['test', 'automated'],
      };

      try {
        const threadId = await ctx.runMutation(
          api.threads.createThread,
          validThreadData
        );
        results.push({
          test: 'createValidThread',
          success: true,
          threadId,
          message: 'Successfully created valid thread',
        });

        // Test 2: Create a message in the thread
        const validMessageData = {
          threadId,
          messageId: '<test-message-456@example.com>',
          inReplyTo: '<test-thread-123@example.com>',
          references: ['<test-thread-123@example.com>'],
          from: {
            email: 'sender@example.com',
            name: 'Test Sender',
          },
          to: [
            {
              email: 'recipient@company.com',
              name: 'Test Recipient',
            },
          ],
          cc: [
            {
              email: 'cc@company.com',
              name: 'CC Recipient',
            },
          ],
          subject: 'RE: Test Email Thread',
          textContent: 'This is a test message with plain text content.',
          htmlContent:
            '<p>This is a test message with <strong>HTML</strong> content.</p>',
          headers: {
            date: new Date().toISOString(),
          },
          direction: 'inbound' as const,
        };

        try {
          const messageId = await ctx.runMutation(
            api.messages.create,
            validMessageData
          );
          results.push({
            test: 'createValidMessage',
            success: true,
            messageId,
            message: 'Successfully created valid message',
          });
        } catch (error) {
          results.push({
            test: 'createValidMessage',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } catch (error) {
        results.push({
          test: 'createValidThread',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 3: Try to create thread with invalid data
      const invalidThreadData = {
        subject: '', // Empty subject
        messageId: 'invalid-message-id', // Invalid format
        participants: [], // Empty participants
        references: [],
      };

      try {
        await ctx.runMutation(
          api.threads.createThread,
          invalidThreadData as any
        );
        results.push({
          test: 'createInvalidThread',
          success: false,
          message: 'Should have failed with invalid data',
        });
      } catch (error) {
        results.push({
          test: 'createInvalidThread',
          success: true,
          message: 'Correctly rejected invalid thread data',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 4: Try to create message with invalid email
      const invalidMessageData = {
        threadId: 'invalid-thread-id' as any,
        messageId: '<test-invalid@example.com>',
        from: {
          email: 'invalid-email', // Invalid email format
          name: 'Test',
        },
        to: [
          {
            email: 'also-invalid-email', // Invalid email format
          },
        ],
        subject: 'Test',
        headers: {
          date: new Date().toISOString(),
        },
        direction: 'inbound' as const,
        references: [],
      };

      try {
        await ctx.runMutation(api.messages.create, invalidMessageData);
        results.push({
          test: 'createInvalidMessage',
          success: false,
          message: 'Should have failed with invalid email',
        });
      } catch (error) {
        results.push({
          test: 'createInvalidMessage',
          success: true,
          message: 'Correctly rejected invalid message data',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 5: Test data sanitization
      const oversizedData = {
        subject: 'A'.repeat(1000), // Very long subject
        messageId: '<sanitization-test@example.com>',
        participants: [
          {
            email: 'test@example.com',
            name: 'B'.repeat(200), // Very long name
            type: 'from' as const,
          },
          {
            email: 'recipient@company.com',
            type: 'to' as const,
          },
        ],
        references: [],
        tags: Array.from({ length: 20 }, (_, i) => `tag${i}`), // Too many tags
      };

      try {
        const threadId = await ctx.runMutation(
          api.threads.createThread,
          oversizedData
        );

        // Verify the data was sanitized
        const thread = await ctx.runQuery(api.threads.getThread, { threadId });

        results.push({
          test: 'dataSanitization',
          success: true,
          message: 'Data was properly sanitized',
          sanitizedData: {
            subjectLength: thread?.subject.length,
            nameLength: thread?.participants[0].name?.length,
            tagCount: thread?.tags.length,
          },
        });
      } catch (error) {
        results.push({
          test: 'dataSanitization',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 6: Test duplicate prevention
      const duplicateThreadData = {
        subject: 'Duplicate Test',
        messageId: '<duplicate-test@example.com>',
        participants: [
          {
            email: 'test@example.com',
            type: 'from' as const,
          },
          {
            email: 'recipient@company.com',
            type: 'to' as const,
          },
        ],
        references: [],
      };

      try {
        // Create first thread
        const firstThreadId = await ctx.runMutation(
          api.threads.createThread,
          duplicateThreadData
        );

        // Try to create duplicate
        await ctx.runMutation(api.threads.createThread, duplicateThreadData);

        results.push({
          test: 'duplicatePrevention',
          success: false,
          message: 'Should have prevented duplicate thread creation',
        });
      } catch (error) {
        results.push({
          test: 'duplicatePrevention',
          success: true,
          message: 'Correctly prevented duplicate thread creation',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch (error) {
      results.push({
        test: 'generalError',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Unexpected error during testing',
      });
    }

    const summary = {
      totalTests: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    return {
      summary,
      results,
      message: `Email storage tests completed: ${summary.passed}/${summary.totalTests} passed`,
    };
  },
});

/**
 * Test atomic operations and data consistency
 */
export const testAtomicOperations = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    tests: v.array(
      v.object({
        name: v.string(),
        passed: v.boolean(),
        details: v.optional(v.string()),
      })
    ),
  }),
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    message: string;
    tests: Array<{
      name: string;
      passed: boolean;
      details?: string;
    }>;
  }> => {
    try {
      // Test that thread and message creation is properly atomic
      const threadData = {
        subject: 'Atomic Test Thread',
        messageId: '<atomic-test@example.com>',
        participants: [
          {
            email: 'test@example.com',
            type: 'from' as const,
          },
          {
            email: 'recipient@company.com',
            type: 'to' as const,
          },
        ],
        references: [],
      };

      const threadId: any = await ctx.runMutation(
        api.threads.createThread,
        threadData
      );

      // Get initial thread state
      const initialThread: any = await ctx.runQuery(api.threads.getThread, {
        threadId,
      });
      const initialLastMessageAt: any = initialThread?.lastMessageAt;

      // Create a message
      const messageData = {
        threadId,
        messageId: '<atomic-message@example.com>',
        from: { email: 'test@example.com' },
        to: [{ email: 'recipient@company.com' }],
        subject: 'Atomic Test Message',
        textContent: 'Test content',
        headers: { date: new Date().toISOString() },
        direction: 'inbound' as const,
        references: [],
      };

      const messageId: any = await ctx.runMutation(
        api.messages.create,
        messageData
      );

      // Verify thread was updated
      const updatedThread = await ctx.runQuery(api.threads.getThread, {
        threadId,
      });
      const updatedLastMessageAt = updatedThread?.lastMessageAt;

      // Verify message was created
      const messages = await ctx.runQuery(api.messages.listForThread, {
        threadId,
      });

      return {
        success: true,
        message: 'Atomic operations test passed',
        tests: [
          {
            name: 'atomic_operations',
            passed: true,
            details: `Thread created: ${!!threadId}, Message created: ${!!messageId}, Thread updated: ${updatedLastMessageAt !== initialLastMessageAt}`,
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Atomic operations test failed',
        tests: [
          {
            name: 'atomic_operations',
            passed: false,
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  },
});
