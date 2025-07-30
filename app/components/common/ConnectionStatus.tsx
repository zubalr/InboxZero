'use client';

import React, { useState, useEffect } from 'react';
import { useConvexAuth } from 'convex/react';

interface ConnectionState {
  isOnline: boolean;
  isConnected: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
}

export function ConnectionStatus() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isConnected: true,
    reconnectAttempts: 0,
  });
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => {
      setConnectionState((prev) => ({
        ...prev,
        isOnline: true,
        isConnected: true,
        reconnectAttempts: 0,
      }));
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setConnectionState((prev) => ({
        ...prev,
        isOnline: false,
        isConnected: false,
        lastConnected: new Date(),
      }));
      setShowStatus(true);
    };

    // Monitor Convex connection status
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        !connectionState.isConnected
      ) {
        // Attempt to reconnect when tab becomes visible
        setConnectionState((prev) => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1,
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionState.isConnected]);

  // Auto-hide status after connection is restored
  useEffect(() => {
    if (connectionState.isOnline && connectionState.isConnected) {
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionState.isOnline, connectionState.isConnected]);

  // Show status when offline or having connection issues
  useEffect(() => {
    if (!connectionState.isOnline || !connectionState.isConnected) {
      setShowStatus(true);
    }
  }, [connectionState.isOnline, connectionState.isConnected]);

  if (isLoading) {
    return null;
  }

  if (!showStatus && connectionState.isOnline && connectionState.isConnected) {
    return null;
  }

  const getStatusConfig = () => {
    if (!connectionState.isOnline) {
      return {
        color: 'bg-red-500',
        textColor: 'text-white',
        icon: (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
            />
          </svg>
        ),
        message: 'You are offline',
        description: 'Some features may not be available',
      };
    }

    if (!connectionState.isConnected) {
      return {
        color: 'bg-yellow-500',
        textColor: 'text-white',
        icon: (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ),
        message: 'Reconnecting...',
        description: `Attempt ${connectionState.reconnectAttempts}`,
      };
    }

    return {
      color: 'bg-green-500',
      textColor: 'text-white',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      message: 'Connected',
      description: 'All systems operational',
    };
  };

  const config = getStatusConfig();

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`${config.color} ${config.textColor} px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 transition-all duration-300 transform ${
          showStatus ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        {config.icon}
        <div>
          <div className="text-sm font-medium">{config.message}</div>
          {config.description && (
            <div className="text-xs opacity-90">{config.description}</div>
          )}
        </div>

        {connectionState.isOnline && connectionState.isConnected && (
          <button
            onClick={() => setShowStatus(false)}
            className="ml-2 text-white hover:text-gray-200"
          >
            <svg
              className="w-4 h-4"
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
        )}
      </div>
    </div>
  );
}

// Offline banner for when the app is offline
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-yellow-400">
              <svg
                className="h-5 w-5 text-white"
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
            </span>
            <p className="ml-3 font-medium text-yellow-800">
              <span className="md:hidden">You are currently offline</span>
              <span className="hidden md:inline">
                You are currently offline. Some features may not be available
                until you reconnect.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for checking connection status
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isConnected: isOnline && isAuthenticated,
  };
}
