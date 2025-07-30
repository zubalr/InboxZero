import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadList } from '../../app/components/inbox/ThreadList';

const mockUseQuery = vi.fn();
vi.mock('convex/react', () => ({
  useQuery: mockUseQuery,
}));

vi.mock('../../app/components/common/SkeletonLoaders', () => ({
  ThreadListSkeleton: () => (
    <div data-testid="thread-list-skeleton">Loading threads...</div>
  ),
}));

vi.mock('../../app/components/common/ErrorMessages', () => ({
  ErrorMessage: ({ message }: any) => (
    <div data-testid="error-message">{message}</div>
  ),
}));

describe('ThreadList', () => {
  const mockThreads = [
    {
      _id: 'thread-1',
      subject: 'Important Project Update',
      priority: 'urgent',
      status: 'unread',
      assigneeId: 'user-1',
      lastMessageAt: Date.now() - 3600000, // 1 hour ago
      _creationTime: Date.now() - 7200000, // 2 hours ago
      teamId: 'team-1',
      messageId: 'msg-1',
    },
    {
      _id: 'thread-2',
      subject: 'Customer Support Request',
      priority: 'action_required',
      status: 'read',
      assigneeId: 'user-2',
      lastMessageAt: Date.now() - 7200000, // 2 hours ago
      _creationTime: Date.now() - 10800000, // 3 hours ago
      teamId: 'team-1',
      messageId: 'msg-2',
    },
    {
      _id: 'thread-3',
      subject: 'Weekly Newsletter',
      priority: 'info_only',
      status: 'read',
      assigneeId: null,
      lastMessageAt: Date.now() - 86400000, // 1 day ago
      _creationTime: Date.now() - 86400000,
      teamId: 'team-1',
      messageId: 'msg-3',
    },
  ];

  const mockTeamMembers = [
    { _id: 'user-1', name: 'John Doe', email: 'john@test.com' },
    { _id: 'user-2', name: 'Jane Smith', email: 'jane@test.com' },
  ];

  const defaultProps = {
    filters: {},
    selectedThreadId: null,
    onThreadSelect: vi.fn(),
    teamMembers: mockTeamMembers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(mockThreads);
  });

  it('renders thread list with threads', () => {
    render(<ThreadList {...defaultProps} />);

    expect(screen.getByText('Important Project Update')).toBeInTheDocument();
    expect(screen.getByText('Customer Support Request')).toBeInTheDocument();
    expect(screen.getByText('Weekly Newsletter')).toBeInTheDocument();
  });

  it('shows loading skeleton when threads are loading', () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<ThreadList {...defaultProps} />);

    expect(screen.getByTestId('thread-list-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no threads exist', () => {
    mockUseQuery.mockReturnValue([]);

    render(<ThreadList {...defaultProps} />);

    expect(screen.getByText('No threads found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your filters or check back later for new messages.'
      )
    ).toBeInTheDocument();
  });

  it('calls onThreadSelect when thread is clicked', async () => {
    const user = userEvent.setup();
    const onThreadSelect = vi.fn();

    render(<ThreadList {...defaultProps} onThreadSelect={onThreadSelect} />);

    const threadItem = screen.getByText('Important Project Update');
    await user.click(threadItem);

    expect(onThreadSelect).toHaveBeenCalledWith('thread-1');
  });

  it('highlights selected thread', () => {
    render(<ThreadList {...defaultProps} selectedThreadId="thread-1" />);

    const selectedThread = screen
      .getByText('Important Project Update')
      .closest('[data-testid="thread-item"]');
    expect(selectedThread).toHaveClass('bg-blue-50', 'border-blue-200');
  });

  it('displays priority indicators correctly', () => {
    render(<ThreadList {...defaultProps} />);

    // Check for urgent priority indicator
    const urgentThread = screen
      .getByText('Important Project Update')
      .closest('[data-testid="thread-item"]');
    expect(urgentThread?.querySelector('.bg-red-100')).toBeInTheDocument();

    // Check for action required priority indicator
    const actionThread = screen
      .getByText('Customer Support Request')
      .closest('[data-testid="thread-item"]');
    expect(actionThread?.querySelector('.bg-yellow-100')).toBeInTheDocument();

    // Check for info only priority indicator
    const infoThread = screen
      .getByText('Weekly Newsletter')
      .closest('[data-testid="thread-item"]');
    expect(infoThread?.querySelector('.bg-gray-100')).toBeInTheDocument();
  });

  it('displays assignee information', () => {
    render(<ThreadList {...defaultProps} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows unread status indicator', () => {
    render(<ThreadList {...defaultProps} />);

    const unreadThread = screen
      .getByText('Important Project Update')
      .closest('[data-testid="thread-item"]');
    expect(unreadThread?.querySelector('.font-semibold')).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    render(<ThreadList {...defaultProps} />);

    // Should show relative time for recent messages
    expect(screen.getByText('1h ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('1d ago')).toBeInTheDocument();
  });

  it('filters threads by status', () => {
    const filters = { status: 'unread' as const };
    render(<ThreadList {...defaultProps} filters={filters} />);

    // Should only show unread threads
    expect(screen.getByText('Important Project Update')).toBeInTheDocument();
    expect(
      screen.queryByText('Customer Support Request')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Newsletter')).not.toBeInTheDocument();
  });

  it('filters threads by priority', () => {
    const filters = { priority: 'urgent' as const };
    render(<ThreadList {...defaultProps} filters={filters} />);

    // Should only show urgent threads
    expect(screen.getByText('Important Project Update')).toBeInTheDocument();
    expect(
      screen.queryByText('Customer Support Request')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Newsletter')).not.toBeInTheDocument();
  });

  it('filters threads assigned to current user', () => {
    const filters = { assignedToMe: true };
    mockUseQuery.mockImplementation((query) => {
      // Mock current user query
      if (query.toString().includes('getCurrentUser')) {
        return { _id: 'user-1' };
      }
      // Return filtered threads
      return mockThreads.filter((thread) => thread.assigneeId === 'user-1');
    });

    render(<ThreadList {...defaultProps} filters={filters} />);

    expect(screen.getByText('Important Project Update')).toBeInTheDocument();
    expect(
      screen.queryByText('Customer Support Request')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Newsletter')).not.toBeInTheDocument();
  });

  it('searches threads by search term', () => {
    const filters = { searchTerm: 'project' };
    render(<ThreadList {...defaultProps} filters={filters} />);

    expect(screen.getByText('Important Project Update')).toBeInTheDocument();
    expect(
      screen.queryByText('Customer Support Request')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Newsletter')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    const onThreadSelect = vi.fn();

    render(<ThreadList {...defaultProps} onThreadSelect={onThreadSelect} />);

    const firstThread = screen.getByText('Important Project Update');
    await user.click(firstThread);

    // Press arrow down to select next thread
    await user.keyboard('{ArrowDown}');
    expect(onThreadSelect).toHaveBeenCalledWith('thread-2');

    // Press arrow up to select previous thread
    await user.keyboard('{ArrowUp}');
    expect(onThreadSelect).toHaveBeenCalledWith('thread-1');
  });

  it('shows thread count', () => {
    render(<ThreadList {...defaultProps} />);

    expect(screen.getByText('3 threads')).toBeInTheDocument();
  });

  it('handles error state', () => {
    mockUseQuery.mockImplementation(() => {
      throw new Error('Failed to load threads');
    });

    render(<ThreadList {...defaultProps} />);

    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Failed to load threads')).toBeInTheDocument();
  });
});
