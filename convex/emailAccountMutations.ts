import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { auth } from './auth';

// Helper mutation to create email account
export const createEmailAccount = mutation({
  args: {
    userId: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    email: v.string(),
    displayName: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    isActive: v.boolean(),
    lastSyncAt: v.number(),
    syncStatus: v.union(
      v.literal('active'),
      v.literal('connected'),
      v.literal('error'),
      v.literal('disabled')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('emailAccounts', {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Helper mutation to update email account
export const updateEmailAccount = mutation({
  args: {
    accountId: v.id('emailAccounts'),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.number()),
    syncStatus: v.optional(
      v.union(
        v.literal('active'),
        v.literal('connected'),
        v.literal('error'),
        v.literal('disabled')
      )
    ),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId, ...updates } = args;
    return await ctx.db.patch(accountId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Helper query to get email account by email
export const getEmailAccountByEmail = query({
  args: {
    userId: v.id('users'),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('emailAccounts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('email'), args.email))
      .first();
  },
});

// Get user's connected email accounts
export const getUserEmailAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('emailAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();
  },
});

// Get single email account
export const getEmailAccount = query({
  args: {
    accountId: v.id('emailAccounts'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

// Update sync error for an account
export const updateSyncError = mutation({
  args: {
    accountId: v.id('emailAccounts'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      syncError: args.error,
      syncStatus: 'error' as const,
      updatedAt: Date.now(),
    });
  },
});

// Update OAuth tokens for an account
export const updateTokens = mutation({
  args: {
    accountId: v.id('emailAccounts'),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { accountId, ...updates } = args;
    await ctx.db.patch(accountId, {
      ...updates,
      syncError: undefined, // Clear any previous errors
      syncStatus: 'connected' as const,
      updatedAt: Date.now(),
    });
  },
});

// Get all active email accounts
export const getAllActiveAccounts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('emailAccounts')
      .withIndex('by_sync_status', (q) => q.eq('syncStatus', 'connected'))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();
  },
});

// Get accounts with tokens expiring soon
export const getExpiringAccounts = query({
  args: {},
  handler: async (ctx) => {
    const thirtyMinutesFromNow = Date.now() + 30 * 60 * 1000;

    return await ctx.db
      .query('emailAccounts')
      .filter((q) =>
        q.and(
          q.eq(q.field('isActive'), true),
          q.neq(q.field('tokenExpiry'), undefined),
          q.lt(q.field('tokenExpiry'), thirtyMinutesFromNow)
        )
      )
      .collect();
  },
});

// Update webhook configuration for an account
export const updateWebhookConfig = mutation({
  args: {
    accountId: v.id('emailAccounts'),
    webhookConfig: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      settings: {
        ...((await ctx.db.get(args.accountId))?.settings || {}),
        webhookConfig: args.webhookConfig,
      },
      updatedAt: Date.now(),
    });
  },
});
