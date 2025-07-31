'use client';

import { useIsAuthenticated } from './lib/use-user-data';
import { AuthPage } from './components/auth/AuthPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { InboxLayout } from './components/inbox/InboxLayout';

export default function Home() {
  const { isAuthenticated, isLoading, user } = useIsAuthenticated();

  // Loading state - show spinner only if we have no cached data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authenticated - show auth page
  if (!isAuthenticated || !user) {
    return <AuthPage />;
  }

  // Authenticated - show main inbox app
  return (
    <AuthGuard>
      <InboxLayout />
    </AuthGuard>
  );
}
