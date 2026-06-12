# Module 28 — PDF Invoices, Packing Slips & Carrier Labels

## Part A — PDF Invoices & Packing Slips (P2-01)

### A1. Tổng quan

Tự động tạo PDF invoice và packing slip cho mỗi đơn hàng. Lưu cache trên Cloudflare R2. Admin và customer đều có nút download.

### A2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/orders/{orderNumber}/invoice` | Download PDF invoice (customer) | Bearer (owner) |
| GET | `/api/v1/orders/{orderNumber}/packing-slip` | Download PDF packing slip | Bearer (owner) |
| GET | `/api/v1/admin/orders/{id}/invoice` | Admin download invoice | ADMIN |
| GET | `/api/v1/admin/orders/{id}/packing-slip` | Admin download packing slip | ADMIN |
| POST | `/api/v1/admin/orders/{id}/invoice/regenerate` | Force regenerate (invalidate cache) | ADMIN |

Response: `Content-Type: application/pdf` với `Content-Disposition: attachment; filename="invoice-MLH-XXXX.pdf"`

### A3. Service: PdfService

File: `apps/api/src/modules/pdf/pdf.service.ts`

```typescript
@Injectable()
export class PdfService {
  // Generate invoice PDF → return Buffer
  async generateInvoice(order: OrderWithItems): Promise<Buffer>;

  // Generate packing slip PDF → return Buffer
  async generatePackingSlip(order: OrderWithItems): Promise<Buffer>;

  // Check R2 cache → if miss, generate + upload to R2 → return URL
  async getOrCreateInvoicePdf(orderId: string): Promise<string>;
  async getOrCreatePackingSlipPdf(orderId: string): Promise<string>;
}
```

PDF library: `puppeteer` (headless Chrome) hoặc `@sparticuz/chromium` (serverless-compatible)

### A4. PDF Templates (Handlebars)

Files: `apps/api/src/modules/pdf/templates/`
- `invoice.hbs` — Invoice layout
- `packing-slip.hbs` — Packing slip layout

#### Invoice Template Content
- Maple Loom Handmade logo + address
- Bill to: customer name, shipping address
- Invoice #: `INV-{orderNumber}`
- Invoice date, due date: "Due on receipt"
- Line items: product name, variant, qty, unit price, subtotal
- Totals: subtotal, shipping, discount, tax, total
- Payment method + status
- Footer: terms & conditions

#### Packing Slip Template Content
- Order #, order date
- Ship to address
- Items: product name, variant, qty
- Customization details (if any)
- Special instructions/notes
- No pricing info (for gift packaging)

### A5. R2 Cache Strategy

- Invoice PDF key: `pdfs/invoices/{orderId}.pdf`
- Packing slip key: `pdfs/packing-slips/{orderId}.pdf`
- Generated on first request, cached indefinitely
- Regenerate API: delete from R2 → regenerate on next request
- Regenerate trigger: when order is updated (status change, tracking added)

### A6. Client UI

- `OrderDetailClient.tsx`: "Download Invoice" button (shown when order CONFIRMED+)
- `OrderDrawer.tsx` (admin): "Invoice" + "Packing Slip" download buttons

### A7. Business Rules

- Invoice available after order `CONFIRMED`
- Packing slip available after `IN_PRODUCTION`
- Customer can only download their own orders
- PDF generated server-side (not client-side)
- Tax amount: calculated based on order total (configurable rate)

---

## Part B — Carrier Label Purchase (P3-06)

### B1. Tổng quan

Admin có thể mua nhãn vận chuyển trực tiếp từ admin panel thông qua EasyPost API. Hỗ trợ nhiều carrier (USPS, UPS, FedEx, DHL).

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
  constructor(private readonly httpService: HttpService) {}
  // axios-based (không dùng EasyPost SDK)

  async getRates(orderId: string, dto: GetRatesDto): Promise<ShipmentRate[]>;
  async buyLabel(orderId: string, rateId: string): Promise<LabelResult>;
  async voidLabel(labelId: string): Promise<void>;
}
```

### B4. DTOs

```typescript
interface GetRatesDto {
  parcelWeight: number;   // oz
  parcelLength: number;   // inches
  parcelWidth: number;
  parcelHeight: number;
}

interface ShipmentRate {
  rateId: string;         // EasyPost rate ID
  carrier: string;        // "USPS" | "UPS" | "FedEx" | "DHL"
  service: string;        // "Priority Mail" | "Ground" | etc.
  price: number;          // USD
  deliveryDays: number;
  deliveryDate?: string;
}

interface LabelResult {
  labelId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;       // URL to download PDF label
  carrier: string;
  service: string;
  price: number;
}
```

### B5. Prisma Extension

```prisma
model Order {
  // ... existing fields ...
  easypostShipmentId String?   // EasyPost shipment ID
  easypostRateId     String?   // selected rate ID
  labelUrl           String?   // PDF label URL
  labelVoidedAt      DateTime?
}
```

### B6. Admin UI: BuyLabelModal

File: `apps/admin/src/components/orders/BuyLabelModal.tsx`

1. Admin inputs parcel dimensions + weight
2. Click "Get Rates" → shows table of carrier options with price + ETA
3. Admin selects rate → "Buy Label" button
4. Success: tracking number + label download link shown in OrderDrawer

### B7. OrderDrawer Integration

File: `apps/admin/src/components/orders/OrderDrawer.tsx`

When order status `IN_PRODUCTION` or `SHIPPED`:
- "Buy Shipping Label" button (opens BuyLabelModal) — shown if no label purchased
- "Print Label" button → open `labelUrl` in new tab — shown if label exists
- "Void Label" button — shown if label exists and not voided

### B8. Environment Variables

```
EASYPOST_API_KEY=EZ...     # EasyPost API key
```

### B9. Business Rules

- Chỉ mua label khi đơn hàng `IN_PRODUCTION` hoặc `SHIPPED`
- Sau khi mua label: auto-update `Order.trackingNumber`, `Order.trackingUrl`, `Order.carrier`
- Auto-update order status to `SHIPPED` when label bought
- Void label chỉ trong vòng 28 ngày (EasyPost limitation)
- Void không hoàn tiền tự động — phải request refund riêng với EasyPost
- Rates refresh mỗi lần mở modal (không cache rates)
