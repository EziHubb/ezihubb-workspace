# Module 28 — PDF Invoices, Packing Slips & Carrier Labels

## Part A — PDF Invoices & Packing Slips (P2-01)

### A1. Tổng quan

Tự động tạo PDF invoice và packing slip cho mỗi đơn hàng. Lưu cache trên Cloudflare R2. Admin và customer đều có nút download. PDF được render với `@react-pdf/renderer` (React-PDF, không dùng Puppeteer/headless Chrome).

### A2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/orders/{orderNumber}/invoice` | Download PDF invoice (customer) | Bearer (owner) |
| GET | `/api/v1/orders/{orderNumber}/packing-slip` | Download PDF packing slip | Bearer (owner) |
| GET | `/api/v1/admin/orders/{id}/invoice` | Admin download invoice | ADMIN |
| GET | `/api/v1/admin/orders/{id}/packing-slip` | Admin download packing slip | ADMIN |
| POST | `/api/v1/admin/orders/{id}/invoice/regenerate` | Force regenerate (invalidate cache) | ADMIN |

Response: redirect to R2 public URL hoặc `Content-Type: application/pdf`.

### A3. Service: PdfService

File: `apps/api/src/modules/pdf/pdf.service.ts`

```typescript
@Injectable()
export class PdfService {
  // Generate (or return cached) invoice PDF.
  // isGiftReceipt: undefined = auto-detect from order.giftReceipt
  // userId: provided for customer callers; omit for admin
  async generateInvoice(
    orderId: string,
    isGiftReceipt: boolean | undefined,
    userId?: string,
  ): Promise<string>;  // returns R2 public URL

  // Generate (or return cached) packing slip PDF.
  async generatePackingSlip(orderId: string): Promise<string>;

  // Invalidate all cached PDFs for an order (call when order data changes)
  async invalidatePdfs(orderId: string): Promise<void>;
}
```

PDF library: `@react-pdf/renderer` (renderToBuffer) — server-side React component rendering.

### A4. OrderForPdf interface

```typescript
interface OrderForPdf {
  id: string;
  orderNumber: string;
  guestEmail: string | null;
  createdAt: Date;
  shippingName: string;
  shippingAddress: string;  // may be JSON string with addressLine1
  shippingCity: string;
  shippingState: string | null;
  shippingZip: string;
  shippingCountry: string;
  subtotal: number;
  discountAmount: number;
  affiliateDiscountAmount: number;
  shippingCost: number;
  taxAmount: number;
  taxJurisdiction: string | null;
  total: number;
  couponCode: string | null;
  isGift: boolean;
  giftMessage: string | null;
  giftFrom: string | null;
  giftReceipt: boolean;
  giftWrapping: boolean;
  userEmail: string | null;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    customizationData: Record<string, unknown> | null;
  }[];
}
```

### A5. PDF Templates (React-PDF)

Files: `apps/api/src/modules/pdf/templates/`
- `invoice.template.tsx` — `InvoiceDocument` component (supports gift receipt mode)
- `packing-slip.template.tsx` — `PackingSlipDocument` component

#### Invoice Template Content (full invoice mode)
- EziHubb logo + address
- Bill to: customer name, shipping address
- Invoice #: `INV-{orderNumber}`
- Invoice date, due date: "Due on receipt"
- Line items: product name, variant, qty, unit price, subtotal
- Customization details per item (if any)
- Totals: subtotal, shipping, discount (coupon + affiliate), tax, gift wrapping ($4.99 if applicable), total
- Payment method + status
- Footer: terms & conditions

#### Gift Receipt Mode
When `order.giftReceipt === true`, generateInvoice() produces a gift receipt (no pricing). Cache key: `pdfs/{orderId}/gift-receipt.pdf`.

#### Packing Slip Template Content
- Order #, order date
- Ship to address
- Items: product name, variant, qty
- Customization details (if any)
- Gift message (if `isGift === true`)
- No pricing info

### A6. R2 Cache Strategy

Cache keys:
- Invoice: `pdfs/{orderId}/invoice.pdf`
- Gift receipt: `pdfs/{orderId}/gift-receipt.pdf`
- Packing slip: `pdfs/{orderId}/packing-slip.pdf`

Generated on first request, cached indefinitely. `invalidatePdfs()` deletes all three variants — call when admin corrects order address or when order data changes significantly.

### A7. Client UI

- `OrderDetailClient.tsx`: "Download Invoice" button (shown when order CONFIRMED+)
- Customer account orders page: download invoice button per order

### A8. Business Rules

- Invoice available after order `CONFIRMED`
- Packing slip available after `IN_PRODUCTION`
- Customer can only download their own orders (userId ownership check before cache lookup)
- Gift receipt auto-used when `order.giftReceipt === true`
- PDF generated server-side using React-PDF renderToBuffer
- `GIFT_WRAPPING_PRICE = 4.99` (constant in pdf.service.ts)

---

## Part B — Carrier Label Purchase (P3-06)

### B1. Tổng quan

Admin mua nhãn vận chuyển trực tiếp từ admin panel thông qua EasyPost API (axios-based, không dùng EasyPost SDK). Hỗ trợ nhiều carrier. Sau khi mua label: auto-update order status to `SHIPPED` + tracking info.

### B2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/orders/{id}/shipping/rates` | Get shipping rates từ EasyPost | ADMIN |
| POST | `/api/v1/admin/orders/{id}/shipping/buy-label` | Purchase label (chọn rate) | ADMIN |
| GET | `/api/v1/admin/orders/{id}/shipping/label` | Get purchased label info | ADMIN |
| DELETE | `/api/v1/admin/orders/{id}/shipping/label` | Void/cancel label | ADMIN |

### B3. Service: LabelService

File: `apps/api/src/modules/shipping/label.service.ts`

```typescript
@Injectable()
export class LabelService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
  ) {}
  // axios-based (không dùng EasyPost SDK)
  // EasyPost base URL: https://api.easypost.com/v2

  async getRates(orderId: string): Promise<ShippingRate[]>;
  // - Reuses existing EasyPost shipment if easypostShipmentId exists
  // - Creates new shipment with order's address + default parcel
  // - Saves easypostShipmentId to Order
  // - Default parcel: 10x8x4 inches, 8oz (0.5 lb)

  async purchaseLabel(orderId: string, rateId: string): Promise<LabelResult>;
  // - Throws if label already purchased
  // - Throws if getRates not called first
  // - Auto-updates Order: status=SHIPPED, trackingNumber, trackingUrl, carrier,
  //   trackerId, labelUrl, labelCost, labelPurchasedAt, shippedAt, shippingRateId

  // Warehouse from-address uses env vars:
  // WAREHOUSE_NAME, WAREHOUSE_STREET, WAREHOUSE_CITY,
  // WAREHOUSE_STATE, WAREHOUSE_ZIP, WAREHOUSE_PHONE
}
```

### B4. DTOs

```typescript
interface ShippingRate {
  id:           string;   // EasyPost rate ID
  carrier:      string;   // "USPS" | "UPS" | "FedEx" | "DHL"
  service:      string;
  price:        number;   // USD
  deliveryDays?: number;
  currency:     string;   // "USD"
}

interface LabelResult {
  labelUrl:       string;  // PDF label URL from EasyPost
  trackingNumber: string;
  trackingUrl:    string;
  carrier:        string;
  cost:           number;
}
```

### B5. Prisma Extension

Fields added to `Order` model:

```prisma
model Order {
  // ... existing fields ...
  easypostShipmentId String?   // EasyPost shipment ID (set on getRates)
  labelUrl           String?   // PDF label URL (set on purchaseLabel)
  labelCost          Decimal?  // label purchase cost
  labelPurchasedAt   DateTime?
  shippingRateId     String?   // selected EasyPost rate ID
}
```

### B6. Admin UI: BuyLabelModal

File: `apps/admin/src/components/orders/BuyLabelModal.tsx`

Flow:
1. Admin clicks "Buy Shipping Label"
2. Modal opens → auto-calls `GET /rates` endpoint
3. Rate table: carrier, service, price, ETA
4. Admin selects rate → "Buy Label" button
5. Success: tracking number + label download link shown in OrderDrawer

### B7. OrderDrawer Integration

File: `apps/admin/src/components/orders/OrderDrawer.tsx`

When order status `IN_PRODUCTION` or `SHIPPED`:
- "Buy Shipping Label" button (opens BuyLabelModal) — shown if `!order.labelUrl`
- "Print Label" button → open `labelUrl` in new tab — shown if `order.labelUrl` exists
- "Void Label" button — shown if label exists and not voided

### B8. Environment Variables

```
EASYPOST_API_KEY=EZ...     # EasyPost API key
WAREHOUSE_NAME=...         # From-address for labels
WAREHOUSE_STREET=...
WAREHOUSE_CITY=...
WAREHOUSE_STATE=...
WAREHOUSE_ZIP=...
WAREHOUSE_PHONE=...
```

### B9. Business Rules

- getRates: fetches from EasyPost, saves `easypostShipmentId` to Order (reuses on retry)
- purchaseLabel: one label per order (`labelUrl` already set → throws BadRequestException)
- After purchase: auto-update order status to `SHIPPED` + all tracking fields
- Carrier detection: uses `TrackingService.detectCarrier(trackingCode)` if EasyPost doesn't return carrier
- Rates are not cached — always fetched fresh (existing shipment is reused)
- Void label: EasyPost limitation 28 days, no automatic refund
