'use node';
/**
 * Email synchronization service for Gmail and Outlook accounts
 * Handles real-time sync, token refresh, and webhook subscriptions
 */
import { action, mutation } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { auth } from './auth';
import { gmail_v1, google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { parseEmailFromWebhook } from './emailParsing';

/**
 * Set up Gmail push notifications (webhook subscriptions)
 */
export const setupGmailWebhook = action({
  args: {
    accountId: v.id('emailAccounts'),
  },
  returns: v.object({
    success: v.boolean(),
    historyId: v.optional(v.union(v.string(), v.null())),
    expiration: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    historyId?: string | null;
    expiration?: string | null;
  }> => {
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
      // Set up push notification
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: process.env.GMAIL_PUSH_TOPIC!, // Cloud Pub/Sub topic
          labelIds: account.settings?.syncLabels || ['INBOX'],
        },
      });

      // Store the watch configuration
      await ctx.runMutation(api.emailAccountMutations.updateWebhookConfig, {
        accountId: args.accountId,
        webhookConfig: {
          historyId: watchResponse.data.historyId!,
          expiration: parseInt(watchResponse.data.expiration!),
        },
      });

      return {
        success: true,
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
      };
    } catch (error) {
      console.error('Failed to setup Gmail webhook:', error);
      throw new Error(`Failed to setup Gmail webhook: ${error}`);
    }
  },
});

/**
 * Set up Outlook webhook subscriptions
 */
export const setupOutlookWebhook = action({
  args: {
    accountId: v.id('emailAccounts'),
  },
  returns: v.object({
    success: v.boolean(),
    subscriptionId: v.optional(v.string()),
    expiration: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
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
      // Create a subscription for new emails
      const subscription = await graphClient.api('/subscriptions').post({
        changeType: 'created,updated',
        notificationUrl: `${process.env.SITE_URL}/webhooks/outlook/notifications`,
        resource: '/me/messages',
        expirationDateTime: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(), // 3 days
        clientState: `account_${args.accountId}`,
      });

      // Store the subscription configuration
      await ctx.runMutation(api.emailAccountMutations.updateWebhookConfig, {
        accountId: args.accountId,
        webhookConfig: {
          subscriptionId: subscription.id,
          expiration: new Date(subscription.expirationDateTime).getTime(),
        },
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        expiration: subscription.expirationDateTime,
      };
    } catch (error) {
      console.error('Failed to setup Outlook webhook:', error);
      throw new Error(`Failed to setup Outlook webhook: ${error}`);
    }
  },
});

/**
 * Refresh OAuth tokens for expired accounts
 */
export const refreshAccountTokens = action({
  args: {
    accountId: v.id('emailAccounts'),
  },
  returns: v.object({
    success: v.boolean(),
    accessToken: v.optional(v.union(v.string(), v.null())),
    expiry: v.optional(v.union(v.number(), v.null())),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    accessToken?: string | null;
    expiry?: number | null;
  }> => {
    const account = await ctx.runQuery(
      api.emailAccountMutations.getEmailAccount,
      {
        accountId: args.accountId,
      }
    );

    if (!account) {
      throw new Error('Account not found');
    }

    if (account.provider === 'gmail') {
      return await refreshGmailTokens(ctx, account);
    } else if (account.provider === 'outlook') {
      return await refreshOutlookTokens(ctx, account);
    }

    throw new Error(`Unsupported provider: ${account.provider}`);
  },
});

/**
 * Refresh Gmail OAuth tokens
 */
async function refreshGmailTokens(ctx: any, account: any) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: account.refreshToken,
  });

  try {
    const { credentials } = await auth.refreshAccessToken();

    await ctx.runMutation(api.emailAccountMutations.updateTokens, {
      accountId: account._id,
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || account.refreshToken,
      tokenExpiry: credentials.expiry_date,
    });

    return {
      success: true,
      accessToken: credentials.access_token,
      expiry: credentials.expiry_date,
    };
  } catch (error) {
    console.error('Failed to refresh Gmail tokens:', error);

    // Mark account as having token issues
    await ctx.runMutation(api.emailAccountMutations.updateSyncError, {
      accountId: account._id,
      error: 'Token refresh failed - re-authentication required',
    });

    throw new Error(`Failed to refresh Gmail tokens: ${error}`);
  }
}

/**
 * Refresh Outlook OAuth tokens
 */
async function refreshOutlookTokens(ctx: any, account: any) {
  try {
    const response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: account.refreshToken,
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokens = await response.json();

    const tokenExpiry = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    await ctx.runMutation(api.emailAccountMutations.updateTokens, {
      accountId: account._id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || account.refreshToken,
      tokenExpiry,
    });

    return {
      success: true,
      accessToken: tokens.access_token,
      expiry: tokenExpiry,
    };
  } catch (error) {
    console.error('Failed to refresh Outlook tokens:', error);

    // Mark account as having token issues
    await ctx.runMutation(api.emailAccountMutations.updateSyncError, {
      accountId: account._id,
      error: 'Token refresh failed - re-authentication required',
    });

    throw new Error(`Failed to refresh Outlook tokens: ${error}`);
  }
}

/**
 * Process Gmail push notification
 */
export const processGmailNotification = action({
  args: {
    historyId: v.string(),
    emailAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    processedHistories: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Find the Gmail account
    const accounts = await ctx.runQuery(
      api.emailAccountMutations.getUserEmailAccounts
    );
    const gmailAccount = accounts.find(
      (account: any) =>
        account.provider === 'gmail' &&
        account.email === args.emailAddress &&
        account.isActive
    );

    if (!gmailAccount) {
      console.warn(
        'Gmail account not found for notification:',
        args.emailAddress
      );
      return { success: false, error: 'Account not found' };
    }

    // Check if tokens need refresh
    if (gmailAccount.tokenExpiry && gmailAccount.tokenExpiry < Date.now()) {
      await ctx.runAction(api.emailSync.refreshAccountTokens, {
        accountId: gmailAccount._id,
      });

      // Re-fetch account with refreshed tokens
      const refreshedAccount = await ctx.runQuery(
        api.emailAccountMutations.getEmailAccount,
        {
          accountId: gmailAccount._id,
        }
      );

      if (!refreshedAccount) {
        throw new Error('Failed to get refreshed account');
      }

      gmailAccount.accessToken = refreshedAccount.accessToken;
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: gmailAccount.accessToken,
      refresh_token: gmailAccount.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
      // Get the history of changes
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: args.historyId,
        historyTypes: ['messageAdded'],
      });

      const histories = historyResponse.data.history || [];

      for (const history of histories) {
        if (history.messagesAdded) {
          for (const messageAdded of history.messagesAdded) {
            try {
              // Get the full message
              const fullMessage = await gmail.users.messages.get({
                userId: 'me',
                id: messageAdded.message!.id!,
                format: 'full',
              });

              // Convert Gmail message to our email format and process
              const emailData = convertGmailToEmailData(fullMessage.data);

              // Process through our email ingestion system
              await ctx.runAction(api.emailIngestion.processInboundEmail, {
                emailData,
              });
            } catch (error) {
              console.error(
                `Error processing Gmail message ${messageAdded.message?.id}:`,
                error
              );
            }
          }
        }
      }

      return { success: true, processedHistories: histories.length };
    } catch (error) {
      console.error('Failed to process Gmail notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Process Outlook webhook notification
 */
export const processOutlookNotification = action({
  args: {
    subscriptionId: v.string(),
    resource: v.string(),
    changeType: v.string(),
    clientState: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Extract account ID from clientState
    const accountId = args.clientState.replace('account_', '');

    const account = await ctx.runQuery(
      api.emailAccountMutations.getEmailAccount,
      {
        accountId: accountId as any,
      }
    );

    if (!account || account.provider !== 'outlook' || !account.isActive) {
      console.warn('Outlook account not found for notification:', accountId);
      return { success: false, error: 'Account not found' };
    }

    // Check if tokens need refresh
    if (account.tokenExpiry && account.tokenExpiry < Date.now()) {
      await ctx.runAction(api.emailSync.refreshAccountTokens, {
        accountId: account._id,
      });

      // Re-fetch account with refreshed tokens
      const refreshedAccount = await ctx.runQuery(
        api.emailAccountMutations.getEmailAccount,
        {
          accountId: account._id,
        }
      );

      if (!refreshedAccount) {
        throw new Error('Failed to get refreshed account');
      }

      account.accessToken = refreshedAccount.accessToken;
    }

    const graphClient = Client.init({
      authProvider: {
        getAccessToken: async () => account.accessToken,
      } as any,
    });

    try {
      if (args.changeType === 'created') {
        // Extract message ID from resource URL
        const messageId = args.resource.split('/').pop();

        if (messageId) {
          // Get the full message
          const message = await graphClient
            .api(`/me/messages/${messageId}`)
            .get();

          // Convert Outlook message to our email format and process
          const emailData = convertOutlookToEmailData(message);

          // Process through our email ingestion system
          await ctx.runAction(api.emailIngestion.processInboundEmail, {
            emailData,
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to process Outlook notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Scheduled sync for all active email accounts
 */
export const scheduledSync = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accountsSynced: v.optional(v.number()),
    results: v.optional(v.array(v.any())),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      // Get all active email accounts that need syncing
      const allAccounts = await ctx.runQuery(
        api.emailAccountMutations.getAllActiveAccounts
      );

      const results: any[] = [];

      for (const account of allAccounts) {
        try {
          // Check if account needs token refresh
          if (
            account.tokenExpiry &&
            account.tokenExpiry < Date.now() + 300000
          ) {
            // 5 minutes buffer
            await ctx.runAction(api.emailSync.refreshAccountTokens, {
              accountId: account._id,
            });
          }

          // Perform sync based on provider
          if (account.provider === 'gmail') {
            const result = await ctx.runAction(
              api.emailProviders.syncGmailEmails,
              {
                accountId: account._id,
                maxResults: 20, // Limit for scheduled sync
              }
            );
            results.push({
              accountId: account._id,
              provider: 'gmail',
              ...result,
            });
          } else if (account.provider === 'outlook') {
            const result = await ctx.runAction(
              api.emailProviders.syncOutlookEmails,
              {
                accountId: account._id,
                maxResults: 20, // Limit for scheduled sync
              }
            );
            results.push({
              accountId: account._id,
              provider: 'outlook',
              ...result,
            });
          }
        } catch (error) {
          console.error(
            `Scheduled sync failed for account ${account._id}:`,
            error
          );
          results.push({
            accountId: account._id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        accountsSynced: results.length,
        results,
      };
    } catch (error) {
      console.error('Scheduled sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Scheduled token refresh for accounts that will expire soon
 */
export const scheduledTokenRefresh = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accountsProcessed: v.optional(v.number()),
    results: v.optional(v.array(v.any())),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      // Get accounts whose tokens expire in the next 30 minutes
      const expiringAccounts = await ctx.runQuery(
        api.emailAccountMutations.getExpiringAccounts
      );

      const results: any[] = [];

      for (const account of expiringAccounts) {
        try {
          await ctx.runAction(api.emailSync.refreshAccountTokens, {
            accountId: account._id,
          });

          results.push({
            accountId: account._id,
            email: account.email,
            success: true,
          });
        } catch (error) {
          console.error(
            `Failed to refresh tokens for account ${account._id}:`,
            error
          );
          results.push({
            accountId: account._id,
            email: account.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        accountsProcessed: results.length,
        results,
      };
    } catch (error) {
      console.error('Scheduled token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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
