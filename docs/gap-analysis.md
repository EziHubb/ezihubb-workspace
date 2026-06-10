# MapleLoomHandmade — Feature Gap Analysis & Phase Roadmap

**Scan date:** 2026-06-10
**Scanned by:** senior-architect · product-manager · tech-stack-evaluator
**Project:** Nx monorepo — NestJS API + Next.js client + Next.js admin

---

## 1. Codebase Inventory

### 1.1 API Module Status

All modules are registered in `apps/api/src/app/app.module.ts`. Classification is based on actual file content reviewed during this scan.

| Module | Status | Has Controller | Has Service | Has DTOs | Has Tests | Notes |
|--------|--------|----------------|-------------|----------|-----------|-------|
| auth | ✅ COMPLETE | Yes (auth.controller.ts) | Yes (auth.service.ts + totp.service.ts) | Yes (7 DTO files) | Yes (auth.service.spec.ts + auth.integration.spec.ts) | Google OAuth strategy present |
| users | ✅ COMPLETE | Yes (users.controller.ts) | Yes (users.service.ts) | Yes | No | 26 endpoints: profile, addresses, wishlist, FCM tokens, share token |
| catalog | ✅ COMPLETE | Yes (categories + collections + admin controllers) | Yes (catalog.service.ts) | Yes | No | MongoDB mega-menu + Redis cache; admin sync-mega-menu endpoint |
| products | ✅ COMPLETE | Yes (products + admin + csv-import + qa controllers) | Yes (products.service.ts + csv-import + qa + low-stock) | Yes (6 DTO files) | Yes (products.service.spec.ts) | Variation groups, bulk actions, CSV import, Q&A, art styles |
| cart | ✅ COMPLETE | Yes (cart.controller.ts) | Yes (cart.service.ts) | Yes | Yes (cart.service.spec.ts) | Session + auth carts, merge, coupon, totals |
| orders | ✅ COMPLETE | Yes (orders + admin-orders controllers) | Yes (orders.service.ts) | Yes | Yes (orders.service.spec.ts) | Full lifecycle, tracking, label purchase, PDF, cancel |
| payments | ✅ COMPLETE | Yes (payments + webhooks controllers) | Yes (payments.service.ts) | Yes | Yes (stripe-webhook.spec.ts) | Stripe full; PayPal webhook is STUB (see webhooks.controller.ts:36 comment) |
| shipping | ✅ COMPLETE | Yes (shipping + admin-shipping + tracking-webhook controllers) | Yes (shipping + tracking + label services) | Yes | No | EasyPost integration, label purchase, carrier tracking |
| reviews | ✅ COMPLETE | Yes (reviews + admin-reviews + public-reviews controllers) | Yes (reviews.service.ts) | Yes | No | Submit (order-gated), moderation, admin reply, summary endpoint |
| promotions | ✅ COMPLETE | Yes (promotions.controller.ts) | Yes (promotions.service.ts) | Yes | Yes (promotions.service.spec.ts) | Coupon CRUD, validation, flash sale pricing, gift card support |
| search | ✅ COMPLETE | Yes (search.controller.ts) | Yes (search.service.ts) | Yes | No | tsvector full-text, filters, sort |
| affiliates | ✅ COMPLETE | Yes (affiliates + admin-affiliates controllers) | Yes (admin-affiliates + portal + commission + tracking services) | Yes | No | Registration, referral tracking, commission, buyer discount, payouts |
| loyalty | ✅ COMPLETE | Yes (loyalty.controller.ts) | Yes (loyalty.service.ts) | No separate DTO dir | No | Earn/redeem/history, BullMQ auto-confirm, loyalty.config.ts |
| messages | ✅ COMPLETE | Yes (messages + admin-messages controllers) | Yes (messages.service.ts) | Yes | No | 9 endpoints: threads, send, reply, read, admin inbox |
| notifications | ✅ COMPLETE | Yes (notifications.controller.ts) | Yes (notifications + fcm + push services) | No | No | 18 email templates (Handlebars .hbs), FCM push integration |
| customization | ✅ COMPLETE | Yes (customization.controller.ts) | Yes (customization + art-style services) | Yes | No | Canvas editor integration, Replicate AI art styles, R2 storage |
| pdf | ✅ COMPLETE | No separate controller (invoked from orders) | Yes (pdf.service.ts) | No | No | Invoice + packing slip templates (.tsx), R2 cache |
| analytics | ✅ COMPLETE | No HTTP controller | Yes (analytics.service.ts) | No | No | Revenue tracking, search analytics, product views, GA4 MP |
| currency | ✅ COMPLETE | Yes (currency.controller.ts) | Yes (currency.service.ts) | No | No | Exchange rates, CurrencyProvider, CurrencyPicker |
| admin | 🟡 PARTIAL | Yes (admin.controller.ts — dashboard only) | Yes (admin.service.ts) | Yes | No | Only 5 dashboard endpoints; **customer management, settings, team, email-template, cache, export endpoints referenced in constants but not implemented in API** |
| assets | ✅ COMPLETE | Yes (assets.controller.ts) | StorageService (CommonModule) | No | No | Presigned R2 upload URL endpoint |
| tax | ✅ COMPLETE | No HTTP controller | Yes (tax.service.ts) | Yes | No | TaxJar integration, preview endpoint in orders module |
| unsubscribe | ✅ COMPLETE | Yes (unsubscribe.controller.ts) | Inline (uses PrismaService) | No | No | Cart email opt-out; registered directly in AppModule |
| database (MongoDB) | ✅ COMPLETE | N/A (infrastructure module) | MongooseModule | No | No | Mega-menu document schema |
| queue | ✅ COMPLETE | N/A (infrastructure) | 5 processors + scheduler | No | No | email, order, image (art-style/BG-removal), abandoned-cart, low-stock |

### 1.2 Client Routes

All routes are under `apps/client/src/app/[locale]/`.

| Route | Status | Notes |
|-------|--------|-------|
| `/` (home) | ✅ Real content | 117 lines, featured products, CTA |
| `/login` | ✅ Real content | Auth form |
| `/register` | ✅ Real content | Registration form |
| `/forgot-password` | ✅ Real content | Forgot password form |
| `/reset-password` | ✅ Real content | Reset password form |
| `/auth/google/callback` | ✅ Real content | OAuth token handler |
| `/products` | ✅ Real content | Product listing |
| `/products/[slug]` | ✅ Real content | 235 lines, rich PDP with variants, Q&A, reviews |
| `/products/[slug]/customize` | ✅ Real content | Canvas customizer |
| `/categories/[slug]` | ✅ Real content | Category listing |
| `/collections` | ✅ Real content | Collections listing |
| `/collections/[slug]` | ✅ Real content | 193 lines |
| `/occasions` | ✅ Real content | Occasions listing page |
| `/occasions/[slug]` | ✅ Real content | Re-exports from collections slug |
| `/cart` | ✅ Real content | 143 lines, CartDrawer, coupon |
| `/checkout` | ✅ Real content | 587 lines, 3-step checkout |
| `/checkout/success` | ✅ Real content | 351 lines, confirmation |
| `/orders/[orderNumber]` | ✅ Real content | Order detail |
| `/orders/track` | ✅ Real content | Guest order tracking |
| `/gift-cards` | ✅ Real content | 569 lines — UI complete; backend endpoint `/payments/gift-cards/purchase` is **missing** ⚠️ |
| `/search` | ✅ Real content | 30-line wrapper + 240-line SearchPageClient |
| `/affiliate` | ✅ Real content | Affiliate landing page |
| `/affiliate/register` | ✅ Real content | Registration form |
| `/affiliate/(portal)/dashboard` | ✅ Real content | Affiliate portal dashboard |
| `/affiliate/(portal)/links` | ✅ Real content | Referral links management |
| `/affiliate/(portal)/payouts` | ✅ Real content | Payout request form |
| `/account` | ✅ Real content | Account overview |
| `/account/profile` | ✅ Real content | Profile management |
| `/account/addresses` | ✅ Real content | Address book CRUD |
| `/account/orders` | ✅ Real content | Order history |
| `/account/orders/[orderNumber]` | ✅ Real content | Order detail |
| `/account/wishlist` | ✅ Real content | Wishlist |
| `/account/messages` | ✅ Real content | Messages inbox |
| `/account/loyalty` | ✅ Real content | Loyalty points dashboard |
| `/wishlist/[token]` | ✅ Real content | Public shared wishlist (noindex) |
| `/pages/about` | ✅ Real content | About page |
| `/pages/careers` | ✅ Real content | Careers page |
| `/pages/contact` | ✅ Real content | Contact form (ContactForm component) |
| `/pages/faq` | ✅ Real content | FAQ with structured data |
| `/pages/how-it-works` | ✅ Real content | How it works |
| `/pages/our-story` | ✅ Real content | Our story |
| `/pages/returns` | ✅ Real content | Returns policy |
| `/pages/reviews` | ✅ Real content | Global reviews page |
| `/pages/shipping-info` | ✅ Real content | Shipping information |
| Root `/` redirect | ✅ Real content | Redirects to `/en` |

### 1.3 Admin Routes

All routes are under `apps/admin/src/app/`.

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | ✅ Real content | 171 lines, NextAuth credentials |
| `/totp-setup` | ✅ Real content | 270 lines, TOTP setup wizard |
| `/totp-verify` | ✅ Real content | TOTP challenge page |
| Root `/` | ✅ Real content | Redirects to /dashboard |
| `/dashboard` | ✅ Real content | 207 lines, KPIs + charts + SEO health |
| `/products` | ✅ Real content | Product list + DataTable + bulk actions |
| `/products/new` | ✅ Real content | Multi-tab product creation form |
| `/products/[id]/edit` | ✅ Real content | Product edit form |
| `/products/copy/[id]` | ✅ Real content | Duplicate product |
| `/products/import` | ✅ Real content | 446 lines, CSV drag-drop import |
| `/products/seo` | ✅ Real content | 312 lines, SEO health table |
| `/catalog/categories` | ✅ Real content | 588 lines, category tree CRUD |
| `/catalog/collections` | ✅ Real content | Collections management |
| `/orders` | ✅ Real content | Order list + filters |
| `/orders/[id]` | ✅ Real content | Order detail + status transitions |
| `/customers` | 🟡 PARTIAL | UI calls `/admin/customers` — **API endpoint missing** ⚠️ |
| `/customers/[id]` | 🟡 PARTIAL | Customer detail page — **API endpoint missing** ⚠️ |
| `/reviews` | ✅ Real content | Review moderation queue |
| `/affiliates` | ✅ Real content | Affiliate applications queue |
| `/affiliates/[id]` | ✅ Real content | Affiliate detail |
| `/affiliates/payouts` | ✅ Real content | Payout management |
| `/messages` | ✅ Real content | Admin inbox + reply |
| `/payments` | ✅ Real content | 415 lines, payment list + refund actions |
| `/promotions` | ✅ Real content | 449 lines, coupon CRUD + gift card management |
| `/shipping` | ✅ Real content | 532 lines, zones + profiles + rates |
| `/settings` | 🟡 PARTIAL | 1202 lines; SMTP and notifications tabs call endpoints that **don't exist in API** (`/admin/settings/email`, `/admin/settings/notifications`, `/admin/team`, `/admin/email-templates`, `/admin/export/data`) ⚠️ |
| `/settings/affiliates` | ✅ Real content | Affiliate program settings (calls existing `/admin/affiliates/settings`) |

### 1.4 Prisma Models

| Model | Fields | Relations | Has seed data |
|-------|--------|-----------|---------------|
| User | 24 fields | RefreshToken, EmailVerification, PasswordReset, Address, WishlistItem, Cart, Order, CustomizationDraft, Review, Notification, Conversation, AffiliateAccount, LoyaltyAccount, FcmToken | Yes (pg seed) |
| FcmToken | 6 fields | User | No |
| RefreshToken | 6 fields | User | No |
| EmailVerification | 6 fields | User | No |
| PasswordReset | 7 fields | User | No |
| Address | 12 fields | User | No |
| WishlistItem | 5 fields | User, Product | No |
| Category | 14 fields | Category (self, tree), Product, ProductCategory | Yes |
| ProductCategory | 3 fields | Product, Category | Yes |
| Collection | 11 fields | CollectionProduct | Yes |
| CollectionProduct | 4 fields | Collection, Product | Yes |
| Tag | 3 fields | ProductTag | Yes |
| ProductTag | 2 fields | Product, Tag | Yes |
| Product | 46 fields | ProductVariant, ProductImage, CollectionProduct, ProductTag, WishlistItem, CartItem, OrderItem, CustomizationDraft, Review, ProductQuestion, ProductCategory, VariationGroup, VariationSettings, Category, ProcessingProfile, ShippingProfile, ShopSection | Yes |
| ProductVariant | 10 fields | Product, CartItem, OrderItem, CustomizationDraft | Yes |
| ProductImage | 7 fields | Product | Yes |
| VariationGroup | 6 fields | Product, VariationOption | No |
| VariationOption | 11 fields | VariationGroup | No |
| VariationSettings | 5 fields | Product | No |
| ProcessingProfile | 8 fields | Product | No |
| ShippingProfile | 8 fields | ShippingProfileMethod, Product | No |
| ShippingProfileMethod | 9 fields | ShippingProfile | No |
| ShopSection | 5 fields | Product | No |
| ProductionPartner | 5 fields | (none — productionPartnerIds is String[]) | No |
| CustomizationDraft | 11 fields | User, Product, ProductVariant | No |
| Cart | 9 fields | CartItem | No |
| CartItem | 11 fields | Cart, Product, ProductVariant | No |
| Order | 41 fields | OrderItem, OrderStatusHistory, Payment, PromotionUsage, GiftCardUsage, Conversation, AffiliateAccount, AffiliateCommission, User | No |
| OrderItem | 10 fields | Order, Product, ProductVariant | No |
| OrderStatusHistory | 6 fields | Order | No |
| Payment | 17 fields | Order | No |
| GiftCard | 7 fields | GiftCardUsage | No |
| GiftCardUsage | 6 fields | GiftCard, Order | No |
| Promotion | 12 fields | PromotionUsage | Yes |
| PromotionUsage | 6 fields | Promotion, Order | No |
| ShippingZone | 4 fields | ShippingMethod | Yes |
| ShippingMethod | 10 fields | ShippingZone | Yes |
| Review | 12 fields | User, Product | No |
| ProductQuestion | 12 fields | Product | No |
| Notification | 10 fields | User | No |
| AttributeValue | 4 fields | (none) | Yes |
| Conversation | 14 fields | Order, User, Message | No |
| Message | 10 fields | Conversation | No |
| AuditLog | 10 fields | (none) | No |
| AffiliateSettings | 8 fields | (singleton) | No |
| AffiliateAccount | 20 fields | User, AffiliateClick, AffiliateCommission, AffiliatePayout, Order | No |
| AffiliateClick | 9 fields | AffiliateAccount | No |
| AffiliateCommission | 12 fields | AffiliateAccount, Order | No |
| AffiliatePayout | 12 fields | AffiliateAccount | No |
| LoyaltyAccount | 7 fields | User, LoyaltyTransaction | No |
| LoyaltyTransaction | 8 fields | LoyaltyAccount | No |

### 1.5 Shared Libs Health

| Lib | Exports (count) | Used by client | Used by admin | Notes |
|-----|-----------------|----------------|---------------|-------|
| @mlh/ui | 13 components (Avatar, Badge, BottomNav, Button, ErrorBoundary, Input, Modal, Pagination, ProductCard, RatingStars, Skeleton, Textarea, Toast) | Yes | Yes | All built, no stubs |
| @mlh/types | 12 type files (api, cart, catalog, message, order, payment, product, promotion, review, shipping, user + spec) | Yes | Yes | Complete type coverage |
| @mlh/constants | 6 files (app-routes, order-status, pagination, roles, routes, upload) | Yes | Yes | API_ROUTES constants cover all modules |
| @mlh/api-client | fetch client + 14 React Query hooks | Yes | Partial (admin uses axios directly) | client.ts + hooks; admin app uses its own axios-based api-client.ts |

### 1.6 Test Coverage Estimate

- Total .spec.ts / .test.ts files found: **16**
- Modules WITH tests:
  - `auth` (unit + integration spec)
  - `cart` (service spec)
  - `orders` (service spec)
  - `payments` (stripe-webhook spec)
  - `products` (service spec)
  - `promotions` (service spec)
  - `client/customizer.store` (unit test)
  - `libs/types` (spec)
  - `libs/constants` (spec)
  - `e2e` (4 Playwright tests: auth, checkout, homepage, product-detail)
- Modules WITHOUT tests: users, catalog, search, shipping, reviews, messages, notifications, customization, affiliates, loyalty, pdf, analytics, currency, admin, tax, assets, unsubscribe
- Estimated coverage: **LOW (<20%)** — Only the core transactional modules (cart, orders, payments, auth) and 4 E2E paths are covered.

### 1.7 Technical Debt Signals

- `// TODO` comments: **1** — `apps/api/src/queue/image.processor.ts:186` — temp-image cleanup logic not implemented
- `// FIXME` comments: **0**
- `console.log()` in non-seed/non-script files: **2** — `apps/client/src/components/providers/WebVitals.tsx:25` (intentional dev log in WebVitals component), `apps/client/src/lib/hooks/useAuthQuery.ts:49` (in a JSDoc comment, not actual code)
- Hardcoded `/api/v1/` strings in frontend: **0** — Both admin and client use `API_BASE` + `API_ROUTES` constants; URL construction is centralised.
- Empty catch blocks `catch {}` with no body: **0** (all empty catches are `catch { /* no-op */ }` or `catch { return null; }` with rationale)

---

## 2. Feature Matrix

Status legend: ✅ Done · 🟡 Partial · ❌ Missing · ➖ Not applicable

### AUTH & IDENTITY

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Register (email + password) | ✅ | ✅ | ➖ | |
| Login + JWT access token | ✅ | ✅ | ✅ | |
| Refresh token flow | ✅ | ✅ | ✅ | httpOnly cookie |
| Logout + token revoke | ✅ | ✅ | ✅ | |
| Email verification | ✅ | ✅ | ➖ | Token-based flow |
| Forgot / reset password | ✅ | ✅ | ➖ | |
| OAuth — Google | ✅ | ✅ | ➖ | Passport Google strategy; callback page |
| Admin 2FA / TOTP | ✅ | ➖ | ✅ | totp.service.ts; admin totp-setup + totp-verify pages |

### CATALOG

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Category CRUD | ✅ | ✅ | ✅ | |
| 3-level category hierarchy | ✅ | ✅ | ✅ | Level 1/2/3 with parentId tree |
| Mega menu (MongoDB-backed) | ✅ | ✅ | ✅ | Redis-cached 10 min |
| Collection CRUD | ✅ | ✅ | ✅ | |
| Tag management | ✅ | ✅ | 🟡 | API has tags; admin UI lacks dedicated tag management page |

### PRODUCTS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Product CRUD | ✅ | ✅ | ✅ | |
| Product slug + SEO fields | ✅ | ✅ | ✅ | |
| Product images (upload/reorder) | ✅ | ✅ | ✅ | R2 presign + EtsyGallery |
| Variation groups (Size, Color) | ✅ | ✅ | ✅ | VariationGroup/Option model |
| Variant matrix (cross-product) | ✅ | ✅ | ✅ | SmartVariantPicker |
| Custom options (text/file/list) | ✅ | ✅ | ✅ | customizationConfig JSON |
| Product status (draft/active) | ✅ | ✅ | ✅ | ProductStatus enum |
| Bulk actions (publish/archive) | ✅ | ➖ | ✅ | BulkActionBar in admin |
| CSV import / export | ✅ | ➖ | ✅ | 17-col CSV, upsert-by-slug |
| Processing profile | ✅ | ✅ | ✅ | ProcessingProfile model + admin panel |
| Shipping profile | ✅ | ✅ | ✅ | ShippingProfile model + admin panel |

### SEARCH

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Full-text search (tsvector) | ✅ | ✅ | ➖ | |
| Filter by category/tag/price | ✅ | ✅ | ➖ | |
| Sort (newest/price/popular) | ✅ | ✅ | ➖ | |
| Related products | ✅ | ✅ | ➖ | YouMayAlsoLike component |

### PERSONALIZATION / CUSTOMIZER

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Canvas editor (Fabric.js) | ✅ | ✅ | ➖ | Full customizer with multi-step wizard |
| Text input fields | ✅ | ✅ | ➖ | TextFieldInput, AutoFillBanner |
| Photo upload to R2 | ✅ | ✅ | ➖ | Step2PhotoUpload component |
| Background removal (AI) | ✅ | ✅ | ➖ | Remove.bg integration |
| Art style application (AI) | ✅ | ✅ | ➖ | Replicate img2img, 5 styles, ArtStylePicker |
| Customization preview | ✅ | ✅ | ➖ | PreviewModal |

### CART

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Guest cart (session-based) | ✅ | ✅ | ➖ | Session ID header |
| Auth cart | ✅ | ✅ | ➖ | |
| Cart merge on login | ✅ | ✅ | ➖ | |
| Add / update / remove items | ✅ | ✅ | ➖ | |
| Coupon code apply | ✅ | ✅ | ➖ | |
| Affiliate discount apply | ✅ | ✅ | ➖ | Cookie-based, resolved at checkout |
| Loyalty points apply | ✅ | ✅ | ➖ | Slider UI at checkout step 2 |

### CHECKOUT

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Shipping address form | ✅ | ✅ | ➖ | ShippingForm component |
| Shipping method selection | ✅ | ✅ | ➖ | DeliveryForm component |
| Tax calculation (TaxJar) | ✅ | ✅ | ➖ | tax.service.ts + preview endpoint |
| Gift options (message/wrapping) | ✅ | ✅ | ➖ | GiftOptionsSection |
| Stripe Elements payment | ✅ | ✅ | ➖ | PaymentForm with Stripe Elements |
| PayPal payment | 🟡 | ❌ | ➖ | PayPal Order/Capture endpoints not built; webhook is stub; FAQ mentions PayPal |
| Order confirmation | ✅ | ✅ | ➖ | Checkout success page |
| Guest checkout (no account) | ✅ | ✅ | ➖ | guestEmail field on order |

### ORDERS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Order creation flow | ✅ | ✅ | ➖ | |
| Order status lifecycle | ✅ | ✅ | ✅ | 10-state lifecycle |
| Order history (customer) | ✅ | ✅ | ➖ | |
| Order management (admin) | ✅ | ➖ | ✅ | |
| Mark as shipped + tracking | ✅ | ➖ | ✅ | |
| EasyPost carrier tracking | ✅ | ✅ | ✅ | OrderTrackingCard |
| Label purchase (EasyPost) | ✅ | ➖ | ✅ | BuyLabelModal in admin |
| Refund processing | ✅ | ➖ | ✅ | |
| PDF invoice generation | ✅ | ✅ | ✅ | PdfModule, R2 cache |
| Packing slip | ✅ | ➖ | ✅ | |

### PAYMENTS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Stripe payment intent | ✅ | ✅ | ➖ | |
| Stripe webhook handler | ✅ | ➖ | ➖ | Full idempotent handler |
| PayPal webhook handler | 🟡 | ❌ | ➖ | `return { received: true }` stub only |
| Refund via Stripe | ✅ | ➖ | ✅ | |

### USER ACCOUNT

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Profile management | ✅ | ✅ | ➖ | |
| Address book (CRUD) | ✅ | ✅ | ➖ | |
| Wishlist (add/remove) | ✅ | ✅ | ➖ | |
| Wishlist sharing (public URL) | ✅ | ✅ | ➖ | Share token, SSR public page, noindex |
| Order history page | ✅ | ✅ | ➖ | |
| Messages inbox | ✅ | ✅ | ➖ | |
| Loyalty points dashboard | ✅ | ✅ | ➖ | |

### MESSAGING

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Customer → shop contact form | ✅ | ✅ | ➖ | ContactForm component |
| Admin inbox + reply | ✅ | ➖ | ✅ | |
| Email notification on message | ✅ | ➖ | ➖ | new-message.hbs template + queued |
| Push notification (FCM) | ✅ | ✅ | ➖ | SW dynamic route, AuthProvider hook |

### REVIEWS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Submit review (with order check) | ✅ | ✅ | ➖ | ReviewModal component |
| Review moderation | ✅ | ➖ | ✅ | |
| Star rating display | ✅ | ✅ | ➖ | EtsyReviewsSection, RatingStars |
| Review request email | ✅ | ➖ | ➖ | review-reminder.hbs + BullMQ trigger |

### PROMOTIONS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Coupon CRUD | ✅ | ➖ | ✅ | |
| Coupon validation at checkout | ✅ | ✅ | ➖ | |
| Flash sales / sale pricing | ✅ | ✅ | ✅ | compareAtPrice + sale banner |
| Gift cards | 🟡 | ✅ | ✅ | Validate + apply endpoints exist; **purchase endpoint `/payments/gift-cards/purchase` missing from API** ⚠️ |

### AFFILIATE PROGRAM

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Affiliate registration | ✅ | ✅ | ➖ | |
| Referral link + cookie tracking | ✅ | ✅ | ➖ | Middleware sets mlh_affiliate cookie |
| Commission calculation | ✅ | ➖ | ➖ | commission.service.ts, BullMQ processor |
| Buyer discount at checkout | ✅ | ✅ | ➖ | AffiliateDiscountBanner |
| Affiliate portal (dashboard) | ✅ | ✅ | ➖ | 3-page portal |
| Admin payout management | ✅ | ➖ | ✅ | |

### LOYALTY / POINTS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Points earn on purchase | ✅ | ➖ | ➖ | 10pts/$1, order hook |
| Points redemption at checkout | ✅ | ✅ | ➖ | Slider UI, order service |
| Points history page | ✅ | ✅ | ➖ | |
| Auto-confirm after delivery | ✅ | ➖ | ➖ | 14-day BullMQ processor |

### SEO & ANALYTICS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Product structured data (JSON-LD) | ➖ | ✅ | ➖ | |
| Breadcrumb structured data | ➖ | ✅ | ➖ | |
| FAQ structured data (Q&A) | ➖ | ✅ | ➖ | |
| Sitemap.xml (dynamic) | ➖ | ✅ | ➖ | 133-line dynamic sitemap |
| Robots.txt | ➖ | ✅ | ➖ | 42 lines |
| Canonical URLs | ➖ | ✅ | ➖ | generateMetadata on all pages |
| GA4 + GTM integration | ➖ | ✅ | ➖ | Script tags in layout |
| Meta Pixel (Facebook) | ➖ | ✅ | ➖ | MetaPixel component |
| Hotjar / session recording | ✅ | ✅ | ➖ | hotjar.ts, 5 funnel events, CSP updated |

### EMAIL NOTIFICATIONS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Order confirmation email | ✅ | ➖ | ➖ | order-confirmation.hbs |
| Order shipped email | ✅ | ➖ | ➖ | order-shipped.hbs |
| Order delivered email | ✅ | ➖ | ➖ | order-delivered.hbs |
| Abandoned cart recovery | ✅ | ➖ | ➖ | abandoned-cart.hbs + BullMQ processor |
| Review request email | ✅ | ➖ | ➖ | review-reminder.hbs |
| Affiliate approval/rejection | ✅ | ➖ | ➖ | affiliate-approved.hbs + affiliate-rejected.hbs |
| Commission confirmed email | ✅ | ➖ | ➖ | commission-confirmed.hbs |
| Payout processed email | ✅ | ➖ | ➖ | payout-processed.hbs |

### ADMIN OPERATIONS

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Dashboard KPIs (revenue/orders) | ✅ | ➖ | ✅ | 5 endpoints + charts |
| Customer management | ❌ | ➖ | 🟡 | Admin page calls `/admin/customers` — **API endpoint missing** ⚠️ |
| Review moderation queue | ✅ | ➖ | ✅ | |
| Affiliate applications queue | ✅ | ➖ | ✅ | |
| Payout queue | ✅ | ➖ | ✅ | |
| Settings panel (store/email/notifications/team) | ❌ | ➖ | 🟡 | UI calls 5 missing endpoints ⚠️ |
| Product Q&A moderation | ✅ | ➖ | ✅ | admin-qa.controller.ts |

### TECHNICAL / INFRA

| Feature | API | Client | Admin | Notes |
|---------|-----|--------|-------|-------|
| Rate limiting (ThrottlerModule) | ✅ | ➖ | ➖ | 300 req/60s global |
| Security headers (Helmet) | ✅ | ➖ | ➖ | CSP + Helmet configured |
| Global exception filter | ✅ | ➖ | ➖ | HttpExceptionFilter |
| Error boundaries (React) | ➖ | ✅ | ✅ | ErrorBoundary in ReactQueryProvider |
| Request ID + logging interceptor | ✅ | ➖ | ➖ | RequestIdInterceptor + LoggingInterceptor |
| BullMQ queues operational | ✅ | ➖ | ➖ | 5 processors, DevBullModule fallback |
| Redis caching layer | ✅ | ➖ | ➖ | RedisService, mega-menu + analytics |
| Cloudflare R2 storage | ✅ | ✅ | ✅ | StorageService + presign |
| Unit tests (>50% coverage) | ❌ | ❌ | ❌ | Coverage estimated <20% — see 1.6 |
| E2E tests (critical paths) | ➖ | 🟡 | ➖ | 4 Playwright tests (auth, checkout, home, PDP); no admin E2E |
| Multi-currency display | ✅ | ✅ | ➖ | CurrencyProvider + disclaimer |
| i18n / localization | ➖ | 🟡 | ➖ | next-intl configured; 10 message files for en+vi; **most page text is hardcoded English, not using translation keys** |
| Temp image cleanup (queue) | 🟡 | ➖ | ➖ | Job defined but TODO body empty |

---

## 3. Gap Analysis

### 3.1 Critical Gaps

| ID | Feature | Layer(s) missing | Severity | Effort | Blocks | Notes |
|----|---------|------------------|----------|--------|--------|-------|
| G-001 | Gift card purchase endpoint | API | Critical | S (half day) | Client gift-card page fully built; API `/payments/gift-cards/purchase` does not exist — page silently errors on submit ⚠️ | Add `POST /payments/gift-cards/purchase` to PaymentsController + service |
| G-002 | Admin customer management API | API | Critical | L (3-5 days) | Admin `/customers` and `/customers/[id]` pages call `/admin/customers*` endpoints that return 404. Ops cannot view customer list. ⚠️ | Build admin customer list, detail, stats, notes, tags endpoints |
| G-003 | PayPal payment | API + Client | Critical | XL (1+ week) | PayPal mentioned in FAQ, faq-data.ts, and how-it-works page; no PayPal UI at checkout; webhook is stub ⚠️ | Build PayPal Orders API create/capture + client PayPal button + webhook handler |

### 3.2 High Gaps

| ID | Feature | Layer(s) missing | Severity | Effort | Blocks | Notes |
|----|---------|------------------|----------|--------|--------|-------|
| G-004 | Admin settings API (store/email/notifications/SEO/team) | API | High | L (3-5 days) | Admin settings page (1202 lines) calls 5 endpoints that don't exist. SMTP cannot be saved; notification prefs have no backing. ⚠️ | Create settings module with persistent store config (DB or env-override) |
| G-005 | Admin team management API | API | High | M (1-2 days) | Settings > Team tab calls `/admin/team` and `/admin/team/invite` which are missing | Build team list + invite endpoints |
| G-006 | Admin email template management API | API | High | M (1-2 days) | Settings page calls `/admin/email-templates` endpoints — missing | Expose template CRUD over API or static file-edit workflow |
| G-007 | Temp image cleanup job | API (queue) | High | S (half day) | TODO in image.processor.ts:186 — expired CustomizationDraft preview images never deleted from R2, causing storage bleed | Implement `handleCleanupTempImages()` |
| G-008 | Test coverage — critical paths | API + Client | High | XL (1+ week) | Unit test coverage estimated <20%; missing: users, catalog, search, shipping, reviews, affiliates, loyalty, currency, notifications | Add service-level unit tests for top 8 modules |

### 3.3 Medium Gaps

| ID | Feature | Layer(s) missing | Severity | Effort | Blocks | Notes |
|----|---------|------------------|----------|--------|--------|-------|
| G-009 | PayPal webhook real implementation | API | Medium | M (1-2 days) | Webhook returns `{ received: true }` stub; PayPal order confirmation never processed | Implement PayPal webhook event parsing and order state updates |
| G-010 | Admin data export endpoint | API | Medium | M (1-2 days) | Admin settings calls `/admin/export/data` which is missing; orders export exists | Build general data export (customers + orders CSV) |
| G-011 | Tag management admin page | Admin | Medium | S (half day) | API has tags; no admin UI for tag creation/deletion/merge | Add `/catalog/tags` admin page |
| G-012 | i18n translation key coverage | Client | Medium | L (3-5 days) | next-intl is wired; only 10 JSON message files (nav, home, product, etc.); most user-facing strings are hardcoded English | Extract all UI strings into translation keys for en/vi |
| G-013 | Admin E2E tests | Admin | Medium | L (3-5 days) | No Playwright tests for admin flows (login, product create, order status change) | Add admin Playwright test suite for 5+ critical paths |
| G-014 | Cache flush admin endpoint | API | Medium | XS (<2h) | Admin settings calls `/admin/cache/flush` which is missing | Add Redis flush endpoint to admin module |

### 3.4 Low Gaps

| ID | Feature | Layer(s) missing | Severity | Effort | Blocks | Notes |
|----|---------|------------------|----------|--------|--------|-------|
| G-015 | WebVitals console.log cleanup | Client | Low | XS (<2h) | `WebVitals.tsx:25` uses console.log instead of analytics call | Wire Web Vitals to GA4 Measurement Protocol or remove |
| G-016 | Admin cache-flush UI | Admin | Low | XS (<2h) | Settings has "Danger" tab but no working cache flush trigger (depends on G-014) | Wire flush button once API endpoint added |
| G-017 | Audit log UI | Admin | Low | M (1-2 days) | AuditLog model in Prisma but no admin page to view it | Build audit log viewer in settings |
| G-018 | Production partner admin UI | Admin | Low | S (half day) | ProductionPartner model in Prisma; admin-production-partners.controller.ts exists in catalog but no admin page | Add production partners page under catalog |
| G-019 | ShopSection admin UI | Admin | Low | S (half day) | ShopSection model in Prisma; admin-shop-sections.controller.ts exists but no dedicated admin page | Add shop sections management under catalog |
| G-020 | Related products admin editorial | Admin | Low | M (1-2 days) | Related products are auto-computed by category; no manual editorial override | Add manual "featured related" product links per product |

---

## 4. Phase Roadmap

### Phase 1 — MVP / Go-live blockers

**Timeframe:** Immediate (0–2 weeks)
**Goal:** Close the gaps that would cause crashes, 404s, or data loss for real customers and ops staff on day 1.
**Entry criteria:** Docker build is green, all existing 87 tests pass, staging environment reachable.

| Gap ID | Feature | Priority | Effort | Depends on |
|--------|---------|----------|--------|------------|
| G-001 | Gift card purchase API endpoint | P0 | S | — |
| G-002 | Admin customer management API | P0 | L | — |
| G-007 | Temp image cleanup job | P0 | S | — |
| G-003 | PayPal payment (if required — see Open Questions) | P0 | XL | — |

**Acceptance criteria (Definition of Done):**
- `POST /payments/gift-cards/purchase` returns a valid gift card code; client success modal displays it
- `/admin/customers` returns paginated customer list with ordersCount and totalSpent; `/admin/customers/stats` works
- Image cleanup job runs without exception; expired R2 objects are deleted in test environment
- (If PayPal required) PayPal button shown at checkout; successful sandbox payment creates order record

**Phase risks:**

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PayPal scope creep blocks launch | Medium | Decide now whether PayPal is day-1 or phase-2 (see Open Questions) |
| Customer management requires DB migrations | Low | Schema already has all needed fields in User/Order; only API layer missing |
| R2 cleanup job deletes preview images for active drafts | Low | Filter by `expiresAt < NOW()` strictly; do NOT delete non-expired records |

---

### Phase 2 — Post-launch iteration

**Timeframe:** Weeks 3–6
**Goal:** Restore full admin operational capability and fix silent failures in settings panel.
**Entry criteria:** Phase 1 complete, first real orders processed.

| Gap ID | Feature | Priority | Effort | Depends on |
|--------|---------|----------|--------|------------|
| G-004 | Admin settings API (store/email/notifications/SEO) | P1 | L | — |
| G-005 | Admin team management API | P1 | M | G-004 |
| G-006 | Admin email template management API | P1 | M | G-004 |
| G-009 | PayPal webhook real implementation | P1 | M | G-003 |
| G-010 | Admin data export endpoint | P2 | M | G-002 |
| G-014 | Cache flush admin endpoint | P2 | XS | — |

**Acceptance criteria (Definition of Done):**
- Admin can save SMTP settings and send a test email without a 404
- Admin can invite a new team member; invite email is sent
- Admin can edit welcome.hbs email template from the UI
- PayPal `CHECKOUT.ORDER.APPROVED` event updates order status to CONFIRMED
- `/admin/export/data` returns downloadable CSV of orders + customers

**Phase risks:**

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SMTP settings stored in env vs DB conflict | Medium | Use DB-persisted settings with env fallback; document precedence clearly |
| Team invite requires email delivery working | High | Confirm SMTP is functional before enabling team invites |

---

### Phase 3 — Scale

**Timeframe:** Weeks 7–12
**Goal:** Reach acceptable test coverage, close i18n gap, add operational tooling.
**Entry criteria:** Phase 2 complete, 100+ orders processed, team > 1 person.

| Gap ID | Feature | Priority | Effort | Depends on |
|--------|---------|----------|--------|------------|
| G-008 | Test coverage — critical paths | P1 | XL | — |
| G-011 | Tag management admin page | P2 | S | — |
| G-012 | i18n translation key coverage | P2 | L | — |
| G-013 | Admin E2E tests | P2 | L | G-004 |
| G-016 | Admin cache-flush UI | P3 | XS | G-014 |
| G-018 | Production partner admin UI | P3 | S | — |
| G-019 | ShopSection admin UI | P3 | S | — |

**Acceptance criteria (Definition of Done):**
- API unit test coverage reaches ≥50% (auth, users, cart, orders, payments, shipping, reviews, affiliates, loyalty)
- All client UI strings use next-intl translation keys; vi translations reviewed by native speaker
- Admin Playwright suite covers: login → create product → publish; login → process order; review moderation
- Cache flush button in admin UI successfully clears Redis

**Phase risks:**

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| i18n retrofit is large and disruptive | High | Do it page by page; start with highest-traffic pages (PDP, checkout, homepage) |
| Test coverage effort underestimated | Medium | Timebox to most-critical modules; mock Prisma aggressively |

---

### Phase 4 — Growth

**Timeframe:** Month 4+
**Goal:** Editorial improvements, audit visibility, advanced admin tooling.
**Entry criteria:** Phase 3 complete, stable production load.

| Gap ID | Feature | Priority | Effort | Depends on |
|--------|---------|----------|--------|------------|
| G-015 | WebVitals analytics wiring | P3 | XS | — |
| G-017 | Audit log UI | P3 | M | — |
| G-020 | Related products admin editorial | P4 | M | — |

**Acceptance criteria (Definition of Done):**
- WebVitals (LCP, FID, CLS) reported to GA4 Measurement Protocol
- Admin can view paginated AuditLog with filter by user and entity type
- Admin can manually pin up to 4 related products per product listing

**Phase risks:**

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Audit log volume impacts DB query performance | Low | Add createdAt index (already in schema); paginate strictly |

---

## 5. Implementation Order

### Must implement first (blockers):

1. **G-001** — Gift card purchase API — reason: client UI is fully live and silently errors; buying a gift card will fail with a network error today.
2. **G-007** — Temp image cleanup — reason: every art-style generation writes preview images to R2 with no cleanup path; storage cost grows unbounded.
3. **G-002** — Admin customer management API — reason: admin cannot view any customer without this; ops workflow blocked.
4. **G-003** — PayPal (if in scope) — reason: FAQ and how-it-works mention PayPal; requires decision first (see Open Questions).

### Phase 1 sequence:

1. G-001 `POST /payments/gift-cards/purchase` (PaymentsController + service)
2. G-007 Implement `handleCleanupTempImages()` in image.processor.ts
3. G-002 Admin customer management — new `AdminCustomersController` + service (list, detail, stats, notes, tags)
4. G-003 PayPal (conditional on owner decision)

### Phase 2 sequence:

1. G-004 Admin settings module + DB-persisted store/email/notification settings
2. G-005 Team management endpoints (depends on G-004 settings module foundation)
3. G-006 Email template CRUD endpoints (depends on G-004)
4. G-014 Cache flush endpoint (XS, can be done in parallel)
5. G-009 PayPal webhook real implementation (depends on G-003 or parallel)
6. G-010 Data export endpoint

### Phase 3 sequence:

1. G-008 Unit tests — auth, users, catalog, search, shipping, reviews, affiliates, loyalty (8 modules)
2. G-011 Tag management admin page
3. G-012 i18n extraction — start with checkout, PDP, cart, account pages
4. G-013 Admin Playwright E2E tests
5. G-016 Cache flush admin UI button (depends on G-014 already done in Phase 2)
6. G-018 Production partners admin page
7. G-019 ShopSection admin page

---

## 6. Open Questions

These are decisions the code cannot answer — they require owner input before implementation can start.

1. **Is PayPal required for launch or post-launch?** The FAQ and how-it-works page explicitly mention PayPal, creating a customer expectation. However the checkout only shows Stripe Elements today. Deciding this determines whether G-003 is Phase 1 or Phase 2.

2. **Is i18n (Vietnamese) in-scope for launch?** next-intl and routing are wired, and 10 JSON message files exist, but ~95% of UI strings are hardcoded English. If Vietnamese is a launch requirement, G-012 must move to Phase 1 (L-effort, weeks of work). If it's post-launch, Phase 3 is appropriate.

3. **Should admin settings be DB-persisted or env-var-only?** The admin settings UI expects to read and write SMTP credentials, store name, notification prefs from the API. If the project runs on Railway/Vercel with immutable deploys, env vars may be the preferred mechanism. The implementation of G-004 differs significantly based on this choice.

4. **Is there a plan for the AuditLog model?** The schema defines it but no code writes to it and there is no admin UI. If audit compliance is required (e.g., for financial or legal reasons), AuditLog population should happen in parallel with Phase 1 work.

5. **What is the desired gift card payment flow?** The client UI for gift card purchase collects recipient details and calls `POST /payments/gift-cards/purchase`, but this endpoint does not exist in the API. The existing gift card model in the DB is designed for redeeming (not selling) gift cards. Clarify: does purchasing a gift card require Stripe payment, or is it a manual top-up by admin?

6. **Should guest checkout be available without any account?** The current implementation supports guest checkout (guestEmail field on Order). The middleware requires a `refresh_token` cookie for `/checkout` — which guests would not have. This means guest checkout is **currently blocked by middleware**. Verify whether `/checkout` should be accessible without auth.

7. **What is the production team structure?** Team management (G-005) requires knowing: will there be multiple admin users with role-based access, or is the shop single-owner? This determines complexity of the team invite + RBAC implementation.
