import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ModerationQueuePage = require('../page').default;

// Mock the api-client so no real HTTP requests are made
jest.mock('../../../../../lib/api-client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  API_BASE: 'http://localhost:3002/api/v1',
}));

// Mock next-auth/react (used by api-client interceptor)
jest.mock('next-auth/react', () => ({
  getSession: jest.fn().mockResolvedValue(null),
  useSession: jest.fn().mockReturnValue({ data: null, status: 'unauthenticated' }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
  usePathname: () => '/admin/moderation/queue',
}));

// Mock @ezihubb/constants with values the moderation page uses
jest.mock('@ezihubb/constants', () => ({
  ADMIN_ROUTES: {
    moderation: { queue: '/admin/moderation/queue' },
  },
  API_ROUTES: {
    ADMIN: {
      MODERATION_FLAGS:         '/admin/moderation/flags',
      MODERATION_STATS:         '/admin/moderation/stats',
      MODERATION_FLAG_APPROVE:  (id: string) => `/admin/moderation/flags/${id}/approve`,
      MODERATION_FLAG_REJECT:   (id: string) => `/admin/moderation/flags/${id}/reject`,
      MODERATION_FLAG_ESCALATE: (id: string) => `/admin/moderation/flags/${id}/escalate`,
    },
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

const mockFlag = {
  id: 'flag-1',
  type: 'PRODUCT' as const,
  severity: 'HIGH' as const,
  status: 'PENDING' as const,
  reason: 'Test reasoning for AI moderation',
  aiScore: 0.94,
  aiLabel: 'adult_content',
  targetId: 'prod-1',
  targetName: 'Flagged Product Name',
  targetUrl: null,
  reportedBy: null,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  resolvedBy: null,
};

const mockFlagsData = {
  data: [mockFlag],
  pagination: { total: 1, page: 1, totalPages: 1 },
};

const mockStatsData = {
  totalPending: 1,
  criticalCount: 1,
  totalToday: 3,
  avgResolutionHours: 2.5,
};

describe('Admin Moderation Queue Page', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockApi = require('../../../../../lib/api-client').api;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('stats')) return Promise.resolve(mockStatsData);
      return Promise.resolve(mockFlagsData);
    });
  });

  it('renders the page without crashing', () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    expect(document.body).toBeTruthy();
  });

  it('renders the Trust & Safety heading', () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    expect(screen.getByText('Trust & Safety')).toBeInTheDocument();
  });

  it('shows flagged items after loading', async () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    await waitFor(
      () => {
        expect(screen.getByText('Flagged Product Name')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('shows severity badge for flagged item', async () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    await waitFor(() => {
      const highBadge = screen.getAllByText('HIGH')[0];
      expect(highBadge).toBeInTheDocument();
    });
  });

  it('shows PENDING status badge', async () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('shows pending review stat chip', async () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });
  });

  it('shows AI label badge for flagged item', async () => {
    render(<ModerationQueuePage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/adult_content/i)).toBeInTheDocument();
    });
  });
});
