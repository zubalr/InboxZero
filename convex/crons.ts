/**
 * Cron job for scheduled email synchronization
 * This runs periodically to sync emails from connected Gmail and Outlook accounts
 */
import { cronJobs } from 'convex/server';
import { api } from './_generated/api';

const crons = cronJobs();

// Run email synchronization every 5 minutes
crons.interval('email-sync', { minutes: 5 }, api.emailSync.scheduledSync);

// Run token refresh check every hour
crons.interval(
  'token-refresh',
  { hours: 1 },
  api.emailSync.scheduledTokenRefresh
);

// Clean up old data weekly (Sundays at 2 AM)
crons.weekly(
  'data-cleanup',
  { dayOfWeek: 'sunday', hourUTC: 2, minuteUTC: 0 },
  api.emailBatch.cleanupOldData,
  { olderThanDays: 90, dryRun: false }
);

export default crons;
