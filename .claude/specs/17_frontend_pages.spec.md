# Module 17 — Frontend Pages & Routing

## 1. App Structure

Next.js 16 App Router với i18n routing (next-intl).

```
apps/client/src/app/
  [locale]/
    layout.tsx
    (storefront)/               # Main layout (Navbar + Footer + MegaMenu)
      layout.tsx
      loading.tsx
      page.tsx                  # Homepage "/"
      products/
        page.tsx                # Product listing (/products)
        [slug]/
          page.tsx              # Product detail
          customize/
            layout.tsx
            page.tsx            # Full-screen customizer
      categories/
        [slug]/
          page.tsx              # Category listing
      collections/
        page.tsx                # All collections
        [slug]/
          page.tsx              # Collection landing page
      occasions/
        page.tsx                # Occasions index
        [slug]/
          page.tsx              # Occasion products
      search/
        page.tsx                # Search results
      cart/
        layout.tsx
        page.tsx                # Cart page
      checkout/
        layout.tsx
        page.tsx                # Checkout flow
        success/
          page.tsx              # Order success
      orders/
        [orderNumber]/
          page.tsx              # Guest/public order detail
        track/
          layout.tsx
          page.tsx              # Guest order tracking
      gift-cards/
        page.tsx                # Gift cards page
      pages/                    # Static content pages
        about/page.tsx
        careers/page.tsx
        contact/page.tsx
        faq/page.tsx
        how-it-works/page.tsx
        our-story/page.tsx
        returns/page.tsx
        reviews/page.tsx
        shipping-info/page.tsx
    (account)/                  # Account layout (sidebar nav)
      layout.tsx
      AccountLayoutClient.tsx
      account/
        layout.tsx
        page.tsx                # Dashboard overview
        profile/page.tsx
        addresses/page.tsx
        orders/
          page.tsx              # Order list
          [orderNumber]/
            page.tsx            # Order detail
        wishlist/page.tsx
    (auth)/                     # Auth layout (no nav)
      layout.tsx
      AuthLayoutClient.tsx
      login/
        layout.tsx
        page.tsx
      register/
        layout.tsx
        page.tsx
      forgot-password/
        layout.tsx
        page.tsx
      reset-password/
        layout.tsx
        page.tsx
      auth/google/callback/page.tsx
```

## 2. Locales

Supported: `en` (English), `vi` (Vietnamese)
Default: `en`
Library: `next-intl`

Messages location:

```
apps/client/messages/
  en/
    common.json, product.json, cart.json, checkout.json,
    account.json, auth.json, customizer.json
  vi/
    (same structure)
```

## 3. Key Pages

### Homepage (`/[locale]`)

- Server Component
- Sections: HeroBanner, TrendingProducts, CategoryShowcase, CollectionsGrid, HowItWorks, FeaturedReviews, SocialProof, NewsletterSection
- `GET /products/trending` (top 12), category data

### Product Listing (`/[locale]/products`)

- Server Component with Client filters
- Components: `ProductListingLayout`, `FilterSidebar`, `FilterSheet` (mobile), `ProductGrid`, `SortDropdown`, `Pagination`

### Product Detail (`/[locale]/products/[slug]`)

- Server Component + `ProductPageInteractive` (Client)
- SSR with revalidate: 60s
- Components: `ProductGallery`, `ProductInfo`, `SmartVariantPicker`, `ProductActions`
- `ProductTabs` (Description, Specifications, Shipping & Returns, Reviews)

### Full-Screen Customizer (`/[locale]/products/[slug]/customize`)

- Dedicated full-screen layout
- Fabric.js canvas
- `CustomizerPanel` or `BundleCustomizerPanel`

### Search Results (`/[locale]/search`)

- Client Component (dynamic)
- `SearchInput`, `SearchResults`, `NoResults`
- Debounced search, URL sync, facet filters

### Checkout (`/[locale]/checkout`)

- Client Component (requires auth)
- Steps: `DeliveryForm` → `ShippingForm` → `PaymentForm`
- `StepIndicator` component

### Order Tracking (`/[locale]/orders/track`)

- Public page — guest can look up by `orderNumber + email`

### Account Pages

- Protected: redirect to login if not authenticated
- `AccountSidebar` with active state

## 4. Component Library

```
apps/client/src/components/
  layout/
    Navbar.tsx, MegaMenu.tsx, MobileNavDrawer.tsx, MobileBottomNav.tsx
  product/
    SmartVariantPicker.tsx, ProductActions.tsx, ProductGallery.tsx,
    ProductInfo.tsx, ProductPageInteractive.tsx, ProductTabs.tsx,
    ProductCard.tsx, ProductSpecifications.tsx, RelatedProducts.tsx,
    ReviewSection.tsx, ShippingReturnsContent.tsx, SizeGuideModal.tsx,
    VariantPicker.tsx, ProductAttributeList.tsx
    variant-pickers/
      ColorSwatchPicker.tsx, SizePicker.tsx, ShapePicker.tsx,
      DeviceModelPicker.tsx
  customizer/
    Canvas.tsx, FabricCanvas.tsx, CustomizerProvider.tsx, CustomizerPanel.tsx,
    BundleCustomizerPanel.tsx, TextFieldInput.tsx, StylePickerGrid.tsx,
    PreviewModal.tsx, AutoFillBanner.tsx, ImageUploadField.tsx,
    MobileCustomizerCanvas.tsx
    steps/
      Step1BasicInfo.tsx, Step2PhotoUpload.tsx, Step3StylePicker.tsx
  cart/
    CartDrawer.tsx, CartItemRow.tsx, OrderSummary.tsx
  checkout/
    DeliveryForm.tsx, ShippingForm.tsx, PaymentForm.tsx, StepIndicator.tsx
  listing/
    ProductListingLayout.tsx, ProductGrid.tsx, FilterSidebar.tsx,
    FilterSheet.tsx, SortDropdown.tsx, ListingLoadingSkeleton.tsx
  home/
    HeroBanner.tsx, TrendingProducts.tsx, CategoryShowcase.tsx,
    CollectionsGrid.tsx, HowItWorks.tsx, FeaturedReviews.tsx,
    SocialProof.tsx, NewsletterSection.tsx, NewsletterForm.tsx
  orders/
    OrderDetailClient.tsx, OrderStatusTimeline.tsx, OrderTrackingCard.tsx,
    CancelCountdown.tsx
  modals/
    AddressModal.tsx, ReviewModal.tsx, QuickViewModal.tsx,
    ImageCropModal.tsx, GiftCardBalanceModal.tsx, ConfirmModal.tsx
  search/
    SearchInput.tsx, SearchResults.tsx, NoResults.tsx
  skeletons/ (various loading states)
  states/
    EmptyState.tsx, NotFound.tsx, NetworkError.tsx, PageError.tsx
  account/
    AccountSidebar.tsx
```

## 5. Shared UI Library (`@mlh/ui`)

Nx lib: `libs/ui/src/`
Components: `Avatar`, `Badge`, `BottomNav`, `Button`, `Input`, `Modal`, `Pagination`, `ProductCard`, `RatingStars`, `Skeleton`, `Textarea`, `Toast`

## 6. State Management

| Store      | File                            | Persisted                    |
| ---------- | ------------------------------- | ---------------------------- |
| auth       | `lib/store/auth.store.ts`       | `user` (mlh-auth key)        |
| cart       | `lib/store/cart.store.ts`       | `sessionId` (daisy-cart key) |
| customizer | `lib/store/customizer.store.ts` | No (volatile)                |
| toast      | `lib/store/toast.store.ts`      | No                           |

## 7. Data Fetching Pattern

### Server Components

```typescript
const product = await apiClient.get<ProductDto>('/products/my-slug', {
  next: { revalidate: 60, tags: ['product-my-slug'] },
});
```

### Client Components (React Query)

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['products', slug],
  queryFn: () => apiClient.get<ProductDto>(`/products/${slug}`),
});
```

## 8. SEO & Analytics

- `generateMetadata()` on all product/category/collection pages
- GA4, GTM, Meta Pixel via `apps/client/src/components/seo/` and layout scripts
- Structured data: `BreadcrumbStructuredData.tsx`, Product JSON-LD
- FAQ structured data (`@type: FAQPage`) on product Q&A section
- Sitemap: `apps/client/src/app/sitemap.ts` (dynamic)
- Robots: `apps/client/src/app/robots.ts`
- Noindex layouts for auth/account pages
- `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID` env vars
- Hotjar: `NEXT_PUBLIC_HOTJAR_ID`, `NEXT_PUBLIC_HOTJAR_SV` (see `29_admin_extended.spec.md`)
- WebVitals → GA4 via web vitals reporting

## 9. Additional Routes (Post-Phase 1)

### Storefront New Routes

```
[locale]/
  (storefront)/
    creators/
      page.tsx              # Creator network landing (/creators)
      [username]/
        page.tsx            # Creator public profile
    wishlists/
      shared/
        [token]/
          page.tsx          # Public shared wishlist (noindex SSR)
    nft/
      page.tsx              # NFT drops listing
      drops/
        [id]/
          page.tsx          # NFT drop detail + claim
      memberships/
        page.tsx            # NFT membership tiers
    gift-cards/
      purchase/
        page.tsx            # Buy gift card as product
```

### Account New Routes

```
[locale]/
  (account)/
    account/
      messages/
        page.tsx            # Message inbox list
        [threadId]/
          page.tsx          # Thread detail + reply
      loyalty/
        page.tsx            # Loyalty points dashboard
      referrals/
        page.tsx            # Referral hub + tree
      affiliate/
        page.tsx            # Affiliate self-serve portal
      creator/
        page.tsx            # Creator dashboard
        designs/
          page.tsx          # Design portfolio
          new/page.tsx      # Upload new design
        earnings/page.tsx   # Earnings + payout
        profile/page.tsx    # Edit public profile
```

### Service Worker Route

```
firebase-messaging-sw.js/
  route.ts                  # Dynamic SW serving FCM config
```

## 10. Additional Components (Post-Phase 1)

```
apps/client/src/components/
  currency/
    CurrencyPicker.tsx        # Currency selector in navbar
    CurrencyProvider.tsx      # Context provider
  referral/
    ReferralSharePanel.tsx    # Copy link + social share
  loyalty/
    PointsCard.tsx            # Points balance display
    PointsHistory.tsx         # Transaction history
  creators/
    CreatorCard.tsx           # Public creator card
    CreatorGrid.tsx           # Grid of creators
    CreatorCTASection.tsx     # Homepage CTA
  nft/
    NftDropCard.tsx           # Drop listing card
    NftClaimModal.tsx         # Claim flow modal
    WalletConnectButton.tsx   # Crypto wallet connect
  product/
    QaSection.tsx             # Q&A tab component
    QaAskForm.tsx             # Ask question form
  push/
    NotificationPermission.tsx # FCM permission request UI
```

## 11. i18n Message Files (Extended)

```
apps/client/messages/
  en/
    common.json, product.json, cart.json, checkout.json,
    account.json, auth.json, customizer.json,
    loyalty.json, referral.json, messages.json,
    creators.json, nft.json
  vi/
    (same structure — all keys translated)
```
