# Module 18 — Customizer Design Spec

## 1. Tổng quan

Customizer là editor canvas chạy trên trình duyệt, cho phép khách:
- Nhập text (tên, ngày, lời nhắn)
- Upload & crop ảnh
- Xóa nền ảnh (AI)
- Chọn art style
- Xem preview real-time lên mockup sản phẩm

**Library:** Fabric.js v6
**Coordinate system:** Logic canvas 800×800px, scale về kích thước hiển thị theo container.
**Print resolution:** Canvas export ở 300dpi (3000×3000px tương đương 10×10 inch).

---

## 2. Canvas Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FABRIC CANVAS                     │
│                                                     │
│  Layer 0: Product mockup base image (locked)        │
│  Layer 1: Customizable zones (text / image objects) │
│  Layer 2: Product overlay / frame (locked)          │
│                                                     │
│  Coordinate origin: top-left (0, 0)                 │
│  Canvas size: 800 × 800 px (logical)                │
│  Display size: responsive (fit container)           │
└─────────────────────────────────────────────────────┘
```

### Scale factor
```typescript
const CANVAS_LOGICAL_SIZE = 800
const displaySize = containerRef.current.clientWidth  // responsive
const scaleFactor = displaySize / CANVAS_LOGICAL_SIZE

// Mọi position/size trong template config đều là logical px
// Fabric.js tự scale khi set canvas.setDimensions + setZoom
```

---

## 3. Template Config Schema (đầy đủ)

```typescript
interface CustomizationTemplate {
  id: string                    // "tmpl_mug_001"
  name: string                  // "Classic Mug"
  canvasWidth: number           // 800
  canvasHeight: number          // 800
  printWidth: number            // 3000 (px at 300dpi)
  printHeight: number           // 3000
  printDpi: number              // 300

  layers: TemplateLayer[]
  fields: TemplateField[]
}

// ── Layers ────────────────────────────────────────────────
type TemplateLayer =
  | BaseLayer      // ảnh mockup sản phẩm (background)
  | OverlayLayer   // frame / shadow đè lên trên content
  | PrintAreaLayer // chỉ dùng khi export print file

interface BaseLayer {
  type: 'base'
  url: string        // "/templates/mug-base.png"
  lockMovement: true
  selectable: false
}

interface OverlayLayer {
  type: 'overlay'
  url: string        // "/templates/mug-overlay.png"
  lockMovement: true
  selectable: false
}

interface PrintAreaLayer {
  type: 'print_area'
  x: number          // vị trí vùng in trên canvas logical
  y: number
  width: number
  height: number
  visible: false     // ẩn trên preview, chỉ dùng khi export
}

// ── Fields ────────────────────────────────────────────────
type TemplateField =
  | TextField
  | ImageField
  | SelectField
  | DateField

interface BaseField {
  id: string            // "name_text", "photo_upload"
  label: string         // "Your Name"
  required: boolean
  helpText?: string
}

interface TextField extends BaseField {
  type: 'text'
  placeholder?: string
  maxLength: number
  defaultValue?: string

  // Canvas rendering
  canvas: {
    x: number           // logical px, center of text
    y: number
    fontFamily: string  // phải nằm trong ALLOWED_FONTS
    fontSize: number    // logical px
    fontWeight?: 'normal' | 'bold'
    fontStyle?: 'normal' | 'italic'
    fill: string        // màu mặc định, user có thể chọn nếu colorPicker=true
    colorPicker?: boolean
    align?: 'left' | 'center' | 'right'
    maxWidth?: number   // text wrap nếu vượt quá
  }
}

interface ImageField extends BaseField {
  type: 'image'
  allowBgRemoval: boolean
  allowArtStyle: boolean
  artStyles?: ArtStyle[]    // chỉ có nếu allowArtStyle=true

  // Canvas rendering
  canvas: {
    x: number           // top-left của vùng ảnh
    y: number
    width: number
    height: number
    clipShape?: 'rect' | 'circle'   // cắt hình chữ nhật hay tròn
    borderRadius?: number           // nếu clipShape=rect
  }
}

interface SelectField extends BaseField {
  type: 'select'
  options: { value: string; label: string; previewUrl?: string }[]
  defaultValue?: string
  // Select không render trực tiếp lên canvas
  // Ảnh hưởng đến art style hoặc variant của ảnh
}

interface DateField extends BaseField {
  type: 'date'
  format: string          // "MMMM DD, YYYY"
  canvas: TextField['canvas']
}

// ── Art Styles ────────────────────────────────────────────
type ArtStyle = 'watercolor' | 'van_gogh' | 'cartoon' | 'realistic' | 'sketch'
```

---

## 4. Allowed Fonts

```typescript
export const ALLOWED_FONTS = [
  { id: 'dancing-script',  label: 'Dancing Script',  url: '/fonts/DancingScript.woff2',  style: 'cursive' },
  { id: 'playfair-display',label: 'Playfair Display', url: '/fonts/PlayfairDisplay.woff2',style: 'serif' },
  { id: 'montserrat',      label: 'Montserrat',       url: '/fonts/Montserrat.woff2',     style: 'sans-serif' },
  { id: 'pacifico',        label: 'Pacifico',         url: '/fonts/Pacifico.woff2',       style: 'cursive' },
  { id: 'roboto-slab',     label: 'Roboto Slab',      url: '/fonts/RobotoSlab.woff2',     style: 'serif' },
  { id: 'great-vibes',     label: 'Great Vibes',      url: '/fonts/GreatVibes.woff2',     style: 'cursive' },
  { id: 'lato',            label: 'Lato',             url: '/fonts/Lato.woff2',           style: 'sans-serif' },
  { id: 'cinzel',          label: 'Cinzel',           url: '/fonts/Cinzel.woff2',         style: 'serif' },
]
// Load via FontFace API khi khởi tạo customizer
```

---

## 5. Zustand — CustomizerStore

```typescript
interface FieldValue {
  text?: string
  imageKey?: string        // S3 key của ảnh đã upload
  imageUrl?: string        // URL hiển thị (temp hoặc permanent)
  processedImageKey?: string  // S3 key sau khi remove bg / apply style
  processedImageUrl?: string
  artStyle?: ArtStyle
  selectValue?: string
  bgRemoved?: boolean
  isUploading?: boolean
  uploadProgress?: number
  error?: string
}

interface CustomizerStore {
  // Config
  template: CustomizationTemplate | null
  productId: string | null
  variantId: string | null

  // Field values
  fieldValues: Record<string, FieldValue>  // key = field.id

  // UI state
  activeFieldId: string | null
  isPreviewOpen: boolean
  previewImageUrl: string | null
  isGeneratingPreview: boolean
  previewError: string | null

  // Fabric canvas ref
  fabricCanvas: fabric.Canvas | null

  // Undo / Redo
  history: FieldValues[]   // snapshots của fieldValues
  historyIndex: number

  // Actions
  initTemplate: (template, productId, variantId) => void
  setFieldValue: (fieldId: string, value: Partial<FieldValue>) => void
  setActiveField: (fieldId: string | null) => void
  setVariant: (variantId: string) => void
  setFabricCanvas: (canvas: fabric.Canvas) => void

  uploadImage: (fieldId: string, file: File) => Promise<void>
  removeBackground: (fieldId: string) => Promise<void>
  applyArtStyle: (fieldId: string, style: ArtStyle) => Promise<void>
  revertToOriginal: (fieldId: string) => void

  generatePreview: () => Promise<void>
  closePreview: () => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  autoFill: (savedData: Record<string, FieldValue>) => void
  reset: () => void

  // Computed
  isValid: () => boolean           // tất cả required fields có giá trị
  toCustomizationPayload: () => CustomizationPayload  // để gửi lên server
}
```

---

## 6. Component Tree — Customizer

```
CustomizerPanel (client component)
├── AutoFillPrompt            — chỉ hiện nếu có history và user đã login
├── VariantSelector           — chọn size/color (sync với store)
│
├── CanvasSection
│   ├── FabricCanvas          — canvas element, init Fabric.js
│   │   ├── BaseImageLayer    — mockup base
│   │   ├── UserImageObject   — Fabric.Image (draggable trong clip zone)
│   │   ├── TextObjects[]     — Fabric.Text per text field
│   │   └── OverlayImageLayer — frame / shadow
│   ├── ZoomControls          — +/− zoom, reset (mobile)
│   └── UndoRedoButtons
│
├── FieldsPanel
│   └── FieldRenderer (per field)
│       ├── TextField → TextInput + FontPicker + ColorPicker?
│       ├── ImageField → ImageUploadZone
│       │   ├── UploadButton
│       │   ├── UploadPreview (thumbnail + crop indicator)
│       │   ├── RemoveBgButton (+ loading state)
│       │   ├── ArtStylePicker (nếu allowArtStyle=true)
│       │   └── RevertButton
│       ├── SelectField → OptionGrid (image cards)
│       └── DateField → DateInput (formatted display)
│
├── PreviewButton             — "Preview" → gọi generatePreview()
│
└── AddToCartButton           — disabled cho đến khi isValid()

── Modals ───────────────────────────────────────────
PreviewModal
├── HighResPreviewImage
├── "This is an approximate preview" disclaimer
├── [Add to Cart] button
└── [Edit Customization] button

ImageCropModal (mở khi upload ảnh)
├── ReactCrop hoặc react-image-crop
├── Aspect ratio lock (theo canvas field size)
├── Zoom slider
└── [Confirm Crop] button
```

---

## 7. Canvas Interactions

### Desktop
| Action | Behavior |
|--------|----------|
| Click text field trên canvas | Focus field input bên phải |
| Click image zone trên canvas | Mở ImageUploadZone |
| Drag image object | Di chuyển ảnh trong clip zone |
| Scroll wheel trên canvas | Zoom in/out (clamp 0.5× – 3×) |
| Double-click text object | Inline edit (Fabric IText) |

### Mobile (Touch)
| Action | Behavior |
|--------|----------|
| Tap text zone | Scroll xuống field input tương ứng, focus |
| Tap image zone | Mở bottom sheet upload |
| Pinch trên image object | Scale ảnh trong clip zone |
| Two-finger drag | Pan canvas |
| Single tap ngoài object | Deselect |

### Keyboard (Desktop)
| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Xóa selected image (reset về empty) |
| `Arrow keys` | Nudge selected object 1px |
| `Shift+Arrow` | Nudge 10px |

---

## 8. Image Upload Flow (chi tiết)

```
1. User chọn file (input accept="image/*,.heic")
   ├── Validate client-side: size ≤ 10MB, type hợp lệ
   └── Nếu fail → toast error, không upload

2. Mở ImageCropModal
   ├── Hiển thị ảnh trong react-image-crop
   ├── Aspect ratio = field.canvas.width / field.canvas.height
   └── User confirm crop

3. Export cropped image (canvas.toBlob())
   → Compress nếu > 2MB (browser-image-compression)
   → Tạo FormData

4. POST /api/customization/upload-image
   ├── fieldValues[fieldId].isUploading = true
   ├── fieldValues[fieldId].uploadProgress = 0 → 100 (XHR progress)
   └── Nhận response: { tempKey, tempUrl, width, height }

5. Render lên Fabric canvas
   ├── fabric.Image.fromURL(tempUrl)
   ├── Scale + position vào clip zone
   ├── Set clipPath = Rect/Circle theo template config
   └── fieldValues[fieldId] = { imageKey: tempKey, imageUrl: tempUrl }

6. Fabric canvas re-render tự động
```

---

## 9. Remove Background Flow

```
1. User click "Remove Background"
   ├── Button: loading spinner, disabled
   ├── fieldValues[fieldId].bgRemoved = false (pending)

2. POST /api/customization/remove-background
   Body: { imageKey: fieldValues[fieldId].imageKey }
   ← { jobId }

3. Poll GET /api/jobs/:jobId mỗi 2 giây
   ├── status: 'processing' → giữ loading
   ├── status: 'done' → { processedKey, processedUrl }
   └── status: 'failed' → toast error, show "Try again"

4. Khi done:
   ├── fieldValues[fieldId].processedImageKey = processedKey
   ├── fieldValues[fieldId].processedImageUrl = processedUrl
   ├── fieldValues[fieldId].bgRemoved = true
   └── Update Fabric canvas: thay image source → processedUrl

5. "Revert to original" button xuất hiện
   → Restore imageUrl, bgRemoved = false
```

---

## 10. Preview Generation Flow (Server-side)

```typescript
// Request
POST /api/customization/generate-preview
{
  templateId: "tmpl_mug_001",
  fields: {
    name_text: "John & Sarah",
    photo_upload: {
      imageKey: "uploads/uuid.webp",       // original
      processedImageKey: "processed/uuid-nobg.webp",  // dùng cái này nếu có
      bgRemoved: true,
      artStyle: "watercolor"               // nếu có
    },
    style_select: "Watercolor"
  }
}

// Server xử lý (Sharp composite):
1. Load template base image
2. Per field:
   - Text: dùng @napi-rs/canvas hoặc sharp text overlay
   - Image: load processedImageKey (hoặc imageKey), resize, composite
3. Load template overlay image
4. Composite tất cả layers theo thứ tự
5. Output JPEG 1200×1200px (preview quality)
6. Upload lên S3: previews/{uuid}.jpg
7. Return { previewUrl }

// Response
{ previewUrl: "https://cdn.mapleloomhandmade.com/previews/uuid.jpg" }
```

---

## 11. Mobile Layout

Trên màn hình < 768px, Customizer chuyển sang layout dọc:

```
┌──────────────────────┐
│   Canvas (full width)│  ← vuốt để zoom
│   400px height       │
├──────────────────────┤
│  Tabs: Fields | Help │
├──────────────────────┤
│   Field 1: Your Name │
│   [Text Input      ] │
│                      │
│   Field 2: Photo     │
│   [Upload Button   ] │
│   [Remove BG] [Style]│
│                      │
│   [Preview]          │
│   [Add to Cart    ]  │
└──────────────────────┘
```

Canvas trên mobile dùng **touch-action: none** và Hammer.js cho pinch/pan.

---

## 12. Undo / Redo System

```typescript
// Lưu snapshot của fieldValues mỗi khi thay đổi
// Không lưu trạng thái Fabric canvas (quá nặng)
// Thay vào đó replay lại fieldValues để re-render canvas

const MAX_HISTORY = 20

function pushHistory(state: CustomizerStore) {
  const snapshot = JSON.parse(JSON.stringify(state.fieldValues))
  state.history = [
    ...state.history.slice(0, state.historyIndex + 1),
    snapshot
  ].slice(-MAX_HISTORY)
  state.historyIndex = state.history.length - 1
}

function undo(state) {
  if (state.historyIndex > 0) {
    state.historyIndex--
    state.fieldValues = state.history[state.historyIndex]
    replayCanvas(state.fabricCanvas, state.template, state.fieldValues)
  }
}
```

---

## 13. Add to Cart Payload

```typescript
interface CustomizationPayload {
  templateId: string
  fields: Record<string, {
    type: 'text' | 'image' | 'select' | 'date'
    value: string                    // text value hoặc imageKey
    processedValue?: string          // processed imageKey nếu có
    artStyle?: string
    bgRemoved?: boolean
  }>
  previewUrl: string | null          // null nếu chưa generate preview
  variantId: string
}

// CartItem.customizationData = CustomizationPayload (lưu vào DB)
// CartItem.previewUrl = previewUrl (hiển thị thumbnail trong cart)
```

---

## 14. Fallback — Upload Thất Bại Hoàn Toàn

Nếu upload ảnh fail sau 3 lần retry:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️  Unable to upload your photo right now.          │
│                                                     │
│  You can still place your order and send us        │
│  your photo via email after checkout.              │
│                                                     │
│  [Continue without photo]  [Try again]             │
└─────────────────────────────────────────────────────┘
```

Nếu chọn "Continue without photo":
- `fieldValues[imageFieldId].imageKey = '__PENDING_EMAIL__'`
- Order được tạo với flag `requiresManualProcessing: true`
- Admin thấy badge "⚠️ Awaiting photo" trên order
