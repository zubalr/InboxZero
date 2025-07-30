'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { CreateTaskForm } from './integrations/CreateTaskForm';

interface Thread {
  _id: Id<'threads'>;
  subject: string;
  status: 'unread' | 'read' | 'replied' | 'closed' | 'archived';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assignedTo?: Id<'users'>;
  tags: string[];
}

interface TeamMember {
  _id: Id<'users'>;
  name: string;
  email: string;
}

interface ThreadActionsProps {
  thread: Thread;
  teamId: Id<'teams'>;
  onShowComments: () => void;
  showingComments: boolean;
  teamMembers: TeamMember[];
}

export function ThreadActions({
  thread,
  teamId,
  onShowComments,
  showingComments,
  teamMembers,
}: ThreadActionsProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const updateStatus = useMutation(api.threads.updateThreadStatus);
  const assignThread = useMutation(api.threads.assignThread);

  const handleStatusChange = async (status: Thread['status']) => {
    try {
      await updateStatus({
        threadId: thread._id,
        status,
      });
      setShowStatusDropdown(false);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAssignChange = async (userId: Id<'users'> | null) => {
    try {
      await assignThread({
        threadId: thread._id,
        assigneeId: userId || undefined,
      });
      setShowAssignDropdown(false);
    } catch (error) {
      console.error('Failed to assign thread:', error);
    }
  };

  const statusOptions = [
    { value: 'unread', label: 'Unread', color: 'bg-blue-100 text-blue-800' },
    { value: 'read', label: 'Read', color: 'bg-gray-100 text-gray-800' },
    {
      value: 'replied',
      label: 'Replied',
      color: 'bg-green-100 text-green-800',
    },
    {
      value: 'closed',
      label: 'Closed',
      color: 'bg-purple-100 text-purple-800',
    },
    {
      value: 'archived',
      label: 'Archived',
      color: 'bg-gray-100 text-gray-600',
    },
  ] as const;

  const priorityOptions = [
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'normal', label: 'Normal', color: 'bg-gray-100 text-gray-800' },
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
  ] as const;

  const assignedUser = thread.assignedTo
    ? teamMembers.find((member) => member._id === thread.assignedTo)
    : null;

  return (
    <>
      <div className="flex items-center space-x-2">
        {/* Comments toggle */}
        <button
          onClick={onShowComments}
          className={`p-2 rounded-md border transition-colors ${
            showingComments
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
          title="Toggle comments"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.405L3 21l2.595-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
            />
          </svg>
        </button>

        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="inline-flex items-center px-3 py-1 text-sm rounded-md border bg-white hover:bg-gray-50"
          >
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                statusOptions.find((opt) => opt.value === thread.status)
                  ?.color || 'bg-gray-100 text-gray-800'
              }`}
            >
              {statusOptions.find((opt) => opt.value === thread.status)
                ?.label || thread.status}
            </span>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showStatusDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="py-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                      thread.status === option.value ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${option.color}`}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assignment dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
            className="inline-flex items-center px-3 py-1 text-sm rounded-md border bg-white hover:bg-gray-50"
          >
            {assignedUser ? (
              <div className="flex items-center">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                  <span className="text-xs font-medium text-blue-700">
                    {assignedUser.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span>{assignedUser.name}</span>
              </div>
            ) : (
              <span className="text-gray-500">Unassigned</span>
            )}
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showAssignDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="py-1">
                <button
                  onClick={() => handleAssignChange(null)}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                    !thread.assignedTo ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-gray-500">Unassigned</span>
                </button>
                {teamMembers.map((member) => (
                  <button
                    key={member._id}
                    onClick={() => handleAssignChange(member._id)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                      thread.assignedTo === member._id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                        <span className="text-xs font-medium text-gray-700">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span>{member.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create Task Button */}
        <button
          onClick={() => setShowCreateTask(true)}
          className="p-2 rounded-md border bg-white text-gray-600 hover:bg-gray-50"
          title="Create task"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>

        {/* More actions menu */}
        <div className="relative">
          <button className="p-2 rounded-md border bg-white text-gray-600 hover:bg-gray-50">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        </div>
      </div>
      {showCreateTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Create Task</h2>
              <button onClick={() => setShowCreateTask(false)}>&times;</button>
            </div>
            <CreateTaskForm
              threadId={thread._id}
              teamId={teamId}
              onTaskCreated={() => setShowCreateTask(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
