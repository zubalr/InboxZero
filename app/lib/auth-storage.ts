/**
 * Local storage management for authentication state and session tokens
 * Reduces unnecessary function calls and improves performance
 */

export interface StoredUserData {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId?: string;
  profileImage?: string;
  preferences?: {
    emailNotifications: boolean;
    theme: 'light' | 'dark' | 'system';
    timezone: string;
  };
  lastActiveAt: number;
  cachedAt: number;
}

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

const STORAGE_KEYS = {
  USER_DATA: 'inboxzero_user_data',
  AUTH_TOKENS: 'inboxzero_auth_tokens',
  SESSION_ID: 'inboxzero_session_id',
} as const;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class AuthStorage {
  /**
   * Check if we're in a browser environment
   */
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Store user data locally with timestamp
   */
  static storeUserData(userData: Omit<StoredUserData, 'cachedAt'>): void {
    if (!this.isBrowser()) return;

    try {
      const dataWithTimestamp: StoredUserData = {
        ...userData,
        cachedAt: Date.now(),
      };

      localStorage.setItem(
        STORAGE_KEYS.USER_DATA,
        JSON.stringify(dataWithTimestamp)
      );
    } catch (error) {
      console.warn('Failed to store user data:', error);
    }
  }

  /**
   * Get cached user data if still valid
   */
  static getCachedUserData(): StoredUserData | null {
    if (!this.isBrowser()) return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (!stored) return null;

      const userData: StoredUserData = JSON.parse(stored);
      const now = Date.now();

      // Check if cache is still valid
      if (now - userData.cachedAt > CACHE_DURATION) {
        this.clearUserData();
        return null;
      }

      return userData;
    } catch (error) {
      console.warn('Failed to get cached user data:', error);
      this.clearUserData();
      return null;
    }
  }

  /**
   * Store auth tokens securely
   */
  static storeAuthTokens(tokens: AuthTokens): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
    } catch (error) {
      console.warn('Failed to store auth tokens:', error);
    }
  }

  /**
   * Get stored auth tokens
   */
  static getAuthTokens(): AuthTokens | null {
    if (!this.isBrowser()) return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
      if (!stored) return null;

      const tokens: AuthTokens = JSON.parse(stored);

      // Check if tokens are expired
      if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
        this.clearAuthTokens();
        return null;
      }

      return tokens;
    } catch (error) {
      console.warn('Failed to get auth tokens:', error);
      this.clearAuthTokens();
      return null;
    }
  }

  /**
   * Store session ID for reconnection
   */
  static storeSessionId(sessionId: string): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    } catch (error) {
      console.warn('Failed to store session ID:', error);
    }
  }

  /**
   * Get stored session ID
   */
  static getSessionId(): string | null {
    if (!this.isBrowser()) return null;

    try {
      return localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    } catch (error) {
      console.warn('Failed to get session ID:', error);
      return null;
    }
  }

  /**
   * Update user's last active timestamp
   */
  static updateLastActive(): void {
    if (!this.isBrowser()) return;

    const userData = this.getCachedUserData();
    if (userData) {
      this.storeUserData({
        ...userData,
        lastActiveAt: Date.now(),
      });
    }
  }

  /**
   * Check if user data is cached and valid
   */
  static isUserDataCached(): boolean {
    return this.getCachedUserData() !== null;
  }

  /**
   * Clear user data from storage
   */
  static clearUserData(): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.warn('Failed to clear user data:', error);
    }
  }

  /**
   * Clear auth tokens from storage
   */
  static clearAuthTokens(): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
    } catch (error) {
      console.warn('Failed to clear auth tokens:', error);
    }
  }

  /**
   * Clear session ID from storage
   */
  static clearSessionId(): void {
    if (!this.isBrowser()) return;

    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    } catch (error) {
      console.warn('Failed to clear session ID:', error);
    }
  }

  /**
   * Clear all stored auth data (on logout)
   */
  static clearAll(): void {
    this.clearUserData();
    this.clearAuthTokens();
    this.clearSessionId();
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): {
    hasUserData: boolean;
    hasAuthTokens: boolean;
    hasSessionId: boolean;
    userDataAge?: number;
  } {
    const userData = this.getCachedUserData();
    const authTokens = this.getAuthTokens();
    const sessionId = this.getSessionId();

    return {
      hasUserData: userData !== null,
      hasAuthTokens: authTokens !== null,
      hasSessionId: sessionId !== null,
      userDataAge: userData ? Date.now() - userData.cachedAt : undefined,
    };
  }
}
