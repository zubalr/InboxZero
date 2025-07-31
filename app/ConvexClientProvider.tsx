'use client';

import { ConvexProvider } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import React, { useEffect } from 'react';
import { AuthStorage } from './lib/auth-storage';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  // Fail fast with a clear message instead of hanging queries.
  // This will render an inline error in the browser so it's obvious what's wrong.
  // eslint-disable-next-line no-console
  console.error(
    'Missing NEXT_PUBLIC_CONVEX_URL. Set it in .env.local for development.'
  );
}

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function AuthStorageManager({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Log cache status on app start for debugging
    const cacheStatus = AuthStorage.getCacheStatus();
    console.log('Auth cache status on startup:', cacheStatus);

    // Clean up expired cache on app start
    if (
      cacheStatus.hasUserData &&
      cacheStatus.userDataAge &&
      cacheStatus.userDataAge > 10 * 60 * 1000
    ) {
      console.log('Clearing expired auth cache');
      AuthStorage.clearUserData();
    }

    // Set up periodic cache cleanup
    const cleanup = setInterval(
      () => {
        const status = AuthStorage.getCacheStatus();
        if (
          status.hasUserData &&
          status.userDataAge &&
          status.userDataAge > 10 * 60 * 1000
        ) {
          AuthStorage.clearUserData();
        }
      },
      5 * 60 * 1000
    ); // Check every 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!convex) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Configuration error
        </h1>
        <p style={{ marginBottom: 8 }}>
          NEXT_PUBLIC_CONVEX_URL is not set. Add it to .env.local and restart
          the dev server.
        </p>
        <pre
          style={{
            background: '#0b1020',
            color: '#d1d5db',
            padding: 12,
            borderRadius: 8,
            overflowX: 'auto',
          }}
        >
          {`# .env.local
CONVEX_DEPLOYMENT=dev:your-deployment
# Use local Convex dev by default during development:
NEXT_PUBLIC_CONVEX_URL=http://localhost:3210
`}
        </pre>
      </div>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <ConvexAuthProvider client={convex}>
        <AuthStorageManager>{children}</AuthStorageManager>
      </ConvexAuthProvider>
    </ConvexProvider>
  );
}
