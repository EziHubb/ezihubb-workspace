# Module 06 — Cart

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/cart` | Lấy giỏ hàng (tạo mới nếu chưa có) | Optional |
| POST | `/api/v1/cart/items` | Thêm sản phẩm | Optional |
| PATCH | `/api/v1/cart/items/{itemId}` | Cập nhật số lượng | Optional |
| DELETE | `/api/v1/cart/items/{itemId}` | Xoá sản phẩm | Optional |
| DELETE | `/api/v1/cart` | Xoá toàn bộ giỏ hàng (HTTP 204) | Optional |
| POST | `/api/v1/cart/merge` | Merge guest cart vào user cart | Bearer |
| POST | `/api/v1/cart/apply-coupon` | Apply coupon code | Optional |
| DELETE | `/api/v1/cart/coupon` | Remove coupon | Optional |
| POST | `/api/v1/cart/estimate-shipping` | Estimate shipping costs | Optional |

## 2. Guest Cart vs Authenticated Cart

### Guest Cart

- `sessionId` (UUID) sinh server-side, lưu trong httpOnly cookie: `cart_session`
- Cookie: `httpOnly: true`, `secure: true` (production), `sameSite: none` (production) / `lax` (dev), TTL: 30 ngày
- Cart lưu trong PostgreSQL với `sessionId` (không phải userId)
- Mỗi GET/POST `/cart` — nếu chưa có cookie, API tạo session mới và set cookie qua `Set-Cookie` header
- **Lưu ý:** Client store dùng localStorage key `ezihubb-cart` chỉ để persist `sessionId`, nhưng session thực tế được quản lý bởi cookie phía server

### Authenticated Cart

- Dùng `Authorization: Bearer <token>` header
- Cart lưu trong PostgreSQL với `userId`
- Sau login: `POST /api/v1/cart/merge` tự động được gọi bởi auth store

### Merge Flow

1. User login → auth store gọi `cartStore.mergeGuestCart()`
2. Cart store POST `/api/v1/cart/merge` với cookie `cart_session`
3. API merge items (quantity cộng dồn nếu trùng productId + variantId + customizationData hash)
4. Guest cart được xoá sau khi merge

## 3. Shared Types

```typescript
// libs/shared/types/src/lib/cart.types.ts

interface CartItemDto {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  customizationData?: {
    templateId: string;
    fields?: Record<string, string>;
    bundleCount?: number;
    items?: { fields: Record<string, string> }[];
  };
  previewUrl?: string;
  product: {
    name: string;
    slug: string;
    images: { url: string }[];
  };
  variant?: {
    options: Record<string, string>;
    sku: string;
  };
  priceChanged?: boolean;
  totalPrice: number;
  // Compat flat fields (required):
  productName: string;
  productSlug: string;
  productImageUrl?: string;
  variantName?: string;
}

interface CartTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

interface CartDto {
  id?: string;
  items: CartItemDto[];
  subtotal: number;
  itemCount: number;
  couponCode?: string;
  discountAmount?: number;
  totals: CartTotals;
}
```

## 4. Client Cart Store (Zustand)

File: `apps/client/src/lib/store/cart.store.ts`

**Persisted state** (key: `ezihubb-cart`):
```typescript
{
  sessionId: string | null;
} // only sessionId persisted (backup; server cookie is authoritative)
```

**In-memory state:**
```typescript
{
  cart: CartDto | null;
  isLoading: boolean;
  isDrawerOpen: boolean;
}
```

**Actions:**
- `initSession()` — generate session UUID if needed
- `fetchCart()` — GET /cart
- `addItem(dto: AddItemDto)` — POST /cart/items + optimistic update + analytics
- `updateItem(itemId, qty)` — PATCH /cart/items/{id} (optimistic)
- `removeItem(itemId)` — DELETE /cart/items/{id} (optimistic)
- `applyCoupon(code)` — POST /cart/apply-coupon
- `removeCoupon()` — DELETE /cart/coupon
- `clearCart()` — DELETE /cart + clear local state
- `mergeGuestCart()` — POST /cart/merge (called after login)
- `openDrawer()` / `closeDrawer()` — manage CartDrawer UI

**normalizeCart():** Ensures compat fields (`productName`, `productSlug`, `productImageUrl`) exist on all items.

## 5. Prisma Models

```prisma
model Cart {
  id             String     @id @default(cuid())
  userId         String?    @unique
  sessionId      String?    @unique
  couponCode     String?
  discountAmount Decimal    @default(0)
  items          CartItem[]
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  expiresAt      DateTime?
}

model CartItem {
  id                String   @id @default(cuid())
  cartId            String
  productId         String
  variantId         String?
  quantity          Int
  unitPrice         Decimal
  customizationData Json?
  previewUrl        String?
  createdAt         DateTime @default(now())
  cart              Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product           Product  @relation(fields: [productId], references: [id])
  variant           ProductVariant? @relation(fields: [variantId], references: [id])
}
```

## 6. AddCartItemDto

```typescript
interface AddCartItemDto {
  productId: string;
  variantId?: string;
  quantity: number;
  customizationData?: {
    templateId: string;
    fields?: Record<string, string>;
    bundleCount?: number;
    items?: { fields: Record<string, string> }[];
  };
  previewUrl?: string;
}
```

## 7. EstimateShippingDto

```typescript
interface EstimateShippingDto {
  country: string;
  state?: string;
  postalCode?: string;
}
```

## 8. Business Rules

- Giới hạn mềm: 50 items (`MAX_ITEMS = 50`)
- `priceChanged: true` trong CartItemDto khi variant đổi giá
- Quantity min: 1, max: 99 per line item
- Guest cart expire: 30 ngày không hoạt động (`GUEST_CART_TTL_MS`)
- Merge: quantity cộng dồn nếu cùng (productId + variantId + customizationData hash)
- Customization khác nhau → line items riêng biệt
- Coupon validation: active + date range + usage limit + min order amount
- Discount capped at order subtotal
- Cart session cookie path: `/` (không bị restrict như refresh token)
- `getOrCreateCart()` — tự động tạo cart nếu chưa có, trả về `{ cart, newSessionId? }`; client nhận `newSessionId` và persist vào store
