/**
 * Error handling utilities for Convex functions
 */

export class ConvexError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ConvexError';
  }
}

export class ValidationError extends ConvexError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    if (field) {
      this.message = `${field}: ${message}`;
    }
  }
}

export class AuthenticationError extends ConvexError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ConvexError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ConvexError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ConvexError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email');
  }
}

/**
 * Validates and trims name
 */
export function validateName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Name is required', 'name');
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new ValidationError('Name cannot be empty', 'name');
  }

  if (trimmedName.length > 100) {
    throw new ValidationError('Name is too long (max 100 characters)', 'name');
  }

  return trimmedName;
}

/**
 * Validates timezone string
 */
export function validateTimezone(timezone: string): void {
  if (!timezone || typeof timezone !== 'string') {
    throw new ValidationError('Timezone is required', 'timezone');
  }

  if (timezone.trim().length === 0) {
    throw new ValidationError('Timezone cannot be empty', 'timezone');
  }
}

/**
 * Validates ID parameter
 */
export function validateId(id: string | undefined, fieldName: string): void {
  if (!id) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Wraps a function with error handling and logging
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in ${context}:`, error);

      // Re-throw known errors
      if (error instanceof ConvexError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ConvexError(
        `An unexpected error occurred in ${context}`,
        'INTERNAL_ERROR',
        500
      );
    }
  };
}

/**
 * Safe database operation wrapper
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database operation failed in ${context}:`, error);
    if (fallback !== undefined) {
      return fallback;
    }
    throw new ConvexError(
      `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DATABASE_ERROR',
      500
    );
  }
}

/**
 * Retry wrapper for operations that might fail temporarily
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        break;
      }

      // Don't retry validation or authentication errors
      if (
        error instanceof ValidationError ||
        error instanceof AuthenticationError
      ) {
        throw error;
      }

      console.warn(
        `Operation failed (attempt ${attempt}/${maxRetries}):`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}
