import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

// Helper function to get current user
async function getCurrentUserFromAuth(ctx: any) {
  const identity = await getAuthUserId(ctx);
  if (!identity) {
    throw new Error('Not authenticated');
  }

  const authUser = await ctx.db.get(identity);
  if (!authUser) {
    throw new Error('Auth user not found');
  }

  const currentUser = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', authUser.email))
    .first();

  if (!currentUser) {
    throw new Error('User profile not found');
  }

  return currentUser;
}

// Save a search for quick access
export const saveSearch = mutation({
  args: {
    name: v.string(),
    query: v.string(),
    filters: v.object({
      status: v.optional(v.string()),
      priority: v.optional(v.string()),
      assignedTo: v.optional(v.string()),
      participant: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      dateRange: v.optional(
        v.object({
          startDate: v.number(),
          endDate: v.number(),
        })
      ),
      sortBy: v.optional(v.string()),
    }),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.id('savedSearches'),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate name
    if (!args.name.trim() || args.name.length > 100) {
      throw new Error('Search name must be between 1 and 100 characters');
    }

    // Check if name already exists for this user
    const existingSearch = await ctx.db
      .query('savedSearches')
      .withIndex('by_user', (q: any) => q.eq('userId', currentUser._id))
      .filter((q) => q.eq(q.field('name'), args.name.trim()))
      .first();

    if (existingSearch) {
      throw new Error('A saved search with this name already exists');
    }

    // If this is being set as default, unset other defaults
    if (args.isDefault) {
      const defaultSearches = await ctx.db
        .query('savedSearches')
        .withIndex('by_user_and_default', (q: any) =>
          q.eq('userId', currentUser._id).eq('isDefault', true)
        )
        .collect();

      for (const search of defaultSearches) {
        await ctx.db.patch(search._id, { isDefault: false });
      }
    }

    const searchId = await ctx.db.insert('savedSearches', {
      userId: currentUser._id,
      name: args.name.trim(),
      query: args.query,
      filters: args.filters,
      isDefault: args.isDefault || false,
      lastUsedAt: Date.now(),
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return searchId;
  },
});

// Get saved searches for current user
export const getSavedSearches = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal('name'),
        v.literal('lastUsed'),
        v.literal('useCount'),
        v.literal('created')
      )
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id('savedSearches'),
      name: v.string(),
      query: v.string(),
      filters: v.object({
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        assignedTo: v.optional(v.string()),
        participant: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        dateRange: v.optional(
          v.object({
            startDate: v.number(),
            endDate: v.number(),
          })
        ),
        sortBy: v.optional(v.string()),
      }),
      isDefault: v.boolean(),
      lastUsedAt: v.number(),
      useCount: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const searches = await ctx.db
      .query('savedSearches')
      .withIndex('by_user', (q: any) => q.eq('userId', currentUser._id))
      .collect();

    // Sort searches
    const sortBy = args.sortBy || 'lastUsed';
    searches.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'useCount':
          return b.useCount - a.useCount;
        case 'created':
          return b.createdAt - a.createdAt;
        case 'lastUsed':
        default:
          return b.lastUsedAt - a.lastUsedAt;
      }
    });

    return searches.map((search) => ({
      _id: search._id,
      name: search.name,
      query: search.query,
      filters: search.filters,
      isDefault: search.isDefault,
      lastUsedAt: search.lastUsedAt,
      useCount: search.useCount,
      createdAt: search.createdAt,
    }));
  },
});

// Update a saved search
export const updateSavedSearch = mutation({
  args: {
    searchId: v.id('savedSearches'),
    name: v.optional(v.string()),
    query: v.optional(v.string()),
    filters: v.optional(
      v.object({
        status: v.optional(v.string()),
        priority: v.optional(v.string()),
        assignedTo: v.optional(v.string()),
        participant: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        dateRange: v.optional(
          v.object({
            startDate: v.number(),
            endDate: v.number(),
          })
        ),
        sortBy: v.optional(v.string()),
      })
    ),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== currentUser._id) {
      throw new Error('Saved search not found or access denied');
    }

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const defaultSearches = await ctx.db
        .query('savedSearches')
        .withIndex('by_user_and_default', (q: any) =>
          q.eq('userId', currentUser._id).eq('isDefault', true)
        )
        .collect();

      for (const defaultSearch of defaultSearches) {
        if (defaultSearch._id !== args.searchId) {
          await ctx.db.patch(defaultSearch._id, { isDefault: false });
        }
      }
    }

    const updates: any = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      if (!args.name.trim() || args.name.length > 100) {
        throw new Error('Search name must be between 1 and 100 characters');
      }
      updates.name = args.name.trim();
    }

    if (args.query !== undefined) updates.query = args.query;
    if (args.filters !== undefined) updates.filters = args.filters;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

    await ctx.db.patch(args.searchId, updates);
    return null;
  },
});

// Delete a saved search
export const deleteSavedSearch = mutation({
  args: {
    searchId: v.id('savedSearches'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== currentUser._id) {
      throw new Error('Saved search not found or access denied');
    }

    await ctx.db.delete(args.searchId);
    return null;
  },
});

// Use a saved search (increments usage count and updates last used time)
export const useSavedSearch = mutation({
  args: {
    searchId: v.id('savedSearches'),
  },
  returns: v.object({
    name: v.string(),
    query: v.string(),
    filters: v.object({
      status: v.optional(v.string()),
      priority: v.optional(v.string()),
      assignedTo: v.optional(v.string()),
      participant: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      dateRange: v.optional(
        v.object({
          startDate: v.number(),
          endDate: v.number(),
        })
      ),
      sortBy: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== currentUser._id) {
      throw new Error('Saved search not found or access denied');
    }

    // Update usage statistics
    await ctx.db.patch(args.searchId, {
      useCount: search.useCount + 1,
      lastUsedAt: Date.now(),
    });

    return {
      name: search.name,
      query: search.query,
      filters: search.filters,
    };
  },
});

// Log search for analytics
export const logSearch = mutation({
  args: {
    query: v.string(),
    filters: v.optional(v.string()),
    resultsCount: v.number(),
    sessionId: v.string(),
  },
  returns: v.id('searchHistory'),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const historyId = await ctx.db.insert('searchHistory', {
      userId: currentUser._id,
      query: args.query,
      filters: args.filters,
      resultsCount: args.resultsCount,
      sessionId: args.sessionId,
      createdAt: Date.now(),
    });

    return historyId;
  },
});

// Log search result click for analytics
export const logSearchClick = mutation({
  args: {
    historyId: v.id('searchHistory'),
    threadId: v.id('threads'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const history = await ctx.db.get(args.historyId);
    if (!history || history.userId !== currentUser._id) {
      throw new Error('Search history not found or access denied');
    }

    await ctx.db.patch(args.historyId, {
      clickedResult: args.threadId,
    });

    return null;
  },
});

// Get search analytics for user
export const getSearchAnalytics = query({
  args: {
    days: v.optional(v.number()),
  },
  returns: v.object({
    totalSearches: v.number(),
    topQueries: v.array(
      v.object({
        query: v.string(),
        count: v.number(),
      })
    ),
    avgResultsPerSearch: v.number(),
    clickThroughRate: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const days = args.days || 30;
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    const searchHistory = await ctx.db
      .query('searchHistory')
      .withIndex('by_user_and_created', (q: any) =>
        q.eq('userId', currentUser._id).gte('createdAt', cutoffDate)
      )
      .collect();

    const totalSearches = searchHistory.length;
    const searchesWithClicks = searchHistory.filter(
      (h) => h.clickedResult
    ).length;
    const clickThroughRate =
      totalSearches > 0 ? (searchesWithClicks / totalSearches) * 100 : 0;

    // Calculate average results per search
    const totalResults = searchHistory.reduce(
      (sum, h) => sum + h.resultsCount,
      0
    );
    const avgResultsPerSearch =
      totalSearches > 0 ? totalResults / totalSearches : 0;

    // Get top queries
    const queryCount = new Map<string, number>();
    searchHistory.forEach((h) => {
      const count = queryCount.get(h.query) || 0;
      queryCount.set(h.query, count + 1);
    });

    const topQueries = Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalSearches,
      topQueries,
      avgResultsPerSearch: Math.round(avgResultsPerSearch * 100) / 100,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
    };
  },
});

// Get search suggestions based on search history and content
export const getSearchSuggestions = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      suggestion: v.string(),
      type: v.union(
        v.literal('history'),
        v.literal('participant'),
        v.literal('subject'),
        v.literal('tag')
      ),
      frequency: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = args.limit || 10;
    const queryLower = args.query.toLowerCase().trim();

    if (!queryLower) return [];

    const suggestions: Array<{
      suggestion: string;
      type: 'history' | 'participant' | 'subject' | 'tag';
      frequency?: number;
    }> = [];

    // Search history suggestions
    if (queryLower.length >= 2) {
      const searchHistory = await ctx.db
        .query('searchHistory')
        .withIndex('by_user', (q: any) => q.eq('userId', currentUser._id))
        .collect();

      const historyMatches = new Map<string, number>();
      searchHistory.forEach((h) => {
        if (
          h.query.toLowerCase().includes(queryLower) &&
          h.query !== args.query
        ) {
          const count = historyMatches.get(h.query) || 0;
          historyMatches.set(h.query, count + 1);
        }
      });

      // Add top history matches
      Array.from(historyMatches.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([query, count]) => {
          suggestions.push({
            suggestion: query,
            type: 'history',
            frequency: count,
          });
        });
    }

    // Participant suggestions
    const recentThreads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .order('desc')
      .take(500);

    const participantMatches = new Set<string>();
    recentThreads.forEach((thread) => {
      thread.participants.forEach((p: any) => {
        const email = p.email.toLowerCase();
        const name = p.name?.toLowerCase() || '';

        if (email.includes(queryLower) || name.includes(queryLower)) {
          participantMatches.add(p.name || p.email);
        }
      });
    });

    Array.from(participantMatches)
      .slice(0, 3)
      .forEach((participant) => {
        suggestions.push({
          suggestion: participant,
          type: 'participant',
        });
      });

    // Subject suggestions
    const subjectMatches = new Set<string>();
    recentThreads.forEach((thread) => {
      if (thread.subject.toLowerCase().includes(queryLower)) {
        subjectMatches.add(thread.subject);
      }
    });

    Array.from(subjectMatches)
      .slice(0, 2)
      .forEach((subject) => {
        suggestions.push({
          suggestion: subject,
          type: 'subject',
        });
      });

    // Tag suggestions
    const tagMatches = new Set<string>();
    recentThreads.forEach((thread) => {
      thread.tags.forEach((tag: string) => {
        if (tag.toLowerCase().includes(queryLower)) {
          tagMatches.add(tag);
        }
      });
    });

    Array.from(tagMatches)
      .slice(0, 2)
      .forEach((tag) => {
        suggestions.push({
          suggestion: tag,
          type: 'tag',
        });
      });

    // Sort by type priority and limit results
    const typePriority = { history: 0, participant: 1, subject: 2, tag: 3 };
    return suggestions
      .sort((a, b) => {
        if (a.type !== b.type) {
          return typePriority[a.type] - typePriority[b.type];
        }
        return (b.frequency || 0) - (a.frequency || 0);
      })
      .slice(0, limit);
  },
});

// Enhanced auto-complete for search with real-time suggestions
export const getAutoCompleteSuggestions = query({
  args: {
    query: v.string(),
    context: v.optional(
      v.union(
        v.literal('participant'),
        v.literal('subject'),
        v.literal('tag'),
        v.literal('general')
      )
    ),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const queryLower = args.query.toLowerCase().trim();

    if (!queryLower || queryLower.length < 2) return [];

    const suggestions = new Set<string>();
    const context = args.context || 'general';

    // Get recent threads for suggestions
    const threads = await ctx.db
      .query('threads')
      .withIndex('by_team', (q: any) => q.eq('teamId', currentUser.teamId))
      .order('desc')
      .take(300);

    if (context === 'participant' || context === 'general') {
      // Extract participant suggestions
      threads.forEach((thread) => {
        thread.participants.forEach((p: any) => {
          if (p.email.toLowerCase().includes(queryLower)) {
            suggestions.add(p.email);
          }
          if (p.name?.toLowerCase().includes(queryLower)) {
            suggestions.add(p.name);
          }
        });
      });
    }

    if (context === 'subject' || context === 'general') {
      // Extract subject word suggestions
      threads.forEach((thread) => {
        const words = thread.subject.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length >= 3 && word.includes(queryLower)) {
            suggestions.add(word);
          }
        });
      });
    }

    if (context === 'tag' || context === 'general') {
      // Extract tag suggestions
      threads.forEach((thread) => {
        thread.tags.forEach((tag: string) => {
          if (tag.toLowerCase().includes(queryLower)) {
            suggestions.add(tag);
          }
        });
      });
    }

    return Array.from(suggestions).slice(0, 8);
  },
});

// Get search insights and analytics
export const getSearchInsights = query({
  args: {
    timeframe: v.optional(
      v.union(v.literal('day'), v.literal('week'), v.literal('month'))
    ),
  },
  async handler(ctx, args) {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const { timeframe = 'week' } = args;

    // Calculate time range
    const now = Date.now();
    let startTime = now;

    switch (timeframe) {
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get search history for the timeframe
    const searchHistory = await ctx.db
      .query('searchHistory')
      .withIndex('by_user_and_created', (q: any) =>
        q.eq('userId', currentUser._id).gte('createdAt', startTime)
      )
      .collect();

    // Calculate insights
    const totalSearches = searchHistory.length;
    const uniqueTerms = new Set(searchHistory.map((h) => h.query.toLowerCase()))
      .size;

    const totalResults = searchHistory.reduce(
      (sum, h) => sum + h.resultsCount,
      0
    );
    const avgResultsPerSearch =
      totalSearches > 0 ? totalResults / totalSearches : 0;

    const successfulSearches = searchHistory.filter(
      (h) => h.resultsCount > 0
    ).length;
    const successRate =
      totalSearches > 0 ? successfulSearches / totalSearches : 0;

    // Calculate average search length
    const totalSearchLength = searchHistory.reduce(
      (sum, h) => sum + h.query.split(' ').length,
      0
    );
    const avgSearchLength =
      totalSearches > 0 ? totalSearchLength / totalSearches : 0;

    // Find peak hour
    const hourCounts = new Array(24).fill(0);
    searchHistory.forEach((h) => {
      const hour = new Date(h.createdAt).getHours();
      hourCounts[hour]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Mock slow queries for now (since duration isn't tracked yet)
    const slowQueries: Array<{ term: string; duration: number }> = [];

    return {
      totalSearches,
      uniqueTerms,
      avgResultsPerSearch,
      successRate,
      avgSearchLength,
      peakHour,
      slowQueries,
    };
  },
});
