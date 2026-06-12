# Module 04 — Product Catalog

## 1. Public Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/products` | Danh sách sản phẩm (phân trang, filter) | No |
| GET | `/api/v1/products/trending` | Top 12 trending sản phẩm (by soldCount) | No |
| GET | `/api/v1/products/recently-viewed` | 8 sản phẩm xem gần đây | Bearer |
| GET | `/api/v1/products/{slug}` | Chi tiết sản phẩm | No |
| GET | `/api/v1/products/{id}/related` | 8 sản phẩm liên quan | No |
| POST | `/api/v1/products/{id}/viewed` | Ghi lại lượt xem | Optional |

## 2. Admin Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/products` | Danh sách sản phẩm (includes inactive) | ADMIN |
| GET | `/api/v1/admin/products/{id}` | Full product by ID for edit form | ADMIN |
| GET | `/api/v1/admin/products/{id}/performance` | Stats (`?range=7d\|30d\|90d\|1y\|all`) | ADMIN |
| POST | `/api/v1/admin/products/draft` | Auto-create draft product | ADMIN |
| POST | `/api/v1/admin/products` | Create product with variants | ADMIN |
| PATCH | `/api/v1/admin/products/{id}` | Update product | ADMIN |
| DELETE | `/api/v1/admin/products/{id}` | Soft-delete product | ADMIN |
| POST | `/api/v1/admin/products/{id}/duplicate` | Deep copy product | ADMIN |
| POST | `/api/v1/admin/products/{id}/images` | Upload images (multipart, max 10) | ADMIN |
| POST | `/api/v1/admin/products/{id}/images/from-urls` | Attach presigned image URLs | ADMIN |
| DELETE | `/api/v1/admin/products/{id}/images/{imgId}` | Delete image | ADMIN |
| PATCH | `/api/v1/admin/products/{id}/images/reorder` | Reorder images | ADMIN |
| GET | `/api/v1/admin/products/{id}/detail` | Get MongoDB product detail | ADMIN |
| PUT | `/api/v1/admin/products/{id}/detail` | Upsert MongoDB product detail | ADMIN |
| POST | `/api/v1/admin/products/{id}/variants` | Add variant | ADMIN |
| DELETE | `/api/v1/admin/products/{id}/variants/{sku}` | Remove variant by SKU | ADMIN |
| POST | `/api/v1/admin/products/{id}/attributes` | Replace all attributes | ADMIN |
| POST | `/api/v1/admin/products/{id}/customization` | Set customization template | ADMIN |
| GET | `/api/v1/admin/products/{id}/variations` | List variation groups with options | ADMIN |
| PUT | `/api/v1/admin/products/{id}/variations` | Bulk-replace variation groups | ADMIN |
| POST | `/api/v1/admin/products/{id}/variations/groups` | Create variation group | ADMIN |
| DELETE | `/api/v1/admin/products/{id}/variations/groups/{groupId}` | Delete variation group | ADMIN |
| POST | `/api/v1/admin/products/{id}/variations/{groupId}/options` | Add option to group | ADMIN |
| PATCH | `/api/v1/admin/products/{id}/variations/{groupId}/options/{optionId}` | Update option | ADMIN |
| DELETE | `/api/v1/admin/products/{id}/variations/{groupId}/options/{optionId}` | Delete option | ADMIN |
| GET | `/api/v1/admin/products/{id}/variation-settings` | Get variation settings | ADMIN |
| PATCH | `/api/v1/admin/products/{id}/variation-settings` | Update variation settings | ADMIN |
| GET | `/api/v1/admin/products/{id}/variations/variants` | Flat variants for price matrix | ADMIN |
| PATCH | `/api/v1/admin/products/{id}/variations/variants/{variantId}` | Update variant | ADMIN |
| GET | `/api/v1/admin/products/{id}/custom-options` | List custom order options | ADMIN |
| POST | `/api/v1/admin/products/{id}/custom-options` | Add custom option field | ADMIN |
| PATCH | `/api/v1/admin/products/{id}/custom-options/{optionId}` | Update custom option | ADMIN |
| DELETE | `/api/v1/admin/products/{id}/custom-options/{optionId}` | Delete custom option | ADMIN |
| PUT | `/api/v1/admin/products/{id}/custom-options/reorder` | Reorder custom options | ADMIN |

## 3. Data Architecture

Sản phẩm dùng **dual-database**:
- **PostgreSQL** (Prisma): dữ liệu giao dịch (tên, giá, SKU, danh mục, variants, hình ảnh, thống kê)
- **MongoDB** (Mongoose): chi tiết phong phú (attributes, customization config, rich description, GPSR, imageAltTexts)

## 4. Prisma Models

```prisma
enum ProductStatus { DRAFT ACTIVE INACTIVE ARCHIVED }
enum WhoMadeIt     { I_DID SHOP_MEMBER ANOTHER_COMPANY }
enum HowItWasMade  { MADE_TO_ORDER HANDMADE ASSEMBLED ALTERED CURATED_SET NATURAL_MATERIAL }
enum RenewalType   { AUTOMATIC MANUAL }
enum ReturnPolicy  { NO_RETURNS RETURNS_ACCEPTED EXCHANGES_ONLY }

model Product {
  id                    String          @id @default(cuid())
  name                  String
  slug                  String          @unique
  sku                   String          @unique
  description           String?
  shortDescription      String?
  basePrice             Decimal
  compareAtPrice        Decimal?
  isPersonalizable      Boolean         @default(true)
  isActive              Boolean         @default(true)
  status                ProductStatus   @default(DRAFT)
  isFeatured            Boolean         @default(false)
  viewCount             Int             @default(0)
  soldCount             Int             @default(0)
  processingDays        Int             @default(3)
  titleCharCount        Int?
  categoryId            String          // primary category (legacy flat FK)
  // Item Attribute arrays
  primaryColors         String[]
  secondaryColors       String[]
  materials             String[]
  occasions             String[]
  holidayTags           String[]
  recipientTags         String[]
  styles                String[]
  sustainability        String[]
  // Pricing
  domesticGlobalPricing Boolean         @default(false)
  quantity              Int?
  returnPolicy          ReturnPolicy    @default(NO_RETURNS)
  // How It's Made
  whoMadeIt             WhoMadeIt       @default(I_DID)
  howItWasMade          HowItWasMade    @default(MADE_TO_ORDER)
  toolsUsed             String[]
  productionPartnerIds  String[]
  hsCode                String?
  // Relationships
  processingProfileId   String?
  shippingProfileId     String?
  shopSectionId         String?
  // Settings
  isAdsEnabled          Boolean         @default(false)
  renewalType           RenewalType     @default(AUTOMATIC)
  expiresAt             DateTime?
  videoUrls             String[]
  thumbnailCropData     Json?
  customizationConfig   Json?
  deletedAt             DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  altText   String?
  isPrimary Boolean @default(false)
  sortOrder Int     @default(0)
}

model ProductCategory {
  productId  String
  categoryId String
  isPrimary  Boolean @default(false)
  @@id([productId, categoryId])
}

model ProductVariant {
  id        String  @id @default(cuid())
  productId String
  name      String
  options   Json    // Record<string, string>
  price     Decimal
  sku       String  @unique
  isDefault Boolean @default(false)
  sortOrder Int     @default(0)
}

model VariationGroup {
  id          String            @id @default(cuid())
  productId   String
  name        String
  displayType String            // "color" | "image" | "text"
  sortOrder   Int               @default(0)
  options     VariationOption[]
}

model VariationOption {
  id          String  @id @default(cuid())
  groupId     String
  name        String
  value       String
  colorHex    String?
  imageUrl    String?
  imageId     String?
  priceDelta  Decimal @default(0)
  sortOrder   Int     @default(0)
  isAvailable Boolean @default(true)
}

model VariationSettings {
  id                String   @id @default(cuid())
  productId         String   @unique
  enableVariations  Boolean  @default(false)
  variesBy          String[]
  skuPrefix         String?
}

model ProcessingProfile {
  id        String               @id @default(cuid())
  name      String
  type      ProcessingProfileType
  minDays   Int
  maxDays   Int
  isDefault Boolean              @default(false)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt
}

model ShippingProfile {
  id             String                @id @default(cuid())
  name           String                @unique
  type           String
  activeListings Int                   @default(0)
  isDefault      Boolean               @default(false)
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  methods        ShippingProfileMethod[]
}

model ShippingProfileMethod {
  id              String  @id @default(cuid())
  profileId       String
  destinationType String
  carrier         String?
  minDays         Int
  maxDays         Int
  price           Decimal
  extraItemPrice  Decimal @default(0)
}

model ShopSection {
  id        String   @id @default(cuid())
  name      String   @unique
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}

model ProductionPartner {
  id          String   @id @default(cuid())
  name        String
  description String?
  location    String?
  createdAt   DateTime @default(now())
}
```

## 5. MongoDB Schema

Collection: `product_details`
```typescript
interface ProductDetail {
  productId: string;        // FK to PostgreSQL Product.id (indexed unique)
  richDescription?: string; // HTML rich description
  sizeGuide?: string;
  shippingNote?: string;
  attributes?: { key: string; value: string; filterable?: boolean; unit?: string }[];
  variantOptions?: { name: string; values: string[] }[];
  variants?: {
    sku: string;
    options: Record<string, string>;
    price: number;
    compareAtPrice?: number;
    isAvailable: boolean;
    isDefault: boolean;
    imageIndex?: number;
  }[];
  customization?: {
    templateId: string;
    version: number;
    fields: {
      id: string;
      type: 'text' | 'textarea' | 'image' | 'select' | 'color';
      label: string;
      required: boolean;
      maxLength?: number;
      options?: string[];
      position?: object;
      size?: object;
      allowBgRemoval?: boolean;
    }[];
    previewLayers: {
      type: 'base' | 'overlay' | 'text' | 'image';
      url: string;
      zIndex: number;
    }[];
  };
  metaTitle?: string;
  metaDescription?: string;
  printSpecs?: {
    minDPI: number;
    maxFileSize: number;  // MB
    acceptedFormats: string[];
    printArea?: object;
  };
  imageAltTexts?: Record<string, string>;  // imageId → altText
  gpsrInfo?: {
    manufacturerName?: string;
    manufacturerAddress?: string;
    manufacturerEmail?: string;
    safetyWarnings?: string[];
    countryOfOrigin?: string;
  };
}
```

## 6. Query Parameters (GET /products)

| Param | Type | Mô tả |
|---|---|---|
| page | number | Trang (default: 1) |
| limit | number | Items/trang (default: 24, max: 96) |
| categoryId | string | Category ID |
| category | string | Category slug |
| collection | string | Collection slug |
| tags | string[] | Tag slugs |
| minPrice | number | Giá tối thiểu |
| maxPrice | number | Giá tối đa |
| minRating | number | Rating tối thiểu |
| isActive | boolean | Filter active/inactive |
| isFeatured | boolean | Filter featured |
| sort | string | `newest`, `price_asc`, `price_desc`, `bestseller`, `rating`, `featured` |
| includeInactive | boolean | Admin only |

## 7. Product Page Flow (Client)

```
/[locale]/products/[slug]/page.tsx  (Server Component)
  ├── Fetch ProductDto SSR (revalidate: 60s)
  ├── ProductGallery, ProductInfo (static)
  └── <ProductPageInteractive product={product} locale={locale} />
        ├── <SmartVariantPicker onVariantChange={setSelectedVariant} />
        └── <ProductActions product={product} selectedVariant={selectedVariant} />
              ├── Flow A: CustomizerPanel / BundleCustomizerPanel (isPersonalizable + customization)
              ├── Flow B: PersonalizationComingSoon (isPersonalizable, no customization)
              └── Flow C: DirectAddToCartPanel (!isPersonalizable)

/[locale]/products/[slug]/customize/page.tsx  (Full-screen customizer)
  └── Full customizer UI (Fabric.js canvas)
```

## 8. SmartVariantPicker Widget Detection

File: `apps/client/src/components/product/SmartVariantPicker.tsx`

```typescript
const OPTION_WIDGET_MAP: Record<string, WidgetType> = {
  Color: 'color-swatch', Colour: 'color-swatch',
  Shape: 'shape-picker',
  Model: 'device-model', Device: 'device-model',
  Size: 'size-picker', Capacity: 'size-picker',
};
// fallback: 'pill' for unknown option names
```

## 9. Admin Product Edit Shell

File: `apps/admin/src/components/products/edit/ProductEditShell.tsx`

7 tabs (CSS hidden strategy — all components stay mounted to preserve local state):
- **Performance** — view/sold metrics (edit mode only)
- **Photo & Video** — image upload, reorder, alt texts, video URLs, thumbnail crop
- **Item Details** — name, category, rich description
- **Item Options** — tags, colors, materials, occasions, styles, customization options
- **Pricing & Shipping** — price, SKU, quantity, shipping/processing profiles, variations
- **How It's Made** — whoMadeIt, tools, production partners, GPSR info
- **Settings** — shop section, isFeatured, renewalType, isAdsEnabled

**Form state:** React Hook Form `FormProvider` — all fields live in parent, preserved across tabs.

**Save flow (edit mode):**
1. `PATCH /admin/products/{id}` — PostgreSQL fields (via `extractPrismaFields`, remaps `primaryCategoryId` → `categoryId`)
2. `PUT /admin/products/{id}/detail` — MongoDB fields: `richDescription`, `gpsrInfo`, `imageAltTexts`

**Image reorder:** `PATCH /admin/products/{id}/images/reorder` called immediately on drag end (not on Save).

## 10. Additional Admin Endpoints (Post-Phase 1)

### Q&A Management
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/questions` | ADMIN — all pending questions |
| POST | `/api/v1/admin/questions/{id}/answer` | ADMIN |
| PATCH | `/api/v1/admin/questions/{id}/status` | ADMIN |
| DELETE | `/api/v1/admin/questions/{id}` | ADMIN |

### Bulk Actions
| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/admin/products/bulk` | ADMIN — bulk publish/unpublish/archive/sale/export |

### CSV Import
| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/admin/products/csv/validate` | ADMIN |
| POST | `/api/v1/admin/products/csv/execute` | ADMIN |
| GET | `/api/v1/admin/products/csv/template` | ADMIN |

### Translations
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/products/{id}/translations` | ADMIN |
| PUT | `/api/v1/admin/products/{id}/translations/{locale}` | ADMIN |
| POST | `/api/v1/admin/products/{id}/translations/{locale}/auto` | ADMIN |

See full details: `29_admin_extended.spec.md`

## 11. Product Schema Additions (Post-Phase 1)

### Low-Stock Inventory Fields
```prisma
model Product {
  // ... existing fields ...
  trackInventory    Boolean @default(false)
  lowStockThreshold Int     @default(5)
}
```

### OrderItem Snapshot
`OrderItem` stores a `productSnapshot` JSON at order creation time — ensures historical accuracy when product is later modified:
```prisma
model OrderItem {
  // ... existing fields ...
  productSnapshot Json?   // { name, slug, imageUrl, basePrice, sku }
  variantSnapshot Json?   // { sku, options, price }
}
```

## 12. Public Q&A Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/products/{slug}/questions` | No — approved Q&A only |
| POST | `/api/v1/products/{slug}/questions` | Bearer — customer ask question |

Q&A tab in `ProductTabs`, FAQ structured data (`@type: FAQPage`) for answered questions.

See full Q&A spec: `29_admin_extended.spec.md`
