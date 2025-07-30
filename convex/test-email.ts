import { action } from './_generated/server';
import { v } from 'convex/values';
import { getResend } from './resend';

/**
 * Test the Resend component configuration
 * This function sends a simple test email to verify the setup
 */
export const testResendSetup = action({
  args: {
    to: v.string(),
    subject: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.string()),
    message: v.string(),
    details: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const resend = await getResend();
      const result = await resend.sendEmail(ctx, {
        from: 'InboxZero AI <test@resend.dev>', // Using Resend's test domain
        to: args.to,
        subject: args.subject || 'InboxZero AI - Resend Component Test',
        text: 'This is a test email from InboxZero AI to verify the Resend component is working correctly.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">InboxZero AI - Resend Component Test</h2>
            <p>This is a test email to verify that the Resend component is properly configured and working.</p>
            <p>If you received this email, the setup is successful! 🎉</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This email was sent from InboxZero AI development environment.
            </p>
          </div>
        `,
      });

      return {
        success: true,
        messageId: result.toString(), // EmailId is a branded string type
        message: 'Test email sent successfully!',
        details: result,
      };
    } catch (error) {
      console.error('Resend test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message:
          'Failed to send test email. Please check your Resend API key configuration.',
      };
    }
  },
});

/**
 * Get Resend component status and configuration info
 */
export const getResendStatus = action({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    hasApiKey: v.boolean(),
    apiKeyPrefix: v.optional(v.string()),
    message: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      // Try to access the Resend API to check if it's configured
      const apiKey = process.env.RESEND_API_KEY;

      return {
        configured: !!apiKey,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : undefined,
        message: apiKey
          ? 'Resend component appears to be configured correctly'
          : 'Resend API key not found in environment variables',
      };
    } catch (error) {
      return {
        configured: false,
        hasApiKey: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error checking Resend configuration',
      };
    }
  },
});
