'use client';

import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { AuthPage } from './components/auth/AuthPage';
import { AuthGuard } from './components/auth/AuthGuard';

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

  // Authenticated - show main app
  return (
    <AuthGuard>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to InboxZero AI
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Your AI-powered team email management platform is ready!
          </p>

          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Hello, {currentUser.name}!
            </h2>
            <p className="text-gray-600 mb-4">
              You're successfully signed in to your team workspace.
            </p>
            <div className="text-sm text-gray-500">
              <p>Email: {currentUser.email}</p>
              <p>Role: {currentUser.role}</p>
              <p>Team ID: {currentUser.teamId}</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Email ingestion and UI components will be implemented in the next
              tasks.
            </p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
