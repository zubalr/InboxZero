'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
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
 * Send a test email using the Resend component (Production Ready)
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
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      throw new Error('Not authenticated');
    }

    try {
      // Use the Resend component for production email sending
      const resendInstance = await getResend();

      const emailId = await resendInstance.sendEmail(ctx, {
        from: 'InboxZero AI <noreply@inboxzero.ai>',
        to: args.to,
        subject: args.subject,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">InboxZero Test Email</h2>
          <p>${args.content}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280;">
            This is a test email sent from InboxZero AI
          </p>
        </div>`,
        text: `InboxZero Test Email\n\n${args.content}\n\n---\nThis is a test email sent from InboxZero AI`,
      });

      return {
        success: true,
        messageId: emailId,
      };
    } catch (error) {
      console.error('Failed to send test email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Send a reply email using the Resend component (Production Ready)
 */
export const sendReply: any = action({
  args: {
    threadId: v.id('threads'),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    textContent: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    localMessageId: v.optional(v.id('messages')),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await getAuthUserId(ctx);
    if (!identity) {
      throw new Error('Not authenticated');
    }

    try {
      // Get the current user's information
      const currentUser: any = await ctx.runQuery(api.users.getCurrentUser);
      if (!currentUser) {
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
      const emailHeaders: Array<{ name: string; value: string }> = [];

      if (args.inReplyTo) {
        emailHeaders.push({ name: 'In-Reply-To', value: args.inReplyTo });
      }

      if (args.references && args.references.length > 0) {
        emailHeaders.push({
          name: 'References',
          value: args.references.join(' '),
        });
      }

      // Add additional headers for better deliverability
      emailHeaders.push(
        { name: 'X-Mailer', value: 'InboxZero AI' },
        { name: 'X-Thread-ID', value: args.threadId }
      );

      // Use the Resend component for production email sending
      const resendInstance = await getResend();

      // Prepare the email content
      const htmlContent =
        args.htmlContent ||
        `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; white-space: pre-wrap;">${args.textContent || ''}</div>`;
      const textContent =
        args.textContent || args.htmlContent?.replace(/<[^>]*>/g, '') || '';

      // Send email using the Resend component
      const emailId: any = await resendInstance.sendEmail(ctx, {
        from: `${currentUser.name} <${currentUser.email}>`,
        to: args.to[0],
        subject: args.subject,
        html: htmlContent,
        text: textContent,
        headers: emailHeaders,
      });

      // Store the outbound message in our database
      const localMessageId: Id<'messages'> = await ctx.runMutation(
        api.messages.create,
        {
          threadId: args.threadId,
          messageId: emailId || `outbound-${Date.now()}`,
          inReplyTo: args.inReplyTo,
          references: args.references || [],
          from: {
            email: currentUser.email,
            name: currentUser.name,
          },
          to: args.to.map((email) => ({ email, name: undefined })),
          cc: args.cc?.map((email) => ({ email, name: undefined })),
          bcc: args.bcc?.map((email) => ({ email, name: undefined })),
          subject: args.subject,
          textContent: textContent,
          htmlContent: htmlContent,
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

      // Update thread status to reflect that a reply was sent
      await ctx.runMutation(api.threads.updateStatus, {
        threadId: args.threadId,
        status: 'replied',
      });

      return {
        success: true,
        messageId: emailId,
        localMessageId: localMessageId,
      };
    } catch (error) {
      console.error('Failed to send reply email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
