import { action } from './_generated/server';
import { v } from 'convex/values';
import {
  parseEmailAddress,
  parseEmailAddresses,
  parseReferences,
  parseMessageId,
  parseInReplyTo,
  parseSubject,
  parseDate,
  extractTextFromHtml,
  isAutoReply,
  extractDomain,
  buildThreadKey,
  parseEmailFromWebhook,
} from './emailParsing';

/**
 * Test email parsing functions
 */
export const testEmailParsing = action({
  args: {},
  handler: async (ctx) => {
    const results: any[] = [];

    // Test parseEmailAddress
    try {
      const testCases = [
        'john@example.com',
        'John Doe <john@example.com>',
        '"John Doe" <john@example.com>',
        '<john@example.com>',
        'John Doe john@example.com',
      ];

      for (const testCase of testCases) {
        const result = parseEmailAddress(testCase);
        results.push({
          test: 'parseEmailAddress',
          input: testCase,
          output: result,
          success: true,
        });
      }
    } catch (error) {
      results.push({
        test: 'parseEmailAddress',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test parseEmailAddresses
    try {
      const multipleEmails =
        'john@example.com, Jane Doe <jane@example.com>, "Bob Smith" <bob@example.com>';
      const result = parseEmailAddresses(multipleEmails);
      results.push({
        test: 'parseEmailAddresses',
        input: multipleEmails,
        output: result,
        success: true,
      });
    } catch (error) {
      results.push({
        test: 'parseEmailAddresses',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test parseReferences
    try {
      const references =
        '<msg1@example.com> <msg2@example.com> <msg3@example.com>';
      const result = parseReferences(references);
      results.push({
        test: 'parseReferences',
        input: references,
        output: result,
        success: true,
      });
    } catch (error) {
      results.push({
        test: 'parseReferences',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test isAutoReply
    try {
      const autoReplyTests = [
        { subject: 'Auto-reply: Out of office', expected: true },
        { subject: 'RE: Your inquiry', expected: false },
        { subject: 'Vacation auto-reply', expected: true },
        { subject: 'Normal email subject', expected: false },
      ];

      for (const test of autoReplyTests) {
        const result = isAutoReply(test.subject, {});
        results.push({
          test: 'isAutoReply',
          input: test.subject,
          output: result,
          expected: test.expected,
          success: result === test.expected,
        });
      }
    } catch (error) {
      results.push({
        test: 'isAutoReply',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test extractDomain
    try {
      const domainTests = [
        'john@example.com',
        'user@subdomain.example.org',
        'test@localhost',
      ];

      for (const email of domainTests) {
        const result = extractDomain(email);
        results.push({
          test: 'extractDomain',
          input: email,
          output: result,
          success: true,
        });
      }
    } catch (error) {
      results.push({
        test: 'extractDomain',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test extractTextFromHtml
    try {
      const htmlContent =
        '<p>Hello <strong>world</strong>!</p><br><div>This is a test.</div>';
      const result = extractTextFromHtml(htmlContent);
      results.push({
        test: 'extractTextFromHtml',
        input: htmlContent,
        output: result,
        success: true,
      });
    } catch (error) {
      results.push({
        test: 'extractTextFromHtml',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test parseEmailFromWebhook
    try {
      const webhookData = {
        from: 'John Doe <john@example.com>',
        to: ['support@company.com'],
        cc: ['manager@company.com'],
        subject: 'Test email subject',
        text: 'This is the plain text content.',
        html: '<p>This is the <strong>HTML</strong> content.</p>',
        message_id: '<test123@example.com>',
        in_reply_to: '<original456@example.com>',
        references: '<ref1@example.com> <ref2@example.com>',
        date: '2024-01-15T10:30:00Z',
        headers: {
          'X-Custom-Header': 'test-value',
        },
      };

      const result = parseEmailFromWebhook(webhookData);
      results.push({
        test: 'parseEmailFromWebhook',
        input: 'webhook data object',
        output: result,
        success: true,
      });
    } catch (error) {
      results.push({
        test: 'parseEmailFromWebhook',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }

    // Test buildThreadKey
    try {
      const participants = [
        { email: 'john@example.com', name: 'John' },
        { email: 'jane@example.com', name: 'Jane' },
      ];
      const result = buildThreadKey('RE: Project Update', participants);
      results.push({
        test: 'buildThreadKey',
        input: { subject: 'RE: Project Update', participants },
        output: result,
        success: true,
      });
    } catch (error) {
      results.push({
        test: 'buildThreadKey',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
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
      message: `Email parsing tests completed: ${summary.passed}/${summary.totalTests} passed`,
    };
  },
});

/**
 * Test email threading logic with sample data
 */
export const testEmailThreading = action({
  args: {},
  handler: async (ctx) => {
    try {
      // Simulate a conversation thread
      const originalEmail = {
        from: 'customer@example.com',
        to: ['support@company.com'],
        subject: 'Need help with product',
        text: 'I need assistance with your product.',
        message_id: '<original123@example.com>',
        date: '2024-01-15T10:00:00Z',
      };

      const replyEmail = {
        from: 'support@company.com',
        to: ['customer@example.com'],
        subject: 'RE: Need help with product',
        text: 'We can help you with that.',
        message_id: '<reply456@company.com>',
        in_reply_to: '<original123@example.com>',
        references: '<original123@example.com>',
        date: '2024-01-15T11:00:00Z',
      };

      const followUpEmail = {
        from: 'customer@example.com',
        to: ['support@company.com'],
        subject: 'RE: Need help with product',
        text: 'Thank you for the quick response!',
        message_id: '<followup789@example.com>',
        in_reply_to: '<reply456@company.com>',
        references: '<original123@example.com> <reply456@company.com>',
        date: '2024-01-15T12:00:00Z',
      };

      // Parse all emails
      const parsedOriginal = parseEmailFromWebhook(originalEmail);
      const parsedReply = parseEmailFromWebhook(replyEmail);
      const parsedFollowUp = parseEmailFromWebhook(followUpEmail);

      // Test thread key generation
      const originalThreadKey = buildThreadKey(parsedOriginal.subject, [
        parsedOriginal.from,
        ...parsedOriginal.to,
      ]);

      const replyThreadKey = buildThreadKey(parsedReply.subject, [
        parsedReply.from,
        ...parsedReply.to,
      ]);

      return {
        success: true,
        message: 'Email threading test completed successfully',
        data: {
          originalEmail: parsedOriginal,
          replyEmail: parsedReply,
          followUpEmail: parsedFollowUp,
          threadKeys: {
            original: originalThreadKey,
            reply: replyThreadKey,
            shouldMatch: originalThreadKey === replyThreadKey,
          },
          threadingInfo: {
            originalHasReferences: parsedOriginal.references.length > 0,
            replyReferencesOriginal:
              parsedReply.inReplyTo === parsedOriginal.messageId,
            followUpReferencesReply:
              parsedFollowUp.inReplyTo === parsedReply.messageId,
            followUpHasFullChain: parsedFollowUp.references.includes(
              parsedOriginal.messageId
            ),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Email threading test failed',
      };
    }
  },
});
