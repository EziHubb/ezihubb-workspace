# Audit Report — EziHubb Architecture
> Generated: ARCH-00 audit pass  
> Date: 2026-06-10  
> Status: **READ-ONLY** — no code was modified

---

## 1. Hardcoded API Paths Found

**~420 total occurrences across ~100 files**

### Client app (`apps/client`) — uses `apiClient` / `apiFetch` from `@ezihubb/api-client`
~67 fetch calls with hardcoded path strings. The shared `@ezihubb/api-client` hooks
(`useCart`, `useProduct`, etc.) use `API_ROUTES` from `@ezihubb/constants` — but all page
files and most components call `apiClient.get/post/patch/delete()` with raw strings.

Top repeated patterns:
```
/users/me/addresses          — 4 calls  (addresses page)
/messages/conversations/:id  — 6 calls  (messages page)
/products                    — 8+ calls (listing pages)
/categories                  — 6 calls  (various pages)
/users/me/wishlist           — 4 calls  (wishlist page)
/affiliates/me               — 3 calls  (affiliate portal)
```

### Admin app (`apps/admin`) — uses `clientFetch` / `serverFetch` / `apiFetch`
**211 fetch calls** with hardcoded path strings. Zero usage of `API_ROUTES` constants.

Top 10 most repeated patterns:
```
/admin/affiliates/:id/approve    — 2 files
/admin/affiliates/:id/reject     — 2 files
/admin/affiliates/:id            — 3 files
/admin/orders/:id                — 3 files
/admin/customers/:id             — 4 files
/admin/customers                 — 3 files
/admin/messages/conversations/:id — 4 calls in one file
/admin/products                  — 5+ calls across files
/admin/orders (list)             — 3 files
/admin/affiliates/payouts        — 2 files
```

### Existing constants (underutilised)
`libs/shared/constants/src/lib/routes.ts` (105 lines) **already has** `API_ROUTES` with
AUTH, USERS, PRODUCTS, CATALOG sections — but it is only imported by:
- `@ezihubb/api-client` hooks (useCart, useProduct, useCatalog, etc.)
- 8 client auth/customizer files

**It is completely absent from the admin app.**  
Missing from `API_ROUTES`: admin endpoints, orders, cart, messages, loyalty, affiliates, currency.

---

## 2. Hardcoded Next.js Routes Found

**~55 occurrences** across `apps/client` and `apps/admin`.

### Admin app — hardcoded `href` strings (19 occurrences):
```
/customers                — 3 occurrences
/products                 — 5 occurrences (list, import, seo, back links)
/products/import          — 1
/products/new             — 1
/orders                   — 1
/reviews                  — 1
/catalog/categories       — 1
/admin/shipping           — 1 (wrong — should be /shipping)
/shipping                 — 1
```

### Client app — hardcoded `href` strings (36 occurrences):
```
/products                 — 6 occurrences
/                         — 5 occurrences
/checkout                 — 2 occurrences (CartDrawer)
/pages/contact            — 5 occurrences
/pages/faq                — 3 occurrences
/pages/privacy-policy     — 1
/pages/terms              — 1
/account/messages         — 1
/account/orders           — 1
/orders/track             — 2 occurrences
/collections              — 1
```

**Critical (3+ occurrences):** `/products`, `/`, `/pages/contact`, `/pages/faq`, `/checkout`

---

## 3. Inline Transforms to Move to Utils

Component-level scan (`apps/client/components`, `apps/admin/components`):
- `.toFixed()` in JSX/TSX: **0 occurrences** ✅
- `?? ` null coalescing: **0 occurrences** ✅
- `Number()` / `formatCurrency`: **0 occurrences** ✅

> Components are already reasonably clean of inline transforms.
> The `formatPrice`/`useCurrency` from P3-05 handles currency formatting.
> Utility layer (ARCH-04) should still be built for consistency and future-proofing.

---

## 4. fetch() Usages to Replace with Axios

**351 total** `fetch()` calls (native or via wrappers), across ~100 files.

### Current fetch architecture:

**`apps/client`** → uses `@ezihubb/api-client`:
- `apiClient.get/post/patch/delete()` — wraps native `fetch()`, has token refresh
- `apiFetch<T>()` — lower-level wrapper
- `api.get/post/patch/delete()` — older convenience wrapper (same underlying fetch)

**`apps/admin`** → uses `apps/admin/src/lib/api.ts`:
- `clientFetch(path, init)` — wraps native `fetch()` with NextAuth session token
- `serverFetch(path, init)` — server-side version with `getServerSession()`
- `apiFetch<T>(path, init, server?)` — typed helper over both

### Files to migrate (admin, high priority):
```
apps/admin/src/app/(admin)/affiliates/page.tsx
apps/admin/src/app/(admin)/affiliates/payouts/page.tsx
apps/admin/src/app/(admin)/affiliates/[id]/page.tsx
apps/admin/src/app/(admin)/catalog/categories/page.tsx
apps/admin/src/app/(admin)/catalog/collections/page.tsx
apps/admin/src/app/(admin)/customers/page.tsx
apps/admin/src/app/(admin)/customers/[id]/CustomerSideCards.tsx
apps/admin/src/app/(admin)/orders/page.tsx
apps/admin/src/app/(admin)/orders/[id]/OrderDetailContent.tsx
apps/admin/src/app/(admin)/messages/page.tsx
apps/admin/src/app/(admin)/products/page.tsx
apps/admin/src/app/(admin)/promotions/page.tsx
apps/admin/src/app/(admin)/reviews/page.tsx
apps/admin/src/app/(admin)/settings/affiliates/page.tsx
apps/admin/src/components/orders/OrderDrawer.tsx
apps/admin/src/components/products/edit/*.tsx (10+ files)
```

---

## 5. Admin/Client API Separation Issues

### Client calling `/admin/` routes: **NONE** ✅
The client app correctly calls only public/customer endpoints.

### Admin calling non-`/admin/` routes (BUGS):
The admin catalog page mixes admin and public paths inconsistently:

```typescript
// apps/admin/src/app/(admin)/catalog/categories/page.tsx
clientFetch('/catalog/categories')           // ❌ calls public endpoint
clientFetch(`/admin/categories/${id}`)       // ❌ wrong path (should be /admin/catalog/categories/:id)
clientFetch('/admin/categories')             // ❌ wrong path (should be /admin/catalog/categories)
clientFetch('/admin/catalog/sync-mega-menu') // ✓ correct

// apps/admin/src/components/products/edit/CategoryPickerModal.tsx
clientFetch('/categories?level=1&isVisible=true')  // acceptable — reads public data
clientFetch('/categories?level=2&parentId=...')    // acceptable — reads public data
```

**Conclusion:**
- Path `/catalog/categories` (line 396) hits the public endpoint without admin auth — unintended
- Paths `/admin/categories/...` (lines 451, 456, 466) point to a wrong route (should be `/admin/catalog/categories/...`)
- `CategoryPickerModal` using `/categories` is acceptable (reading public catalog data for picker UI)

---

## 6. Dead Components (Unused)

Grep-based analysis (may include false positives for dynamically imported components):

### Confirmed unused (not imported anywhere):
```
apps/client/src/components/home/NewsletterForm.tsx
apps/client/src/components/skeletons/DashboardStatCardSkeleton.tsx
apps/client/src/components/skeletons/ProductDetailSkeleton.tsx
```

### Potentially unused (verify before deleting):
```
apps/client/src/components/modals/AddressModal.tsx
apps/client/src/components/modals/ConfirmModal.tsx
apps/client/src/components/modals/GiftCardBalanceModal.tsx
apps/client/src/components/modals/ImageCropModal.tsx
apps/client/src/components/modals/QuickViewModal.tsx
apps/client/src/components/modals/ReviewModal.tsx
apps/client/src/components/product/ProductAttributeList.tsx
apps/client/src/components/product/ProductInfo.tsx
apps/client/src/components/product/ProductPageInteractive.tsx
apps/client/src/components/product/ProductTabs.tsx
apps/client/src/components/product/RelatedProducts.tsx
apps/client/src/components/pages/FaqClient.tsx
apps/client/src/components/providers/AuthProvider.tsx
apps/client/src/components/providers/Providers.tsx
apps/client/src/components/search/SearchResults.tsx
```

> **Note:** Modal components may be imported via dynamic `import()` which grep won't catch.
> Run a full TypeScript unused-exports check before deleting.

---

## 7. Current seed.ts Structure

**Single monolithic file: `prisma/seed.ts` — 2215 lines**

Seeded models in order:
1. `User` (1 super admin)
2. `Category` (3-level tree: L1 nav → L2 groups → L3 leaf items)
3. `Collection` (occasion-based)
4. `Product` (20 sample products with variants)
5. `CollectionProduct` (links)
6. MongoDB `MegaMenuDoc` (derived from PG category tree)
7. MongoDB `ProductDetail` (descriptions, specs)
8. `Promotion` (discount codes)
9. `ShippingZone` (zones + rates)
10. `ProcessingProfile` (default profile)
11. `ShippingProfile` (default profile)
12. `ShopSection` (Etsy-like sections)

**Issues with current structure:**
- PG and MongoDB mixed in one file
- No folder hierarchy — cannot seed independently
- Functions are top-level, no module exports
- No separate reset script for MongoDB
- `connectMongo` has retry logic inline
- No `upsert`-safe guarantees for all models

---

## 8. api-e2e Status

```
apps/api-e2e/: EXISTS — to be deleted
```

Contents: `eslint.config.mjs`, `jest.config.cts`, `project.json`, `src/`, `tsconfig.json`, `tsconfig.spec.json`

---

## 9. Admin Controllers — Current Decorator Pattern

**10 admin controllers** found in `apps/api/src/modules/`:
```
admin-affiliates.controller.ts
admin-attributes.controller.ts
admin-catalog.controller.ts
admin-messages.controller.ts
admin-orders.controller.ts
admin-production-partners.controller.ts
admin-products.controller.ts
admin-qa.controller.ts
admin-reviews.controller.ts
admin-shop-sections.controller.ts
admin-shipping.controller.ts
```

**Current pattern** (manual, repeated in every file):
```typescript
@ApiTags('Admin — Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController { ... }
```

**Target pattern** after ARCH-02:
```typescript
@AdminController('orders')   // single decorator handles everything
export class AdminOrdersController { ... }
```

**Also:** `apps/api/src/modules/products/csv-import.controller.ts` handles `/admin/products/import/...`
and needs the same treatment.

---

## 10. Summary — Work Required Per Phase

| Phase | Scope | Effort |
|-------|-------|--------|
| ARCH-01 | Delete api-e2e, split seed.ts into 12 PG + 3 Mongo files | Medium |
| ARCH-02 | Create `@AdminController` decorator, apply to 10 controllers | Small |
| ARCH-03 | Expand `API_PATHS` (add missing 60% of endpoints), add `APP_ROUTES` + `QUERY_KEYS`, replace `clientFetch`/`serverFetch` in admin with axios | Large |
| ARCH-04 | Build `@ezihubb/utils` lib (number, date, string, array, null-safety utils) | Medium |
| ARCH-05 | Add `ErrorBoundary` wrappers across client + admin | Medium |
| ARCH-06 | Delete confirmed dead files, remove unused imports | Small |
| ARCH-07 | Full verify: build + lint + test | Small |

**Highest-impact quick wins:**
1. `@AdminController` decorator (ARCH-02) — 10 files, zero risk
2. Fix admin catalog wrong paths (ARCH-03) — 5 lines, prevents silent bugs
3. Delete `api-e2e` (ARCH-01) — removes dead weight immediately
