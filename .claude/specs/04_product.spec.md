# Module 04 — Product Management

## 1. Tổng quan

Quản lý toàn bộ thông tin sản phẩm: thông tin cơ bản, variants (size/màu), giá, hình ảnh, customization template config, trạng thái tồn kho (POD không cần track stock vật lý nhưng cần track template availability).

---

## 2. User Stories

### 2.1 Storefront — Xem sản phẩm
- **US-PROD-001:** Là khách, tôi muốn xem danh sách sản phẩm với ảnh, tên, giá.
- **US-PROD-002:** Là khách, tôi muốn xem trang chi tiết sản phẩm với mô tả đầy đủ, ảnh gallery, variants.
- **US-PROD-003:** Là khách, tôi muốn thấy badge "In demand – X người mua trong 24h" để cảm nhận độ phổ biến.
- **US-PROD-004:** Là khách, tôi muốn xem sản phẩm liên quan / gợi ý ở cuối trang.
- **US-PROD-005:** Là khách, tôi muốn xem giá gốc và giá sale nếu sản phẩm đang khuyến mãi.
- **US-PROD-006:** Là khách, tôi muốn chọn variant (size, màu) trước khi customize.

### 2.2 Admin — Quản lý sản phẩm
- **US-PROD-007:** Là admin, tôi muốn tạo sản phẩm mới với đầy đủ thông tin.
- **US-PROD-008:** Là admin, tôi muốn upload nhiều ảnh sản phẩm, chọn ảnh chính.
- **US-PROD-009:** Là admin, tôi muốn tạo các variants (ví dụ: size S/M/L, màu đen/trắng) với giá riêng.
- **US-PROD-010:** Là admin, tôi muốn gắn sản phẩm vào category, collection, tags.
- **US-PROD-011:** Là admin, tôi muốn ẩn/hiện sản phẩm mà không cần xóa.
- **US-PROD-012:** Là admin, tôi muốn xem thống kê: số lượt xem, số lần mua của từng sản phẩm.
- **US-PROD-013:** Là admin, tôi muốn duplicate sản phẩm để tạo biến thể nhanh.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/products` | Danh sách sản phẩm (paginated, filterable) | No |
| GET | `/products/:slug` | Chi tiết sản phẩm | No |
| GET | `/products/:slug/related` | Sản phẩm liên quan | No |
| GET | `/products/trending` | Top sản phẩm trending | No |
| POST | `/admin/products` | Tạo sản phẩm | Admin |
| PATCH | `/admin/products/:id` | Sửa sản phẩm | Admin |
| DELETE | `/admin/products/:id` | Xóa sản phẩm | Admin |
| POST | `/admin/products/:id/duplicate` | Duplicate sản phẩm | Admin |
| POST | `/admin/products/:id/images` | Upload ảnh sản phẩm | Admin |
| DELETE | `/admin/products/:id/images/:imgId` | Xóa ảnh | Admin |
| GET | `/admin/products` | Danh sách (admin view, full data) | Admin |

---

## 4. Data Models

```prisma
model Product {
  id                  String    @id @default(cuid())
  name                String
  slug                String    @unique
  sku                 String    @unique
  description         String
  shortDescription    String?
  basePrice           Decimal   @db.Decimal(10, 2)
  compareAtPrice      Decimal?  @db.Decimal(10, 2)  -- giá gốc khi sale
  isPersonalizable    Boolean   @default(true)
  isActive            Boolean   @default(true)
  isFeatured          Boolean   @default(false)
  viewCount           Int       @default(0)
  soldCount           Int       @default(0)
  processingDays      Int       @default(3)          -- ngày sản xuất POD
  categoryId          String
  category            Category  @relation(fields: [categoryId], references: [id])
  
  variants            ProductVariant[]
  images              ProductImage[]
  customizationConfig Json?                          -- config cho personalizer
  collections         CollectionProduct[]
  tags                ProductTag[]
  reviews             Review[]
  wishlistItems       WishlistItem[]
  orderItems          OrderItem[]
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@index([categoryId])
  @@index([isActive, isFeatured])
}

model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  name       String   -- "Size M - Black"
  options    Json     -- { size: "M", color: "Black" }
  price      Decimal  @db.Decimal(10, 2)
  sku        String?
  isDefault  Boolean  @default(false)
  sortOrder  Int      @default(0)
  orderItems OrderItem[]
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id])
  url       String
  altText   String?
  isPrimary Boolean @default(false)
  sortOrder Int     @default(0)
}
```

---

## 5. Cấu trúc `customizationConfig` (JSON)

```json
{
  "templateId": "tmpl_mug_001",
  "fields": [
    {
      "id": "name_text",
      "type": "text",
      "label": "Your Name",
      "maxLength": 30,
      "required": true,
      "position": { "x": 120, "y": 80 }
    },
    {
      "id": "photo_upload",
      "type": "image",
      "label": "Upload Photo",
      "required": false,
      "allowBgRemoval": true,
      "position": { "x": 50, "y": 50 },
      "size": { "w": 200, "h": 200 }
    },
    {
      "id": "style_select",
      "type": "select",
      "label": "Art Style",
      "options": ["Watercolor", "Van Gogh", "Cartoon", "Realistic"],
      "required": true
    }
  ],
  "previewLayers": [
    { "type": "base", "url": "/templates/mug-base.png" },
    { "type": "overlay", "url": "/templates/mug-overlay.png" }
  ]
}
```

---

## 6. Business Rules

- Slug tự động tạo từ tên sản phẩm + SKU suffix (unique guarantee).
- Sản phẩm phải có **ít nhất 1 ảnh** mới được publish.
- `compareAtPrice` phải **lớn hơn** `basePrice` (dùng để hiển thị % giảm giá).
- `viewCount` tăng mỗi khi trang chi tiết được load (debounce theo session).
- `soldCount` tăng khi đơn hàng chuyển sang trạng thái `CONFIRMED`.
- Badge "In demand" hiện nếu sản phẩm có **≥ 10 đơn trong 24h**.
- "Related products" lấy theo: cùng category + cùng tags, giới hạn 8 sản phẩm.
