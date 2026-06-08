# Module 08 — Payment

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/payments/create-intent` | Tạo Stripe PaymentIntent for order | Bearer |
| GET | `/api/v1/payments/gift-cards/{code}/validate` | Validate gift card + check balance | Optional |
| POST | `/api/v1/payments/gift-cards/{code}/apply` | Apply gift card to order | Bearer |
| GET | `/api/v1/payments/stats` | Aggregate payment stats (admin) | ADMIN |
| GET | `/api/v1/payments` | List all payments (admin) | ADMIN |
| GET | `/api/v1/payments/{id}/refunds` | Get refund details (admin) | ADMIN |
| POST | `/api/v1/payments/{id}/refund` | Issue refund (admin) | ADMIN |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook | No (sig verify) |
| POST | `/api/v1/webhooks/paypal` | PayPal webhook | No (sig verify) |

## 2. Stripe Integration

### Payment Flow
1. Order created first (`POST /api/v1/orders`) with status `PENDING_PAYMENT`
2. Client: `POST /api/v1/payments/create-intent` → `{ clientSecret, paymentIntentId }`
3. Client: render Stripe Elements (PaymentElement)
4. User điền thẻ → `stripe.confirmPayment({ elements, redirect: 'if_required' })`
5. Stripe webhook: `payment_intent.succeeded` → update order status → `CONFIRMED`

### Environment Variables
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 3. PayPal Integration

### Payment Flow
1. Client: redirect user đến PayPal checkout
2. User approve → redirect về `/checkout/success?token=<paypalOrderId>`
3. Backend capture + update order status
4. Webhook `PAYMENT.CAPTURE.COMPLETED` → confirm

### Environment Variables
```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox  # hoặc "live"
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

- Gift card balance validated before order creation
- `giftCardCode` + `giftCardAmount` stored on Payment record
- Mixed payment: gift card covers part, Stripe covers remainder
- Balance tidak bisa negatif

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
  refundedAmount        Decimal       @default(0)
  refundedAt            DateTime?
  refundReason          String?
  paidAt                DateTime?
  createdAt             DateTime      @default(now())
}
```

## 6. Webhook Security

### Stripe Webhook
- Header: `Stripe-Signature`
- Verify: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Requires NestJS `rawBody: true` (set trong main.ts)
- Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### PayPal Webhook
- Header: `Paypal-Transmission-Sig`
- Verify via PayPal SDK `verifyWebhookSignature`
- Events handled: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`

## 7. Refund Flow

1. Admin triggers refund via `POST /api/v1/payments/{id}/refund`
2. API gọi Stripe/PayPal refund API
3. Webhook confirm refund → update Payment `refundedAmount`, `refundedAt`, `status`
4. Order status → `REFUNDED`
5. Email notification gửi đến user

## 8. Business Rules

- Mỗi đơn hàng có 1 Payment record (unique orderId)
- Amount must match order total (server-side validate)
- Idempotency: duplicate webhook events ignored (check `stripePaymentIntentId` / `paypalCaptureId` unique)
- Currency: USD (mặc định)
- Failed payment: order stays `PENDING_PAYMENT`, user có thể retry
- `PARTIALLY_REFUNDED`: khi refundedAmount < amount
- `MIXED` method: gift card + Stripe, both amounts tracked
