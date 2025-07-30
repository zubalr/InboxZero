'use client';

import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { AuthPage } from './components/auth/AuthPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { InboxLayout } from './components/inbox/InboxLayout';

export default function Home() {
  const currentUser = useQuery(api.users.getCurrentUser);

  // Loading state
  if (currentUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authenticated - show auth page
  if (currentUser === null) {
    return <AuthPage />;
  }

  // Authenticated - show main inbox app
  return (
    <AuthGuard>
      <InboxLayout />
    </AuthGuard>
  );
}
