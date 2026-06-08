# Module 18 — Customizer Design

## 1. Tổng quan

Hệ thống customizer 3 flow, kích hoạt từ `ProductActions.tsx`. Canvas render bằng **Fabric.js**. Hỗ trợ AI background removal, art style transformation, undo/redo, và job-based async processing.

## 2. Flow Detection

```typescript
// apps/client/src/components/product/ProductActions.tsx
function detectFlow(product: ProductDto): 'A' | 'B' | 'C' {
  if (!product.isPersonalizable) return 'C';  // DirectAddToCartPanel
  if (product.customization)     return 'A';  // Customizer flow
  return 'B';                                 // PersonalizationComingSoon
}
```

## 3. Flow A — CustomizerPanel

File: `apps/client/src/components/customizer/CustomizerPanel.tsx`

### Route
- Inline trên product page (`ProductActions`)
- Full-screen: `/[locale]/products/[slug]/customize`

### Steps (via step components)
1. `Step1BasicInfo` — product/variant selection
2. `Step2PhotoUpload` — image upload field
3. `Step3StylePicker` — style selection

### State Machine (customizerStore)
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
  fabricCanvas: FabricCanvasInstance;   // Fabric.js ref
  history: FieldValues[];               // max 50
  historyIndex: number;
}
```

### Field Renderer (`TextFieldInput.tsx`, `ImageUploadField.tsx`, `StylePickerGrid.tsx`)
| Field type | Component |
|---|---|
| `text` | `TextFieldInput` con `<Input>` + maxLength counter |
| `textarea` | `TextFieldInput` với `<Textarea>` |
| `image` | `ImageUploadField` → upload to R2 → store URL |
| `select` | `StylePickerGrid` |
| `color` | Color picker |

### Canvas Layers

Files: `Canvas.tsx`, `FabricCanvas.tsx`

- Fabric.js renders `previewLayers` in z-index order
- `type: 'base'` → static product image
- `type: 'overlay'` → static overlay image
- `type: 'text'` → text overlay từ `fieldRef` value
- `type: 'image'` → uploaded user image

### AutoFill
File: `AutoFillBanner.tsx`
- Banner hiển thị khi có `CustomizationDraft` đã lưu cho product
- Click "Use previous" → `customizerStore.autoFill(savedData)`

### Preview Modal
File: `PreviewModal.tsx`
- Mở khi `isPreviewOpen === true`
- Hiển thị `previewImageUrl`

## 4. Flow A — BundleCustomizerPanel

File: `apps/client/src/components/customizer/BundleCustomizerPanel.tsx`

### When triggered
`product.customization.bundleCount > 1`

### Tab Structure
```
[Item 1 for Alice] [Item 2 for Bob]
  └── Fields for item 1 (name, message, etc.)
```

### Field ID Convention
Bundle fields use prefix `item_N_` (1-indexed):
```
item_1_name     → itemIndex=0, field="name"
item_2_name     → itemIndex=1, field="name"
```

`parseFieldId(id)` extracts `{ itemIndex: number, baseId: string }`.

### Bundle Store Actions
```typescript
setActiveItem(index: number): void;
setItemField(itemIndex: number, fieldId: string, value: FieldValue): void;
getItemData(itemIndex: number): Record<string, FieldValue>;
```

### Completion Check
Tab badge (✓/✗) based on `isItemComplete(index)`.
"Add to Cart" disabled until all items complete.

### Cart Payload
```typescript
{
  productId: string;
  variantId?: string;
  quantity: 1,
  customization: {
    templateId: "couples-mug-set-v1",
    bundleCount: 2,
    items: [
      { fields: { name: "Alice", message: "Love you" } },
      { fields: { name: "Bob",   message: "Always" } }
    ]
  }
}
```

## 5. Flow B — PersonalizationComingSoon

File: `apps/client/src/components/product/PersonalizationComingSoon.tsx`

- Badge: "Coming Soon"
- Email notify form
- Submit → `POST /api/v1/notifications/contact` or similar

## 6. Flow C — DirectAddToCartPanel

File: `apps/client/src/components/product/DirectAddToCartPanel.tsx`

- Quantity stepper (min: 1, max: 99)
- **Add to Cart** button → `cartStore.addItem()`
- **Add to Wishlist** heart icon (requires auth)
- Product attribute highlights
- Trust badges: processingDays, "Cancel within 2 hours", secure checkout

## 7. SmartVariantPicker

File: `apps/client/src/components/product/SmartVariantPicker.tsx`

### Widget Auto-Detection
```typescript
const OPTION_WIDGET_MAP: Record<string, WidgetType> = {
  Color: 'color-swatch', Colour: 'color-swatch',
  Shape: 'shape-picker',
  Model: 'device-model', Device: 'device-model',
  Size: 'size-picker', Capacity: 'size-picker',
};
// Default for unknown option names: 'pill'
```

Variant pickers: `ColorSwatchPicker`, `SizePicker`, `ShapePicker`, `DeviceModelPicker`

### Availability Cascade
When user selects an option, filter available variants and grey out incompatible values.

## 8. AI Features (via Job Polling)

### Background Removal
1. `customizerStore.removeBackground(fieldId)` → `POST /customization/remove-background`
2. Poll `GET /customization/jobs/{jobId}` every 2s (timeout: 65s)
3. On complete: update `fieldValues[fieldId]` with result URL

### Art Style Transformation
1. `customizerStore.applyArtStyle(fieldId, style)` → `POST /customization/art-style`
2. Same polling pattern
3. On complete: update field value

### Revert
`customizerStore.revertToOriginal(fieldId)` — revert to uploaded image before AI processing

## 9. Undo/Redo

```typescript
// History stack (max 50 entries)
history: FieldValues[];
historyIndex: number;

undo(): void;         // historyIndex--
redo(): void;         // historyIndex++
canUndo(): boolean;
canRedo(): boolean;
```

`setFieldValue()` automatically pushes to history.

## 10. SizeGuideModal

File: `apps/client/src/components/product/SizeGuideModal.tsx`

### Default Tables
| Product Type | Columns |
|---|---|
| apparel | Size, Chest (in), Waist (in), Length (in) |
| canvas | Size, Dimensions (cm), Best For |
| drinkware | Size, Height (cm), Diameter (cm), Capacity (ml) |

Custom guide: if `product.sizeGuide` provided, render sanitized HTML.
`SizePicker` shows "Size Guide" link only when `SIZE_GUIDE_TYPES` includes the product type.

## 11. Mobile Customizer

File: `MobileCustomizerCanvas.tsx`
- Mobile-optimized canvas layout
- Bottom sheet field input
- Touch-friendly controls
