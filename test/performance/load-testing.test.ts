import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Performance and Load Testing', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  describe('Database Query Performance', () => {
    it('should handle large thread lists efficiently', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      // Create 100 threads to test pagination and performance
      const threadPromises = [];
      for (let i = 0; i < 100; i++) {
        threadPromises.push(
          t.mutation(api.threads.create, {
            subject: `Test Thread ${i}`,
            teamId,
            messageId: `msg-${i}`,
            fromEmail: `sender${i}@example.com`,
            toEmails: ['test@test.com'],
            textBody: `Test message content ${i}`,
          })
        );
      }

      await Promise.all(threadPromises);

      // Measure query performance
      const startTime = performance.now();
      const threads = await t.query(api.threads.list, { userId });
      const endTime = performance.now();

      expect(threads).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large message threads efficiently', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Long Thread',
        teamId,
        messageId: 'initial-msg',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'Initial message',
      });

      // Add 50 messages to create a long thread
      const messagePromises = [];
      for (let i = 1; i <= 50; i++) {
        messagePromises.push(
          t.mutation(api.messages.create, {
            threadId,
            fromEmail:
              i % 2 === 0 ? 'support@test.com' : 'customer@example.com',
            toEmails:
              i % 2 === 0 ? ['customer@example.com'] : ['support@test.com'],
            subject: `Re: Long Thread`,
            textBody: `Message ${i} content`,
            messageId: `msg-${i}`,
            sentAt: Date.now() + i * 1000,
            isOutbound: i % 2 === 0,
          })
        );
      }

      await Promise.all(messagePromises);

      // Measure message retrieval performance
      const startTime = performance.now();
      const messages = await t.query(api.messages.listForThread, { threadId });
      const endTime = performance.now();

      expect(messages).toHaveLength(51); // 50 + initial message
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Search Performance', () => {
    it('should handle search queries efficiently with large dataset', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      // Create threads with varied content for search testing
      const searchTerms = [
        'urgent',
        'payment',
        'account',
        'support',
        'bug',
        'feature',
      ];
      const threadPromises = [];

      for (let i = 0; i < 200; i++) {
        const term = searchTerms[i % searchTerms.length];
        threadPromises.push(
          t.mutation(api.threads.create, {
            subject: `${term} issue ${i}`,
            teamId,
            messageId: `search-msg-${i}`,
            fromEmail: `user${i}@example.com`,
            toEmails: ['support@test.com'],
            textBody: `This is a ${term} related message with content ${i}`,
          })
        );
      }

      await Promise.all(threadPromises);

      // Test search performance
      const startTime = performance.now();
      const results = await t.query(api.search.threads, {
        userId,
        query: 'urgent',
      });
      const endTime = performance.now();

      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Real-time Updates Performance', () => {
    it('should handle concurrent comment additions efficiently', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userIds = [];
      for (let i = 0; i < 10; i++) {
        const userId = await t.mutation(api.users.create, {
          email: `user${i}@test.com`,
          name: `User ${i}`,
          teamId,
        });
        userIds.push(userId);
      }

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Collaborative Thread',
        teamId,
        messageId: 'collab-msg',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'Thread for collaboration testing',
      });

      // Simulate concurrent comment additions
      const commentPromises = [];
      for (let i = 0; i < 50; i++) {
        const userId = userIds[i % userIds.length];
        commentPromises.push(
          t.mutation(api.comments.add, {
            threadId,
            userId,
            content: `Comment ${i} from user ${userId}`,
          })
        );
      }

      const startTime = performance.now();
      await Promise.all(commentPromises);
      const endTime = performance.now();

      // Verify all comments were added
      const comments = await t.query(api.comments.listForThread, { threadId });
      expect(comments).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle presence updates efficiently', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Test Team',
        domain: 'test.com',
      });

      const userIds = [];
      for (let i = 0; i < 20; i++) {
        const userId = await t.mutation(api.users.create, {
          email: `user${i}@test.com`,
          name: `User ${i}`,
          teamId,
        });
        userIds.push(userId);
      }

      const threadId = await t.mutation(api.threads.create, {
        subject: 'Presence Test Thread',
        teamId,
        messageId: 'presence-msg',
        fromEmail: 'customer@example.com',
        toEmails: ['support@test.com'],
        textBody: 'Thread for presence testing',
      });

      // Simulate multiple users joining the thread
      const presencePromises = userIds.map((userId) =>
        t.mutation(api.presence.update, {
          threadId,
          userId,
        })
      );

      const startTime = performance.now();
      await Promise.all(presencePromises);
      const endTime = performance.now();

      // Verify presence was recorded
      const presence = await t.query(api.presence.listForThread, { threadId });
      expect(presence).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large data operations without memory issues', async () => {
      const teamId = await t.mutation(api.teams.create, {
        name: 'Memory Test Team',
        domain: 'test.com',
      });

      // Create a large amount of data to test memory handling
      const batchSize = 50;
      const batches = 5;

      for (let batch = 0; batch < batches; batch++) {
        const threadPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const threadIndex = batch * batchSize + i;
          threadPromises.push(
            t.mutation(api.threads.create, {
              subject: `Memory Test Thread ${threadIndex}`,
              teamId,
              messageId: `memory-msg-${threadIndex}`,
              fromEmail: `sender${threadIndex}@example.com`,
              toEmails: ['test@test.com'],
              textBody: `Large content for memory testing ${'x'.repeat(1000)}`,
            })
          );
        }

        await Promise.all(threadPromises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Verify all data was created successfully
      const userId = await t.mutation(api.users.create, {
        email: 'test@test.com',
        name: 'Test User',
        teamId,
      });

      const threads = await t.query(api.threads.list, { userId });
      expect(threads).toHaveLength(batchSize * batches);
    });
  });
});
