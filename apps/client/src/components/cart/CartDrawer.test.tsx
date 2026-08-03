import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartDrawer } from './CartDrawer';

// ── Mock next/image ───────────────────────────────────────────────────────────
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, ...rest }: { src: string; alt: string; fill?: boolean; [k: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}));

// ── Mock next/link ────────────────────────────────────────────────────────────
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

// ── Mock next-intl ────────────────────────────────────────────────────────────
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      'drawer.title':          'Your Cart',
      'drawer.close':          'Close cart',
      'drawer.empty':          'Your cart is empty',
      'drawer.browseProducts': 'Browse products →',
      'drawer.subtotal':       'Subtotal',
      'drawer.shippingNote':   'Shipping calculated at checkout',
      'drawer.discount':       `Discount (${params?.couponCode ?? ''})`,
      'drawer.checkout':       `Checkout — $${params?.amount ?? ''}`,
      'item.priceUpdated':     'Price updated',
      'item.decreaseQty':      'Decrease quantity',
      'item.increaseQty':      'Increase quantity',
      'item.remove':           `Remove ${params?.name ?? ''}`,
      'itemCount':             `${params?.count ?? 0} ${(params?.count as number) === 1 ? 'item' : 'items'}`,
    };
    return map[key] ?? key;
  },
}));

// ── Mock @ezihubb/api-client hooks ────────────────────────────────────────────────
const mockUpdateItemMutate = jest.fn();
const mockRemoveItemMutate = jest.fn();

jest.mock('@ezihubb/api-client', () => ({
  useCart:       jest.fn(),
  useMutateCart: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useCart, useMutateCart } = require('@ezihubb/api-client');

// ── Test data ─────────────────────────────────────────────────────────────────
const mockCartData = {
  id:             'cart-001',
  couponCode:     null,
  discountAmount: null,
  items: [
    {
      id:                'item-001',
      productId:         'prod-001',
      productName:       'Custom Photo Mug',
      productSlug:       'custom-photo-mug',
      productImageUrl:   null,
      variantId:         'var-001',
      variantName:       'Red / M',
      variantOptions:    { Color: 'Red', Size: 'M' },
      quantity:          2,
      unitPrice:         29.99,
      currentPrice:      29.99,
      priceChanged:      false,
      customizationData: null,
      previewUrl:        null,
    },
    {
      id:                'item-002',
      productId:         'prod-002',
      productName:       'Personalized Frame',
      productSlug:       'personalized-frame',
      productImageUrl:   'https://example.com/frame.jpg',
      variantId:         null,
      variantName:       null,
      variantOptions:    null,
      quantity:          1,
      unitPrice:         49.99,
      currentPrice:      49.99,
      priceChanged:      false,
      customizationData: null,
      previewUrl:        null,
    },
    {
      id:                'item-003',
      productId:         'prod-003',
      productName:       'Engraved Keychain',
      productSlug:       'engraved-keychain',
      productImageUrl:   null,
      variantId:         'var-003',
      variantName:       'Gold',
      variantOptions:    null,
      quantity:          1,
      unitPrice:         14.99,
      currentPrice:      14.99,
      priceChanged:      false,
      customizationData: null,
      previewUrl:        'https://example.com/preview.jpg',
    },
  ],
  totals: { subtotal: 124.96, discount: 0, shipping: 0, total: 124.96, itemCount: 4 },
};

const emptyCartData = {
  id:             'cart-001',
  couponCode:     null,
  discountAmount: null,
  items:          [],
  totals:         { subtotal: 0, discount: 0, shipping: 0, total: 0, itemCount: 0 },
};

function setCartMocks(cartData = mockCartData, updatePending = false) {
  (useCart as jest.Mock).mockReturnValue({ data: cartData, isLoading: false });
  (useMutateCart as jest.Mock).mockReturnValue({
    updateItem:  { mutate: mockUpdateItemMutate, isPending: updatePending },
    removeItem:  { mutate: mockRemoveItemMutate, isPending: false },
    addItem:     { mutate: jest.fn(), isPending: false },
    applyCoupon: { mutate: jest.fn(), isPending: false },
    removeCoupon:{ mutate: jest.fn(), isPending: false },
    clearCart:   { mutate: jest.fn(), isPending: false },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('CartDrawer', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setCartMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(<CartDrawer isOpen={false} onClose={onClose} />, { wrapper });
    expect(screen.queryByTestId('cart-drawer')).not.toBeInTheDocument();
  });

  it('shows cart drawer with aria-label when isOpen is true', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByRole('dialog', { name: /your cart/i })).toBeInTheDocument();
  });

  it('shows cart items after data loads', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText('Custom Photo Mug')).toBeInTheDocument();
    expect(screen.getByText('Personalized Frame')).toBeInTheDocument();
  });

  it('shows item count in header', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText(/4 items/)).toBeInTheDocument();
  });

  it('shows subtotal in footer', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText('$124.96')).toBeInTheDocument();
  });

  it('shows empty state when cart has no items', () => {
    setCartMocks(emptyCartData);
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    await userEvent.click(screen.getByTestId('cart-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: /close cart/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls update mutation when quantity increase button is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    const increaseBtn = screen.getAllByRole('button', { name: /increase quantity/i })[0];
    await userEvent.click(increaseBtn);
    expect(mockUpdateItemMutate).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-001' }),
    );
  });

  it('calls remove mutation when the remove button is clicked', async () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    await userEvent.click(screen.getByTestId('remove-item-item-001'));
    expect(mockRemoveItemMutate).toHaveBeenCalledWith('item-001');
  });

  it('disables quantity buttons while an update is pending', () => {
    setCartMocks(mockCartData, true);
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    const increaseBtn = screen.getAllByRole('button', { name: /increase quantity/i })[0];
    expect(increaseBtn).toBeDisabled();
  });

  it('renders variantOptions as "Key: Value" pairs joined by ·', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText('Color: Red · Size: M')).toBeInTheDocument();
  });

  it('falls back to variantName when variantOptions is null', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders previewUrl image when available', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    const images = screen.getAllByRole('img');
    const previewImg = images.find((img) => img.getAttribute('src') === 'https://example.com/preview.jpg');
    expect(previewImg).toBeTruthy();
  });

  it('renders productImageUrl when previewUrl is absent', () => {
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    const images = screen.getAllByRole('img');
    const productImg = images.find((img) => img.getAttribute('src') === 'https://example.com/frame.jpg');
    expect(productImg).toBeTruthy();
  });

  it('shows price-updated warning when priceChanged is true', () => {
    const changedCart = {
      ...mockCartData,
      items: [
        {
          ...mockCartData.items[0],
          unitPrice:    29.99,
          currentPrice: 34.99,
          priceChanged: true,
        },
        ...mockCartData.items.slice(1),
      ],
    };
    setCartMocks(changedCart);
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText('Price updated')).toBeInTheDocument();
  });

  it('shows discount row when coupon is applied', () => {
    const discountedCart = {
      ...mockCartData,
      couponCode:     'SAVE10',
      discountAmount: 10,
      totals: { ...mockCartData.totals, discount: 10 },
    };
    setCartMocks(discountedCart);
    render(<CartDrawer isOpen={true} onClose={onClose} />, { wrapper });
    expect(screen.getByText(/−\$10\.00/)).toBeInTheDocument();
  });
});
