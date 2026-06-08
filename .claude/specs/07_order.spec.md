# Module 07 — Orders

## 1. Endpoints

### Public / Customer
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/orders` | Tạo đơn hàng (checkout) | Bearer |
| GET | `/api/v1/orders/me` | Đơn hàng của tôi (phân trang) | Bearer |
| GET | `/api/v1/orders/me/{orderNumber}` | Chi tiết đơn hàng của tôi | Bearer |
| GET | `/api/v1/orders/{orderNumber}` | Guest order tra cứu (`?email=` required) | No |
| POST | `/api/v1/orders/{orderNumber}/cancel` | Huỷ đơn (trong 2h sau confirm) | Bearer |

### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/orders` | All orders (filterable) | ADMIN |
| GET | `/api/v1/admin/orders/export` | Export orders as CSV | ADMIN |
| GET | `/api/v1/admin/orders/{id}` | Chi tiết đơn hàng by ID | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/status` | Cập nhật order status | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/tracking` | Add tracking information | ADMIN |

## 2. Order Status Flow

```
PENDING_PAYMENT
  └── CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED → COMPLETED
               ↘ CANCELLED (within 2h of CONFIRMED)
  └── (expired/failed)

CONFIRMED → REFUND_REQUESTED → REFUNDED
CONFIRMED → DISPUTED
```

### Status enum
`PENDING_PAYMENT | CONFIRMED | IN_PRODUCTION | SHIPPED | DELIVERED | COMPLETED | CANCELLED | REFUND_REQUESTED | REFUNDED | DISPUTED`

## 3. Prisma Models

```prisma
enum OrderStatus {
  PENDING_PAYMENT CONFIRMED IN_PRODUCTION SHIPPED DELIVERED
  COMPLETED CANCELLED REFUND_REQUESTED REFUNDED DISPUTED
}

model Order {
  id              String        @id @default(cuid())
  orderNumber     String        @unique  // human-readable e.g. "MLH-20240601-0001"
  userId          String?
  guestEmail      String?
  status          OrderStatus   @default(PENDING_PAYMENT)
  // Shipping snapshot (scalar fields, not FK — preserved if user updates address)
  shippingName    String
  shippingPhone   String
  shippingAddress String
  shippingCity    String
  shippingState   String?
  shippingZip     String
  shippingCountry String
  shippingMethod  String?
  shippingCost    Decimal       @default(0)
  // Totals
  subtotal        Decimal
  discountAmount  Decimal       @default(0)
  total           Decimal
  couponCode      String?
  // Tracking
  trackingNumber  String?
  trackingUrl     String?
  carrier         String?
  // Meta
  note            String?
  cancelReason    String?
  cancelledAt     DateTime?
  confirmedAt     DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  // Relations
  items           OrderItem[]
  statusHistory   OrderStatusHistory[]
  payment         Payment?
  promotionUsages PromotionUsage[]
  giftCardUsages  GiftCardUsage[]
}

model OrderItem {
  id                String   @id @default(cuid())
  orderId           String
  productId         String
  variantId         String?
  productName       String
  variantName       String?
  quantity          Int
  unitPrice         Decimal
  customizationData Json?
  previewUrl        String?
}

model OrderStatusHistory {
  id        String      @id @default(cuid())
  orderId   String
  status    OrderStatus
  note      String?
  createdBy String?     // userId of admin who changed
  createdAt DateTime    @default(now())
}
```

## 4. DTOs

### OrderDto
```typescript
interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  shippingAddress: {
    name: string; phone: string; address: string;
    city: string; state?: string; zip: string; country: string;
  };
  shippingMethod?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  items: OrderItemDto[];
  couponCode?: string;
  note?: string;
  createdAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

interface OrderItemDto {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  customizationData?: object;
  previewUrl?: string;
}
```

### CreateOrderDto
```typescript
interface CreateOrderDto {
  shippingAddressId: string;
  shippingMethod: string;
  paymentMethod: 'stripe' | 'paypal' | 'gift_card' | 'mixed';
  couponCode?: string;
  giftCardCode?: string;
  note?: string;
}
```

## 5. Checkout Flow (Client)

1. `/[locale]/checkout` — Multi-step checkout page
2. Step 1: `DeliveryForm` — address selection / entry
3. Step 2: `ShippingForm` — shipping method selection
4. Step 3: `PaymentForm` — Stripe Elements / PayPal / Gift Card
5. Payment success → `POST /api/v1/orders`
6. Redirect → `/[locale]/checkout/success?orderNumber=...`

Also: `/[locale]/orders/track` — guest order tracking page

Files: `apps/client/src/components/checkout/`

## 6. Cancellation Window

- 2 giờ sau khi CONFIRMED
- Sau 2 giờ: phải liên hệ support
- Huỷ → trigger refund flow qua Payment service
- Email notification khi order cancelled
- `CancelCountdown` component trong order detail page

## 7. Business Rules

- Tạo order: validate cart items còn hàng + giá không đổi
- Shipping address snapshot vào scalar fields (không FK) để tránh mất data khi user update address
- `OrderStatusHistory` ghi lại mọi thay đổi status kèm note + admin userId
- `orderNumber` là human-readable unique string (prefix: `MLH-`)
- Guest orders: `guestEmail` required, tra cứu qua `/orders/:orderNumber?email=`
