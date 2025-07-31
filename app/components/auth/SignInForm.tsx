'use client';

import { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAuthErrorHandler } from '@/app/lib/auth-errors';
import { AuthService } from '@/app/lib/auth-service';
import { AuthStorage } from '@/app/lib/auth-storage';
import { GoogleSignIn } from './GoogleSignIn';

export function SignInForm() {
  const { signIn } = useAuthActions();
  const { handleError } = useAuthErrorHandler();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      // Client-side validation
      const errors: Record<string, string> = {};

      if (!email.trim()) {
        errors.email = 'Email is required';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.email = 'Please enter a valid email address';
        }
      }

      if (!password) {
        errors.password = 'Password is required';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      // Clear any existing auth data before signin
      AuthStorage.clearAll();

      // Use the robust auth service
      await AuthService.signIn({
        email,
        password,
        signInFunction: signIn,
      });

      // Success - the auth system will handle redirect
      console.log('Signin completed successfully');
    } catch (err) {
      const authError = await handleError(err, 'signin');

      if (authError.field) {
        setFieldErrors({ [authError.field]: authError.message });
      } else {
        setError(authError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md border">
      <h2 className="text-2xl font-bold text-center mb-6">Sign In</h2>

      {/* Google Sign In */}
      <div className="mb-6">
        <GoogleSignIn />
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              fieldErrors.password
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
            }`}
            placeholder="Enter your password"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
