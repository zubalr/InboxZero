'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import {
  parseEmailFromWebhook,
  extractDomain,
  isAutoReply,
  buildThreadKey,
} from './emailParsing';

/**
 * Process inbound email from Resend webhook
 * This function handles the core email ingestion logic
 */
export const processInboundEmail = action({
  args: {
    emailData: v.object({
      from: v.string(),
      to: v.union(v.string(), v.array(v.string())),
      subject: v.string(),
      message_id: v.string(),
      text: v.optional(v.string()),
      html: v.optional(v.string()),
      cc: v.optional(v.union(v.string(), v.array(v.string()))),
      bcc: v.optional(v.union(v.string(), v.array(v.string()))),
      in_reply_to: v.optional(v.string()),
      references: v.optional(v.string()),
      date: v.optional(v.string()),
      headers: v.optional(v.record(v.string(), v.any())),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    threadId: v.optional(v.id('threads')),
    messageId: v.optional(v.id('messages')),
    isNewThread: v.optional(v.boolean()),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    threadId?: Id<'threads'>;
    messageId?: Id<'messages'>;
    isNewThread?: boolean;
    skipped?: boolean;
    reason?: string;
  }> => {
    try {
      const { emailData } = args;

      console.log('Processing inbound email webhook data:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        messageId: emailData.message_id,
      });

      // Parse email using improved parsing functions
      const parsedEmail = parseEmailFromWebhook(emailData);

      console.log('Parsed email data:', {
        from: parsedEmail.from,
        to: parsedEmail.to,
        subject: parsedEmail.subject,
        messageId: parsedEmail.messageId,
      });

      // Check if this is an auto-reply (skip processing if desired)
      if (isAutoReply(parsedEmail.subject, parsedEmail.headers)) {
        console.log('Skipping auto-reply email:', parsedEmail.subject);
        return {
          success: true,
          skipped: true,
          reason: 'auto-reply',
        };
      }

      // Determine team based on recipient domain
      let teamId: string | null = null;

      try {
        teamId = await findTeamByEmailDomain(ctx, parsedEmail.to[0].email);
      } catch (error) {
        console.error('Error finding team by domain:', error);
        throw new Error(
          `Failed to lookup team for domain: ${extractDomain(parsedEmail.to[0].email)}`
        );
      }

      if (!teamId) {
        const domain = extractDomain(parsedEmail.to[0].email);
        console.error('No team found for email domain:', domain);
        return {
          success: false,
          reason: `No team configured for domain: ${domain}. Please configure a team for this domain first.`,
        };
      }

      // Find existing thread or create new one
      let threadId: Id<'threads'> | null = await findExistingThread(
        ctx,
        parsedEmail.messageId,
        parsedEmail.inReplyTo,
        parsedEmail.references,
        teamId
      );

      if (!threadId) {
        // Create new thread
        const participants = [
          { ...parsedEmail.from, type: 'from' as const },
          ...parsedEmail.to.map((addr) => ({ ...addr, type: 'to' as const })),
          ...(parsedEmail.cc || []).map((addr) => ({
            ...addr,
            type: 'cc' as const,
          })),
          ...(parsedEmail.bcc || []).map((addr) => ({
            ...addr,
            type: 'bcc' as const,
          })),
        ];

        threadId = await ctx.runMutation(api.threads.createThread, {
          subject: parsedEmail.subject,
          messageId: parsedEmail.messageId,
          inReplyTo: parsedEmail.inReplyTo,
          references: parsedEmail.references,
          participants,
          priority: 'normal',
          tags: [],
        });

        console.log('Created new thread:', threadId);
      } else {
        console.log('Found existing thread:', threadId);
      }

      // Create message in thread (threadId is guaranteed to be non-null at this point)
      const newMessageId: Id<'messages'> = await ctx.runMutation(
        api.messages.create,
        {
          threadId,
          messageId: parsedEmail.messageId,
          inReplyTo: parsedEmail.inReplyTo,
          references: parsedEmail.references,
          from: parsedEmail.from,
          to: parsedEmail.to,
          cc: parsedEmail.cc,
          bcc: parsedEmail.bcc,
          subject: parsedEmail.subject,
          textContent: parsedEmail.textContent,
          htmlContent: parsedEmail.htmlContent,
          headers: {
            date: parsedEmail.date,
          },
          direction: 'inbound',
        }
      );

      console.log('Created new message:', newMessageId);

      // Classify email priority using AI (optional, can be done async)
      try {
        const contentForClassification =
          parsedEmail.textContent ||
          parsedEmail.htmlContent ||
          parsedEmail.subject;

        await ctx.runAction(api.ai.classifyEmailPriority, {
          threadId,
          messageContent: contentForClassification,
        });
      } catch (error) {
        console.warn('Failed to classify email priority:', error);
        // Don't fail the entire process if AI classification fails
      }

      return {
        success: true,
        threadId: threadId || undefined,
        messageId: newMessageId,
        isNewThread: !!threadId,
      };
    } catch (error) {
      console.error('Error processing inbound email:', error);
      throw error;
    }
  },
});

/**
 * Update delivery status for outbound emails
 */
export const updateDeliveryStatus = action({
  args: {
    deliveryData: v.object({
      message_id: v.string(),
      status: v.string(),
      error_message: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.id('messages')),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const { deliveryData } = args;
      const {
        message_id: messageId,
        status,
        error_message: errorMessage,
      } = deliveryData;

      console.log('Updating delivery status:', { messageId, status });

      // Find message by Resend message ID
      const message: any = await ctx.runQuery(api.messages.findByResendId, {
        resendId: messageId,
      });

      if (!message) {
        console.warn(
          'Message not found for delivery status update:',
          messageId
        );
        return { success: false, error: 'Message not found' };
      }

      // Update delivery status
      await ctx.runMutation(api.messages.updateDeliveryStatus, {
        messageId: message._id,
        status: mapDeliveryStatus(status),
        errorMessage,
      });

      return { success: true, messageId: message._id };
    } catch (error) {
      console.error('Error updating delivery status:', error);
      throw error;
    }
  },
});

/**
 * Find team by email domain (updated to use extractDomain)
 */
async function findTeamByEmailDomain(
  ctx: any,
  email: string
): Promise<string | null> {
  const domain = extractDomain(email);
  if (!domain) return null;

  try {
    const team = await ctx.runQuery(api.teams.findByDomain, { domain });
    return team?._id || null;
  } catch (error) {
    console.error('Error finding team by domain:', error);
    return null;
  }
}

/**
 * Find existing thread by message threading headers
 */
async function findExistingThread(
  ctx: any,
  messageId: string,
  inReplyTo: string | undefined,
  references: string[],
  teamId: string
): Promise<Id<'threads'> | null> {
  try {
    // First, check if this is a reply to an existing message
    if (inReplyTo) {
      const thread = await ctx.runQuery(api.threads.findByMessageId, {
        messageId: inReplyTo,
        teamId,
      });
      if (thread) return thread._id;
    }

    // Check references for thread association
    for (const ref of references) {
      const thread = await ctx.runQuery(api.threads.findByMessageId, {
        messageId: ref,
        teamId,
      });
      if (thread) return thread._id;
    }

    return null;
  } catch (error) {
    console.error('Error finding existing thread:', error);
    return null;
  }
}

/**
 * Map Resend delivery status to our internal status
 */
function mapDeliveryStatus(
  resendStatus: string
): 'sent' | 'delivered' | 'failed' {
  switch (resendStatus.toLowerCase()) {
    case 'sent':
    case 'queued':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'failed':
    case 'bounced':
    case 'complained':
      return 'failed';
    default:
      return 'sent';
  }
}
