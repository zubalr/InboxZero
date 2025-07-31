/**
 * Authentication Error Boundary Component
 * Catches and handles errors in auth-related components
 */

'use client';

import React from 'react';

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<AuthErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Auth Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  private async reportError(
    error: Error,
    errorInfo: React.ErrorInfo
  ): Promise<void> {
    try {
      await fetch('/api/convex/auth/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          type: 'auth_boundary_error',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (reportError) {
      console.warn('Failed to report auth boundary error:', reportError);
    }
  }

  private retry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent error={this.state.error} retry={this.retry} />
        );
      }

      return (
        <DefaultAuthErrorFallback error={this.state.error} retry={this.retry} />
      );
    }

    return this.props.children;
  }
}

interface AuthErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function DefaultAuthErrorFallback({
  error,
  retry,
}: AuthErrorFallbackProps): React.ReactElement {
  const isNetworkError =
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('connection');

  const isAuthError =
    error.message.toLowerCase().includes('auth') ||
    error.message.toLowerCase().includes('credential') ||
    error.message.toLowerCase().includes('login') ||
    error.message.toLowerCase().includes('sign');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-500">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>

          <p className="mt-2 text-center text-sm text-gray-600">
            {isNetworkError
              ? "We're having trouble connecting to our servers"
              : isAuthError
                ? 'There was a problem with authentication'
                : 'Something went wrong'}
          </p>

          <div className="mt-4 p-4 bg-red-50 rounded-md">
            <p className="text-sm text-red-800">
              {isNetworkError
                ? 'Please check your internet connection and try again.'
                : isAuthError
                  ? 'Please try signing in again or contact support if the problem persists.'
                  : 'We apologize for the inconvenience. Please try again.'}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={retry}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>

            <button
              onClick={() => window.location.reload()}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh Page
            </button>

            <a
              href="/support"
              className="group relative w-full flex justify-center py-2 px-4 text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Contact Support
            </a>
          </div>

          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
              {error.message}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/**
 * Higher-order component for wrapping auth components with error boundary
 */
export function withAuthErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorHandler?: (error: Error, errorInfo: React.ErrorInfo) => void
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <AuthErrorBoundary onError={errorHandler}>
      <Component {...props} />
    </AuthErrorBoundary>
  );

  WrappedComponent.displayName = `withAuthErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
