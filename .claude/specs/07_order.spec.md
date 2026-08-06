# Module 07 — Orders

## 1. Endpoints

### Public / Customer
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/orders/tax-preview` | Preview tax (US only — TaxJar or fallback) | No |
| POST | `/api/v1/orders` | Tạo đơn hàng (checkout) | Optional (guest allowed) |
| GET | `/api/v1/orders/me` | Đơn hàng của tôi (phân trang) | Bearer |
| GET | `/api/v1/orders/me/{orderNumber}` | Chi tiết đơn hàng của tôi | Bearer |
| GET | `/api/v1/orders/track` | Guest order lookup (`?orderNumber=&email=`) | No |
| GET | `/api/v1/orders/{orderNumber}` | Order detail — auth user by userId, guest by `?email=` | Optional |
| POST | `/api/v1/orders/{orderNumber}/cancel` | Huỷ đơn (2h window, guest allowed) | Optional |
| GET | `/api/v1/orders/{id}/invoice` | Download own invoice PDF | Bearer |
| GET | `/api/v1/orders/{orderId}/tracking` | Get order tracking stages + events | Bearer |

### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/orders` | All orders (filterable, paginated) | ADMIN |
| GET | `/api/v1/admin/orders/export` | Export orders as CSV | ADMIN |
| GET | `/api/v1/admin/orders/{id}/invoice` | Generate / return cached invoice PDF | ADMIN |
| GET | `/api/v1/admin/orders/{id}/packing-slip` | Generate / return cached packing slip PDF | ADMIN |
| POST | `/api/v1/admin/orders/bulk-packing-slips` | Generate packing slips for multiple orders | ADMIN |
| GET | `/api/v1/admin/orders/{id}` | Chi tiết đơn hàng by ID | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/status` | Cập nhật order status | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/tracking` | Add tracking information | ADMIN |
| PATCH | `/api/v1/admin/orders/{id}/ship` | Mark order SHIPPED — saves tracking, registers EasyPost tracker, emails customer | ADMIN |
| GET | `/api/v1/admin/orders/{id}/rates` | Get EasyPost shipping rates (no charge) | ADMIN |
| POST | `/api/v1/admin/orders/{id}/buy-label` | Purchase EasyPost label (irreversible) | ADMIN |
| POST | `/api/v1/admin/orders/{id}/note` | Add / update private admin note | ADMIN |
| POST | `/api/v1/admin/orders/{id}/cancel` | Admin-cancel order (no time restriction) | ADMIN |
| GET | `/api/v1/admin/orders/{id}/earnings` | Earnings breakdown (fees, net) | ADMIN |

## 2. Order Status Flow

```
PENDING_PAYMENT
  └── CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED → COMPLETED
               ↘ CANCELLED (within 2h of CONFIRMED, or admin-cancel at any time)
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
  taxAmount       Decimal       @default(0)
  total           Decimal
  couponCode      String?
  // Tracking
  trackingNumber  String?
  trackingUrl     String?
  carrier         String?
  trackerId       String?       // EasyPost tracker ID
  // EasyPost label
  easypostShipmentId String?
  easypostRateId     String?
  labelUrl           String?
  labelVoidedAt      DateTime?
  // Gift options
  isGift          Boolean       @default(false)
  giftMessage     String?
  giftFrom        String?
  giftReceipt     Boolean       @default(false)
  giftWrapping    Boolean       @default(false)
  // Meta
  note            String?
  adminNote       String?
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
  tracking        OrderTracking?
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
  productSnapshot   Json?    // { name, slug, imageUrl, basePrice, sku }
  variantSnapshot   Json?    // { sku, options, price }
}

model OrderStatusHistory {
  id        String      @id @default(cuid())
  orderId   String
  status    OrderStatus
  note      String?
  createdBy String?     // userId of admin who changed
  createdAt DateTime    @default(now())
}

// Detailed tracking stages (OrderTrackingController)
enum TrackingStage {
  ORDER_CONFIRMED
  IN_PRODUCTION
  READY_TO_SHIP
  SHIPPED
  OUT_FOR_DELIVERY
  DELIVERED
  EXCEPTION
}

model OrderTracking {
  id                    String         @id @default(cuid())
  orderId               String         @unique
  currentStage          TrackingStage
  carrierName           String?
  carrierTrackingNumber String?
  lastPolledAt          DateTime?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  events                TrackingEvent[]
}

model TrackingEvent {
  id         String        @id @default(cuid())
  trackingId String
  stage      TrackingStage
  title      String
  source     String
  eventAt    DateTime
  createdAt  DateTime      @default(now())
}
```

## 4. DTOs

### CheckoutDto (POST /orders)
```typescript
interface CheckoutDto {
  shippingAddress: {
    fullName: string; phone: string;
    addressLine1: string; addressLine2?: string;
    city: string; state?: string;
    postalCode: string; country: string; // 2-letter ISO
  };
  shippingMethodId: string;
  guestEmail?: string;      // required for guest checkout
  couponCode?: string;
  giftCardCode?: string;
  note?: string;
  isGift?: boolean;
  giftMessage?: string;
  giftFrom?: string;
  giftReceipt?: boolean;
  giftWrapping?: boolean;
}

// Response
interface CheckoutResponseDto {
  orderId: string;
  orderNumber: string;
  clientSecret: string;   // Stripe PaymentIntent client secret
  total: number;
  taxAmount: number;
}
```

### OrderDto (response)
```typescript
interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  taxAmount: number;
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
```

## 5. Checkout Flow (Client)

1. `/[locale]/checkout` — Multi-step checkout page
2. Step 1: `DeliveryForm` — address entry (inline, no saved address selector)
3. Step 2: `ShippingForm` — shipping method selection
4. Step 3: `PaymentForm` — Stripe Elements + `ExpressPayStrip` (PayPal only)
5. Checkout submit → `POST /api/v1/orders` → receives `clientSecret`
6. Confirm payment → Stripe webhook → order `CONFIRMED`
7. Redirect → `/[locale]/checkout/success?orderNumber=...`

Client files: `apps/client/src/components/checkout/`
- `DeliveryForm.tsx`, `ShippingForm.tsx`, `PaymentForm.tsx`
- `ExpressPayStrip.tsx` — PayPal express button (full-width, no Apple Pay)
- `GiftOptionsSection.tsx` — gift wrap / message / receipt
- `AffiliateDiscountBanner.tsx` — shows affiliate discount if applicable

Client routes:
- `/[locale]/account/orders` — order history
- `/[locale]/account/orders/[orderNumber]` — order detail
- `/[locale]/account/orders/[orderNumber]/tracking` — tracking page
- `/[locale]/orders/track` — guest order tracking page

## 6. Cancellation Window

- 2 giờ sau khi CONFIRMED (`CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000`)
- Customer cancel: cần `userId` hoặc `guestEmail` để xác thực ownership
- Admin cancel: không bị giới hạn thời gian (`POST /admin/orders/{id}/cancel`)
- Huỷ → trigger refund flow qua PaymentsService
- Email notification khi order cancelled
- `CancelOrderDto`: `{ reason?, guestEmail? }`

## 7. Business Rules

- Checkout: validate cart items còn hàng + giá không đổi
- Tax preview: TaxJar API (US only); fallback to static STATE_RATES table
- Gift wrapping adds $4.99 to order total
- Shipping address snapshot vào scalar fields (không FK)
- `OrderStatusHistory` ghi lại mọi thay đổi kèm note + admin userId + AuditLog
- `orderNumber` là human-readable unique string (prefix: `MLH-`)
- Guest orders: `guestEmail` required; lookup qua `/orders/{orderNumber}?email=`
- `GET /orders/track?orderNumber=&email=` là alias cho guest tracking

## 8. Order Integration Points

### Affiliate / Referral Commission
- Order `CONFIRMED` → check affiliate cookie → create `AffiliateCommission`
- Order `CONFIRMED` → check referral tree → create `ReferralCommission` (L1/L2/L3)
- Order `CANCELLED` → commissions voided

### Carrier Label & Tracking
- Admin buys label via EasyPost → auto-updates `trackingNumber`, `trackingUrl`, `carrier`, `easypostShipmentId`
- `PATCH /admin/orders/{id}/ship` → sets SHIPPED, emails customer, registers EasyPost tracker
- EasyPost webhook (`POST /webhooks/easypost`) → auto-updates order to `DELIVERED`
- POD provider webhook (`POST /webhooks/:provider/:token` — one route for every provider, `:provider` is cosmetic, `:token` is the real per-connection secret embedded in the URL) → handled by `FulfillmentWebhookController`/`FulfillmentWebhookService` in `apps/api/src/modules/fulfillment/`, which also updates `OrderTrackingService` for the customer-facing timeline. Printify has no payload signature at all (verified against its OpenAPI spec — the URL token is the only security); Merchize additionally sends a `merchize-webhook-key` header checked against a seller-configured secret. See `20_backend_conventions.spec.md` §18 for the full provider architecture.

### OrderItem Snapshot
- At order creation: `productSnapshot` + `variantSnapshot` captured on each `OrderItem`
- Ensures order history stays accurate after product updates

## 9. EasyPost Webhook

```
POST /api/v1/webhooks/easypost
```
- HMAC-SHA256 signature via `X-Hmac-Signature` header (key: `EASYPOST_WEBHOOK_SECRET`)
- On `delivered` event: auto-updates order to `DELIVERED` + sends delivery email
- Matches by `trackerId` first, then `trackingNumber` fallback
