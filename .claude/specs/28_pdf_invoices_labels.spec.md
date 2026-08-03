# Module 28 — PDF Invoices, Packing Slips & Carrier Labels

## Part A — PDF Invoices & Packing Slips (P2-01)

### A1. Tổng quan

Tự động tạo PDF invoice và packing slip cho mỗi đơn hàng. Lưu cache trên Cloudflare R2. Admin và customer đều có nút download. PDF được render với `@react-pdf/renderer` (React-PDF, không dùng Puppeteer/headless Chrome).

### A2. API Endpoints

> **Lưu ý:** Path param thực tế là `{id}` (order's cuid), KHÔNG phải `{orderNumber}`. Customer **không có** route download packing slip riêng — chỉ admin mới tải được packing slip. Cũng không có endpoint "regenerate" — `PdfService.invalidatePdfs()` tồn tại trong service nhưng hiện KHÔNG được gọi từ bất kỳ controller nào (dead code, chưa wire).

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/orders/{id}/invoice` | Download PDF invoice (customer, tự động ẩn giá nếu là gift receipt) | Bearer (owner, `userId` check trong `generateInvoice`) |
| GET | `/api/v1/admin/orders/{id}/invoice` | Admin download invoice (luôn full invoice, `isGiftReceipt=false`) | ADMIN |
| GET | `/api/v1/admin/orders/{id}/packing-slip` | Admin download packing slip | ADMIN |
| POST | `/api/v1/admin/orders/bulk-packing-slips` | Generate packing slip cho nhiều order cùng lúc (body: `orderIds: string[]`, trả về `{ urls: string[] }`) — tính năng không có trong spec cũ | ADMIN |

Response: `{ url: string }` JSON chứa R2 public URL (không redirect trực tiếp, không trả `Content-Type: application/pdf` trực tiếp từ route này — client tự mở URL).

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

Generated on first request, cached indefinitely. `invalidatePdfs()` (xoá cả 3 cache key) tồn tại trong `PdfService` nhưng **hiện không được gọi ở bất kỳ đâu** trong codebase — chưa wire trigger tự động khi admin sửa địa chỉ đơn hàng, và không có endpoint admin nào để invalidate/regenerate thủ công. Đây là gap thực tế so với thiết kế ban đầu.

### A7. Client UI

- File thực tế: `apps/client/src/app/[locale]/(account)/account/orders/[orderNumber]/page.tsx` (KHÔNG phải `OrderDetailClient.tsx`) — nút "Download Invoice" ở header, gọi `GET /orders/{order.id}/invoice`, mở URL trả về bằng `window.open()`
- Nút hiển thị **không điều kiện theo order status** (luôn hiển thị, không gate theo CONFIRMED+)
- Không có nút download packing slip ở phía customer (chỉ admin có)

### A8. Business Rules

- **Không có gate theo order status** trong `PdfService`/`OrdersController` — invoice/packing-slip có thể generate ở bất kỳ status nào miễn ownership hợp lệ (khác với claim "available after CONFIRMED/IN_PRODUCTION" ở bản spec trước — đó là behavior mong muốn ban đầu, chưa được implement)
- Customer can only download their own orders (userId ownership check trong `generateInvoice`, thực hiện trước khi check cache)
- Gift receipt auto-used when `order.giftReceipt === true`
- PDF generated server-side using React-PDF renderToBuffer
- `GIFT_WRAPPING_PRICE = 4.99` (constant, exported từ `pdf.service.ts`)

---

## Part B — Carrier Label Purchase (P3-06)

### B1. Tổng quan

Admin mua nhãn vận chuyển trực tiếp từ admin panel thông qua EasyPost API (axios-based, không dùng EasyPost SDK). Hỗ trợ nhiều carrier. Sau khi mua label: auto-update order status to `SHIPPED` + tracking info.

### B2. API Endpoints

> **Lưu ý:** Path thực tế KHÔNG có segment `/shipping/` — routes nằm trực tiếp trên `AdminOrdersController` (`@Controller('admin/orders')`). Lấy rates là `GET` (không phải `POST`). Không có endpoint "get purchased label info" hay "void/cancel label" — cả hai đều chưa implement.

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/orders/{id}/rates` | Get shipping rates từ EasyPost (an toàn — không charge) | ADMIN |
| POST | `/api/v1/admin/orders/{id}/buy-label` | Purchase label (body: `{ rateId: string }`) — irreversible, charge ngay | ADMIN |

> Label info sau khi mua nằm sẵn trong response `buy-label` (`LabelResult`) và trong order record (`labelUrl`, `trackingNumber`, ...) — không cần endpoint GET riêng. Void/cancel label **chưa được implement** ở bất kỳ đâu trong code.

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

File: `apps/admin/src/components/orders/BuyLabelModal.tsx` — dùng chung bởi cả `OrderDrawer.tsx` và `OrderDetailPanel.tsx`

Flow:
1. Admin click nút **"Buy label"** (chữ thường, không phải "Buy Shipping Label")
2. Modal opens → auto-calls `GET /admin/orders/{id}/rates`
3. Rate table: carrier, service, price, ETA
4. Admin chọn rate → xác nhận mua → `POST /admin/orders/{id}/buy-label`
5. Success: `onLabelPurchased` callback cập nhật UI với tracking number + label URL

### B7. OrderDrawer / OrderDetailPanel Integration

Files: `apps/admin/src/components/orders/OrderDrawer.tsx`, `apps/admin/src/components/orders/OrderDetailPanel.tsx`

- **"Buy label"** button (mở `BuyLabelModal`) — hiển thị khi `!order.labelUrl`
- **"Print label"** link → mở `labelUrl` trong tab mới — hiển thị khi `order.labelUrl` tồn tại
- **Không có nút "Void Label"** ở bất kỳ đâu trong UI — tính năng void/cancel label chưa được implement (khớp với việc thiếu endpoint void ở B2)

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
- purchaseLabel: one label per order (`labelUrl` already set → throws BadRequestException); throws nếu chưa gọi getRates trước (`easypostShipmentId` chưa tồn tại)
- After purchase: auto-update order status to `SHIPPED` + all tracking fields
- Carrier detection: uses `TrackingService.detectCarrier(trackingCode)` if EasyPost doesn't return carrier
- Rates are not cached — always fetched fresh (existing shipment is reused)
- **Void label chưa được implement** — không có service method, endpoint, hay UI nào cho việc void/cancel label (khác với claim "EasyPost limitation 28 days" ở bản spec trước, vốn mô tả một tính năng chưa tồn tại)
