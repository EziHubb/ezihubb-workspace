// Core HTTP client + token configuration
export * from './client';   // api, apiFetch, setBaseUrl, setTokenGetter, setTokenUpdater

// Centralized query keys
export * from './queryKeys';

// ── Query hooks ───────────────────────────────────────────────────────────────

// Products
export * from './hooks/useProducts';   // useProducts, useProduct, useRelatedProducts, usePrefetchProduct

// Catalog
export * from './hooks/useCatalog';    // useCategories, useCategory, useCollections, useCollection

// Cart
export * from './hooks/useCart';       // useCart
export * from './hooks/useMutateCart'; // useMutateCart

// Orders
export * from './hooks/useOrders';     // useOrders, useOrder, useCancelOrder

// Checkout
export * from './hooks/useCheckout';   // useCheckout

// Wishlist
export * from './hooks/useWishlist';        // useWishlist
export * from './hooks/useMutateWishlist';  // useMutateWishlist (direct add/remove)
export * from './hooks/useWishlistToggle';  // useWishlistToggle (debounced + instant visual)

// Search
export * from './hooks/useSearch';     // useSearch, useSearchSuggestions

// Reviews
export * from './hooks/useReviews';    // useReviews, useReviewSummary

// Newsletter
export * from './hooks/useNewsletter'; // useNewsletterSubscribe

// Shipping
export * from './hooks/useShipping';   // useShippingEstimate

// Profile & Addresses
export * from './hooks/useProfile';    // useProfile, useMutateProfile, useAddresses, useMutateAddresses

