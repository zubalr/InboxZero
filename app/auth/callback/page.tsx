'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuthToken } from '@convex-dev/auth/react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const isAuthenticated = !!token;
  const connectGmail = useMutation(api.emailProviders.connectGmailAccount);
  const connectOutlook = useMutation(api.emailProviders.connectOutlookAccount);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (!isAuthenticated) {
        // Wait for authentication or redirect to login
        router.push('/auth?redirect=/auth/callback');
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        router.push('/email-accounts?error=oauth_denied');
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        router.push('/email-accounts?error=no_code');
        return;
      }

      try {
        // Parse state to determine provider
        let provider = 'unknown';
        if (state) {
          try {
            const stateData = JSON.parse(atob(state));
            provider = stateData.provider;
          } catch {
            // Fallback to simple string check
            provider = state.includes('gmail')
              ? 'gmail'
              : state.includes('outlook')
                ? 'outlook'
                : 'unknown';
          }
        }

        if (provider === 'gmail') {
          await connectGmail({ authorizationCode: code });
        } else if (provider === 'outlook') {
          await connectOutlook({ authorizationCode: code });
        } else {
          throw new Error('Unknown provider');
        }

        router.push('/email-accounts?success=connected');
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/email-accounts?error=connection_failed');
      }
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
