import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface CreateTaskFormProps {
  threadId: Id<'threads'>;
  teamId: Id<'teams'>;
  onTaskCreated: () => void;
}

export function CreateTaskForm({ threadId, teamId, onTaskCreated }: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent' | 'low'>('normal');
  const [createInNotion, setCreateInNotion] = useState(false);

  const createTask = useMutation(api.integrations.createTask);
  const notionIntegration = useQuery(api.integrations.getNotionIntegration, { teamId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    await createTask({
      threadId,
      title,
      description,
      priority,
      createInNotion,
    });

    setTitle('');
    setDescription('');
    setPriority('normal');
    setCreateInNotion(false);
    onTaskCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t">
      <h3 className="text-lg font-semibold mb-2">Create New Task</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full p-2 border rounded"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description (optional)"
          className="w-full p-2 border rounded"
          rows={3}
        ></textarea>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as any)}
          className="w-full p-2 border rounded"
        >
          <option value="low">Low Priority</option>
          <option value="normal">Normal Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent Priority</option>
        </select>
        {notionIntegration?.isActive && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="createInNotion"
              checked={createInNotion}
              onChange={(e) => setCreateInNotion(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="createInNotion">Create in Notion</label>
          </div>
        )}
        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Create Task
        </button>
      </div>
    </form>
  );
}
