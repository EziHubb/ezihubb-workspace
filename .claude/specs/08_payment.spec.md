# Module 08 — Payment

## 1. Tổng quan

Xử lý thanh toán qua Stripe (Credit/Debit Card, Apple Pay, Google Pay), PayPal, và Gift Card nội bộ. Toàn bộ dữ liệu nhạy cảm không chạm server — dùng Stripe Elements / PayPal SDK.

---

## 2. User Stories

- **US-PAY-001:** Là khách, tôi muốn thanh toán bằng thẻ tín dụng/ghi nợ (Visa, Mastercard, Amex).
- **US-PAY-002:** Là khách, tôi muốn thanh toán bằng PayPal.
- **US-PAY-003:** Là khách trên mobile, tôi muốn dùng Apple Pay / Google Pay để thanh toán nhanh.
- **US-PAY-004:** Là khách, tôi muốn dùng Gift Card để thanh toán một phần hoặc toàn bộ.
- **US-PAY-005:** Là khách, tôi muốn thấy tổng số tiền cuối cùng rõ ràng trước khi xác nhận.
- **US-PAY-006:** Là admin, tôi muốn hoàn tiền (full / partial refund) cho một đơn hàng.
- **US-PAY-007:** Hệ thống tự động xử lý webhook từ Stripe để cập nhật trạng thái đơn.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/payments/create-intent` | Tạo Stripe PaymentIntent | No |
| POST | `/payments/paypal/create-order` | Tạo PayPal Order | No |
| POST | `/payments/paypal/capture/:orderId` | Capture PayPal payment | No |
| GET | `/payments/gift-cards/:code/validate` | Validate gift card | No |
| POST | `/payments/gift-cards/:code/apply` | Apply gift card | No |
| POST | `/webhooks/stripe` | Stripe webhook handler | Stripe sig |
| POST | `/webhooks/paypal` | PayPal webhook handler | PayPal sig |
| POST | `/admin/payments/:id/refund` | Hoàn tiền | Admin |
| GET | `/admin/payments` | Danh sách giao dịch | Admin |

---

## 4. Data Models

```prisma
model Payment {
  id                String        @id @default(cuid())
  orderId           String        @unique
  order             Order         @relation(fields: [orderId], references: [id])
  method            PaymentMethod
  status            PaymentStatus @default(PENDING)
  amount            Decimal       @db.Decimal(10, 2)
  currency          String        @default("USD")
  
  -- Stripe
  stripePaymentIntentId String?   @unique
  stripeChargeId        String?
  
  -- PayPal
  paypalOrderId     String?       @unique
  paypalCaptureId   String?
  
  -- Gift Card (nếu partial)
  giftCardCode      String?
  giftCardAmount    Decimal?      @db.Decimal(10, 2)
  
  refundedAmount    Decimal       @default(0) @db.Decimal(10, 2)
  refundedAt        DateTime?
  refundReason      String?
  
  paidAt            DateTime?
  createdAt         DateTime      @default(now())
}

enum PaymentMethod { STRIPE PAYPAL GIFT_CARD MIXED }
enum PaymentStatus { PENDING PAID FAILED REFUNDED PARTIALLY_REFUNDED }

model GiftCard {
  id          String    @id @default(cuid())
  code        String    @unique
  initialValue Decimal  @db.Decimal(10, 2)
  balance     Decimal   @db.Decimal(10, 2)
  isActive    Boolean   @default(true)
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  usages      GiftCardUsage[]
}

model GiftCardUsage {
  id          String   @id @default(cuid())
  giftCardId  String
  giftCard    GiftCard @relation(fields: [giftCardId], references: [id])
  orderId     String
  amount      Decimal  @db.Decimal(10, 2)
  usedAt      DateTime @default(now())
}
```

---

## 5. Luồng thanh toán Stripe

```
Client:
1. Checkout form → POST /payments/create-intent
   { orderId, giftCardCode? }
   ← { clientSecret, amount }

2. Render Stripe Elements (card / Apple Pay / Google Pay)
3. stripe.confirmPayment({ clientSecret })

Server (Webhook):
4. POST /webhooks/stripe
   Verify Stripe-Signature header
   ├── payment_intent.succeeded → Order: CONFIRMED, gửi email
   ├── payment_intent.payment_failed → ghi log, notify client
   └── charge.refunded → cập nhật Payment.refundedAmount
```

---

## 6. Gift Card + Payment kết hợp

```
Tổng đơn: $45
Gift Card balance: $20
Stripe charge: $25

Server:
1. Validate gift card (active, đủ balance)
2. Tạo PaymentIntent với amount = $25
3. Khi payment thành công:
   └── Trừ $20 từ GiftCard.balance
   └── Ghi GiftCardUsage
   └── Lưu Payment.method = MIXED
```

---

## 7. Business Rules

- **PCI Compliance:** Server không bao giờ nhận raw card data — chỉ nhận PaymentIntent ID từ Stripe.
- Refund tối đa bằng số tiền đã thanh toán, tối đa **60 ngày** sau khi đặt hàng.
- Gift card không hoàn tiền về tiền mặt — chỉ hoàn về gift card balance.
- Stripe webhook phải verify chữ ký (`Stripe-Signature`) trước khi xử lý.
- Idempotent: mỗi webhook event chỉ xử lý **một lần** (lưu event ID để dedup).
- Currency: mặc định **USD**; có thể mở rộng sau.
