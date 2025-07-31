import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  // Include Convex Auth tables
  ...authTables,
  // User management table
  users: defineTable({
    email: v.string(),
    name: v.string(),
    profileImage: v.optional(v.string()),
    teamId: v.optional(v.id('teams')),
    role: v.union(v.literal('admin'), v.literal('member'), v.literal('viewer')),
    isActive: v.boolean(),
    lastActiveAt: v.float64(), // timestamp
    preferences: v.optional(
      v.object({
        emailNotifications: v.boolean(),
        theme: v.union(
          v.literal('light'),
          v.literal('dark'),
          v.literal('system')
        ),
        timezone: v.string(),
      })
    ),
  })
    .index('by_email', ['email'])
    .index('by_team', ['teamId'])
    .index('by_team_and_active', ['teamId', 'isActive']),

  // Email account connections for OAuth integration
  emailAccounts: defineTable({
    userId: v.id('users'),
    provider: v.union(v.literal('gmail'), v.literal('outlook')),
    email: v.string(),
    displayName: v.optional(v.string()),
    accessToken: v.string(), // Encrypted
    refreshToken: v.optional(v.string()), // Encrypted
    tokenExpiry: v.optional(v.number()),
    isActive: v.boolean(),
    lastSyncAt: v.optional(v.number()),
    syncStatus: v.union(
      v.literal('active'),
      v.literal('connected'),
      v.literal('error'),
      v.literal('disabled')
    ),
    syncError: v.optional(v.string()),
    settings: v.optional(
      v.object({
        syncFrequency: v.optional(v.number()), // in minutes
        syncLabels: v.optional(v.array(v.string())), // Gmail labels or Outlook folders to sync
        autoReply: v.optional(v.boolean()),
        forwardingRules: v.optional(
          v.array(
            v.object({
              condition: v.string(),
              action: v.string(),
            })
          )
        ),
        webhookConfig: v.optional(v.any()), // Store webhook/subscription config
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_sync_status', ['syncStatus'])
    .index('by_provider', ['provider'])
    .index('by_email', ['email'])
    .index('by_user_provider', ['userId', 'provider']),

  // Team/organization management
  teams: defineTable({
    name: v.string(),
    domain: v.optional(v.string()), // for email domain association
    settings: v.optional(
      v.object({
        allowedDomains: v.array(v.string()),
        autoAssignRules: v.array(
          v.object({
            pattern: v.string(),
            assigneeId: v.id('users'),
          })
        ),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_domain', ['domain']),

  // Email threads (conversations)
  threads: defineTable({
    subject: v.string(),
    messageId: v.string(), // Original Message-ID from email headers
    inReplyTo: v.optional(v.string()), // In-Reply-To header for threading
    references: v.array(v.string()), // References header for threading
    participants: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
        type: v.union(
          v.literal('to'),
          v.literal('cc'),
          v.literal('bcc'),
          v.literal('from')
        ),
      })
    ),
    teamId: v.id('teams'),
    assignedTo: v.optional(v.id('users')),
    status: v.union(
      v.literal('unread'),
      v.literal('read'),
      v.literal('replied'),
      v.literal('closed'),
      v.literal('archived')
    ),
    priority: v.union(
      v.literal('urgent'),
      v.literal('high'),
      v.literal('normal'),
      v.literal('low')
    ),
    tags: v.array(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // AI-generated summary cache
    summary: v.optional(
      v.object({
        content: v.string(),
        generatedAt: v.number(),
        model: v.string(),
      })
    ),
    // Classification results
    classification: v.optional(
      v.object({
        category: v.string(),
        priority: v.union(
          v.literal('urgent'),
          v.literal('high'),
          v.literal('normal'),
          v.literal('low')
        ),
        confidence: v.number(),
        generatedAt: v.number(),
      })
    ),
    // For full-text search
    searchContent: v.string(),
  })
    .index('by_team', ['teamId'])
    .index('by_team_and_status', ['teamId', 'status'])
    .index('by_team_and_assignee', ['teamId', 'assignedTo'])
    .index('by_team_and_priority', ['teamId', 'priority'])
    .index('by_team_status_priority', ['teamId', 'status', 'priority']) // Compound index for complex filters
    .index('by_team_assignee_status', ['teamId', 'assignedTo', 'status']) // Compound index for assignment + status
    .index('by_last_message', ['lastMessageAt'])
    .index('by_team_last_message', ['teamId', 'lastMessageAt']) // Optimized for sorted team queries
    .index('by_message_id', ['messageId'])
    .searchIndex('search_content', {
      searchField: 'searchContent',
      filterFields: ['teamId', 'status', 'priority', 'assignedTo'],
    }),

  // Individual email messages within threads
  messages: defineTable({
    threadId: v.id('threads'),
    messageId: v.string(), // Message-ID from email headers
    inReplyTo: v.optional(v.string()),
    references: v.array(v.string()),
    from: v.object({
      email: v.string(),
      name: v.optional(v.string()),
    }),
    to: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
      })
    ),
    cc: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      )
    ),
    bcc: v.optional(
      v.array(
        v.object({
          email: v.string(),
          name: v.optional(v.string()),
        })
      )
    ),
    subject: v.string(),
    textContent: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          contentType: v.string(),
          size: v.number(),
          storageId: v.optional(v.string()), // For future file storage
        })
      )
    ),
    headers: v.object({
      date: v.string(),
      deliveredTo: v.optional(v.string()),
      returnPath: v.optional(v.string()),
      received: v.array(v.string()),
    }),
    direction: v.union(v.literal('inbound'), v.literal('outbound')),
    deliveryStatus: v.optional(
      v.object({
        status: v.union(
          v.literal('sent'),
          v.literal('delivered'),
          v.literal('failed')
        ),
        errorMessage: v.optional(v.string()),
        attempts: v.number(),
        lastAttemptAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    // For full-text search
    searchContent: v.string(),
  })
    .index('by_thread', ['threadId'])
    .index('by_thread_and_created', ['threadId', 'createdAt'])
    .index('by_message_id', ['messageId'])
    .index('by_direction', ['direction'])
    .searchIndex('search_content', {
      searchField: 'searchContent',
      filterFields: ['threadId', 'direction', 'from.email'],
    }),

  // Internal team comments (not visible to email participants)
  comments: defineTable({
    threadId: v.id('threads'),
    authorId: v.id('users'),
    content: v.string(),
    parentCommentId: v.optional(v.id('comments')), // For threaded comments
    reactions: v.optional(
      v.array(
        v.object({
          emoji: v.string(),
          userId: v.id('users'),
          createdAt: v.number(),
        })
      )
    ),
    isEdited: v.boolean(),
    editHistory: v.optional(
      v.array(
        v.object({
          content: v.string(),
          editedAt: v.number(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_thread_and_created', ['threadId', 'createdAt'])
    .index('by_author', ['authorId'])
    .index('by_parent', ['parentCommentId']),

  // User presence for real-time collaboration
  presence: defineTable({
    userId: v.id('users'),
    threadId: v.optional(v.id('threads')),
    status: v.union(
      v.literal('online'),
      v.literal('idle'),
      v.literal('busy'),
      v.literal('offline')
    ),
    currentActivity: v.optional(
      v.object({
        type: v.union(
          v.literal('viewing_thread'),
          v.literal('composing_reply'),
          v.literal('adding_comment')
        ),
        threadId: v.optional(v.id('threads')),
      })
    ),
    lastSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_thread', ['threadId'])
    .index('by_status', ['status'])
    .index('by_thread_and_status', ['threadId', 'status']),

  // Task management and external integrations
  tasks: defineTable({
    threadId: v.id('threads'),
    createdById: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('cancelled')
    ),
    priority: v.union(
      v.literal('urgent'),
      v.literal('high'),
      v.literal('normal'),
      v.literal('low')
    ),
    assignedTo: v.optional(v.id('users')),
    dueDate: v.optional(v.number()),
    // External integration details
    externalIntegration: v.optional(
      v.object({
        platform: v.union(
          v.literal('notion'),
          v.literal('asana'),
          v.literal('clickup')
        ),
        externalId: v.string(),
        externalUrl: v.string(),
        syncedAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_creator', ['createdById'])
    .index('by_assignee', ['assignedTo'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority'])
    .index('by_due_date', ['dueDate']),

  // User feedback for AI improvements
  emailFeedback: defineTable({
    threadId: v.id('threads'),
    messageId: v.optional(v.id('messages')),
    userId: v.id('users'),
    feedbackType: v.union(
      v.literal('summary_quality'),
      v.literal('reply_suggestion'),
      v.literal('priority_classification'),
      v.literal('general')
    ),
    rating: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5)
    ),
    comment: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    aiResponse: v.optional(v.string()), // Store the AI response being rated
    metadata: v.optional(
      v.object({
        feature: v.string(),
        version: v.string(),
        sessionId: v.string(),
      })
    ),
    createdAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_user', ['userId'])
    .index('by_type', ['feedbackType'])
    .index('by_rating', ['rating'])
    .index('by_created', ['createdAt']),

  // Integration configurations and credentials
  integrations: defineTable({
    teamId: v.id('teams'),
    platform: v.union(
      v.literal('notion'),
      v.literal('asana'),
      v.literal('clickup'),
      v.literal('resend')
    ),
    name: v.string(),
    configuration: v.object({
      // Platform-specific configuration stored as flexible object
      apiKey: v.optional(v.string()), // Encrypted in production
      databaseId: v.optional(v.string()), // For Notion
      workspaceId: v.optional(v.string()), // For Asana/ClickUp
      spaceId: v.optional(v.string()), // For ClickUp
      listId: v.optional(v.string()), // For ClickUp
      projectId: v.optional(v.string()),
      customFields: v.optional(
        v.array(
          v.object({
            name: v.string(),
            type: v.string(),
            mapping: v.string(),
          })
        )
      ),
    }),
    isActive: v.boolean(),
    lastSyncAt: v.optional(v.number()),
    syncErrors: v.optional(
      v.array(
        v.object({
          error: v.string(),
          occurredAt: v.number(),
          resolved: v.boolean(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_platform', ['platform'])
    .index('by_team_and_platform', ['teamId', 'platform'])
    .index('by_active', ['isActive']),

  // Saved searches for quick access
  savedSearches: defineTable({
    userId: v.id('users'),
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
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_default', ['userId', 'isDefault'])
    .index('by_user_and_last_used', ['userId', 'lastUsedAt']),

  // Search history for analytics and quick access
  searchHistory: defineTable({
    userId: v.id('users'),
    query: v.string(),
    filters: v.optional(v.string()), // JSON stringified filters
    resultsCount: v.number(),
    clickedResult: v.optional(v.id('threads')),
    sessionId: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_created', ['userId', 'createdAt'])
    .index('by_session', ['sessionId']),

  // User events for analytics
  userEvents: defineTable({
    userId: v.id('users'),
    teamId: v.optional(v.id('teams')),
    event: v.string(),
    properties: v.record(v.string(), v.any()),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_team', ['teamId'])
    .index('by_user_and_timestamp', ['userId', 'timestamp'])
    .index('by_event', ['event'])
    .index('by_session', ['sessionId']),

  // Page views for analytics
  pageViews: defineTable({
    userId: v.id('users'),
    teamId: v.optional(v.id('teams')),
    page: v.string(),
    referrer: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    metadata: v.record(v.string(), v.any()),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_team', ['teamId'])
    .index('by_page', ['page'])
    .index('by_session', ['sessionId'])
    .index('by_timestamp', ['timestamp']),

  // Feature usage tracking
  featureUsage: defineTable({
    userId: v.id('users'),
    teamId: v.optional(v.id('teams')),
    feature: v.string(),
    action: v.string(),
    duration: v.optional(v.number()),
    success: v.optional(v.boolean()),
    metadata: v.record(v.string(), v.any()),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_team', ['teamId'])
    .index('by_feature', ['feature'])
    .index('by_feature_and_action', ['feature', 'action'])
    .index('by_timestamp', ['timestamp']),
});
