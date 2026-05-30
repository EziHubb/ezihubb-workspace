# Module 17 — Frontend Pages Spec (Next.js 14)

## 1. Tổng quan kỹ thuật

| Concern | Giải pháp |
|---------|-----------|
| Framework | Next.js 14, App Router |
| Styling | Tailwind CSS + shadcn/ui |
| State — server | React Query (TanStack Query v5) |
| State — client | Zustand |
| Forms | React Hook Form + Zod |
| Canvas | Fabric.js (customizer) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Image | next/image với CDN |
| Fonts | next/font (Inter + custom display font) |

**Rendering strategy mặc định:**
- Public pages có SEO → **SSG + ISR** (revalidate 60s)
- Product detail → **SSG** per slug, ISR revalidate 30s
- Account / Cart / Checkout / Customizer → **CSR** (no SSR, `'use client'`)
- Admin dashboard → **CSR** (protected route)
- API routes → chỉ dùng cho webhook proxy nếu cần

---

## 2. Route Map

```
app/
├── (storefront)/
│   ├── page.tsx                          HOMEPAGE
│   ├── products/
│   │   ├── page.tsx                      PRODUCT LISTING
│   │   └── [slug]/
│   │       └── page.tsx                  PRODUCT DETAIL + CUSTOMIZER
│   ├── collections/
│   │   └── [slug]/page.tsx               COLLECTION PAGE
│   ├── categories/
│   │   └── [slug]/page.tsx               CATEGORY PAGE
│   ├── search/page.tsx                   SEARCH RESULTS
│   ├── cart/page.tsx                     CART
│   ├── checkout/
│   │   ├── page.tsx                      CHECKOUT FORM
│   │   └── success/page.tsx              ORDER SUCCESS
│   ├── orders/
│   │   ├── track/page.tsx                GUEST ORDER TRACKING
│   │   └── [orderNumber]/page.tsx        ORDER DETAIL (guest)
│   ├── account/
│   │   ├── page.tsx                      ACCOUNT OVERVIEW
│   │   ├── orders/page.tsx               ORDER HISTORY
│   │   ├── orders/[orderNumber]/page.tsx ORDER DETAIL
│   │   ├── addresses/page.tsx            ADDRESS BOOK
│   │   ├── wishlist/page.tsx             WISHLIST
│   │   └── profile/page.tsx             PROFILE SETTINGS
│   ├── gift-cards/page.tsx               GIFT CARD PURCHASE
│   └── pages/
│       ├── about/page.tsx
│       ├── contact/page.tsx
│       └── faq/page.tsx
│
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
└── (admin)/
    ├── layout.tsx                        ADMIN LAYOUT (sidebar)
    ├── dashboard/page.tsx
    ├── orders/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── products/
    │   ├── page.tsx
    │   ├── new/page.tsx
    │   └── [id]/edit/page.tsx
    ├── catalog/
    │   ├── categories/page.tsx
    │   └── collections/page.tsx
    ├── customers/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── promotions/page.tsx
    ├── reviews/page.tsx
    ├── shipping/page.tsx
    └── settings/page.tsx
```

---

## 3. Page Specs

---

### P01 — Homepage (`/`)

**Rendering:** SSG, ISR revalidate 60s

**Sections (top → bottom):**
1. **Hero Banner** — ảnh full-width, tagline, CTA button "Shop Now"
2. **Collections Grid** — 4–6 collection cards (seasonal/occasion)
3. **How It Works** — 4 bước: Choose → Personalize → Preview → Order
4. **Trending Products** — carousel 8 sản phẩm bán chạy nhất
5. **Category Showcase** — grid icon + label (Drinkware, Apparel, Home Decor...)
6. **Social Proof** — rating tổng, số đơn đã hoàn thành, badge Trustpilot
7. **Featured Reviews** — 3 review 5 sao nổi bật
8. **Newsletter Signup** — email input + CTA

**Component tree:**
```
HomePage
├── HeroBanner
├── CollectionsGrid
│   └── CollectionCard (×6)
├── HowItWorks
│   └── StepCard (×4)
├── TrendingProducts
│   ├── SectionHeader
│   └── ProductCarousel
│       └── ProductCard (×8)
├── CategoryShowcase
│   └── CategoryTile (×8)
├── SocialProof
├── FeaturedReviews
│   └── ReviewCard (×3)
└── NewsletterSection
```

**State:** Tất cả static, không cần client state.

---

### P02 — Product Listing (`/products`, `/categories/[slug]`, `/collections/[slug]`)

**Rendering:** SSG + ISR 30s

**Layout:** Sidebar filter (desktop) / Bottom sheet filter (mobile) + Product grid

**Sections:**
1. **Breadcrumb**
2. **Page Header** — tên category/collection + số lượng sản phẩm
3. **Filter Bar** (desktop: sidebar trái; mobile: button mở sheet)
   - Category (checkbox tree)
   - Price Range (slider)
   - Rating (star select)
   - Tags (checkbox)
4. **Sort Dropdown** — Newest / Price Low-High / Price High-Low / Best Selling / Rating
5. **Product Grid** — 24 sản phẩm/trang, 4 cột desktop / 2 cột mobile
6. **Pagination**

**Component tree:**
```
ProductListingPage
├── Breadcrumb
├── PageHeader
├── FilterSidebar (desktop) | FilterSheet (mobile)
│   ├── CategoryFilter
│   ├── PriceRangeFilter
│   ├── RatingFilter
│   └── TagFilter
├── ProductGrid
│   └── ProductCard (×24)
│       ├── ProductImage (với hover zoom)
│       ├── ProductBadges (Sale, New, In demand)
│       ├── ProductName
│       ├── PriceDisplay (giá + compareAtPrice)
│       ├── RatingSummary (stars + count)
│       └── WishlistButton
└── Pagination
```

**State (Zustand — `useFilterStore`):**
```typescript
interface FilterStore {
  filters: {
    category?: string
    tags: string[]
    minPrice?: number
    maxPrice?: number
    minRating?: number
  }
  sort: SortOption
  page: number
  setFilter: (key, value) => void
  resetFilters: () => void
  setSort: (sort: SortOption) => void
  setPage: (page: number) => void
}
```

**Loading state:** Skeleton cards (×24) trong khi fetch.
**Empty state:** Illustration + "No products found" + "Clear filters" button.

---

### P03 — Product Detail + Customizer (`/products/[slug]`)

**Rendering:** SSG per slug, ISR 30s. Customizer section là `'use client'`.

**Layout:** 2 cột desktop (ảnh trái, info + customizer phải) / single column mobile

**Sections:**
1. **Breadcrumb**
2. **Image Gallery** — main image + thumbnail strip, zoom on hover
3. **Product Info**
   - Tên, rating summary, soldCount badge ("X sold in last 24h")
   - Price (+ compareAtPrice nếu có sale)
   - Short description
4. **Variant Selector** — size/color pills, chọn trước khi customize
5. **Customizer Panel** ← xem spec riêng `18_customizer_design.spec.md`
6. **Add to Cart Button** — disabled cho đến khi hoàn thành required fields
7. **Product Description** — tabs: Description / Size Guide / Shipping & Returns
8. **Review Section** — summary + list (paginated, filterable by stars)
9. **Related Products** — carousel 8 sản phẩm

**State (Zustand — `useCustomizerStore`):**
Xem spec riêng `18_customizer_design.spec.md`

**Auto-fill prompt:**
Nếu user đã đăng nhập và có lịch sử customize sản phẩm này:
```
┌─────────────────────────────────────────────┐
│ 💡 You have a previous customization.       │
│    Would you like to auto-fill it?          │
│         [Yes, auto-fill]  [Start fresh]     │
└─────────────────────────────────────────────┘
```

**SEO Meta:**
```typescript
export async function generateMetadata({ params }) {
  const product = await getProduct(params.slug)
  return {
    title: `${product.name} | MapleLoomHandmade`,
    description: product.shortDescription,
    openGraph: {
      title: product.name,
      images: [product.images[0].url],
      type: 'product',
    },
    other: {
      'product:price:amount': product.basePrice,
      'product:price:currency': 'USD',
    }
  }
}
```

---

### P04 — Cart (`/cart`)

**Rendering:** CSR (`'use client'`)

**Layout:** 2 cột — Cart items (trái) + Order Summary (phải)

**Cart Item hiển thị:**
- Ảnh preview customization (thumbnail 80×80)
- Tên sản phẩm + variant
- Tóm tắt customization (VD: "Name: John, Style: Watercolor")
- Số lượng (input +/−)
- Giá đơn vị × số lượng
- Nút xóa

**Order Summary:**
- Subtotal
- Shipping (ước tính, "calculated at checkout")
- Discount (nếu có coupon)
- **Total**
- Coupon input
- Nút "Proceed to Checkout"

**Empty Cart:** Illustration + "Your cart is empty" + "Start Shopping" button.

**State (Zustand — `useCartStore`):**
```typescript
interface CartStore {
  items: CartItem[]
  coupon: CouponData | null
  isLoading: boolean

  addItem: (product, variant, customization) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, qty: number) => Promise<void>
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => void
  clearCart: () => void
  syncWithServer: () => Promise<void>  // gọi khi mount
}
```

---

### P05 — Checkout (`/checkout`)

**Rendering:** CSR, protected (redirect về login hoặc cho phép guest)

**Steps (multi-step form, không navigate — dùng stepper UI):**
```
Step 1: Contact & Shipping
  → Email (nếu guest)
  → Full name, phone
  → Address line 1, 2
  → City, State, Zip, Country
  → [Continue to Shipping]

Step 2: Shipping Method
  → Danh sách shipping methods + estimated delivery
  → [Continue to Payment]

Step 3: Payment
  → Stripe Elements (Card / Apple Pay / Google Pay)
  → Gift Card input (optional)
  → Order summary bên phải
  → [Place Order]
```

**Form validation (Zod):**
```typescript
const checkoutSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,15}$/),
  addressLine1: z.string().min(5),
  city: z.string().min(1),
  postalCode: z.string().min(3),
  country: z.string().length(2),
})
```

**Price change warning:** Nếu giá sản phẩm thay đổi kể từ lúc thêm vào giỏ, hiện banner:
```
⚠️ Price of "Custom Mug" has changed from $24.99 to $27.99.
   Please review before placing your order.
```

---

### P06 — Order Success (`/checkout/success`)

**Sections:**
1. ✅ Animated checkmark
2. Order number (bold, copiable)
3. "A confirmation email has been sent to {email}"
4. Order summary (items, total, shipping address)
5. Estimated delivery date
6. CTA: "Track Order" + "Continue Shopping"

---

### P07 — Search Results (`/search?q=...`)

**Rendering:** CSR

**Layout:** Tương tự Product Listing nhưng:
- Hiện "X results for '{query}'"
- Highlight từ khóa trong tên sản phẩm
- Autocomplete dropdown khi gõ (debounce 300ms)
- No results: "No results for '{query}'" + trending products

---

### P08 — Account Pages (`/account/*`)

**Rendering:** CSR, protected (redirect về `/login` nếu chưa đăng nhập)

**Layout:** 2 cột — Sidebar nav (trái) + Content (phải)

**Sidebar nav:**
- My Orders
- Wishlist
- Address Book
- Profile & Password
- Sign Out

**Order History (`/account/orders`):**
- List card: order number, date, status badge, total, thumbnail items
- Click → Order detail
- Filter by status

**Order Detail (`/account/orders/[orderNumber]`):**
- Order info + status timeline
- Items với ảnh preview customization
- Tracking info (nếu có)
- Cancel button (chỉ hiện khi còn trong 2h)

**Address Book (`/account/addresses`):**
- List addresses, badge "Default"
- Add / Edit / Delete / Set as default
- Form: tương tự checkout address form

---

### P09 — Auth Pages

**Login:**
- Email + Password form
- Google OAuth button
- "Forgot password?" link
- "Don't have account? Register"
- Redirect to: `?redirect=` param hoặc homepage

**Register:**
- First name, Last name, Email, Password, Confirm Password
- Google OAuth button
- Sau đăng ký → toast "Check your email to verify your account"

**Forgot / Reset Password:**
- Forgot: chỉ email input → "Reset link sent" toast
- Reset: new password + confirm (URL có token)

---

### P10 — Admin Pages (`/admin/*`)

**Layout:** Fixed sidebar (240px) + Main content area

**Sidebar:**
```
📊 Dashboard
📦 Orders
🛍️ Products
📂 Catalog
  ├── Categories
  └── Collections
👥 Customers
🏷️ Promotions
⭐ Reviews
🚚 Shipping
💳 Payments
⚙️ Settings
```

**Dashboard KPI Cards:**
- 4 cards hàng đầu: Revenue Today / Orders Today / Pending / In Production
- Revenue Chart (Recharts LineChart) — 30 ngày
- Orders by Status (Recharts PieChart)
- Top 10 Products table
- Recent Reviews needing approval

**Orders Table:**
- Columns: Order # / Customer / Date / Status / Total / Actions
- Filter: Status dropdown, Date range picker, Search by order # / email
- Bulk actions: Export selected to CSV
- Row click → Order detail drawer (slide-in)

**Order Detail (drawer):**
- Timeline trạng thái
- Items với ảnh customization (click để xem full)
- Customer info
- Shipping info + tracking input
- Status update dropdown + Save button
- Refund button

---

## 4. Shared Components

### Layout Components
```
components/
├── layout/
│   ├── Navbar.tsx            — Logo, Nav links, Search, Cart icon, User menu
│   ├── Footer.tsx
│   ├── AdminSidebar.tsx
│   └── MobileBottomNav.tsx   — Mobile: Home, Search, Cart, Account
```

### UI Components (tái sử dụng)
```
components/ui/                — shadcn/ui components (Button, Input, Dialog...)
components/common/
├── ProductCard.tsx
├── ProductCardSkeleton.tsx
├── RatingStars.tsx
├── PriceDisplay.tsx          — basePrice + compareAtPrice + % off badge
├── OrderStatusBadge.tsx
├── Pagination.tsx
├── ImageUploader.tsx
├── LoadingSpinner.tsx
├── EmptyState.tsx
├── ErrorState.tsx
└── ConfirmDialog.tsx
```

---

## 5. State Management Architecture

### Zustand — UI State Only

Zustand quản lý **ephemeral UI state** không cần server sync:

```typescript
// stores/
├── cart.store.ts         — CartUIStore: { isDrawerOpen, openDrawer, closeDrawer }
├── customizer.store.ts   — CustomizerStore (spec 18) — canvas fields, preview, history
└── auth.store.ts         — { user, isLoading, setUser, logout }
```

> ⚠️ **Rule:** Zustand stores KHÔNG được gọi `fetch()` trực tiếp.
> Tất cả server data đi qua React Query (`@mlh/api-client` hooks).

### React Query — Server State

Mọi client component lấy server data qua hooks từ `@mlh/api-client`:

```typescript
// Đúng ✅
const { data: cart, isLoading } = useCart();
const { updateItem } = useMutateCart();

// Sai ❌ — không gọi fetch() trực tiếp trong component
const [cart, setCart] = useState(null);
useEffect(() => { fetch('/api/v1/cart').then(...) }, []);
```

---

## 6. React Query Conventions

### QueryClient Configuration

```typescript
// apps/client/src/components/providers/ReactQueryProvider.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,    // 1 min — giảm refetch thừa
      gcTime:               5 * 60_000, // 5 min — cache tối thiểu
      retry:                shouldRetry, // không retry 401/403/404
      retryDelay:           exponentialBackoff, // 1s → 2s → 4s → max 10s
      refetchOnWindowFocus: false,      // tránh refetch khi switch tab
      throwOnError:         false,      // xử lý lỗi tại component
    },
    mutations: { retry: 0 },
  },
})
```

### Centralized Query Keys

Tất cả query keys nằm trong `libs/shared/api-client/src/queryKeys.ts`:

```typescript
import { queryKeys } from '@mlh/api-client';

// Dùng factory để type-safe + dễ invalidate
queryKeys.cart()                        // ['cart']
queryKeys.products({ page: 1 })        // ['products', { page: 1 }]
queryKeys.product('my-slug')           // ['products', 'detail', 'my-slug']
queryKeys.reviews('slug', { page: 1 }) // ['reviews', 'slug', { page: 1 }]
queryKeys.order('MLH-2024-00001')      // ['orders', 'detail', 'MLH-...']

// Invalidate toàn domain (e.g. sau khi tạo sản phẩm mới)
qc.invalidateQueries({ queryKey: PRODUCTS_KEY })  // invalidates all product queries
qc.invalidateQueries({ queryKey: CART_KEY })       // invalidates cart
```

### Available Hooks (`@mlh/api-client`)

| Hook | Type | Description |
|------|------|-------------|
| `useProducts(query)` | Query | Paginated product list |
| `useProduct(slug)` | Query | Single product detail |
| `useRelatedProducts(slug)` | Query | Related products |
| `usePrefetchProduct()` | Util | Prefetch on card hover |
| `useCart()` | Query | Current cart (staleTime: 30s) |
| `useMutateCart()` | Mutation | addItem, updateItem (optimistic), removeItem (optimistic), applyCoupon, removeCoupon, clearCart |
| `useOrders(query)` | Query | Paginated order list |
| `useOrder(orderNumber)` | Query | Single order detail |
| `useCheckout()` | Mutation | createOrder, createPaymentIntent, validateCoupon, applyGiftCard |
| `useWishlist()` | Query | User wishlist |
| `useMutateWishlist()` | Mutation | addToWishlist, removeFromWishlist |
| `useSearch(query)` | Query | Product search (disabled when q empty) |
| `useSearchSuggestions(q)` | Query | Typeahead (enabled when q.length ≥ 2) |
| `useReviews(slug, query)` | Query | Paginated reviews |
| `useReviewSummary(slug)` | Query | Rating summary (staleTime: 5 min) |
| `useCategories(query)` | Query | Category list |
| `useCategory(slug)` | Query | Single category + children |
| `useCollections(query)` | Query | Collection list |
| `useCollection(slug)` | Query | Single collection |
| `useNewsletterSubscribe()` | Mutation | Newsletter signup |
| `useProfile()` | Query | Current user profile |
| `useMutateProfile()` | Mutation | updateProfile, changePassword |
| `useAddresses()` | Query | User address book |
| `useMutateAddresses()` | Mutation | addAddress, updateAddress, deleteAddress |

### Optimistic Updates Pattern

`updateItem` và `removeItem` dùng **optimistic updates** với rollback:

```typescript
// Pattern trong useMutateCart:
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey: CART_KEY });   // hủy inflight requests
  const snapshot = qc.getQueryData(CART_KEY);        // snapshot để rollback
  qc.setQueryData(CART_KEY, optimisticState);        // apply ngay lập tức
  return { snapshot };
},
onError: (_err, _vars, ctx) => {
  qc.setQueryData(CART_KEY, ctx?.snapshot);          // rollback khi lỗi
},
onSettled: () => {
  qc.invalidateQueries({ queryKey: CART_KEY });      // sync với server
},
```

### Server Components vs Client Components

| Context | Pattern | Lý do |
|---------|---------|-------|
| Server Component (page.tsx) | `fetch()` trực tiếp + `next: { revalidate }` | RSC không có React Context |
| Client Component | React Query hooks từ `@mlh/api-client` | Cache, deduplication, optimistic UI |
| Zustand store | KHÔNG fetch | UI state only |

### Error Handling

```typescript
// Query error — hiển thị inline
const { data, isError, refetch } = useProducts();
if (isError) return <ErrorState onRetry={refetch} />;

// Mutation error — hiển thị inline hoặc toast
const { addItem } = useMutateCart();
addItem.mutate(input, {
  onError: (err) => showToast(err.message, 'error'),
});

// isPending — disable button + show spinner
<button disabled={addItem.isPending}>
  {addItem.isPending ? 'Adding…' : 'Add to Cart'}
</button>
```

---

## 7. Error & Loading States (chuẩn cho mọi page)

### Loading States
- **List pages:** Skeleton cards (giữ layout, không CLS)
- **Detail pages:** Skeleton với cùng layout thực
- **Buttons khi submit:** Spinner icon + disabled, text đổi thành "Processing..."
- **Image upload:** Progress bar %

### Error States
- **Network error:** Toast "Connection error. Please try again." + Retry button
- **404:** Custom 404 page với illustration + "Go back home"
- **500:** "Something went wrong" + Error ID (requestId) để support

### Empty States
- Mỗi list page có empty state riêng với illustration phù hợp + CTA

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Notes |
|-----------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |

**Mobile-specific behaviors:**
- Navbar → hamburger menu
- Filter sidebar → bottom sheet (slide up)
- Product grid → 2 cột
- Customizer → full-screen modal với canvas ở trên, fields ở dưới
- Checkout → single column, steps là accordion

---

## 9. SEO Strategy

| Page | Strategy | Metadata |
|------|----------|----------|
| Homepage | SSG | Title: "MapleLoomHandmade — Personalized Gifts" |
| Product | SSG+ISR | Title: "{name} \| MapleLoomHandmade", OG image: product image |
| Category | SSG+ISR | Title: "{category} Gifts \| MapleLoomHandmade" |
| Collection | SSG+ISR | Title: "{collection} \| MapleLoomHandmade" |
| Search | CSR | noindex (dynamic) |
| Account | CSR | noindex (private) |
| Admin | CSR | noindex (private) |

**Sitemap:** Auto-generate từ tất cả product slugs + category/collection slugs.
**Structured Data:** `Product` schema trên product detail pages (rating, price, availability).
