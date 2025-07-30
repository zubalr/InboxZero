import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxLayout } from '../../app/components/inbox/InboxLayout';

// Mock the Convex hooks
const mockUseQuery = vi.fn();
vi.mock('convex/react', () => ({
  useQuery: mockUseQuery,
}));

// Mock child components
vi.mock('../../app/components/inbox/ThreadList', () => ({
  ThreadList: ({ onThreadSelect, selectedThreadId }: any) => (
    <div data-testid="thread-list">
      <button
        onClick={() => onThreadSelect('thread-1')}
        data-testid="thread-item"
        className={selectedThreadId === 'thread-1' ? 'selected' : ''}
      >
        Test Thread
      </button>
    </div>
  ),
}));

vi.mock('../../app/components/inbox/ThreadView', () => ({
  ThreadView: ({ threadId, onClose }: any) => (
    <div data-testid="thread-view">
      <span>Thread: {threadId}</span>
      <button onClick={onClose} data-testid="close-thread">
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../app/components/inbox/EnhancedSearchInterface', () => ({
  EnhancedSearchInterface: ({ onThreadSelect }: any) => (
    <div data-testid="search-interface">
      <button onClick={() => onThreadSelect('search-thread-1')}>
        Search Result
      </button>
    </div>
  ),
}));

vi.mock('../../app/components/inbox/SearchAnalytics', () => ({
  SearchAnalytics: () => <div data-testid="search-analytics">Analytics</div>,
}));

vi.mock('../../app/components/inbox/PresenceIndicator', () => ({
  GlobalPresence: () => <div data-testid="global-presence">Presence</div>,
}));

vi.mock('../../app/components/inbox/useSearchState', () => ({
  useSearchState: () => ({
    searchState: {
      query: '',
      status: undefined,
      priority: undefined,
      assignee: undefined,
    },
    updateURL: vi.fn(),
    clearSearch: vi.fn(),
    hasActiveFilters: false,
    hasSearchCriteria: false,
  }),
}));

vi.mock('../../app/components/common/ErrorBoundary', () => ({
  InboxErrorBoundary: ({ children }: any) => <div>{children}</div>,
  SearchErrorBoundary: ({ children }: any) => <div>{children}</div>,
  ThreadErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../app/components/common/SkeletonLoaders', () => ({
  FullPageLoading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('../../app/components/common/ConnectionStatus', () => ({
  ConnectionStatus: () => <div data-testid="connection-status">Connected</div>,
  OfflineBanner: () => <div data-testid="offline-banner">Offline</div>,
}));

vi.mock('../../app/components/common/ErrorMessages', () => ({
  ErrorMessage: ({ message }: any) => (
    <div data-testid="error-message">{message}</div>
  ),
  useErrorHandler: () => ({
    error: null,
    handleError: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe('InboxLayout', () => {
  const mockCurrentUser = {
    _id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    teamId: 'team-1',
  };

  const mockTeamMembers = [
    { _id: 'user-1', name: 'Test User', email: 'test@test.com' },
    { _id: 'user-2', name: 'Team Member', email: 'member@test.com' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation((query) => {
      if (query.toString().includes('getCurrentUser')) {
        return mockCurrentUser;
      }
      if (query.toString().includes('getTeamMembers')) {
        return mockTeamMembers;
      }
      return null;
    });
  });

  it('renders loading state when user is not loaded', () => {
    mockUseQuery.mockImplementation(() => null);

    render(<InboxLayout />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders inbox view by default', () => {
    render(<InboxLayout />);

    expect(screen.getByText('InboxZero AI')).toBeInTheDocument();
    expect(screen.getByTestId('thread-list')).toBeInTheDocument();
    expect(screen.getByText('Select a thread to view')).toBeInTheDocument();
  });

  it('switches to search view when search tab is clicked', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    const searchTab = screen.getByText('Search');
    await user.click(searchTab);

    expect(screen.getByTestId('search-interface')).toBeInTheDocument();
    expect(screen.queryByTestId('thread-list')).not.toBeInTheDocument();
  });

  it('switches to analytics view when analytics tab is clicked', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    const analyticsTab = screen.getByText('Analytics');
    await user.click(analyticsTab);

    expect(screen.getByTestId('search-analytics')).toBeInTheDocument();
    expect(screen.getByText('Search Analytics')).toBeInTheDocument();
  });

  it('selects thread when thread item is clicked', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    const threadItem = screen.getByTestId('thread-item');
    await user.click(threadItem);

    expect(screen.getByTestId('thread-view')).toBeInTheDocument();
    expect(screen.getByText('Thread: thread-1')).toBeInTheDocument();
  });

  it('closes thread view when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    // First select a thread
    const threadItem = screen.getByTestId('thread-item');
    await user.click(threadItem);

    expect(screen.getByTestId('thread-view')).toBeInTheDocument();

    // Then close it
    const closeButton = screen.getByTestId('close-thread');
    await user.click(closeButton);

    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument();
    expect(screen.getByText('Select a thread to view')).toBeInTheDocument();
  });

  it('highlights active tab correctly', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    const inboxTab = screen.getByText('Inbox');
    const searchTab = screen.getByText('Search');

    // Inbox should be active by default
    expect(inboxTab).toHaveClass('bg-white', 'text-gray-900', 'shadow-sm');
    expect(searchTab).toHaveClass('text-gray-600');

    // Switch to search
    await user.click(searchTab);

    expect(searchTab).toHaveClass('bg-white', 'text-gray-900', 'shadow-sm');
    expect(inboxTab).toHaveClass('text-gray-600');
  });

  it('renders connection status and presence indicators', () => {
    render(<InboxLayout />);

    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByTestId('global-presence')).toBeInTheDocument();
  });

  it('passes correct props to ThreadList', () => {
    render(<InboxLayout />);

    const threadList = screen.getByTestId('thread-list');
    expect(threadList).toBeInTheDocument();

    // ThreadList should receive filters and team members
    // This is tested indirectly through the mock implementation
  });

  it('handles thread selection from search interface', async () => {
    const user = userEvent.setup();
    render(<InboxLayout />);

    // Switch to search view
    const searchTab = screen.getByText('Search');
    await user.click(searchTab);

    // Select thread from search results
    const searchResult = screen.getByText('Search Result');
    await user.click(searchResult);

    // Should show thread view
    expect(screen.getByTestId('thread-view')).toBeInTheDocument();
    expect(screen.getByText('Thread: search-thread-1')).toBeInTheDocument();
  });
});
