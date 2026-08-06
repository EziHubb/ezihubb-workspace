# Module 17 — Frontend Pages & Routing

## 1. Cấu trúc App

Next.js 16 App Router với i18n routing (next-intl).

```
apps/client/src/app/
  [locale]/
    layout.tsx
    error.tsx
    not-found.tsx

    (storefront)/           # Layout: Navbar + Footer + MegaMenu
      layout.tsx
      loading.tsx
      page.tsx              # Homepage "/"

      products/
        page.tsx            # All products listing (with filters)
        [slug]/
          page.tsx          # Product detail
          opengraph-image.tsx
          customize/
            layout.tsx
            page.tsx        # Full-screen customizer

      categories/[slug]/page.tsx
      collections/
        page.tsx            # All collections
        [slug]/page.tsx     # Collection landing

      occasions/
        page.tsx            # Occasions index
        [slug]/page.tsx     # Occasion products

      search/page.tsx       # Search results (Client Component)

      cart/
        layout.tsx
        page.tsx

      checkout/
        layout.tsx
        page.tsx
        success/page.tsx

      orders/
        [orderNumber]/page.tsx   # Guest/public order detail
        track/
          layout.tsx
          page.tsx               # Guest order tracking

      shops/[slug]/page.tsx      # Store detail (Featured/All/Reviews/About tabs)

      gift-cards/page.tsx
      open-shop/page.tsx         # Apply for store; shows pending/rejected states

      creators/page.tsx          # Creator network landing

      affiliate/
        page.tsx                 # Affiliate landing
        register/page.tsx
        (portal)/
          layout.tsx
          dashboard/page.tsx
          links/page.tsx
          payouts/page.tsx

      wishlist/[token]/page.tsx  # Public shared wishlist (noindex SSR)

      pages/                     # Static content pages
        about/page.tsx
        careers/page.tsx
        contact/page.tsx
        faq/page.tsx
        how-it-works/page.tsx
        our-story/page.tsx
        privacy-policy/page.tsx
        returns/page.tsx
        reviews/page.tsx
        shipping-info/page.tsx
        terms/page.tsx

    (account)/              # Layout: sidebar nav; all routes protected
      layout.tsx
      AccountLayoutClient.tsx
      error.tsx
      account/
        layout.tsx
        page.tsx            # Dashboard overview
        profile/page.tsx
        addresses/page.tsx
        orders/
          page.tsx
          [orderNumber]/
            page.tsx
            tracking/page.tsx
        wishlist/page.tsx
        messages/page.tsx
        referrals/
          page.tsx
          earnings/page.tsx
          payouts/page.tsx
        creator/
          page.tsx
          earnings/page.tsx
          payouts/page.tsx

    (seller)/               # Seller portal (shop owner routes within client app)
      seller/
        page.tsx            # Seller overview / hub
        orders/page.tsx
        payouts/page.tsx
        products/page.tsx
        reviews/page.tsx
        store/page.tsx

    (auth)/                 # Auth layout (no nav, noindex)
      layout.tsx
      AuthLayoutClient.tsx
      login/layout.tsx + page.tsx
      register/layout.tsx + page.tsx
      forgot-password/layout.tsx + page.tsx
      reset-password/layout.tsx + page.tsx
      auth/google/callback/page.tsx

  api/
    auth/[...nextauth]/route.ts
    health/route.ts
    hello/route.ts
  firebase-messaging-sw.js/route.ts  # Dynamic SW for FCM
  page.tsx          # Root redirect to [locale]
  layout.tsx
  not-found.tsx
  global-error.tsx
```

> **Quan trọng:** Route `/my-shop` không tồn tại. Shop owner có 2 routes: `/seller` (seller portal trong client app) và admin dashboard tại `NEXT_PUBLIC_ADMIN_URL`. Navbar hiển thị link "Sell" → `/open-shop` (buyer) hoặc "My Shop" → admin URL (seller). SUPER_ADMIN truy cập full admin panel; ADMIN role truy cập seller-scoped admin panel.

## 2. Locales

Supported: `en` (English), `vi` (Vietnamese)
Default: `en`
Library: `next-intl`

Messages location:

Namespaces are loaded and merged in `apps/client/src/i18n/request.ts` — one JSON file per namespace per locale.

```
apps/client/messages/
  en/
    site.json, nav.json, footer.json, home.json, customizer.json,
    orderTracking.json, common.json, errors.json, collections.json,
    occasions.json, product.json, cart.json, checkout.json,
    account.json, creator.json
  vi/, zh/
    (cùng cấu trúc — vi đã dịch đầy đủ, zh dịch một phần)
```

## 3. Key Pages

### Homepage (`/[locale]`)

- Server Component
- Sections: `HeroBanner`, `MobileHeroCarousel`, `TrendingProducts`, `CategoryShowcase`, `CollectionsGrid`, `CreatorNetworkCta`, `OpenShopCta`, `HowItWorks`, `FeaturedReviews`, `SocialProof`, `NewsletterSection`
- `GET /products/trending` (top 12), category data

### Product Detail (`/[locale]/products/[slug]`)

- Server Component + `ProductPageInteractive` (Client)
- SSR với revalidate: 60s
- Components: `ProductGallery`, `ProductGalleryColumn`, `ProductInfo`, `SmartVariantPicker`, `ProductPurchasePanel`, `ProductActions`
- `ProductTabs`: Description, Specifications, Shipping & Returns, Reviews, Q&A
- Related: `RelatedProducts`, `YouMayAlsoLike`, `MoreFromShop`, `SellerCard`

### Customizer (`/[locale]/products/[slug]/customize`)

- Dedicated full-screen layout
- Fabric.js canvas
- `CustomizerPanel` hoặc `BundleCustomizerPanel`

### Store Detail (`/[locale]/shops/[slug]`)

- Etsy-like tabs: Featured / All / Reviews / About
- `StoreReviewsClient.tsx` xử lý reviews tab
- Sort enum: `newest`, `price_asc`, `price_desc`, `popular`

### Open Shop (`/[locale]/open-shop`)

- Buyer apply to become seller
- Hiển thị trạng thái `pending` và `rejected`

### Checkout (`/[locale]/checkout`)

- Client Component (auth required)
- Steps: `DeliveryForm` → `ShippingForm` → `PaymentForm`
- Panels: `AffiliateDiscountBanner`, `GiftOptionsSection`, `ExpressPayStrip`
- **Không có Apple Pay**

### Account Pages

- Protected: redirect to login nếu chưa auth
- `AccountSidebar` với active state

## 4. Navbar & Layout

File: `apps/client/src/components/layout/Navbar.tsx`

- Hai row: logo/search/icons + category nav (desktop)
- Desktop header: **LocaleSwitcher** (ngôn ngữ), Wishlist, Cart, "Sell"/"My Shop" link, UserMenu
- **CurrencyPicker KHÔNG còn trong Navbar** (component vẫn tồn tại nhưng không được mount trong Navbar/MobileNavDrawer)
- `CurrencyProvider` vẫn wrap toàn app trong `[locale]/layout.tsx`
- Mobile: hamburger → `MobileNavDrawer` (có LocaleSwitcher, không có CurrencyPicker)
- Category nav fallback links: Search, Collections, Occasions, Gift Cards

## 5. Component Library

```
apps/client/src/components/
  layout/
    Navbar.tsx, MegaMenu.tsx, MobileNavDrawer.tsx, MobileBottomNav.tsx,
    CurrencyPicker.tsx, LocaleSwitcher.tsx, Footer.tsx, CartDrawer.tsx
  product/
    SmartVariantPicker.tsx, ProductActions.tsx, ProductGallery.tsx,
    ProductGalleryColumn.tsx, ProductInfo.tsx, ProductPageInteractive.tsx,
    ProductPurchasePanel.tsx, ProductTabs.tsx, ProductSpecifications.tsx,
    ProductAccordions.tsx, ProductBreadcrumb.tsx, ProductCard.tsx,
    ProductAttributeList.tsx, ProductQandA.tsx, RelatedProducts.tsx,
    YouMayAlsoLike.tsx, MoreFromShop.tsx, ReviewSection.tsx, ReviewsSection.tsx,
    ShippingReturnsContent.tsx, SizeGuideModal.tsx, VariantPicker.tsx,
    ShareButton.tsx, SellerCard.tsx, PersonalizationComingSoon.tsx,
    MobileStickyCartBar.tsx
    variant-pickers/
      ColorSwatchPicker.tsx, SizePicker.tsx, ShapePicker.tsx, DeviceModelPicker.tsx
  customizer/
    Canvas.tsx, FabricCanvas.tsx, CustomizerProvider.tsx, CustomizerPanel.tsx,
    BundleCustomizerPanel.tsx, TextFieldInput.tsx, StylePickerGrid.tsx,
    PreviewModal.tsx, AutoFillBanner.tsx, ImageUploadField.tsx,
    MobileCustomizerCanvas.tsx, ArtStylePicker.tsx
    steps/
      Step1BasicInfo.tsx, Step2PhotoUpload.tsx, Step3StylePicker.tsx
  cart/
    CartDrawer.tsx, CartItemRow.tsx, OrderSummary.tsx
  checkout/
    DeliveryForm.tsx, ShippingForm.tsx, PaymentForm.tsx, StepIndicator.tsx,
    AffiliateDiscountBanner.tsx, ExpressPayStrip.tsx, GiftOptionsSection.tsx
  listing/
    ProductListingLayout.tsx, ProductGrid.tsx, FilterSidebar.tsx,
    FilterSheet.tsx, SortDropdown.tsx, ListingLoadingSkeleton.tsx
  home/
    HeroBanner.tsx, MobileHeroCarousel.tsx, TrendingProducts.tsx,
    CategoryShowcase.tsx, CollectionsGrid.tsx, HowItWorks.tsx,
    FeaturedReviews.tsx, SocialProof.tsx, NewsletterSection.tsx,
    NewsletterForm.tsx, CreatorNetworkCta.tsx, OpenShopCta.tsx
  orders/
    OrderDetailClient.tsx (trong account pages)
  campaign/
    CampaignBannerBar.tsx, CountdownTimer.tsx, UrgencyBadge.tsx,
    SeasonalBanner.tsx, OneClickCTA.tsx, ProgressFill.tsx
  search/
    SearchInput.tsx, SearchResults.tsx, NoResults.tsx, SearchNoResults.tsx,
    SearchFilterSidebar.tsx, SearchProductCard.tsx, SearchProductGrid.tsx,
    SearchTopBar.tsx, MobileFilterSheet.tsx, RecentlyViewedPanel.tsx,
    RelatedSearches.tsx, ShopCustomizableIdeas.tsx
  seller/
    SellerScoreCard.tsx, SellerSidebar.tsx
  stores/
    StoreScorePopover.tsx
  account/
    AccountSidebar.tsx
  seo/
    BreadcrumbStructuredData.tsx, ProductStructuredData.tsx,
    FAQStructuredData.tsx, OrganizationStructuredData.tsx,
    WebsiteStructuredData.tsx, ReviewsPageStructuredData.tsx
  providers/
    AuthProvider.tsx, AuthInitializer.tsx, NextAuthProvider.tsx,
    Providers.tsx, ReactQueryProvider.tsx, SessionSyncer.tsx,
    WebVitals.tsx, AffiliateTracker.tsx
  analytics/
    CookieConsentBanner.tsx, MetaPixel.tsx
  skeletons/ (nhiều skeleton components)
  states/
    EmptyState.tsx, NotFound.tsx, NetworkError.tsx, PageError.tsx
  ui/
    ToastContainer.tsx
  faq/
    FAQAccordionList.tsx, FAQSearchBar.tsx
  collections/
    CollectionHero.tsx, RelatedCollections.tsx
```

## 6. Shared UI Library (`@ezihubb/ui`)

Nx lib: `libs/ui/src/`
Components: `Avatar`, `Badge`, `BottomNav`, `Button`, `Input`, `Modal`, `Pagination`, `ProductCard`, `RatingStars`, `Skeleton`, `Textarea`, `Toast`

## 7. State Management

| Store      | File                            | Persisted                      |
| ---------- | ------------------------------- | ------------------------------ |
| auth       | `lib/store/auth.store.ts`       | `user` (mlh-auth key)          |
| cart       | `lib/store/cart.store.ts`       | `sessionId` (ezihubb-cart key)   |
| customizer | `lib/store/customizer.store.ts` | No (volatile)                  |
| toast      | `lib/store/toast.store.ts`      | No                             |

## 8. Data Fetching Pattern

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

## 9. Admin App

All pages: `apps/admin/src/app/(admin)/`

| Section | Routes |
|---|---|
| Core | dashboard, orders/[id], products/new|[id]/edit|copy|import|seo, stores/[id]|[id]/permissions, stores/settings, settings/fulfillment, settings/api-keys |
| Catalog (SUPER_ADMIN only) | catalog/categories|collections|tags|shop-sections|production-partners |
| Customers (SUPER_ADMIN only) | customers/[id] |
| Finance | payments, payouts, finance |
| Affiliates (SUPER_ADMIN only) | affiliates/[id]|payouts, settings/affiliates |
| Referrals (SUPER_ADMIN only) | referrals/users|payouts|settings |
| Creators (SUPER_ADMIN only) | creators/members|payouts|settings |
| Campaigns (SUPER_ADMIN only) | campaigns |
| Moderation (SUPER_ADMIN only) | moderation/queue|rules|history|ip-scan|settings |
| Settings (SUPER_ADMIN only) | settings/audit-log |
| Promotions | promotions, reviews, shipping |
| Stats | stats/listings/[id] |
| Messages | messages/conversations |

**Permission scoping:** Shop owner (ADMIN role) dùng cùng admin routes; API scope data bằng `storeId`. `SUPER_ADMIN_ONLY_PREFIXES`: `/catalog`, `/customers`, `/payments`, `/campaigns`, `/affiliates`, `/creators`, `/moderation`, `/settings`, `/referrals`, `/finance`.

## 10. SEO & Analytics

- `generateMetadata()` trên tất cả product/category/collection pages
- GA4, GTM, Meta Pixel via `apps/client/src/components/analytics/` + layout scripts
- Structured data: `BreadcrumbStructuredData.tsx`, `ProductStructuredData.tsx`, `FAQStructuredData.tsx`
- Sitemap: `apps/client/src/app/sitemap.ts` (dynamic)
- Robots: `apps/client/src/app/robots.ts`
- Noindex layouts: auth + account pages
- Hotjar: `NEXT_PUBLIC_HOTJAR_ID`, `NEXT_PUBLIC_HOTJAR_SV`
- WebVitals → GA4 via `WebVitals.tsx` provider
- `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID` env vars
