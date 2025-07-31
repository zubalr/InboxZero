'use node';
import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { auth } from './auth';
import { gmail_v1, google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';

// Gmail API Integration
class ConvexGmailAuthProvider implements AuthenticationProvider {
  constructor(private accessToken: string) {}

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

// Microsoft Graph API Integration
class ConvexGraphAuthProvider implements AuthenticationProvider {
  constructor(private accessToken: string) {}

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

// Connect Gmail account
export const connectGmailAccount = action({
  args: {
    authorizationCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject;

    // Initialize Gmail API client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.SITE_URL}/auth/callback`
    );

    try {
      // Exchange authorization code for tokens
      const { tokens } = await auth.getToken(args.authorizationCode);
      auth.setCredentials(tokens);

      const gmail = google.gmail({ version: 'v1', auth });

      // Get user's email address
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress!;

      // Check if this email account is already connected
      const existingAccount = await ctx.runQuery(
        api.emailAccountMutations.getEmailAccountByEmail,
        {
          userId: userId as any,
          email: emailAddress,
        }
      );

      if (existingAccount) {
        // Update existing account with new tokens
        await ctx.runMutation(api.emailAccountMutations.updateEmailAccount, {
          accountId: existingAccount._id,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry: tokens.expiry_date || undefined,
          isActive: true,
          lastSyncAt: Date.now(),
          syncStatus: 'connected' as const,
        });
      } else {
        // Store the new email account
        await ctx.runMutation(api.emailAccountMutations.createEmailAccount, {
          userId: userId as any,
          provider: 'gmail',
          email: emailAddress,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry: tokens.expiry_date || undefined,
          isActive: true,
          lastSyncAt: Date.now(),
          syncStatus: 'connected' as const,
        });
      }

      return { success: true, email: emailAddress };
    } catch (error) {
      console.error('Failed to connect Gmail account:', error);
      throw new Error(`Failed to connect Gmail account: ${error}`);
    }
  },
});

// Connect Outlook account
export const connectOutlookAccount = action({
  args: {
    authorizationCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject;

    try {
      // Exchange authorization code for tokens
      const response = await fetch(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: args.authorizationCode,
            redirect_uri: `${process.env.SITE_URL}/auth/callback`,
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens = await response.json();

      // Initialize Microsoft Graph client
      const graphClient = Client.init({
        authProvider: {
          getAccessToken: async () => tokens.access_token,
        } as any,
      });

      // Get user's email address
      const me = await graphClient.api('/me').get();
      const emailAddress = me.mail || me.userPrincipalName;

      if (!emailAddress) {
        throw new Error('Could not determine user email address');
      }

      // Check if this email account is already connected
      const existingAccount = await ctx.runQuery(
        api.emailAccountMutations.getEmailAccountByEmail,
        {
          userId: userId as any,
          email: emailAddress,
        }
      );

      const tokenExpiry = tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined;

      if (existingAccount) {
        // Update existing account with new tokens
        await ctx.runMutation(api.emailAccountMutations.updateEmailAccount, {
          accountId: existingAccount._id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry,
          isActive: true,
          lastSyncAt: Date.now(),
          syncStatus: 'connected' as const,
        });
      } else {
        // Store the new email account
        await ctx.runMutation(api.emailAccountMutations.createEmailAccount, {
          userId: userId as any,
          provider: 'outlook',
          email: emailAddress,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry,
          isActive: true,
          lastSyncAt: Date.now(),
          syncStatus: 'connected' as const,
        });
      }

      return { success: true, email: emailAddress };
    } catch (error) {
      console.error('Failed to connect Outlook account:', error);
      throw new Error(`Failed to connect Outlook account: ${error}`);
    }
  },
});

// Sync emails from Gmail
export const syncGmailEmails = action({
  args: {
    accountId: v.id('emailAccounts'),
    maxResults: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    messagesSynced: v.number(),
    messages: v.array(v.any()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    messagesSynced: number;
    messages: any[];
  }> => {
    // Get account
    const account = await ctx.runQuery(
      api.emailAccountMutations.getEmailAccount,
      {
        accountId: args.accountId,
      }
    );

    if (!account || account.provider !== 'gmail' || !account.isActive) {
      throw new Error('Gmail account not found or inactive');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
      // List recent messages
      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        q: 'in:inbox',
        maxResults: args.maxResults || 10,
      });

      const messages = messagesResponse.data.messages || [];
      const syncedMessages: any[] = [];

      for (const message of messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          // Convert to our email format and store
          const emailData = convertGmailToEmailData(fullMessage.data);

          // Process through our email ingestion system
          await ctx.runAction(api.emailIngestion.processInboundEmail, {
            emailData,
          });

          syncedMessages.push({
            id: message.id,
            subject: emailData.subject,
            from: emailData.from,
          });
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
        }
      }

      return {
        success: true,
        messagesSynced: syncedMessages.length,
        messages: syncedMessages,
      };
    } catch (error) {
      console.error('Gmail sync error:', error);
      await ctx.runMutation(api.emailAccountMutations.updateSyncError, {
        accountId: args.accountId,
        error: `Gmail sync failed: ${error}`,
      });
      throw new Error(`Gmail sync failed: ${error}`);
    }
  },
});

// Sync emails from Outlook
export const syncOutlookEmails = action({
  args: {
    accountId: v.id('emailAccounts'),
    maxResults: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    messagesSynced: v.number(),
    messages: v.array(v.any()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    messagesSynced: number;
    messages: any[];
  }> => {
    // Get account
    const account = await ctx.runQuery(
      api.emailAccountMutations.getEmailAccount,
      {
        accountId: args.accountId,
      }
    );

    if (!account || account.provider !== 'outlook' || !account.isActive) {
      throw new Error('Outlook account not found or inactive');
    }

    const graphClient = Client.init({
      authProvider: {
        getAccessToken: async () => account.accessToken,
      } as any,
    });

    try {
      // Get recent messages
      const messagesResponse = await graphClient
        .api('/me/messages')
        .top(args.maxResults || 10)
        .filter('isRead eq false')
        .get();

      const messages = messagesResponse.value || [];
      const syncedMessages: any[] = [];

      for (const message of messages) {
        try {
          // Convert to our email format and store
          const emailData = convertOutlookToEmailData(message);

          // Process through our email ingestion system
          await ctx.runAction(api.emailIngestion.processInboundEmail, {
            emailData,
          });

          syncedMessages.push({
            id: message.id,
            subject: message.subject,
            from: message.from?.emailAddress?.address,
          });
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
        }
      }

      return {
        success: true,
        messagesSynced: syncedMessages.length,
        messages: syncedMessages,
      };
    } catch (error) {
      console.error('Outlook sync error:', error);
      await ctx.runMutation(api.emailAccountMutations.updateSyncError, {
        accountId: args.accountId,
        error: `Outlook sync failed: ${error}`,
      });
      throw new Error(`Outlook sync failed: ${error}`);
    }
  },
});

// Trigger manual sync for an account
export const triggerManualSync = action({
  args: {
    accountId: v.id('emailAccounts'),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      messagesSynced: v.number(),
      messages: v.array(v.any()),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    })
  ),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    messagesSynced: number;
    messages: any[];
  }> => {
    const account = await ctx.runQuery(
      api.emailAccountMutations.getEmailAccount,
      {
        accountId: args.accountId,
      }
    );

    if (!account || !account.isActive) {
      throw new Error('Account not found or inactive');
    }

    try {
      if (account.provider === 'gmail') {
        return await ctx.runAction(api.emailProviders.syncGmailEmails, {
          accountId: args.accountId,
        });
      } else if (account.provider === 'outlook') {
        return await ctx.runAction(api.emailProviders.syncOutlookEmails, {
          accountId: args.accountId,
        });
      }

      throw new Error(`Unsupported provider: ${account.provider}`);
    } catch (error) {
      await ctx.runMutation(api.emailAccountMutations.updateSyncError, {
        accountId: args.accountId,
        error: `Manual sync failed: ${error}`,
      });
      throw error;
    }
  },
});

/**
 * Convert Gmail message format to our standard email data format
 */
function convertGmailToEmailData(gmailMessage: gmail_v1.Schema$Message): any {
  const headers = gmailMessage.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

  // Extract text and HTML content
  let textContent = '';
  let htmlContent = '';

  if (gmailMessage.payload?.parts) {
    for (const part of gmailMessage.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textContent = Buffer.from(part.body.data, 'base64').toString();
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlContent = Buffer.from(part.body.data, 'base64').toString();
      }
    }
  } else if (gmailMessage.payload?.body?.data) {
    if (gmailMessage.payload.mimeType === 'text/plain') {
      textContent = Buffer.from(
        gmailMessage.payload.body.data,
        'base64'
      ).toString();
    } else if (gmailMessage.payload.mimeType === 'text/html') {
      htmlContent = Buffer.from(
        gmailMessage.payload.body.data,
        'base64'
      ).toString();
    }
  }

  return {
    from: getHeader('From'),
    to:
      getHeader('To')
        ?.split(',')
        .map((email) => email.trim()) || [],
    cc: getHeader('Cc')
      ?.split(',')
      .map((email) => email.trim()),
    bcc: getHeader('Bcc')
      ?.split(',')
      .map((email) => email.trim()),
    subject: getHeader('Subject') || '',
    text: textContent,
    html: htmlContent,
    'message-id': getHeader('Message-ID'),
    'in-reply-to': getHeader('In-Reply-To'),
    references: getHeader('References'),
    date: getHeader('Date'),
    headers: Object.fromEntries(headers.map((h) => [h.name!, h.value!])),
  };
}

/**
 * Convert Outlook message format to our standard email data format
 */
function convertOutlookToEmailData(outlookMessage: any): any {
  const toRecipients =
    outlookMessage.toRecipients?.map((r: any) => r.emailAddress.address) || [];
  const ccRecipients =
    outlookMessage.ccRecipients?.map((r: any) => r.emailAddress.address) || [];
  const bccRecipients =
    outlookMessage.bccRecipients?.map((r: any) => r.emailAddress.address) || [];

  return {
    from: outlookMessage.from?.emailAddress?.address,
    to: toRecipients,
    cc: ccRecipients.length > 0 ? ccRecipients : undefined,
    bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
    subject: outlookMessage.subject || '',
    text:
      outlookMessage.body?.contentType === 'text'
        ? outlookMessage.body.content
        : undefined,
    html:
      outlookMessage.body?.contentType === 'html'
        ? outlookMessage.body.content
        : undefined,
    'message-id': outlookMessage.internetMessageId,
    'in-reply-to': outlookMessage.conversationId, // Outlook uses conversation ID
    references: outlookMessage.conversationId,
    date: outlookMessage.receivedDateTime,
    headers: {
      'X-Outlook-Message-Id': outlookMessage.id,
      'X-Outlook-Conversation-Id': outlookMessage.conversationId,
    },
  };
}
