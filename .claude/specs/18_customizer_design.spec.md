# Module 18 — Customizer Design

## 1. Tổng quan

Hệ thống customizer 3 flow, được kích hoạt từ `ProductActions.tsx` dựa trên thuộc tính sản phẩm.

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

### Steps
1. **Customize** — User điền các field (text, image, color)
2. **Preview** — Hiển thị preview canvas với các layers
3. **Review** — Confirm trước khi add to cart

### State Machine (customizerStore)
```typescript
interface CustomizerState {
  fields: Record<string, FieldValue>;
  currentStep: 'customize' | 'preview' | 'review';
  isLoading: boolean;
  previewUrl?: string;
}
```

### Field Renderer (`FieldRenderer.tsx`)
| Field type | Component |
|---|---|
| `text` | `<Input>` với maxLength counter |
| `textarea` | `<Textarea>` với maxLength counter |
| `image` | `<ImageUpload>` → upload to R2 → store URL |
| `color` | `<ColorPicker>` (hex input + color wheel) |

### Preview Canvas
- React component renders layers in z-index order
- `previewLayers` from `CustomizationConfig`:
  - `type: 'image'` → render static product image
  - `type: 'text'` → render text overlay từ `fieldRef` value
  - `type: 'user-image'` → render uploaded user image

## 4. Flow A — BundleCustomizerPanel

File: `apps/client/src/components/customizer/BundleCustomizerPanel.tsx`

### When triggered
`product.customization.bundleCount > 1`

### Tab Structure
```
[Item 1 for Alice] [Item 2 for Bob]
  └── Fields for item 1 (name, message, etc.)
  └── Fields for item 2 (name, message, etc.)
```

### Field ID Convention
Bundle fields use prefix `item_N_` (1-indexed):
```
item_1_name     → item 0, field "name"
item_1_message  → item 0, field "message"
item_2_name     → item 1, field "name"
```

`parseFieldId(id)` extracts `{ itemIndex: number, baseId: string }`.

### Bundle State Extensions (customizerStore)
```typescript
{
  bundleCount: number;
  activeItemIndex: number;
  itemFields: Record<number, Record<string, FieldValue>>;
  // actions:
  setActiveItem(index: number): void;
  setItemField(itemIndex: number, fieldId: string, value: FieldValue): void;
  getItemData(itemIndex: number): Record<string, FieldValue>;
}
```

### Completion Check
Tab shows badge (✓/✗) based on `isItemComplete(index)`.
"Add to Cart" disabled until all items complete (all required fields filled).

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

### UI
- Badge: "Coming Soon"
- Mô tả: "We're working on the personalization tool for this product"
- Email notify form (pre-filled từ auth store user email)
- Submit → `POST /api/v1/notifications/product-ready { productId, email }`
- After submit: shows "We'll notify you" confirmation

## 6. Flow C — DirectAddToCartPanel

File: `apps/client/src/components/product/DirectAddToCartPanel.tsx`

### UI Elements
- Quantity stepper (min: 1, max: 99)
- **Add to Cart** button → `cartStore.addItem()`
- **Add to Wishlist** heart icon (requires auth, redirects to login if guest)
- Product attribute highlights (up to 4 key attributes)
- Trust badges:
  - Processing time (from `product.processingDays`)
  - "Cancel within 2 hours" window
  - Secure checkout icon

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

### Availability Cascade
When user selects an option value, filter available variants and grey out incompatible values in other pickers.

### Size Guide Integration
- `SizeGuideModal` managed internally via `useModal()`
- `SizePicker` shows "Size Guide" link only when `SIZE_GUIDE_TYPES` includes the product type
- Product types: `apparel`, `canvas`, `drinkware`, `other`
- `other` type: no size guide button

## 8. SizeGuideModal

File: `apps/client/src/components/product/SizeGuideModal.tsx`

### Default Tables
| Product Type | Columns |
|---|---|
| apparel | Size, Chest (in), Waist (in), Length (in) |
| canvas | Size, Dimensions (cm), Best For |
| drinkware | Size, Height (cm), Diameter (cm), Capacity (ml) |

Custom guide: if `product.sizeGuide.html` is provided, render sanitized HTML (inline `stripDangerousHtml()` — no DOMPurify).

## 9. i18n Keys Used

```
product.variants.sizeGuide
product.variants.unavailable
product.variants.outOfStock
product.variants.colorLabel
product.variants.shapeLabel
product.variants.modelLabel
product.variants.selectOption
product.sizeGuide.title
product.sizeGuide.apparel.note
product.sizeGuide.canvas.note
product.sizeGuide.drinkware.note
customizer.bundle.tabLabel
customizer.bundle.itemTab
customizer.bundle.complete
customizer.bundle.incomplete
customizer.bundle.priceNote
product.personalization.comingSoon
product.personalization.notifyMe
product.personalization.notified
product.actions.addToCart
product.actions.addToWishlist
product.actions.removeFromWishlist
product.actions.quantity
```
