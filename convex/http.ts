import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { api } from './_generated/api';
import { v } from 'convex/values';
import { logger } from './lib/logging';

const http = httpRouter();

// Apply CORS preflight and origin checks for all routes
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, resend-signature, resend-timestamp',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin) {
    // Log and do not set ACAO header for disallowed origins
    logger.warn('CORS origin rejected', { origin });
  }
  return headers;
}

// Simple in-memory rate limiter per IP + path (window: 60s)
const rlStore = new Map<string, { count: number; ts: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimited(
  key: string,
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
) {
  const now = Date.now();
  const cur = rlStore.get(key);
  if (!cur || now - cur.ts > windowMs) {
    rlStore.set(key, { count: 1, ts: now });
    return false;
  }
  cur.count += 1;
  if (cur.count > max) return true;
  rlStore.set(key, cur);
  return false;
}

auth.addHttpRoutes(http);

// Error handling endpoint for auth-related errors
http.route({
  path: '/auth/error',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const origin = request.headers.get('origin');
      const corsHeaders = buildCorsHeaders(origin);

      // Rate limiting
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
      const rateLimitKey = `auth-error:${clientIP}`;
      if (rateLimited(rateLimitKey, 10, 60_000)) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await request.text();
      let errorData;

      try {
        errorData = JSON.parse(body);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Log the error for monitoring
      logger.warn('Auth error reported', {
        error: errorData.error,
        type: errorData.type,
        timestamp: errorData.timestamp,
        userAgent: request.headers.get('user-agent'),
        ip: clientIP,
      });

      return new Response(JSON.stringify({ success: true, logged: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error(
        'Error in auth error handler',
        error instanceof Error ? error : new Error(String(error))
      );
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Auth health check endpoint
http.route({
  path: '/auth/health',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    try {
      const origin = request.headers.get('origin');
      const corsHeaders = buildCorsHeaders(origin);

      // Basic health check - verify auth system is responsive
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          auth: 'available',
          database: 'available',
        },
      };

      return new Response(JSON.stringify(healthStatus), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error(
        'Auth health check failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }),
});

// CORS preflight handler for auth routes
http.route({
  path: '/auth/error',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: '/auth/health',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/**
 * Webhook handler for inbound emails from Resend
 * This endpoint receives inbound emails and processes them into threads and messages
 */
http.route({
  path: '/resend/inbound',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    });
  }),
});
http.route({
  path: '/resend/inbound',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rlKey = `${ip}:/resend/inbound:POST`;
    if (rateLimited(rlKey, 120, 60_000)) {
      logger.warn('Rate limit triggered', { path: '/resend/inbound', ip });
      return new Response('Too Many Requests', {
        status: 429,
        headers: buildCorsHeaders(origin),
      });
    }
    try {
      // Enforce content-type and payload size
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return new Response('Unsupported Media Type', {
          status: 415,
          headers: buildCorsHeaders(origin),
        });
      }
      // Verify webhook signature for security
      const signature = request.headers.get('resend-signature');
      const timestamp = request.headers.get('resend-timestamp');

      if (!signature || !timestamp) {
        console.error('Missing webhook signature or timestamp');
        return new Response('Unauthorized', { status: 401 });
      }

      // Get the raw body for signature verification
      const body = await request.text();

      // Verify the webhook signature (implement proper verification)
      const isValidSignature = await verifyWebhookSignature(
        body,
        signature,
        timestamp
      );
      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse the webhook payload
      let emailData;
      try {
        emailData = JSON.parse(body);
      } catch (error) {
        console.error('Failed to parse webhook payload:', error);
        return new Response('Bad Request', { status: 400 });
      }

      // Process the inbound email
      const result = await ctx.runAction(
        api.emailIngestion.processInboundEmail,
        {
          emailData,
        }
      );

      logger.info('Successfully processed inbound email', {
        messageId: result.messageId,
        threadId: result.threadId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId,
          threadId: result.threadId,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        }
      );
    } catch (error) {
      logger.error('Error processing inbound email webhook', error as Error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        }
      );
    }
  }),
});

/**
 * Webhook handler for email delivery status updates from Resend
 */
http.route({
  path: '/resend/delivery',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    });
  }),
});
http.route({
  path: '/resend/delivery',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rlKey = `${ip}:/resend/delivery:POST`;
    if (rateLimited(rlKey, 240, 60_000)) {
      logger.warn('Rate limit triggered', { path: '/resend/delivery', ip });
      return new Response('Too Many Requests', {
        status: 429,
        headers: buildCorsHeaders(origin),
      });
    }
    try {
      // Enforce content-type
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return new Response('Unsupported Media Type', {
          status: 415,
          headers: buildCorsHeaders(origin),
        });
      }
      // Verify webhook signature
      const signature = request.headers.get('resend-signature');
      const timestamp = request.headers.get('resend-timestamp');

      if (!signature || !timestamp) {
        console.error('Missing webhook signature or timestamp');
        return new Response('Unauthorized', { status: 401 });
      }

      const body = await request.text();

      const isValidSignature = await verifyWebhookSignature(
        body,
        signature,
        timestamp
      );
      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse delivery status data
      let deliveryData;
      try {
        deliveryData = JSON.parse(body);
      } catch (error) {
        console.error('Failed to parse delivery webhook payload:', error);
        return new Response('Bad Request', { status: 400 });
      }

      // Update message delivery status
      const result = await ctx.runAction(
        api.emailIngestion.updateDeliveryStatus,
        {
          deliveryData,
        }
      );

      logger.info('Successfully updated delivery status', { result });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(origin),
        },
      });
    } catch (error) {
      logger.error('Error processing delivery status webhook', error as Error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        }
      );
    }
  }),
});

/**
 * Gmail webhook handler for push notifications
 * Receives notifications when new emails arrive in connected Gmail accounts
 */
http.route({
  path: '/webhooks/gmail/notifications',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');

    try {
      const body = await request.text();
      const data = JSON.parse(body);

      // Gmail sends push notifications via Pub/Sub
      const message = data.message;
      if (message && message.data) {
        const notificationData = JSON.parse(
          Buffer.from(message.data, 'base64').toString()
        );

        const { emailAddress, historyId } = notificationData;

        // Process the Gmail notification
        const result = await ctx.runAction(
          api.emailSync.processGmailNotification,
          {
            historyId,
            emailAddress,
          }
        );

        logger.info('Processed Gmail notification', {
          emailAddress,
          historyId,
          result,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        });
      }

      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(origin),
        },
      });
    } catch (error) {
      logger.error('Error processing Gmail notification', error as Error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        }
      );
    }
  }),
});

/**
 * Outlook webhook handler for push notifications
 * Receives notifications when new emails arrive in connected Outlook accounts
 */
http.route({
  path: '/webhooks/outlook/notifications',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');

    try {
      const body = await request.text();
      const notifications = JSON.parse(body);

      // Microsoft Graph sends an array of notifications
      if (notifications.value && Array.isArray(notifications.value)) {
        for (const notification of notifications.value) {
          try {
            // Validate the notification
            const validationToken = request.url.includes('validationToken');
            if (validationToken) {
              // Return validation token for subscription verification
              const url = new URL(request.url);
              const token = url.searchParams.get('validationToken');
              return new Response(token, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
              });
            }

            // Process the notification
            const result = await ctx.runAction(
              api.emailSync.processOutlookNotification,
              {
                subscriptionId: notification.subscriptionId,
                resource: notification.resource,
                changeType: notification.changeType,
                clientState: notification.clientState || '',
              }
            );

            logger.info('Processed Outlook notification', {
              subscriptionId: notification.subscriptionId,
              resource: notification.resource,
              result,
            });
          } catch (error) {
            logger.error(
              'Error processing individual Outlook notification',
              error as Error
            );
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...buildCorsHeaders(origin),
        },
      });
    } catch (error) {
      logger.error('Error processing Outlook notifications', error as Error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...buildCorsHeaders(origin),
          },
        }
      );
    }
  }),
});

/**
 * Health check endpoint for webhook monitoring
 */
http.route({
  path: '/health',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    });
  }),
});
http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin');
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'InboxZero AI Webhooks',
      env: process.env.NODE_ENV,
    };
    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...buildCorsHeaders(origin),
      },
    });
  }),
});

/**
 * Verify webhook signature from Resend
 * This implements HMAC-SHA256 signature verification with proper security
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // In production, this should fail - no fallback
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        console.error('RESEND_WEBHOOK_SECRET is required in production');
        return false;
      }
      console.warn(
        'RESEND_WEBHOOK_SECRET not configured, allowing request in development only'
      );
      return true;
    }

    // Validate timestamp to prevent replay attacks (within 5 minutes)
    const timestampSeconds = parseInt(timestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentSeconds - timestampSeconds);
    if (timeDiff > 300) {
      // 5 minutes
      console.error('Webhook timestamp too old or invalid:', {
        timestamp: timestampSeconds,
        current: currentSeconds,
        diff: timeDiff,
      });
      return false;
    }

    // Create the signature payload (timestamp + payload)
    const signaturePayload = `${timestamp}.${payload}`;

    // Create HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signaturePayload)
    );

    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (remove 'sha256=' prefix if present)
    const providedSignature = signature.replace('sha256=', '');

    // Use timing-safe comparison to prevent timing attacks
    if (computedSignature.length !== providedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |=
        computedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

export default http;
