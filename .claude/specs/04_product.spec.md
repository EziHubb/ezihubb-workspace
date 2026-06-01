# Module 04 — Product Catalog

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/products` | Danh sách sản phẩm (phân trang, filter) | No |
| GET | `/api/v1/products/{slug}` | Chi tiết sản phẩm | No |
| GET | `/api/v1/products/featured` | Sản phẩm nổi bật | No |
| GET | `/api/v1/products/new-arrivals` | Hàng mới về | No |
| GET | `/api/v1/products/{id}/related` | Sản phẩm liên quan | No |

## 2. Data Architecture

Sản phẩm dùng **dual-database**:
- **PostgreSQL** (Prisma): dữ liệu giao dịch (tên, giá, SKU, danh mục, variants, ratings)
- **MongoDB** (Mongoose): chi tiết phong phú (attributes, customization config, preview layers, shipping info)

## 3. Prisma Models

```prisma
model Product {
  id               String       @id @default(cuid())
  name             String
  slug             String       @unique
  description      String?
  basePrice        Decimal
  isActive         Boolean      @default(true)
  isPersonalizable Boolean      @default(true)
  categoryId       String
  category         Category     @relation(...)
  variants         ProductVariant[]
  variantOptions   VariantOption[]
  collections      CollectionProduct[]
  reviews          Review[]
  wishlisted       WishlistItem[]
  processingDays   Int          @default(3)
}

model ProductVariant {
  id          String      @id @default(cuid())
  productId   String
  sku         String      @unique
  price       Decimal
  stockQty    Int         @default(0)
  isActive    Boolean     @default(true)
  options     VariantOptionValue[]  // e.g. Color=Red, Size=M
}

model VariantOption {
  id        String              @id @default(cuid())
  productId String
  name      String              // "Color", "Size", "Material"
  values    VariantOptionValue[]
}
```

## 4. MongoDB Schema

Collection: `product_details`
```typescript
interface IProductDetail {
  productId: string;
  attributes?: { name: string; value: string }[];
  customization?: CustomizationConfig;
  previewLayers?: PreviewLayer[];
  sizeGuide?: { type: string; html: string };
  shippingInfo?: { processingDays: number; carrier: string };
}

interface CustomizationConfig {
  templateId: string;
  version: number;
  bundleCount?: number;  // > 1 → BundleCustomizerPanel
  fields: {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'image' | 'color';
    required: boolean;
    maxLength?: number;
    placeholder?: string;
  }[];
  previewLayers: PreviewLayer[];
}
```

## 5. Shared Types

```typescript
// libs/shared/types/src/lib/product.types.ts

interface ProductVariantDto {
  id?: string;
  sku: string;
  options: Record<string, string>;  // { "Color": "Red", "Size": "M" }
  price: number;
  isAvailable: boolean;
  isDefault?: boolean;
  // compat fields:
  size?: string; color?: string; material?: string;
  isActive?: boolean;
  attributes?: Record<string, string>;
}

interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isActive: boolean;
  isPersonalizable: boolean;
  primaryCategory: { id: string; name: string; slug: string };
  images: { url: string; altText?: string; isPrimary: boolean }[];
  rating?: { avg: number; count: number };
  soldCount24h?: number;
  badge?: string;
  processingDays?: number;
}

interface ProductDto extends ProductListItemDto {
  description?: string;
  variants: ProductVariantDto[];
  variantOptions?: { name: string; values: string[] }[];
  attributes?: { name: string; value: string }[];
  customization?: CustomizationConfigDto;
  sizeGuide?: { type: string; html: string };
}
```

## 6. Query Parameters (GET /products)

| Param | Type | Mô tả |
|---|---|---|
| page | number | Trang (default: 1) |
| limit | number | Items/trang (default: 24, max: 96) |
| category | string | Category slug |
| collection | string | Collection slug |
| minPrice | number | Giá tối thiểu |
| maxPrice | number | Giá tối đa |
| sort | string | `price_asc`, `price_desc`, `newest`, `popular` |
| isPersonalizable | boolean | Filter personalizable |
| search | string | Full-text search |

## 7. Product Page Flow (Client)

File: `apps/client/src/app/[locale]/(main)/products/[slug]/page.tsx`

```
Server Component (page.tsx)
  ├── apiClient.get<ProductDto>(`/products/${slug}`) — SSR with revalidate: 60
  ├── Renders ProductImages, ProductInfo (static)
  └── <ProductPageInteractive product={product} locale={locale} />
        ├── <SmartVariantPicker ... onVariantChange={setSelectedVariant} />
        └── <ProductActions product={product} selectedVariant={selectedVariant} />
              ├── Flow A: CustomizerPanel / BundleCustomizerPanel (isPersonalizable + customization)
              ├── Flow B: PersonalizationComingSoon (isPersonalizable, no customization)
              └── Flow C: DirectAddToCartPanel (!isPersonalizable)
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

## 9. Seed Data (Dev)

Products seeded via `prisma/seed.ts`:
- Custom Name Necklace (Flow A — personalizable with customization)
- Custom Pet Portrait Canvas (Flow A — personalizable with customization)
- Couples Mug Set (Flow A — bundle, bundleCount: 2)
- Personalized Wine Glass (Flow C — isPersonalizable: false)
- Custom Cutting Board (Flow C — isPersonalizable: false)
- Personalized Keychain (Flow C — isPersonalizable: false)
- Family Name Sign (Flow B — isPersonalizable: true, no customization in seed)
