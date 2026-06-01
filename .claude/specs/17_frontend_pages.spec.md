# Module 17 — Frontend Pages & Routing

## 1. App Structure

Next.js 15 App Router với i18n routing.

```
apps/client/src/app/
  [locale]/
    (main)/                    # Main layout (header + footer)
      page.tsx                 # Homepage "/"
      products/
        page.tsx               # Product listing
        [slug]/
          page.tsx             # Product detail page
      categories/
        [slug]/
          page.tsx             # Category listing
      search/
        page.tsx               # Search results
      collections/
        [slug]/
          page.tsx             # Collection page
      checkout/
        page.tsx               # Checkout flow
        success/
          page.tsx             # Order success
    (auth)/                    # Auth layout (no header/footer)
      auth/
        login/page.tsx
        register/page.tsx
        forgot-password/page.tsx
        reset-password/page.tsx
        verify-email/page.tsx
        google/callback/page.tsx
    (account)/                 # Account layout (with sidebar)
      account/
        page.tsx               # Dashboard
        profile/page.tsx
        addresses/page.tsx
        orders/
          page.tsx             # Order list
          [id]/page.tsx        # Order detail
        wishlist/page.tsx
```

## 2. Locales

Supported: `en` (English), `vi` (Vietnamese)
Default: `en`

Messages location:
```
apps/client/messages/
  en/
    common.json
    product.json
    cart.json
    checkout.json
    account.json
    auth.json
    customizer.json
  vi/
    (same structure)
```

i18n library: `next-intl`

## 3. Key Pages

### Homepage (`/[locale]`)
- Server Component
- Sections: Hero, Featured Products, New Arrivals, Category Grid, Testimonials
- Data: `apiClient.get('/products/featured')`, `apiClient.get('/products/new-arrivals')`
- Revalidate: 60s

### Product Listing (`/[locale]/products`)
- Server Component with Client filters
- URL params: `?category=&sort=&minPrice=&maxPrice=&page=`
- `ProductGrid`, `ProductFilters`, `Pagination` components

### Product Detail (`/[locale]/products/[slug]`)
- Server Component + `ProductPageInteractive` (Client Component)
- SSR with `apiClient.get<ProductDto>('/products/[slug]', { next: { revalidate: 60 } })`
- **ProductPageInteractive** wraps:
  - `SmartVariantPicker` — manages variant selection state
  - `ProductActions` — 3-flow system (A/B/C) based on product.isPersonalizable + product.customization
- **ProductTabs** (Server Component):
  - Description tab (always)
  - Specifications tab (when `product.attributes?.length > 0`)
  - Shipping & Returns tab
  - Reviews tab

### Search Results (`/[locale]/search?q=`)
- Client Component (dynamic, no SSR for results)
- `useSearchProducts(q, filters)` hook
- Debounced search, URL sync

### Checkout (`/[locale]/checkout`)
- Client Component (requires auth)
- Multi-step: Address → Shipping → Payment
- Stripe Elements integration
- PayPal SDK integration

### Auth Pages (`/[locale]/auth/*`)
- Client Components
- Google OAuth callback: parse URL params, call `useAuthStore.setTokens()`

### Account Pages (`/[locale]/account/*`)
- Client Components
- Protected route: redirect to login if not authenticated
- Sidebar navigation with active state

## 4. Component Library

File locations:
```
apps/client/src/components/
  layout/
    Header.tsx, Footer.tsx, MegaMenu.tsx, SearchBar.tsx
  product/
    SmartVariantPicker.tsx
    SizeGuideModal.tsx
    ProductActions.tsx
    DirectAddToCartPanel.tsx
    PersonalizationComingSoon.tsx
    ProductTabs.tsx
    ProductImages.tsx
    ProductInfo.tsx
    ProductPageInteractive.tsx
    ProductSpecifications.tsx
    ShippingReturnsContent.tsx
    variant-pickers/
      ColorSwatch.tsx
      SizePicker.tsx
      ShapePicker.tsx
      DeviceModelPicker.tsx
      PillPicker.tsx
  customizer/
    CustomizerPanel.tsx
    BundleCustomizerPanel.tsx
    FieldRenderer.tsx
    PreviewCanvas.tsx
  cart/
    CartDrawer.tsx
    CartItem.tsx
  checkout/
    AddressStep.tsx
    ShippingStep.tsx
    PaymentStep.tsx
  ui/                          # Shared UI (from libs/ui)
    Button, Input, Modal, Badge, Spinner, etc.
```

## 5. Shared UI Library

Nx lib: `@mlh/ui`
Path: `libs/ui/src/`
Components: `Button`, `Input`, `Textarea`, `Select`, `Modal`, `ModalHeader`, `ModalBody`, `Badge`, `Spinner`, `Card`, `Tabs`, etc.

## 6. State Management

| Store | File | Persisted |
|---|---|---|
| auth | `lib/store/auth.store.ts` | `user` (mlh-auth key) |
| cart | `lib/store/cart.store.ts` | `sessionId` (mlh-cart key) |
| customizer | `lib/store/customizer.store.ts` | No |

## 7. Data Fetching Pattern

### Server Components
```typescript
// In page.tsx (server)
const product = await apiClient.get<ProductDto>('/products/my-slug', {
  next: { revalidate: 60, tags: ['product-my-slug'] }
});
```

### Client Components
```typescript
// React Query hooks
const { data, isLoading } = useQuery({
  queryKey: ['products', slug],
  queryFn: () => apiClient.get<ProductDto>(`/products/${slug}`),
});
```

## 8. SEO

- All product/category pages: `generateMetadata()` function
- OG images via dynamic route `/api/og`
- Sitemap: `/sitemap.xml` (generated)
- robots.txt: static in `public/`
