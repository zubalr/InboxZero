'use client';

import { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuthErrorHandler } from '@/app/lib/auth-errors';
import { AuthService } from '@/app/lib/auth-service';
import { AuthStorage } from '@/app/lib/auth-storage';
import { GoogleSignIn } from './GoogleSignIn';

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const createUserProfile = useMutation(api.users.createUserProfile);
  const { handleError } = useAuthErrorHandler();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    teamName: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      // Comprehensive validation
      const errors: Record<string, string> = {};

      if (!formData.name.trim()) {
        errors.name = 'Name is required';
      } else if (formData.name.trim().length > 100) {
        errors.name = 'Name is too long (max 100 characters)';
      }

      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          errors.email = 'Please enter a valid email address';
        }
      }

      if (!formData.password) {
        errors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long';
      }

      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Password confirmation is required';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      // Clear any existing auth data before signup
      AuthStorage.clearAll();

      // Use the robust auth service with improved profile creation
      await AuthService.signUp({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        signInFunction: signIn,
        createProfile: createUserProfile,
      });

      // Success - the auth system will handle redirect
      console.log('Signup completed successfully');
    } catch (err) {
      const authError = await handleError(err, 'signup');

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
      <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

      {/* Google Sign Up */}
      <div className="mb-6">
        <GoogleSignIn>Sign up with Google</GoogleSignIn>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">
            Or create account with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter your full name"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
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
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              fieldErrors.password
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
            }`}
            placeholder="Create a password (min 8 characters)"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              fieldErrors.confirmPassword
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
            }`}
            placeholder="Confirm your password"
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.confirmPassword}
            </p>
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
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
