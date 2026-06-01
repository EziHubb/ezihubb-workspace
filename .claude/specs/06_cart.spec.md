# Module 06 — Cart

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/cart` | Lấy giỏ hàng | Optional |
| POST | `/api/v1/cart/items` | Thêm sản phẩm | Optional |
| PATCH | `/api/v1/cart/items/{itemId}` | Cập nhật số lượng | Optional |
| DELETE | `/api/v1/cart/items/{itemId}` | Xoá sản phẩm | Optional |
| DELETE | `/api/v1/cart` | Xoá toàn bộ giỏ hàng | Optional |
| POST | `/api/v1/cart/merge` | Merge guest cart vào user cart | Bearer |

## 2. Guest Cart vs Authenticated Cart

### Guest Cart
- `sessionId` (UUID v4) lưu trong localStorage (key: `mlh-cart`)
- Mỗi request gửi header: `X-Session-ID: <sessionId>`
- Cart lưu trong Redis với key: `cart:session:<sessionId>`
- TTL: 7 ngày (tự động gia hạn mỗi lần access)

### Authenticated Cart
- Dùng `Authorization: Bearer <token>` header
- Cart lưu trong PostgreSQL (Prisma) + Redis cache
- Sau login: `POST /api/v1/cart/merge` tự động được gọi bởi auth store

### Merge Flow
1. User login → auth store gọi `cartStore.mergeGuestCart()`
2. Cart store POST `/api/v1/cart/merge` với `X-Session-ID` header
3. API merge items (quantity cộng dồn nếu trùng SKU)
4. Cart store xoá sessionId khỏi localStorage

## 3. Shared Types

```typescript
// libs/shared/types/src/lib/cart.types.ts

interface CartItemDto {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  product: {
    name: string;
    slug: string;
    images: { url: string }[];
  };
  variant?: {
    options: Record<string, string>;
    sku: string;
  };
  customization?: {
    templateId: string;
    fields?: Record<string, string>;
    bundleCount?: number;
    items?: { fields: Record<string, string> }[];
  };
  priceChanged?: boolean;
  totalPrice: number;
  // compat flat fields (required):
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
  totals: CartTotals;
}
```

## 4. Client Cart Store (Zustand)

File: `apps/client/src/lib/store/cart.store.ts`

**Persisted state** (key: `mlh-cart`):
```typescript
{ sessionId: string }  // only sessionId persisted
```

**In-memory state:**
```typescript
{
  cart: CartDto | null;
  isLoading: boolean;
}
```

**Actions:**
- `fetchCart()` — GET /cart
- `addItem(dto: AddToCartDto)` — POST /cart/items + optimistic update
- `updateItem(itemId, qty)` — PATCH /cart/items/{id}
- `removeItem(itemId)` — DELETE /cart/items/{id}
- `clearCart()` — DELETE /cart + clear local state
- `mergeGuestCart()` — POST /cart/merge (gọi sau login)
- `sessionHeader()` — returns `{'X-Session-ID': sessionId}` khi guest

**normalizeCart():** Đảm bảo compat fields tồn tại:
```typescript
function normalizeCart(cart: CartDto): CartDto {
  return {
    ...cart,
    totals: cart.totals ?? { subtotal: 0, shipping: 0, tax: 0, discount: 0, total: cart.subtotal },
    items: cart.items.map(item => ({
      ...item,
      productName: item.productName ?? item.product?.name ?? '',
      productSlug: item.productSlug ?? item.product?.slug ?? '',
      productImageUrl: item.productImageUrl ?? item.product?.images?.[0]?.url,
    })),
  };
}
```

## 5. Prisma Models

```prisma
model Cart {
  id        String     @id @default(cuid())
  userId    String?    @unique
  sessionId String?    @unique
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id            String   @id @default(cuid())
  cartId        String
  productId     String
  variantId     String?
  quantity      Int
  price         Decimal
  customization Json?
  cart          Cart     @relation(...)
  product       Product  @relation(...)
}
```

## 6. Business Rules

- Không có max items limit (giới hạn mềm: 50 items)
- Khi variant đổi giá → `priceChanged: true` trong CartItemDto
- Quantity min: 1, max: 99 per line item
- Guest cart expire: 7 ngày không hoạt động
- Merge: quantity cộng dồn nếu cùng (productId + variantId + customization hash)
- Customization khác nhau → line items riêng biệt
