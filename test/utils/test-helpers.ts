/**
 * Test utilities and helpers for InboxZero AI tests
 */

import { vi } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';

// Mock data generators
export const createMockUser = (overrides: Partial<any> = {}) => ({
  _id: 'user-123' as Id<'users'>,
  email: 'test@example.com',
  name: 'Test User',
  teamId: 'team-123' as Id<'teams'>,
  _creationTime: Date.now(),
  ...overrides,
});

export const createMockTeam = (overrides: Partial<any> = {}) => ({
  _id: 'team-123' as Id<'teams'>,
  name: 'Test Team',
  domain: 'test.com',
  settings: {},
  _creationTime: Date.now(),
  ...overrides,
});

export const createMockThread = (overrides: Partial<any> = {}) => ({
  _id: 'thread-123' as Id<'threads'>,
  subject: 'Test Thread',
  teamId: 'team-123' as Id<'teams'>,
  assigneeId: null,
  priority: 'info_only' as const,
  status: 'unread' as const,
  summary: null,
  lastMessageAt: Date.now(),
  messageId: 'msg-123',
  references: [],
  _creationTime: Date.now(),
  ...overrides,
});

export const createMockMessage = (overrides: Partial<any> = {}) => ({
  _id: 'message-123' as Id<'messages'>,
  threadId: 'thread-123' as Id<'threads'>,
  fromEmail: 'sender@example.com',
  fromName: 'Sender Name',
  toEmails: ['recipient@example.com'],
  ccEmails: [],
  bccEmails: [],
  subject: 'Test Message',
  htmlBody: '<p>Test content</p>',
  textBody: 'Test content',
  isOutbound: false,
  messageId: 'msg-123',
  inReplyTo: null,
  sentAt: Date.now(),
  resendId: null,
  deliveryStatus: null,
  _creationTime: Date.now(),
  ...overrides,
});

export const createMockComment = (overrides: Partial<any> = {}) => ({
  _id: 'comment-123' as Id<'comments'>,
  threadId: 'thread-123' as Id<'threads'>,
  userId: 'user-123' as Id<'users'>,
  content: 'Test comment',
  reactions: [],
  _creationTime: Date.now(),
  ...overrides,
});

// Mock Convex hooks
export const mockConvexHooks = () => {
  const mockUseQuery = vi.fn();
  const mockUseMutation = vi.fn();
  const mockUseAction = vi.fn();

  vi.mock('convex/react', () => ({
    useQuery: mockUseQuery,
    useMutation: mockUseMutation,
    useAction: mockUseAction,
    ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
    ConvexReactClient: vi.fn(),
  }));

  return {
    mockUseQuery,
    mockUseMutation,
    mockUseAction,
  };
};

// Mock AI services
export const mockAIServices = () => {
  const mockGenerateText = vi.fn();

  vi.mock('ai', () => ({
    generateText: mockGenerateText,
  }));

  return {
    mockGenerateText,
  };
};

// Mock Resend service
export const mockResendService = () => {
  const mockSend = vi.fn();

  vi.mock('@convex-dev/resend', () => ({
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    })),
  }));

  return {
    mockSend,
  };
};

// Test data builders
export class TestDataBuilder {
  static team(name = 'Test Team') {
    return {
      name,
      domain: `${name.toLowerCase().replace(/\s+/g, '')}.com`,
      settings: {},
    };
  }

  static user(email = 'test@example.com', teamId?: Id<'teams'>) {
    return {
      email,
      name: email.split('@')[0],
      teamId: teamId || ('team-123' as Id<'teams'>),
    };
  }

  static thread(subject = 'Test Thread', teamId?: Id<'teams'>) {
    return {
      subject,
      teamId: teamId || ('team-123' as Id<'teams'>),
      messageId: `msg-${Date.now()}`,
      fromEmail: 'sender@example.com',
      toEmails: ['recipient@example.com'],
      textBody: 'Test message content',
    };
  }

  static message(threadId?: Id<'threads'>) {
    return {
      threadId: threadId || ('thread-123' as Id<'threads'>),
      fromEmail: 'sender@example.com',
      toEmails: ['recipient@example.com'],
      subject: 'Test Message',
      textBody: 'Test message content',
      messageId: `msg-${Date.now()}`,
      sentAt: Date.now(),
    };
  }

  static comment(threadId?: Id<'threads'>, userId?: Id<'users'>) {
    return {
      threadId: threadId || ('thread-123' as Id<'threads'>),
      userId: userId || ('user-123' as Id<'users'>),
      content: 'Test comment content',
    };
  }
}

// Performance testing utilities
export const measurePerformance = async <T>(
  operation: () => Promise<T>,
  maxDuration: number = 1000
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await operation();
  const duration = performance.now() - startTime;

  if (duration > maxDuration) {
    throw new Error(
      `Operation took ${duration}ms, expected less than ${maxDuration}ms`
    );
  }

  return { result, duration };
};

// Async test utilities
export const waitFor = (
  condition: () => boolean,
  timeout = 5000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
};

// Error simulation utilities
export const simulateNetworkError = () => {
  throw new Error('Network request failed');
};

export const simulateTimeoutError = () => {
  throw new Error('Request timeout');
};

export const simulateValidationError = (field: string) => {
  throw new Error(`Validation failed for field: ${field}`);
};

// Test environment setup
export const setupTestEnvironment = () => {
  // Mock window objects
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
};

// Cleanup utilities
export const cleanupTestEnvironment = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};
