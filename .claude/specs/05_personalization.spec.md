# Module 05 — Personalization & Customizer

## 1. Tổng quan

Hệ thống customizer cho phép user điền thông tin cá nhân hoá sản phẩm trước khi add to cart. Sử dụng **Fabric.js** để render canvas preview. Hỗ trợ 2 mode:
- **Single-item customizer** (`CustomizerPanel`) — 1 sản phẩm với N fields
- **Bundle customizer** (`BundleCustomizerPanel`) — N items (ví dụ: Couples Mug Set, 2 items)

## 2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/customization/upload` | Upload ảnh cho customization (max 10MB) | Optional |
| POST | `/api/v1/customization/remove-background` | Queue background removal (~60s async) | Optional |
| GET | `/api/v1/customization/jobs/{jobId}` | Poll job status | Optional |
| POST | `/api/v1/customization/preview` | Queue preview generation | Optional |
| POST | `/api/v1/customization/art-style` | Queue art style transformation | Optional |
| POST | `/api/v1/customization/draft` | Save/update customization draft (upsert) | Optional |
| GET | `/api/v1/customization/draft` | Get latest draft (`?productId=`) | Optional |
| GET | `/api/v1/customization/draft/{draftId}` | Get draft by ID | Optional |

## 3. 3-Flow ProductActions System

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
- Full-screen customize page: `/[locale]/products/[slug]/customize`

### Flow B — PersonalizationComingSoon
- Điều kiện: `product.isPersonalizable === true && !product.customization`
- Hiển thị "Coming Soon" + form đăng ký notify

### Flow C — DirectAddToCartPanel
- Điều kiện: `product.isPersonalizable === false`
- Quantity stepper (min 1, max 99)
- Wishlist toggle (yêu cầu auth)
- Trust badges (processingDays, 2h cancel window, secure checkout)

## 4. Customizer Store (Zustand)

File: `apps/client/src/lib/store/customizer.store.ts`

```typescript
interface CustomizerState {
  template: CustomizationTemplate | null;
  productId: string | null;
  variantId: string | null;
  fieldValues: Record<string, FieldValue>;
  bundleCount: number;
  activeItemIndex: number;
  itemFields: Record<number, Record<string, FieldValue>>;
  activeFieldId: string | null;
  isPreviewOpen: boolean;
  previewImageUrl: string | null;
  isGeneratingPreview: boolean;
  previewError: string | null;
  fabricCanvas: FabricCanvasInstance;   // Fabric.js canvas ref
  history: FieldValues[];               // undo/redo stack (max 50)
  historyIndex: number;
}
```

**Actions:**
- `initTemplate(template, productId, variantId)` — initialize customizer
- `setFieldValue(fieldId, value)` — set field + push history
- `setActiveItem(index)` / `setItemField(index, fieldId, value)` — bundle management
- `uploadImage(fieldId, file)` — XHR upload with progress
- `removeBackground(fieldId)` — POST job, poll `/jobs/:id` (2s interval, 65s timeout)
- `applyArtStyle(fieldId, style)` — async job, same polling
- `revertToOriginal(fieldId)` — revert to uploaded image before AI processing
- `generatePreview()` — POST `/customization/preview`
- `undo()` / `redo()` / `canUndo()` / `canRedo()` — history management
- `autoFill(savedData)` — fill fields from saved draft
- `toCustomizationPayload()` — serialize for cart API

**Persistence:** None (volatile). Job polling: 2s interval, 65s timeout.

## 5. Canvas Components

File: `apps/client/src/components/customizer/Canvas.tsx`
File: `apps/client/src/components/customizer/FabricCanvas.tsx`

- Fabric.js renders layers in z-index order
- `previewLayers` from `CustomizationConfig`:
  - `type: 'base'` → static product image
  - `type: 'overlay'` → static overlay image
  - `type: 'text'` → text from `fieldRef` value
  - `type: 'image'` → uploaded user image

## 6. Customizer Step Components

Files: `apps/client/src/components/customizer/steps/`
- `Step1BasicInfo.tsx` — Basic product/variant info
- `Step2PhotoUpload.tsx` — Image upload field
- `Step3StylePicker.tsx` — Style selection

Other components:
- `TextFieldInput.tsx` — text/textarea inputs
- `StylePickerGrid.tsx` — style grid picker
- `ImageUploadField.tsx` — image upload + R2 + background removal
- `PreviewModal.tsx` — generated preview display
- `AutoFillBanner.tsx` — restore from saved draft banner
- `MobileCustomizerCanvas.tsx` — mobile canvas variant

## 7. BundleCustomizerPanel

File: `apps/client/src/components/customizer/BundleCustomizerPanel.tsx`

- Tabs: "Item 1 for [name]", "Item 2 for [name]", ...
- `parseFieldId('item_1_name')` → `{ itemIndex: 0, baseId: 'name' }`
- Convention: bundle fields have prefix `item_N_` (1-indexed)
- `isItemComplete(index)` — check all required fields of that item
- Tab badge (✓/✗), "Add to Cart" disabled until all items complete

## 8. Cart Item Payload

```typescript
interface AddToCartDto {
  productId: string;
  variantId?: string;
  quantity: number;
  customization?: {
    templateId: string;
    fields?: Record<string, string>;     // single-item
    bundleCount?: number;
    items?: { fields: Record<string, string> }[];  // bundle
  };
}
```

## 9. CustomizationDraft Model (Prisma)

```prisma
model CustomizationDraft {
  id             String   @id @default(cuid())
  userId         String?
  sessionId      String?
  productId      String
  variantId      String?
  templateId     String
  data           Json     // saved field values
  previewUrl     String?
  uploadedImages String[]
  createdAt      DateTime @default(now())
  expiresAt      DateTime
}
```

## 10. MongoDB Customization Config Example

```json
{
  "templateId": "couples-mug-set-v1",
  "version": 1,
  "bundleCount": 2,
  "fields": [
    { "id": "item_1_name", "label": "Name on Mug 1", "type": "text", "required": true, "maxLength": 20 },
    { "id": "item_2_name", "label": "Name on Mug 2", "type": "text", "required": true, "maxLength": 20 }
  ],
  "previewLayers": [
    { "type": "base", "url": "templates/couples-mug-base.png", "zIndex": 0 },
    { "type": "text",  "fieldRef": "item_1_name", "zIndex": 1 }
  ]
}
```
