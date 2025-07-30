import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { api } from './_generated/api';
import { v } from 'convex/values';

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Webhook handler for inbound emails from Resend
 * This endpoint receives inbound emails and processes them into threads and messages
 */
http.route({
  path: '/resend/inbound',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
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

      console.log('Successfully processed inbound email:', result);

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId,
          threadId: result.threadId,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error processing inbound email webhook:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
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
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
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

      console.log('Successfully updated delivery status:', result);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error processing delivery status webhook:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
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
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'InboxZero AI Webhooks',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
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
