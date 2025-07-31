/**
 * Robust authentication service with retry logic and comprehensive error handling
 */

import { ConvexError } from 'convex/values';
import { AuthStorage } from './auth-storage';

export interface AuthRetryConfig {
  maxRetries: number;
  initialDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: AuthRetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  retryableErrors: [
    'network',
    'timeout',
    'connection',
    'server error',
    'internal server error',
    '500',
    '502',
    '503',
    '504',
  ],
};

export class AuthService {
  private static isRetryableError(
    error: unknown,
    config: AuthRetryConfig
  ): boolean {
    if (!error) return false;

    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    return config.retryableErrors.some((retryableError) =>
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Executes an auth operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: AuthRetryConfig = DEFAULT_RETRY_CONFIG,
    context: string = 'auth operation'
  ): Promise<T> {
    let lastError: unknown;
    let delay = config.initialDelay;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt or non-retryable errors
        if (
          attempt > config.maxRetries ||
          !this.isRetryableError(error, config)
        ) {
          break;
        }

        console.warn(
          `${context} failed (attempt ${attempt}/${config.maxRetries + 1}), retrying in ${delay}ms:`,
          error
        );

        await this.delay(delay);
        delay *= config.backoffMultiplier;
      }
    }

    throw lastError;
  }

  /**
   * Sign up with comprehensive error handling and retries
   */
  static async signUp(params: {
    email: string;
    password: string;
    name: string;
    signInFunction: (provider: string, params: any) => Promise<any>;
    createProfile: (params: { name: string; email: string }) => Promise<string>;
  }): Promise<void> {
    const { email, password, name, signInFunction, createProfile } = params;

    // Validate inputs
    this.validateSignUpInputs({ email, password, name });

    // Clear any existing auth data
    AuthStorage.clearAll();

    // Step 1: Create auth account with retry
    await this.withRetry(
      async () => {
        await signInFunction('password', {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          flow: 'signUp',
        });
      },
      DEFAULT_RETRY_CONFIG,
      'auth account creation'
    );

    // Step 2: Wait for authentication session to be fully established
    await this.delay(2000); // Reduced from 5 seconds

    // Step 3: Check if profile already exists before creating
    let profileCreated = false;
    await this.withRetry(
      async () => {
        try {
          const userId = await createProfile({
            name: name.trim(),
            email: email.trim().toLowerCase(),
          });
          profileCreated = true;

          // Store successful auth data
          AuthStorage.storeSessionId(`auth_${Date.now()}`);

          console.log('User profile created successfully:', userId);
        } catch (error) {
          // If profile already exists, that's not an error for signup
          if (
            error instanceof Error &&
            error.message.includes('already exists')
          ) {
            console.log('User profile already exists, continuing...');
            profileCreated = true;
            return;
          }
          throw error;
        }
      },
      {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 5, // Reduced retries
        initialDelay: 1500, // Reduced initial delay
        backoffMultiplier: 1.5,
      },
      'user profile creation'
    );

    if (!profileCreated) {
      throw new Error('Failed to create or verify user profile');
    }
  }

  /**
   * Sign in with comprehensive error handling and retries
   */
  static async signIn(params: {
    email: string;
    password: string;
    signInFunction: (provider: string, params: any) => Promise<any>;
  }): Promise<void> {
    const { email, password, signInFunction } = params;

    // Validate inputs
    this.validateSignInInputs({ email, password });

    // Clear any existing auth data
    AuthStorage.clearAll();

    // Sign in with retry
    await this.withRetry(
      async () => {
        await signInFunction('password', {
          email: email.trim().toLowerCase(),
          password,
          flow: 'signIn',
        });

        // Store session data on successful sign in
        AuthStorage.storeSessionId(`auth_${Date.now()}`);
      },
      DEFAULT_RETRY_CONFIG,
      'sign in'
    );
  }

  /**
   * Sign out and clear all local data
   */
  static async signOut(signOutFunction: () => Promise<void>): Promise<void> {
    try {
      await signOutFunction();
    } finally {
      // Always clear local data regardless of server response
      AuthStorage.clearAll();
    }
  }

  /**
   * Validates sign up inputs
   */
  private static validateSignUpInputs(params: {
    email: string;
    password: string;
    name: string;
  }): void {
    const { email, password, name } = params;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Name is required');
    }

    if (name.trim().length > 100) {
      throw new Error('Name is too long (max 100 characters)');
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format');
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
  }

  /**
   * Validates sign in inputs
   */
  private static validateSignInInputs(params: {
    email: string;
    password: string;
  }): void {
    const { email, password } = params;

    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format');
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }
  }

  /**
   * Health check for auth system
   */
  static async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to fetch auth status
      const response = await fetch('/api/auth/health', {
        method: 'GET',
        cache: 'no-cache',
      });

      return response.ok;
    } catch (error) {
      console.warn('Auth health check failed:', error);
      return false;
    }
  }
}
