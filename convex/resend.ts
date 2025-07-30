import { Resend } from '@convex-dev/resend';
import { internalAction } from './_generated/server';
import { v } from 'convex/values';

// We'll initialize this once components are available
let resendInstance: Resend | null = null;

export const getResend = async (): Promise<Resend> => {
  if (!resendInstance) {
    // Import components dynamically to avoid initialization issues
    const apiModule = await import('./_generated/api');
    const components = (apiModule as any).components;
    if (!components) {
      throw new Error(
        'Resend component not yet available. Make sure convex.config.ts includes the Resend component.'
      );
    }
    resendInstance = new Resend(components.resend, {
      testMode: true, // Set to false in production
    });
  }
  return resendInstance;
};

// Example email sending function
export const sendTestEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const resend = await getResend();
      await resend.sendEmail(ctx, {
        from: 'InboxZero <noreply@inboxzero.com>',
        to: args.to,
        subject: args.subject,
        html: args.html,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
    return null;
  },
});
