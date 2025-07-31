/**
 * Authentication error handling utilities
 */

export interface AuthError {
  code: string;
  message: string;
  field?: string;
  retryable?: boolean;
}

export class AuthErrorHandler {
  /**
   * Maps raw error messages to user-friendly error objects
   */
  static mapError(error: unknown): AuthError {
    if (!error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        retryable: true,
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Account already exists errors
    if (
      lowerMessage.includes('already exists') ||
      (lowerMessage.includes('account') && lowerMessage.includes('exists'))
    ) {
      return {
        code: 'ACCOUNT_EXISTS',
        message:
          'An account with this email already exists. Please sign in instead.',
        field: 'email',
        retryable: false,
      };
    }

    // Invalid credentials
    if (
      lowerMessage.includes('invalid credentials') ||
      lowerMessage.includes('incorrect password') ||
      lowerMessage.includes('authentication failed') ||
      lowerMessage.includes('user not found')
    ) {
      return {
        code: 'INVALID_CREDENTIALS',
        message:
          'Invalid email or password. Please check your credentials and try again.',
        retryable: false,
      };
    }

    // Email validation errors
    if (lowerMessage.includes('email is required')) {
      return {
        code: 'EMAIL_REQUIRED',
        message: 'Please enter your email address',
        field: 'email',
        retryable: false,
      };
    }

    if (
      lowerMessage.includes('invalid email') ||
      lowerMessage.includes('email format')
    ) {
      return {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address',
        field: 'email',
        retryable: false,
      };
    }

    // Name validation errors
    if (
      lowerMessage.includes('name is required') ||
      lowerMessage.includes('name cannot be empty')
    ) {
      return {
        code: 'NAME_REQUIRED',
        message: 'Please enter your full name',
        field: 'name',
        retryable: false,
      };
    }

    if (lowerMessage.includes('name is too long')) {
      return {
        code: 'NAME_TOO_LONG',
        message: 'Name is too long (max 100 characters)',
        field: 'name',
        retryable: false,
      };
    }

    // Password validation errors
    if (lowerMessage.includes('password is required')) {
      return {
        code: 'PASSWORD_REQUIRED',
        message: 'Please enter your password',
        field: 'password',
        retryable: false,
      };
    }

    if (lowerMessage.includes('password must be at least')) {
      return {
        code: 'PASSWORD_TOO_SHORT',
        message: 'Password must be at least 8 characters long',
        field: 'password',
        retryable: false,
      };
    }

    if (lowerMessage.includes('passwords do not match')) {
      return {
        code: 'PASSWORDS_MISMATCH',
        message: 'Passwords do not match',
        field: 'confirmPassword',
        retryable: false,
      };
    }

    // Network/connection errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('fetch')
    ) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection and try again.',
        retryable: true,
      };
    }

    // Rate limiting
    if (
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')
    ) {
      return {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a moment and try again.',
        retryable: true,
      };
    }

    // Server errors
    if (
      lowerMessage.includes('internal server error') ||
      lowerMessage.includes('server error') ||
      lowerMessage.includes('500')
    ) {
      return {
        code: 'SERVER_ERROR',
        message: 'Server error. Please try again in a moment.',
        retryable: true,
      };
    }

    // Default fallback
    return {
      code: 'UNKNOWN_ERROR',
      message:
        errorMessage || 'An unexpected error occurred. Please try again.',
      retryable: true,
    };
  }

  /**
   * Logs error for debugging purposes
   */
  static logError(error: AuthError, context: string): void {
    console.error(`[Auth Error - ${context}]`, {
      code: error.code,
      message: error.message,
      field: error.field,
      retryable: error.retryable,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reports error to monitoring service (if configured)
   */
  static async reportError(error: AuthError, context: string): Promise<void> {
    try {
      // Only report server errors and unknown errors for monitoring
      if (error.code === 'SERVER_ERROR' || error.code === 'UNKNOWN_ERROR') {
        await fetch('/api/convex/auth/error', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: error.message,
            code: error.code,
            context,
            timestamp: new Date().toISOString(),
            type: 'auth_error',
          }),
        });
      }
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError);
    }
  }
}

/**
 * Hook for handling authentication errors consistently
 */
export function useAuthErrorHandler() {
  const handleError = async (
    error: unknown,
    context: string
  ): Promise<AuthError> => {
    const mappedError = AuthErrorHandler.mapError(error);
    AuthErrorHandler.logError(mappedError, context);
    await AuthErrorHandler.reportError(mappedError, context);
    return mappedError;
  };

  return { handleError };
}
