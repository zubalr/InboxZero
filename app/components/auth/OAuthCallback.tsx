import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuthToken } from '@convex-dev/auth/react';

export function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const isAuthenticated = !!token;
  const connectGmail = useMutation(api.emailProviders.connectGmailAccount);
  const connectOutlook = useMutation(api.emailProviders.connectOutlookAccount);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (!isAuthenticated) return;

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const provider = searchParams.get('provider');

      if (!code) {
        console.error('No authorization code received');
        router.push('/email-accounts?error=no_code');
        return;
      }

      try {
        if (provider === 'google' || state?.includes('gmail')) {
          // Handle Gmail OAuth
          await handleGmailCallback(code);
        } else if (provider === 'microsoft' || state?.includes('outlook')) {
          // Handle Outlook OAuth
          await handleOutlookCallback(code);
        } else {
          console.error('Unknown provider in OAuth callback');
          router.push('/email-accounts?error=unknown_provider');
          return;
        }

        // Redirect to email accounts page with success
        router.push('/email-accounts?success=connected');
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/email-accounts?error=connection_failed');
      }
    };

    const handleGmailCallback = async (code: string) => {
      // Exchange code for tokens using Google OAuth
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${window.location.origin}/auth/callback`,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await tokenResponse.json();

      await connectGmail({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      });
    };

    const handleOutlookCallback = async (code: string) => {
      // Exchange code for tokens using Microsoft OAuth
      const tokenResponse = await fetch(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            redirect_uri: `${window.location.origin}/auth/callback`,
            grant_type: 'authorization_code',
            scope:
              'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite',
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await tokenResponse.json();

      await connectOutlook({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      });
    };

    handleOAuthCallback();
  }, [isAuthenticated, searchParams, router, connectGmail, connectOutlook]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-12 w-12 text-indigo-600 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Connecting your email account...
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we set up your email integration.
          </p>
        </div>
      </div>
    </div>
  );
}
