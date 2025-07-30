'use client';

import React from 'react';

export interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  onDismiss?: () => void;
  showIcon?: boolean;
}

export function ErrorMessage({
  title,
  message,
  type = 'error',
  actions = [],
  onDismiss,
  showIcon = true,
}: ErrorMessageProps) {
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-400',
          textColor: 'text-yellow-800',
          icon: (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ),
        };
      case 'info':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-400',
          textColor: 'text-blue-800',
          icon: (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
      default:
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-400',
          textColor: 'text-red-800',
          icon: (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ),
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div
      className={`rounded-md ${config.bgColor} ${config.borderColor} border p-4`}
    >
      <div className="flex">
        {showIcon && (
          <div className="flex-shrink-0">
            <div className={config.iconColor}>{config.icon}</div>
          </div>
        )}
        <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
          <div className={`text-sm ${config.textColor}`}>
            {title && <h3 className="font-medium mb-1">{title}</h3>}
            <p>{message}</p>
          </div>

          {actions.length > 0 && (
            <div className="mt-4 flex space-x-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`text-sm font-medium rounded-md px-3 py-2 ${
                    action.variant === 'primary'
                      ? type === 'error'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : type === 'warning'
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      : `${config.textColor} hover:bg-opacity-20 hover:bg-current`
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 ${config.textColor} hover:bg-opacity-20 hover:bg-current focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-50 focus:ring-${type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-600`}
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Specific error message components
export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorMessage
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      actions={[
        { label: 'Retry', onClick: onRetry, variant: 'primary' },
        { label: 'Refresh Page', onClick: () => window.location.reload() },
      ]}
    />
  );
}

export function AuthenticationError({ onSignIn }: { onSignIn: () => void }) {
  return (
    <ErrorMessage
      title="Authentication Required"
      message="Your session has expired. Please sign in again to continue."
      actions={[{ label: 'Sign In', onClick: onSignIn, variant: 'primary' }]}
    />
  );
}

export function PermissionError() {
  return (
    <ErrorMessage
      title="Access Denied"
      message="You don't have permission to access this resource. Please contact your team administrator."
      type="warning"
    />
  );
}

export function NotFoundError({ onGoBack }: { onGoBack: () => void }) {
  return (
    <ErrorMessage
      title="Not Found"
      message="The requested resource could not be found. It may have been moved or deleted."
      type="warning"
      actions={[{ label: 'Go Back', onClick: onGoBack, variant: 'primary' }]}
    />
  );
}

export function ValidationError({
  errors,
  onDismiss,
}: {
  errors: string[];
  onDismiss?: () => void;
}) {
  return (
    <ErrorMessage
      title="Validation Error"
      message={
        errors.length === 1 ? errors[0] : `Please fix the following errors:`
      }
      type="warning"
      onDismiss={onDismiss}
    />
  );
}

export function RateLimitError({ retryAfter }: { retryAfter?: number }) {
  const retryTime = retryAfter
    ? new Date(Date.now() + retryAfter * 1000).toLocaleTimeString()
    : 'a few minutes';

  return (
    <ErrorMessage
      title="Rate Limit Exceeded"
      message={`You've made too many requests. Please try again ${typeof retryTime === 'string' ? 'in ' + retryTime : 'at ' + retryTime}.`}
      type="warning"
    />
  );
}

export function MaintenanceError() {
  return (
    <ErrorMessage
      title="Maintenance Mode"
      message="The system is currently undergoing maintenance. Please try again later."
      type="info"
      actions={[
        {
          label: 'Check Status',
          onClick: () => window.open('/status', '_blank'),
        },
      ]}
    />
  );
}

// Toast notification for errors
export function ErrorToast({
  message,
  onDismiss,
  autoHide = true,
}: {
  message: string;
  onDismiss: () => void;
  autoHide?: boolean;
}) {
  React.useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="text-sm font-medium">{message}</span>
        </div>
        <button
          onClick={onDismiss}
          className="ml-2 text-white hover:text-gray-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Hook for managing error state
export function useErrorHandler() {
  const [error, setError] = React.useState<string | null>(null);

  const handleError = React.useCallback((error: Error | string) => {
    const message = typeof error === 'string' ? error : error.message;
    setError(message);

    // Log error for debugging
    console.error('Error handled:', error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
  };
}
