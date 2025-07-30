'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { Resend } from '@convex-dev/resend';

// Function to get the Resend instance
async function getResend(): Promise<Resend> {
  // Import components dynamically to avoid initialization issues
  const apiModule = await import('./_generated/api');
  const components = (apiModule as any).components;
  if (!components) {
    throw new Error(
      'Resend component not yet available. Make sure convex.config.ts includes the Resend component.'
    );
  }
  return new Resend(components.resend, {
    testMode: false, // Set to true for testing
  });
}

/**
 * Send a reply email using the Resend component
 */
export const sendReply = action({
  args: {
    threadId: v.id('threads'),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    htmlContent: v.optional(v.string()),
    textContent: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    localMessageId: v.optional(v.id('messages')),
  }),
  handler: async (ctx, args) => {
    // Get the current user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get user details
    const user: any = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) {
      throw new Error('User not found');
    }

    // Get thread details for proper email headers
    const thread = await ctx.runQuery(api.threads.getById, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Prepare email headers for proper threading
    const headers: Record<string, string> = {};

    if (args.inReplyTo) {
      headers['In-Reply-To'] = args.inReplyTo;
    }

    if (args.references && args.references.length > 0) {
      headers['References'] = args.references.join(' ');
    }

    try {
      // Use the Resend component instead of direct API calls
      const resendInstance = await getResend();

      // Prepare headers in the correct format for Resend component
      const emailHeaders = Object.entries(headers).map(([name, value]) => ({
        name,
        value,
      }));

      // Send email using the Resend component
      const emailId = await resendInstance.sendEmail(ctx, {
        from: `${user.name} <${user.email}>`,
        to: args.to.join(', '), // Resend expects a single string for multiple recipients
        subject: args.subject,
        html: args.htmlContent || args.textContent,
        headers: emailHeaders,
      });

      // Store the outbound message in our database
      const messageId: Id<'messages'> = await ctx.runMutation(
        api.messages.create,
        {
          threadId: args.threadId,
          messageId: emailId || `outbound-${Date.now()}`,
          inReplyTo: args.inReplyTo,
          references: args.references || [],
          from: {
            email: user.email,
            name: user.name,
          },
          to: args.to.map((email) => ({ email })),
          cc: args.cc?.map((email) => ({ email })),
          bcc: args.bcc?.map((email) => ({ email })),
          subject: args.subject,
          textContent: args.textContent,
          htmlContent: args.htmlContent,
          headers: {
            date: new Date().toISOString(),
          },
          direction: 'outbound',
          deliveryStatus: {
            status: 'sent',
            attempts: 1,
            lastAttemptAt: Date.now(),
          },
        }
      );

      // Update thread status
      await ctx.runMutation(api.threads.updateStatus, {
        threadId: args.threadId,
        status: 'replied',
      });

      return {
        success: true,
        messageId: emailId,
        localMessageId: messageId,
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error}`);
    }
  },
});

/**
 * Test email sending functionality with development emails
 */
export const sendTestEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    content: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    try {
      // Use the Resend component instead of direct API calls
      const resendInstance = await getResend();

      const emailId = await resendInstance.sendEmail(ctx, {
        from: 'InboxZero AI <test@inboxzero.ai>',
        to: args.to,
        subject: args.subject,
        html: `<p>${args.content}</p>`,
      });

      return {
        success: true,
        messageId: emailId,
        message: 'Test email sent successfully',
      };
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw new Error(`Failed to send test email: ${error}`);
    }
  },
});
