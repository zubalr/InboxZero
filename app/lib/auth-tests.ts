/**
 * Authentication system testing utilities
 * This file contains comprehensive tests for the auth error handling system
 */

import { AuthErrorHandler, AuthError } from './auth-errors';
import { AuthService } from './auth-service';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

export class AuthTestSuite {
  private results: TestResult[] = [];

  /**
   * Runs all authentication tests
   */
  async runAllTests(): Promise<TestResult[]> {
    this.results = [];

    await this.testErrorMapping();
    await this.testInputValidation();
    await this.testRetryLogic();
    await this.testAuthService();

    return this.results;
  }

  private addResult(test: string, passed: boolean, error?: string): void {
    this.results.push({ test, passed, error });
    console.log(
      `[Auth Test] ${test}: ${passed ? 'PASS' : 'FAIL'}${error ? ` - ${error}` : ''}`
    );
  }

  /**
   * Test error mapping functionality
   */
  private async testErrorMapping(): Promise<void> {
    try {
      // Test account exists error
      const accountExistsError = AuthErrorHandler.mapError(
        new Error('Account hello@hello.com already exists')
      );
      this.addResult(
        'Account exists error mapping',
        accountExistsError.code === 'ACCOUNT_EXISTS' &&
          accountExistsError.field === 'email'
      );

      // Test invalid credentials error
      const invalidCredsError = AuthErrorHandler.mapError(
        new Error('Invalid credentials')
      );
      this.addResult(
        'Invalid credentials error mapping',
        invalidCredsError.code === 'INVALID_CREDENTIALS'
      );

      // Test name required error
      const nameRequiredError = AuthErrorHandler.mapError(
        new Error('Name is required')
      );
      this.addResult(
        'Name required error mapping',
        nameRequiredError.code === 'NAME_REQUIRED' &&
          nameRequiredError.field === 'name'
      );

      // Test email validation error
      const emailError = AuthErrorHandler.mapError(
        new Error('Invalid email format')
      );
      this.addResult(
        'Email validation error mapping',
        emailError.code === 'INVALID_EMAIL' && emailError.field === 'email'
      );

      // Test password validation error
      const passwordError = AuthErrorHandler.mapError(
        new Error('Password must be at least 8 characters long')
      );
      this.addResult(
        'Password validation error mapping',
        passwordError.code === 'PASSWORD_TOO_SHORT' &&
          passwordError.field === 'password'
      );

      // Test network error
      const networkError = AuthErrorHandler.mapError(
        new Error('Network error occurred')
      );
      this.addResult(
        'Network error mapping',
        networkError.code === 'NETWORK_ERROR' && networkError.retryable === true
      );

      // Test unknown error
      const unknownError = AuthErrorHandler.mapError(
        new Error('Some random error')
      );
      this.addResult(
        'Unknown error mapping',
        unknownError.code === 'UNKNOWN_ERROR' && unknownError.retryable === true
      );
    } catch (error) {
      this.addResult(
        'Error mapping tests',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test input validation
   */
  private async testInputValidation(): Promise<void> {
    try {
      // Test sign-up validation
      try {
        await AuthService.signUp({
          email: '',
          password: 'password123',
          name: 'Test User',
          signInFunction: async () => {},
          createProfile: async () => 'user-id',
        });
        this.addResult(
          'Sign-up empty email validation',
          false,
          'Should have thrown error'
        );
      } catch {
        this.addResult('Sign-up empty email validation', true);
      }

      try {
        await AuthService.signUp({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
          signInFunction: async () => {},
          createProfile: async () => 'user-id',
        });
        this.addResult(
          'Sign-up short password validation',
          false,
          'Should have thrown error'
        );
      } catch {
        this.addResult('Sign-up short password validation', true);
      }

      try {
        await AuthService.signUp({
          email: 'test@example.com',
          password: 'password123',
          name: '',
          signInFunction: async () => {},
          createProfile: async () => 'user-id',
        });
        this.addResult(
          'Sign-up empty name validation',
          false,
          'Should have thrown error'
        );
      } catch {
        this.addResult('Sign-up empty name validation', true);
      }

      // Test sign-in validation
      try {
        await AuthService.signIn({
          email: 'invalid-email',
          password: 'password123',
          signInFunction: async () => {},
        });
        this.addResult(
          'Sign-in invalid email validation',
          false,
          'Should have thrown error'
        );
      } catch {
        this.addResult('Sign-in invalid email validation', true);
      }

      try {
        await AuthService.signIn({
          email: 'test@example.com',
          password: '',
          signInFunction: async () => {},
        });
        this.addResult(
          'Sign-in empty password validation',
          false,
          'Should have thrown error'
        );
      } catch {
        this.addResult('Sign-in empty password validation', true);
      }
    } catch (error) {
      this.addResult(
        'Input validation tests',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test retry logic
   */
  private async testRetryLogic(): Promise<void> {
    try {
      let attemptCount = 0;
      const maxRetries = 3;

      try {
        await AuthService.withRetry(
          async () => {
            attemptCount++;
            if (attemptCount <= 2) {
              throw new Error('Network error'); // Retryable error
            }
            return 'success';
          },
          {
            maxRetries,
            initialDelay: 10,
            backoffMultiplier: 1,
            retryableErrors: ['network'],
          },
          'test retry'
        );
        this.addResult(
          'Retry logic success after failures',
          attemptCount === 3
        );
      } catch {
        this.addResult(
          'Retry logic success after failures',
          false,
          'Should have succeeded on 3rd attempt'
        );
      }

      // Test non-retryable error
      let nonRetryableAttempts = 0;
      try {
        await AuthService.withRetry(
          async () => {
            nonRetryableAttempts++;
            throw new Error('Name is required'); // Non-retryable error
          },
          {
            maxRetries,
            initialDelay: 10,
            backoffMultiplier: 1,
            retryableErrors: ['network'],
          },
          'test non-retryable'
        );
        this.addResult(
          'Non-retryable error handling',
          false,
          'Should have failed immediately'
        );
      } catch {
        this.addResult(
          'Non-retryable error handling',
          nonRetryableAttempts === 1
        );
      }
    } catch (error) {
      this.addResult(
        'Retry logic tests',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test auth service integration
   */
  private async testAuthService(): Promise<void> {
    try {
      // Test successful sign-up flow
      let signInCalled = false;
      let profileCreated = false;

      await AuthService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        signInFunction: async () => {
          signInCalled = true;
        },
        createProfile: async () => {
          profileCreated = true;
          return 'user-id';
        },
      });

      this.addResult(
        'Auth service sign-up flow',
        signInCalled && profileCreated
      );

      // Test successful sign-in flow
      let signInSuccess = false;

      await AuthService.signIn({
        email: 'test@example.com',
        password: 'password123',
        signInFunction: async () => {
          signInSuccess = true;
        },
      });

      this.addResult('Auth service sign-in flow', signInSuccess);

      // Test health check
      const healthStatus = await AuthService.healthCheck();
      this.addResult(
        'Auth service health check',
        typeof healthStatus === 'boolean'
      );
    } catch (error) {
      this.addResult(
        'Auth service tests',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Generates a test report
   */
  generateReport(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    let report = `\n=== Authentication System Test Report ===\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    if (failedTests > 0) {
      report += `Failed Tests:\n`;
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          report += `- ${r.test}${r.error ? `: ${r.error}` : ''}\n`;
        });
    }

    return report;
  }
}

/**
 * Utility function to run auth tests in development
 */
export async function runAuthTests(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Auth tests should only be run in development environment');
    return;
  }

  console.log('Starting authentication system tests...');

  const testSuite = new AuthTestSuite();
  await testSuite.runAllTests();

  const report = testSuite.generateReport();
  console.log(report);
}
