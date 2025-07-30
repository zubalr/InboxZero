'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface Integration {
  _id: Id<'integrations'>;
  platform: 'notion' | 'asana' | 'clickup';
  name: string;
  isActive: boolean;
  configuration: any;
}

interface TaskCreationInterfaceProps {
  teamId: Id<'teams'>;
  threadId: Id<'threads'>;
  integrations: Integration[];
  onTaskCreated?: () => void;
  onClose?: () => void;
}

export function TaskCreationInterface({
  teamId,
  threadId,
  integrations,
  onTaskCreated,
  onClose,
}: TaskCreationInterfaceProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<
    'normal' | 'high' | 'urgent' | 'low'
  >('normal');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessages, setSuccessMessages] = useState<string[]>([]);

  const createUnifiedTask = useMutation(api.integrations.createUnifiedTask);

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (selectedPlatforms.length === 0) {
      setErrors({
        general: 'Please select at least one platform to create the task',
      });
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessages([]);

    try {
      const result = await createUnifiedTask({
        threadId,
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        assignee: assignee.trim() || undefined,
        platforms: selectedPlatforms as ('notion' | 'asana' | 'clickup')[],
      });

      // Handle results from each platform
      const newSuccessMessages: string[] = [];
      const newErrors: Record<string, string> = {};

      if (result.notion?.success) {
        newSuccessMessages.push('✅ Task created in Notion');
      } else if (result.notion?.error) {
        newErrors.notion = result.notion.error;
      }

      if (result.asana?.success) {
        newSuccessMessages.push('✅ Task created in Asana');
      } else if (result.asana?.error) {
        newErrors.asana = result.asana.error;
      }

      if (result.clickup?.success) {
        newSuccessMessages.push('✅ Task created in ClickUp');
      } else if (result.clickup?.error) {
        newErrors.clickup = result.clickup.error;
      }

      setSuccessMessages(newSuccessMessages);
      setErrors(newErrors);

      // If any platform succeeded, consider it a success
      if (newSuccessMessages.length > 0) {
        // Clear form on success
        setTitle('');
        setDescription('');
        setPriority('normal');
        setDueDate('');
        setAssignee('');
        setSelectedPlatforms([]);

        onTaskCreated?.();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setErrors({
        general:
          error instanceof Error ? error.message : 'Failed to create task',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'notion':
        return '📝';
      case 'asana':
        return '✅';
      case 'clickup':
        return '📋';
      default:
        return '🔗';
    }
  };

  const activePlatforms = integrations.filter((int) => int.isActive);

  if (activePlatforms.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">No integrations configured</p>
        <p className="text-sm text-gray-400">
          Configure integrations in the settings to create tasks from emails
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Create Task
        </h2>
        <p className="text-gray-600">
          Create a task from this email thread in your connected platforms
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Platform Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Platforms *
          </label>
          <div className="grid gap-3">
            {activePlatforms.map((integration) => (
              <label
                key={integration.platform}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedPlatforms.includes(integration.platform)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(integration.platform)}
                  onChange={() => handlePlatformToggle(integration.platform)}
                  className="sr-only"
                />
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-xl">
                    {getPlatformIcon(integration.platform)}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">
                      {integration.name}
                    </div>
                    <div className="text-sm text-gray-500 capitalize">
                      {integration.platform}
                    </div>
                  </div>
                </div>
                {selectedPlatforms.includes(integration.platform) && (
                  <div className="text-blue-600">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
          {errors.general && (
            <p className="text-sm text-red-600 mt-1">{errors.general}</p>
          )}
        </div>

        {/* Task Details */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task description (optional)"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dueDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="assignee"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Assignee
          </label>
          <input
            type="text"
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Email or username (optional)"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Error Messages */}
        {Object.keys(errors).length > 0 && (
          <div className="space-y-2">
            {Object.entries(errors).map(([platform, error]) => (
              <div
                key={platform}
                className="p-3 bg-red-50 border border-red-200 rounded-md"
              >
                <p className="text-sm text-red-700">
                  <strong className="capitalize">{platform}:</strong> {error}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Success Messages */}
        {successMessages.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            {successMessages.map((message, index) => (
              <p key={index} className="text-sm text-green-700">
                {message}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={
              isLoading || !title.trim() || selectedPlatforms.length === 0
            }
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Task...' : 'Create Task'}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
