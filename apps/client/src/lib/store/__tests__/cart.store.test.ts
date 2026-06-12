import { useCartStore } from '../cart.store';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('useCartStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store
    useCartStore.setState({
      cart: null,
      sessionId: null,
      isLoading: false,
      isDrawerOpen: false,
      _lastMutatedAt: 0,
    });
  });

  it('starts with null cart', () => {
    const state = useCartStore.getState();
    expect(state.cart).toBeNull();
  });

  it('starts with drawer closed', () => {
    const state = useCartStore.getState();
    expect(state.isDrawerOpen).toBe(false);
  });

  it('openDrawer sets isDrawerOpen to true', () => {
    useCartStore.getState().openDrawer();
    expect(useCartStore.getState().isDrawerOpen).toBe(true);
  });

  it('closeDrawer sets isDrawerOpen to false', () => {
    useCartStore.getState().openDrawer();
    useCartStore.getState().closeDrawer();
    expect(useCartStore.getState().isDrawerOpen).toBe(false);
  });

  it('clearCart resets cart to null', () => {
    useCartStore.setState({
      cart: {
        id: 'cart-1',
        items: [{ id: 'item-1', productId: 'p1', productName: 'A',
          productSlug: 'a', unitPrice: 10, quantity: 1, subtotal: 10,
          customizationData: null, variantId: null, previewUrl: null }],
        subtotal: 10,
        coupon: null,
        discount: 0,
        total: 10,
      },
    });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().cart).toBeNull();
  });

  it('initSession creates a sessionId if none exists', () => {
    useCartStore.getState().initSession();
    const { sessionId } = useCartStore.getState();
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');
  });

  it('initSession does not overwrite existing sessionId', () => {
    useCartStore.setState({ sessionId: 'existing-session-id' });
    useCartStore.getState().initSession();
    expect(useCartStore.getState().sessionId).toBe('existing-session-id');
  });
});
