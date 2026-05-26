# Module 03 — Catalog (Danh mục & Collection)

## 1. Tổng quan

Quản lý cấu trúc phân loại sản phẩm: category, collection (theo dịp lễ / chủ đề), tag. Đây là backbone để hiển thị navigation và filter trên storefront.

---

## 2. User Stories

### 2.1 Storefront
- **US-CAT-001:** Là khách, tôi muốn xem danh sách danh mục chính trên navbar để điều hướng nhanh.
- **US-CAT-002:** Là khách, tôi muốn xem các collection theo dịp lễ (Christmas, Valentine, Mother's Day...).
- **US-CAT-003:** Là khách, tôi muốn lọc sản phẩm theo tag (Pet Lovers, Couples, Family...).
- **US-CAT-004:** Là khách, tôi muốn thấy số lượng sản phẩm trong mỗi danh mục.

### 2.2 Admin
- **US-CAT-005:** Là admin, tôi muốn tạo/sửa/xóa category với ảnh thumbnail và mô tả.
- **US-CAT-006:** Là admin, tôi muốn tạo collection theo mùa/dịp lễ, gắn sản phẩm vào collection.
- **US-CAT-007:** Là admin, tôi muốn sắp xếp thứ tự hiển thị của category và collection.
- **US-CAT-008:** Là admin, tôi muốn ẩn/hiện một category mà không cần xóa.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/categories` | Danh sách category (tree) | No |
| GET | `/categories/:slug` | Chi tiết category + products | No |
| POST | `/admin/categories` | Tạo category | Admin |
| PATCH | `/admin/categories/:id` | Sửa category | Admin |
| DELETE | `/admin/categories/:id` | Xóa category | Admin |
| GET | `/collections` | Danh sách collections | No |
| GET | `/collections/:slug` | Chi tiết collection + products | No |
| POST | `/admin/collections` | Tạo collection | Admin |
| PATCH | `/admin/collections/:id` | Sửa collection | Admin |
| DELETE | `/admin/collections/:id` | Xóa collection | Admin |
| GET | `/tags` | Tất cả tags | No |

---

## 4. Data Models

```prisma
model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  sortOrder   Int        @default(0)
  isVisible   Boolean    @default(true)
  products    Product[]
  createdAt   DateTime   @default(now())
}

model Collection {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  bannerUrl   String?
  occasion    String?   -- "Christmas", "Valentine", "Mother's Day"...
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  startDate   DateTime?
  endDate     DateTime?
  products    CollectionProduct[]
  createdAt   DateTime  @default(now())
}

model CollectionProduct {
  collectionId String
  productId    String
  sortOrder    Int        @default(0)
  collection   Collection @relation(fields: [collectionId], references: [id])
  product      Product    @relation(fields: [productId], references: [id])

  @@id([collectionId, productId])
}

model Tag {
  id       String    @id @default(cuid())
  name     String    @unique
  slug     String    @unique
  products ProductTag[]
}

model ProductTag {
  productId String
  tagId     String
  product   Product @relation(fields: [productId], references: [id])
  tag       Tag     @relation(fields: [tagId], references: [id])

  @@id([productId, tagId])
}
```

---

## 5. Business Rules

- Category hỗ trợ **2 cấp** (parent → child), không nesting sâu hơn.
- Collection có thể đặt `startDate` / `endDate` để tự động hiện/ẩn theo mùa lễ.
- Xóa category chỉ được phép nếu **không có sản phẩm** đang active trong đó.
- Slug phải **unique**, tự động generate từ name nếu không nhập.
- Cache danh mục trên **Redis TTL 10 phút** vì ít thay đổi.
