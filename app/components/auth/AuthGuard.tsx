'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useIsAuthenticated } from '@/app/lib/use-user-data';
import { AuthService } from '@/app/lib/auth-service';

interface UserProfileProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: UserProfileProps) {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading, user } = useIsAuthenticated();

  // Loading state - only show if we have no cached data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null; // Parent component should handle showing auth forms
  }

  const handleSignOut = async () => {
    try {
      await AuthService.signOut(signOut);
    } catch (error) {
      console.error('Sign out error:', error);
      // Force clear local data even if server signout fails
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info and logout */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                InboxZero AI
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
