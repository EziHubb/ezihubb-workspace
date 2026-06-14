# Module 08 — Payment

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/payments/create-intent` | Tạo Stripe PaymentIntent for order | No (orderId in body) |
| POST | `/api/v1/payments/paypal/create-order` | Create PayPal order → returns `paypalOrderId` + `approvalUrl` | No |
| POST | `/api/v1/payments/paypal/capture` | Capture approved PayPal order | No |
| POST | `/api/v1/payments/gift-cards/purchase` | Purchase a gift card (Stripe → code emailed to recipient) | Optional |
| GET | `/api/v1/payments/gift-cards/{code}/validate` | Validate gift card + check balance | No |
| POST | `/api/v1/payments/gift-cards/{code}/apply` | Apply gift card to order | No |
| GET | `/api/v1/payments/stats` | Aggregate payment stats (admin) | ADMIN |
| GET | `/api/v1/payments` | List all payments (admin) | ADMIN |
| GET | `/api/v1/payments/{id}/refunds` | Get refund details (admin) | ADMIN |
| POST | `/api/v1/payments/{id}/refund` | Issue refund (admin) | ADMIN |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook | No (sig verify) |
| POST | `/api/v1/webhooks/paypal` | PayPal webhook | No (sig verify) |

## 2. Stripe Integration

### Payment Flow
1. Order created first (`POST /api/v1/orders`) → receives `clientSecret` + `orderId`
2. Client: render Stripe `PaymentElement` using `clientSecret`
3. User fills card → `stripe.confirmPayment({ elements, redirect: 'if_required' })`
4. Stripe webhook: `payment_intent.succeeded` → update order status → `CONFIRMED`

**Note:** `POST /api/v1/payments/create-intent` also accepts optional `giftCardCode` to cover partial payment (remainder charged via Stripe).

### CreatePaymentIntentDto
```typescript
interface CreatePaymentIntentDto {
  orderId: string;
  giftCardCode?: string;  // optional partial gift card payment
}

// Response
interface PaymentIntentResponseDto {
  clientSecret: string;
  amount: number;
  currency: string;
}
```

### Environment Variables
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 3. PayPal Integration

### Payment Flow (JS SDK popup — no redirect)
1. Client: `POST /api/v1/payments/paypal/create-order { orderId, returnUrl?, cancelUrl? }`
2. API returns `{ paypalOrderId, approvalUrl }`
3. Client: open PayPal JS SDK popup for payer approval (no full-page redirect)
4. Payer approves → client calls `POST /api/v1/payments/paypal/capture { paypalOrderId }`
5. API captures + updates order `CONFIRMED`
6. Webhook `CHECKOUT.ORDER.APPROVED` / `PAYMENT.CAPTURE.COMPLETED` → confirm idempotently

**Important:** Apple Pay is NOT supported. `ExpressPayStrip` component renders PayPal only (full-width yellow button).

### ExpressPayStrip component
File: `apps/client/src/components/checkout/ExpressPayStrip.tsx`
- Props: `{ total: number, onSelect?: () => void }`
- Single PayPal button (bg `#FFC439`, text `#003087`)
- Loading spinner while processing
- No Apple Pay button

### PaypalService
File: `apps/api/src/modules/payments/paypal.service.ts`
- axios-based (no PayPal Node SDK)
- OAuth2 access token cached in Redis (`paypal:access_token`)
- `isConfigured()` — checks `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`
- `createOrder(orderId, returnUrl?, cancelUrl?)` → `{ paypalOrderId, approvalUrl }`
- `captureOrder(paypalOrderId)` → updates order + payment record
- `verifyWebhookSignature(headers, rawBody)` — dev-bypass when `PAYPAL_WEBHOOK_ID` unset

### Environment Variables
```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox         # or "live"
PAYPAL_WEBHOOK_ID=...       # optional; skips sig verify in dev if unset
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
```

## 4. Gift Cards

```prisma
enum PaymentMethod { STRIPE PAYPAL GIFT_CARD MIXED }
enum PaymentStatus { PENDING PAID FAILED REFUNDED PARTIALLY_REFUNDED }

model GiftCard {
  id           String         @id @default(cuid())
  code         String         @unique
  initialValue Decimal
  balance      Decimal
  isActive     Boolean        @default(true)
  expiresAt    DateTime?
  createdAt    DateTime       @default(now())
  usages       GiftCardUsage[]
}

model GiftCardUsage {
  id          String   @id @default(cuid())
  giftCardId  String
  orderId     String
  amount      Decimal
  usedAt      DateTime @default(now())
}
```

### Gift Card Purchase Flow
- `POST /api/v1/payments/gift-cards/purchase` — auth optional (logged-in or guest)
- Creates a Stripe PaymentIntent for the gift card value
- On payment success → new `GiftCard` record created → code emailed to recipient

### Gift Card at Checkout
- `giftCardCode` field in `CheckoutDto` (and `CreatePaymentIntentDto`)
- Gift card covers full or partial order total
- If partial: `method = MIXED`, remainder charged via Stripe
- Balance cannot go negative

## 5. Prisma Payment Model

```prisma
model Payment {
  id                    String        @id @default(cuid())
  orderId               String        @unique
  method                PaymentMethod
  status                PaymentStatus @default(PENDING)
  amount                Decimal
  currency              String        @default("USD")
  stripePaymentIntentId String?
  stripeChargeId        String?
  paypalOrderId         String?
  paypalCaptureId       String?
  giftCardCode          String?
  giftCardAmount        Decimal?
  storeCreditAmount     Decimal?
  loyaltyPointsAmount   Decimal?
  refundedAmount        Decimal       @default(0)
  refundedAt            DateTime?
  refundReason          String?
  paidAt                DateTime?
  createdAt             DateTime      @default(now())
}
```

## 6. Webhook Security

### Stripe Webhook
- Guard: `StripeWebhookGuard` — verifies `Stripe-Signature` header
- Uses `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Requires NestJS `rawBody: true` (set in `main.ts`)
- Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- Idempotency: duplicate events ignored by checking `stripePaymentIntentId` uniqueness
- Returns `{ received: true }` always (to prevent Stripe retries)

### PayPal Webhook
- Signature verified via `paypalService.verifyWebhookSignature(headers, rawBody)`
- Dev-bypass when `PAYPAL_WEBHOOK_ID` not set
- Events handled: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`
- Returns `{ received: true }` always
- Idempotency: duplicate events checked via `paypalCaptureId`
- Both webhooks tagged `@SkipThrottle()` — exempt from rate limiting

## 7. Refund Flow

1. Admin triggers refund via `POST /api/v1/payments/{id}/refund`
2. API calls Stripe/PayPal refund API
3. Webhook confirms refund → update `Payment.refundedAmount`, `refundedAt`, `status`
4. Order status → `REFUNDED`
5. Loyalty points earned on this order deducted
6. Email notification sent to user
7. Refund window: 60 days (`REFUND_WINDOW_DAYS = 60`)

## 8. Business Rules

- Mỗi đơn hàng có 1 Payment record (unique `orderId`)
- Amount must match order total (server-side validated)
- Idempotency: duplicate webhook events ignored
- Currency: USD (default)
- Failed payment: order stays `PENDING_PAYMENT`; user can retry
- `PARTIALLY_REFUNDED`: `refundedAmount < amount`
- `MIXED` method: gift card + Stripe (both amounts tracked)
- Store credit and loyalty points reductions also recorded on Payment
- PayPal access token cached in Redis with 90% TTL padding
