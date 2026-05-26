import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartDrawer } from './CartDrawer';

// ── Mock fetch ─────────────────────────────────────────────────────────────────
const mockCartData = {
  id:             'cart-001',
  couponCode:     null,
  discountAmount: null,
  items: [
    {
      id:              'item-001',
      productId:       'prod-001',
      productName:     'Custom Photo Mug',
      productSlug:     'custom-photo-mug',
      productImageUrl: null,
      variantId:       null,
      variantName:     null,
      quantity:        2,
      unitPrice:       29.99,
      currentPrice:    29.99,
      priceChanged:    false,
      customizationData: null,
      previewUrl:      null,
    },
    {
      id:              'item-002',
      productId:       'prod-002',
      productName:     'Personalized Frame',
      productSlug:     'personalized-frame',
      productImageUrl: 'https://example.com/frame.jpg',
      variantId:       null,
      variantName:     null,
      quantity:        1,
      unitPrice:       49.99,
      currentPrice:    49.99,
      priceChanged:    false,
      customizationData: null,
      previewUrl:      null,
    },
  ],
  totals: { subtotal: 109.97, discount: 0, shipping: 0, total: 109.97, itemCount: 3 },
};

const emptyCartData = {
  id:             'cart-001',
  couponCode:     null,
  discountAmount: null,
  items:          [],
  totals:         { subtotal: 0, discount: 0, shipping: 0, total: 0, itemCount: 0 },
};

global.fetch = jest.fn();

function mockFetchResponse(data: unknown, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue({ data }),
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('CartDrawer', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchResponse(mockCartData);
  });

  it('renders nothing when isOpen is false', () => {
    render(<CartDrawer isOpen={false} onClose={onClose} />, { wrapper });
    expect(screen.queryByTestId('cart-drawer')).not.toBeInTheDocument();
  });

  it('shows cart drawer with aria-label when isOpen is true', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByRole('dialog', { name: /shopping cart/i })).toBeInTheDocument();
  });

  it('shows cart items after data loads', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Custom Photo Mug')).toBeInTheDocument();
      expect(screen.getByText('Personalized Frame')).toBeInTheDocument();
    });
  });

  it('shows item count in header', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/3 items/)).toBeInTheDocument();
    });
  });

  it('shows subtotal in footer', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('$109.97')).toBeInTheDocument();
    });
  });

  it('shows empty state when cart has no items', async () => {
    mockFetchResponse(emptyCartData);

    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when the backdrop is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => screen.getByTestId('cart-backdrop'));
    await userEvent.click(screen.getByTestId('cart-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => screen.getByRole('button', { name: /close cart/i }));
    await userEvent.click(screen.getByRole('button', { name: /close cart/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls update mutation when quantity increase button is clicked', async () => {
    const updatedCart = {
      ...mockCartData,
      items: [{ ...mockCartData.items[0], quantity: 3 }, mockCartData.items[1]],
      totals: { ...mockCartData.totals, itemCount: 4 },
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: mockCartData }) })  // initial fetch
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: updatedCart  }) }); // update call

    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => screen.getByText('Custom Photo Mug'));

    const increaseBtn = screen.getAllByRole('button', { name: /increase quantity/i })[0];
    await userEvent.click(increaseBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('calls remove mutation when the remove button is clicked', async () => {
    const cartAfterRemove = {
      ...mockCartData,
      items:  [mockCartData.items[1]],
      totals: { ...mockCartData.totals, itemCount: 1 },
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: mockCartData      }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: cartAfterRemove }) });

    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => screen.getByTestId('remove-item-item-001'));

    await userEvent.click(screen.getByTestId('remove-item-item-001'));

    await waitFor(() => {
      // After removal the fetch count is 2 (initial + delete)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('disables quantity buttons while an update is pending', async () => {
    // Slow mutation — never resolves
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: mockCartData }) })
      .mockReturnValueOnce(new Promise(() => {})); // hangs

    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });

    await waitFor(() => screen.getByText('Custom Photo Mug'));

    const increaseBtn = screen.getAllByRole('button', { name: /increase quantity/i })[0];
    await userEvent.click(increaseBtn);

    // While mutation is pending, the button should be disabled
    await waitFor(() => {
      expect(increaseBtn).toBeDisabled();
    });
  });
});
