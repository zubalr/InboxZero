import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export function usePresence(
  threadId?: Id<'threads'>,
  activity?: {
    type: 'viewing_thread' | 'composing_reply' | 'adding_comment';
    threadId?: Id<'threads'>;
  }
) {
  const updatePresence = useMutation(api.presence.updatePresence);

  useEffect(() => {
    // Update presence immediately
    updatePresence({
      status: 'online',
      threadId,
      activity,
    });

    // Update presence every 30 seconds
    const interval = setInterval(() => {
      updatePresence({
        status: 'online',
        threadId,
        activity,
      });
    }, 30000);

    // Update to offline when component unmounts
    return () => {
      clearInterval(interval);
      updatePresence({
        status: 'offline',
        threadId: undefined,
        activity: undefined,
      });
    };
  }, [threadId, activity, updatePresence]);

  return { updatePresence };
}
