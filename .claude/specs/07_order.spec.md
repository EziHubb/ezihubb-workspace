# Module 07 — Orders

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/orders` | Danh sách đơn hàng của user | Bearer |
| GET | `/api/v1/orders/{id}` | Chi tiết đơn hàng | Bearer |
| POST | `/api/v1/orders` | Tạo đơn hàng (checkout) | Bearer |
| POST | `/api/v1/orders/{id}/cancel` | Huỷ đơn (trong 2h) | Bearer |
| GET | `/api/v1/orders/track/{trackingNumber}` | Tra cứu vận chuyển | No |
| GET | `/api/v1/admin/orders` | Admin: all orders | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/status` | Admin: cập nhật status | ADMIN |

## 2. Order Status Flow

```
PENDING_PAYMENT
  └── PAYMENT_CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                       ↘ CANCELLED (within 2h of PAYMENT_CONFIRMED)
  └── PAYMENT_FAILED → CANCELLED
```

## 3. Prisma Models

```prisma
model Order {
  id              String        @id @default(cuid())
  userId          String
  status          OrderStatus   @default(PENDING_PAYMENT)
  subtotal        Decimal
  shippingCost    Decimal       @default(0)
  taxAmount       Decimal       @default(0)
  discountAmount  Decimal       @default(0)
  total           Decimal
  currency        String        @default("USD")
  shippingAddress Json
  billingAddress  Json?
  trackingNumber  String?
  notes           String?
  cancelledAt     DateTime?
  cancelReason    String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  items           OrderItem[]
  payments        Payment[]
  user            User          @relation(...)
}

model OrderItem {
  id            String   @id @default(cuid())
  orderId       String
  productId     String
  variantId     String?
  productName   String
  variantName   String?
  sku           String
  quantity      Int
  unitPrice     Decimal
  totalPrice    Decimal
  imageUrl      String?
  customization Json?
}
```

## 4. DTOs

### OrderDto
```typescript
interface OrderDto {
  id: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED';
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  shippingAddress: AddressSnapshot;
  items: OrderItemDto[];
  trackingNumber?: string;
  createdAt: string;
  cancelledAt?: string;
}

interface OrderItemDto {
  id: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  customization?: object;
}
```

### CreateOrderDto
```typescript
interface CreateOrderDto {
  cartId?: string;
  shippingAddressId: string;
  billingAddressId?: string;
  promoCode?: string;
  paymentMethod: 'stripe' | 'paypal';
  notes?: string;
}
```

## 5. Checkout Flow (Client)

1. `/[locale]/(main)/checkout` — Checkout page
2. Step 1: Address selection (useAddresses hook)
3. Step 2: Shipping method selection
4. Step 3: Payment (Stripe Elements / PayPal SDK)
5. On payment success → `POST /api/v1/orders` với paymentMethod
6. Redirect → `/[locale]/checkout/success?orderId=...`

## 6. Cancellation Window

- 2 giờ sau khi PAYMENT_CONFIRMED
- Sau 2 giờ: phải liên hệ support
- Huỷ → hoàn tiền tự động qua Stripe/PayPal refund API
- Email notification khi order cancelled

## 7. Business Rules

- Tạo order: validate cart items còn hàng + giá không đổi
- Snapshot địa chỉ vào order (không link FK) để tránh mất data khi user update address
- Inventory check khi confirm payment (reserve trong PROCESSING)
- Order total = subtotal + shippingCost + taxAmount - discountAmount
