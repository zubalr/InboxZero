import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import Google from '@auth/core/providers/google';
import MicrosoftEntraId from '@auth/core/providers/microsoft-entra-id';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
        },
      },
    }),
    MicrosoftEntraId({
      authorization: {
        params: {
          scope:
            'openid email profile https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite',
        },
      },
    }),
    Password({
      profile(params) {
        try {
          console.log('Profile params received:', {
            ...params,
            password: params.password ? '[REDACTED]' : undefined,
          });

          // Validate required parameters
          if (!params.email || typeof params.email !== 'string') {
            throw new Error('Email is required');
          }

          // For sign-in flow, name might not be provided, so make it optional
          const isSignUp = params.flow === 'signUp' || Boolean(params.name);

          if (isSignUp && (!params.name || typeof params.name !== 'string')) {
            throw new Error('Name is required for account creation');
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(params.email)) {
            throw new Error('Invalid email format');
          }

          const cleanEmail = params.email.toLowerCase().trim();

          // For sign-in, we don't need all the profile data
          if (!isSignUp) {
            return {
              email: cleanEmail,
              name: 'User', // Default name for sign-in flow
              isActive: true,
              lastActiveAt: Date.now(),
              role: 'member' as const,
            };
          }

          // For sign-up, validate name and return full profile
          if (typeof params.name !== 'string') {
            throw new Error('Name must be a string');
          }

          const trimmedName = params.name.trim();
          if (trimmedName.length === 0) {
            throw new Error('Name cannot be empty');
          }
          if (trimmedName.length > 100) {
            throw new Error('Name is too long (max 100 characters)');
          }

          return {
            email: cleanEmail,
            name: trimmedName,
            isActive: true,
            lastActiveAt: Date.now(),
            role: 'member' as const,
          };
        } catch (error) {
          console.error('Profile creation error:', error);
          throw error;
        }
      },
    }),
  ],
});
