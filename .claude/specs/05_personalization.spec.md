# Module 05 — Personalization & Customizer

## 1. Tổng quan

Hệ thống customizer cho phép user điền thông tin cá nhân hoá sản phẩm trước khi add to cart. Hỗ trợ 2 mode:
- **Single-item customizer** (`CustomizerPanel`) — 1 sản phẩm với N fields
- **Bundle customizer** (`BundleCustomizerPanel`) — N items (ví dụ: Couples Mug Set, 2 items)

## 2. 3-Flow ProductActions System

File: `apps/client/src/components/product/ProductActions.tsx`

```typescript
function detectFlow(product: ProductDto): 'A' | 'B' | 'C' {
  if (!product.isPersonalizable) return 'C';  // DirectAddToCartPanel
  if (product.customization)     return 'A';  // Customizer (single or bundle)
  return 'B';                                 // PersonalizationComingSoon
}
```

### Flow A — CustomizerPanel / BundleCustomizerPanel
- Điều kiện: `product.isPersonalizable === true && product.customization !== undefined`
- `bundleCount > 1` → BundleCustomizerPanel
- `bundleCount <= 1 || undefined` → CustomizerPanel

### Flow B — PersonalizationComingSoon
- Điều kiện: `product.isPersonalizable === true && !product.customization`
- Hiển thị "Coming Soon" + form đăng ký notify
- POST `/api/v1/notifications/product-ready` với `{ productId, email }`

### Flow C — DirectAddToCartPanel
- Điều kiện: `product.isPersonalizable === false`
- Quantity stepper (min 1, max 99)
- Wishlist toggle (yêu cầu auth)
- Trust badges (processingDays, 2h cancel window, secure checkout)

## 3. CustomizerPanel

File: `apps/client/src/components/customizer/CustomizerPanel.tsx`

**State** (Zustand — `apps/client/src/lib/store/customizer.store.ts`):
```typescript
{
  fields: Record<string, FieldValue>;    // fieldId → value
  currentStep: 'customize' | 'preview' | 'review';
  isLoading: boolean;
  // Bundle extensions:
  bundleCount: number;
  activeItemIndex: number;
  itemFields: Record<number, Record<string, FieldValue>>;
}
```

**Field Types:**
- `text` — TextInput với maxLength
- `textarea` — Textarea với maxLength
- `image` — ImageUpload (upload đến R2, trả về URL)
- `color` — ColorPicker

**Validation:** Tất cả `required` fields phải được điền trước khi qua bước preview.

## 4. BundleCustomizerPanel

File: `apps/client/src/components/customizer/BundleCustomizerPanel.tsx`

- Tabs cho mỗi item: "Item 1 for [name]", "Item 2 for [name]", ...
- `parseFieldId('item_1_name')` → `{ itemIndex: 0, baseId: 'name' }`
- Convention: fields trong bundle config có prefix `item_N_` (1-indexed)
- `isItemComplete(index)` — kiểm tra tất cả required fields của item đó
- Cart payload:
```typescript
{
  bundleCount: 2,
  items: [
    { fields: { name: "Alice", message: "..." } },
    { fields: { name: "Bob",   message: "..." } }
  ]
}
```

## 5. Cart Item Payload với Customization

```typescript
interface AddToCartDto {
  productId: string;
  variantId?: string;
  quantity: number;
  customization?: {
    templateId: string;
    fields?: Record<string, string>;  // single-item
    bundleCount?: number;
    items?: { fields: Record<string, string> }[];  // bundle
  };
}
```

## 6. Preview System

- `GET /api/v1/customizer/preview` — generate preview image
- Body: `{ templateId, fields, previewLayers }`
- Response: `{ previewUrl: string }` (URL của ảnh preview trên R2)
- Preview invalidated khi user thay đổi bất kỳ field nào

## 7. MongoDB Customization Config Example

```json
{
  "templateId": "couples-mug-set-v1",
  "bundleCount": 2,
  "fields": [
    { "id": "item_1_name", "label": "Name on Mug 1", "type": "text", "required": true, "maxLength": 20 },
    { "id": "item_1_message", "label": "Message on Mug 1", "type": "text", "required": false, "maxLength": 50 },
    { "id": "item_2_name", "label": "Name on Mug 2", "type": "text", "required": true, "maxLength": 20 },
    { "id": "item_2_message", "label": "Message on Mug 2", "type": "text", "required": false, "maxLength": 50 }
  ],
  "previewLayers": [
    { "id": "base", "type": "image", "src": "templates/couples-mug-base.png", "zIndex": 0 },
    { "id": "text_1", "type": "text", "fieldRef": "item_1_name", "zIndex": 1, "style": { ... } }
  ]
}
```

## 8. Endpoints (Customizer API)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/customizer/preview` | Generate preview image | No |
| GET | `/api/v1/customizer/templates/{id}` | Lấy template config | No |
| POST | `/api/v1/customizer/upload-image` | Upload user image | Optional |
| POST | `/api/v1/notifications/product-ready` | Đăng ký thông báo (Flow B) | Optional |
