import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// We test the page by rendering it in isolation with mocked API
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StoresPage = require('../page').default;

// Mock the api-client so no real HTTP requests are made
jest.mock('../../../../lib/api-client', () => ({
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

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
  usePathname: () => '/admin/stores',
}));

// Mock @mlh/constants with the values the page actually uses
jest.mock('@mlh/constants', () => ({
  ADMIN_ROUTES: {
    stores: { root: '/admin/stores', detail: (id: string) => `/admin/stores/${id}` },
  },
  API_ROUTES: {
    ADMIN: {
      STORES:        '/admin/stores',
      STORE_APPROVE: (id: string) => `/admin/stores/${id}/approve`,
      STORE_REJECT:  (id: string) => `/admin/stores/${id}/reject`,
      STORE_SUSPEND: (id: string) => `/admin/stores/${id}/suspend`,
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

const mockStoreData = {
  data: [
    {
      id: 'store-1',
      name: 'Test Shop',
      slug: 'test-shop',
      status: 'PENDING',
      planType: 'COMMISSION',
      commissionRate: 0.12,
      totalOrders: 12,
      totalRevenue: 1500,
      owner: { email: 'seller@test.com', firstName: 'Jane', lastName: 'Doe' },
      createdAt: new Date().toISOString(),
    },
  ],
  pagination: { total: 1, page: 1, totalPages: 1 },
};

describe('Admin Stores Page', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockApi = require('../../../../lib/api-client').api;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockStoreData);
  });

  it('renders the page heading', () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Stores')).toBeInTheDocument();
  });

  it('shows store data after API response', async () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Test Shop')).toBeInTheDocument();
    });
  });

  it('shows PENDING status for pending stores', async () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('shows owner email', async () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('seller@test.com')).toBeInTheDocument();
    });
  });

  it('handles empty state when no stores', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, totalPages: 0 },
    });
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No stores found')).toBeInTheDocument();
    });
  });

  it('shows Approve button for PENDING stores', async () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });
  });

  it('shows Reject button for PENDING stores', async () => {
    render(<StoresPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });
  });
});
