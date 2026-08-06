# Module 05 — Personalization & Customizer

## 1. Tổng quan

Hệ thống customizer cho phép user điền thông tin cá nhân hoá sản phẩm trước khi add to cart. Sử dụng **Fabric.js** để render canvas preview. Hỗ trợ 2 mode:
- **Single-item customizer** (`CustomizerPanel`) — 1 sản phẩm với N fields
- **Bundle customizer** (`BundleCustomizerPanel`) — N items (ví dụ: Couples Mug Set, 2 items)

## 2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/customization/upload` | Upload ảnh cho customization (max 10MB, JPEG/PNG/WebP/HEIC) | Optional |
| POST | `/api/v1/customization/upload-image` | Alias của `/upload` (dùng bởi client store) | Optional |
| POST | `/api/v1/customization/remove-background` | Queue background removal (~60s async) | Optional |
| GET | `/api/v1/customization/jobs/{jobId}` | Poll job status | Optional |
| POST | `/api/v1/customization/preview` | Queue preview generation | Optional |
| POST | `/api/v1/customization/generate-preview` | Alias của `/preview` (dùng bởi client store) | Optional |
| GET | `/api/v1/customization/art-styles` | Danh sách AI art styles có sẵn | Optional |
| POST | `/api/v1/customization/apply-art-style` | Queue art style transformation (async, ~30s) | Optional |
| POST | `/api/v1/customization/art-style` | Legacy alias cho art style (dùng tempKey + style) | Optional |
| POST | `/api/v1/customization/draft` | Save/update customization draft (upsert) | Optional |
| GET | `/api/v1/customization/draft` | Get latest draft (`?productId=`) | Optional |
| GET | `/api/v1/customization/draft/{draftId}` | Get draft by ID | Optional |
| GET | `/api/v1/customization/last/{productId}` | Alias: get last draft by productId | Optional |

### Remove Background Request
```json
{ "tempKey": "uploads/...", "draftId": "draft-id-or-temp" }
```

### Apply Art Style Request (`/apply-art-style`)
```json
{ "imageKey": "uploads/...", "style": "watercolor" }
```

### Job Status Response
```json
{ "status": "pending|processing|done|failed", "result": "https://cdn.../result.jpg", "error": "..." }
```

## 3. Art Styles (5 styles)

| ID | Label | Mô tả | Model |
|---|---|---|---|
| `watercolor` | Watercolor | Soft watercolor painting effect | stability-ai/stable-diffusion-img2img |
| `van_gogh` | Van Gogh | Swirling brushstrokes like Van Gogh | stability-ai/stable-diffusion-img2img |
| `cartoon` | Cartoon | Bold outlines, flat colors cartoon style | stability-ai/stable-diffusion-img2img |
| `realistic` | Realistic | Hyper-realistic photo enhancement | stability-ai/stable-diffusion-img2img |
| `sketch` | Pencil Sketch | Black and white pencil drawing | stability-ai/stable-diffusion-img2img |

Config: `apps/api/src/modules/customization/art-styles.config.ts`
API: `apps/api/src/modules/customization/art-style.service.ts`

## 4. 3-Flow ProductActions System

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

## 5. Customizer Store (Zustand)

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
- `uploadImage(fieldId, file)` — XHR upload with progress (POST `/customization/upload-image`)
- `removeBackground(fieldId)` — POST job, poll `/jobs/:id` (2s interval, 65s timeout)
- `applyArtStyle(fieldId, style)` — async job via `/apply-art-style`, same polling
- `revertToOriginal(fieldId)` — revert to uploaded image before AI processing
- `generatePreview()` — POST `/customization/generate-preview`
- `undo()` / `redo()` / `canUndo()` / `canRedo()` — history management
- `autoFill(savedData)` — fill fields from saved draft
- `toCustomizationPayload()` — serialize for cart API

**Persistence:** None (volatile). Job polling: 2s interval, 65s timeout.

## 6. Canvas Components

File: `apps/client/src/components/customizer/Canvas.tsx`
File: `apps/client/src/components/customizer/FabricCanvas.tsx`

- Fabric.js renders layers in z-index order
- `previewLayers` từ `CustomizationConfig`:
  - `type: 'base'` → static product image
  - `type: 'overlay'` → static overlay image
  - `type: 'text'` → text from `fieldRef` value
  - `type: 'image'` → uploaded user image

## 7. Customizer Step Components

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

## 8. BundleCustomizerPanel

File: `apps/client/src/components/customizer/BundleCustomizerPanel.tsx`

- Tabs: "Item 1 for [name]", "Item 2 for [name]", ...
- `parseFieldId('item_1_name')` → `{ itemIndex: 0, baseId: 'name' }`
- Convention: bundle fields have prefix `item_N_` (1-indexed)
- `isItemComplete(index)` — check all required fields of that item
- Tab badge (✓/✗), "Add to Cart" disabled until all items complete

## 9. Cart Item Payload

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

## 10. CustomizationDraft Model (Prisma)

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

Draft upsert key: `(userId OR sessionId) + productId + templateId`
Session ID đến từ cookie `cart_session` (không phải localStorage key `ezihubb-cart`).

## 11. MongoDB Customization Config Example

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
