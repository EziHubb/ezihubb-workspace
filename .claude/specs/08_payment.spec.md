# Module 08 — Payment

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/payments/stripe/intent` | Tạo PaymentIntent | Bearer |
| POST | `/api/v1/payments/stripe/confirm` | Confirm payment | Bearer |
| POST | `/api/v1/payments/paypal/create` | Tạo PayPal order | Bearer |
| POST | `/api/v1/payments/paypal/capture` | Capture PayPal order | Bearer |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook | No (sig verify) |
| POST | `/api/v1/webhooks/paypal` | PayPal webhook | No (sig verify) |

## 2. Stripe Integration

### Payment Flow
1. Client: `POST /api/v1/payments/stripe/intent` → `{ clientSecret, paymentIntentId }`
2. Client: render Stripe Elements (PaymentElement)
3. User điền thẻ → `stripe.confirmPayment({ elements, redirect: 'if_required' })`
4. Stripe webhook: `payment_intent.succeeded` → cập nhật order status

### Environment Variables
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Prisma Model
```prisma
model Payment {
  id                String        @id @default(cuid())
  orderId           String
  provider          String        // "stripe" | "paypal"
  providerPaymentId String        @unique
  amount            Decimal
  currency          String        @default("USD")
  status            PaymentStatus
  metadata          Json?
  createdAt         DateTime      @default(now())
}
```

## 3. PayPal Integration

### Payment Flow
1. Client: `POST /api/v1/payments/paypal/create` → `{ orderId, approvalUrl }`
2. Client: redirect user đến approvalUrl (PayPal checkout)
3. User approve → redirect về `/checkout/success?token=<paypalOrderId>`
4. Client: `POST /api/v1/payments/paypal/capture` với `{ paypalOrderId }`
5. Backend capture + cập nhật order status

### Environment Variables
```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox  # hoặc "live"
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
```

## 4. Webhook Security

### Stripe Webhook
- Header: `Stripe-Signature`
- Verify: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Requires NestJS `rawBody: true` (set trong main.ts)
- Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### PayPal Webhook
- Header: `Paypal-Transmission-Sig`
- Verify via PayPal SDK `verifyWebhookSignature`
- Events handled: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`

## 5. Refund Flow

1. Admin huỷ order hoặc user cancel trong 2h window
2. API gọi Stripe/PayPal refund API
3. Webhook confirm refund complete
4. Order status → `CANCELLED`, payment status → `REFUNDED`
5. Email thông báo user

## 6. Business Rules

- Mỗi đơn hàng có 1 Payment record
- Amount must match order total (server-side validate)
- Idempotency: duplicate webhook events ignored (check `providerPaymentId` unique)
- Currency: USD (mặc định, extensible)
- Failed payment: order stays `PAYMENT_FAILED`, user có thể retry
