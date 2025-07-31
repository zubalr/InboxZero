'use client';

import { useState } from 'react';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { AuthErrorBoundary } from './AuthErrorBoundary';

export function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);

  return (
    <AuthErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              InboxZero AI
            </h1>
            <p className="text-gray-600">
              AI-powered email management for teams
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mt-8 flex justify-center">
            <div className="border border-gray-300 rounded-lg p-1 bg-white">
              <button
                onClick={() => setIsSignIn(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isSignIn
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignIn(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  !isSignIn
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {isSignIn ? <SignInForm /> : <SignUpForm />}
        </div>

        {/* Additional links */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsSignIn(!isSignIn)}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {isSignIn ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </AuthErrorBoundary>
  );
}
