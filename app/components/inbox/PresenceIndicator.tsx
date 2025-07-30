'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface PresenceIndicatorProps {
  threadId: Id<'threads'>;
}

export function PresenceIndicator({ threadId }: PresenceIndicatorProps) {
  const presence = useQuery(api.presence.listForThread, { threadId });

  if (!presence || presence.length === 0) {
    return null;
  }

  const activeUsers = presence.filter(
    (p: any) => p.status === 'online' || p.status === 'busy'
  );

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      <div className="flex -space-x-2">
        {activeUsers.slice(0, 3).map((user: any) => (
          <div
            key={user.user._id}
            className="relative"
            title={`${user.user.name} is ${user.currentActivity?.type || 'viewing'}`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white">
              {user.user.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                user.status === 'online'
                  ? 'bg-green-400'
                  : user.status === 'busy'
                    ? 'bg-red-400'
                    : 'bg-gray-400'
              }`}
            />
          </div>
        ))}
      </div>
      {activeUsers.length > 3 && (
        <span className="text-xs text-gray-500">
          +{activeUsers.length - 3} more
        </span>
      )}
      <span className="text-xs text-gray-500">
        {activeUsers.length === 1 ? 'is viewing' : 'are viewing'}
      </span>
    </div>
  );
}

interface GlobalPresenceProps {
  className?: string;
}

export function GlobalPresence({ className = '' }: GlobalPresenceProps) {
  const activeUsers = useQuery(api.presence.listActiveUsers);

  if (!activeUsers || activeUsers.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex -space-x-1">
        {activeUsers.slice(0, 5).map((user: any) => (
          <div
            key={user.user._id}
            className="relative"
            title={`${user.user.name} - ${user.status}`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium border-2 border-white">
              {user.user.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                user.status === 'online'
                  ? 'bg-green-400'
                  : user.status === 'busy'
                    ? 'bg-red-400'
                    : user.status === 'idle'
                      ? 'bg-yellow-400'
                      : 'bg-gray-400'
              }`}
            />
          </div>
        ))}
      </div>
      {activeUsers.length > 5 && (
        <span className="text-sm text-gray-600">
          +{activeUsers.length - 5} online
        </span>
      )}
    </div>
  );
}
