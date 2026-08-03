# Module 03 — Catalog (Categories, Collections, Tags & Attributes)

## 1. Public Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/catalog/mega-menu` | Mega-menu data từ MongoDB (Redis-cached 10min) | No |
| GET | `/api/v1/catalog/categories` | Cây danh mục (tree, visible only) | No |
| GET | `/api/v1/catalog/categories/{slug}` | Chi tiết danh mục + L2/L3 children | No |
| GET | `/api/v1/catalog/tags` | All active tags (backward compat alias) | No |
| GET | `/api/v1/catalog/categories/{slug}/filterable-attributes` | Filterable attributes cho category | No |
| GET | `/api/v1/collections` | Danh sách active collections (`?occasion=`) | No |
| GET | `/api/v1/collections/{slug}` | Chi tiết collection + paginated products | No |
| GET | `/api/v1/tags` | All tags with product counts | No |

## 2. Admin Endpoints

### Categories & Collections
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/catalog/sync-mega-menu` | Rebuild MongoDB mega-menu từ Prisma | ADMIN |
| GET | `/api/v1/admin/categories` | All categories (flat, including hidden, `?limit=`) | ADMIN |
| GET | `/api/v1/admin/categories/{id}` | Get single category by ID | ADMIN |
| POST | `/api/v1/admin/categories` | Create category | ADMIN |
| PATCH | `/api/v1/admin/categories/{id}` | Update category | ADMIN |
| DELETE | `/api/v1/admin/categories/{id}` | Delete (rejected nếu có active products) | ADMIN |
| GET | `/api/v1/admin/collections` | List all collections (including inactive) | ADMIN |
| POST | `/api/v1/admin/collections` | Create collection | ADMIN |
| PATCH | `/api/v1/admin/collections/{id}` | Update collection | ADMIN |
| DELETE | `/api/v1/admin/collections/{id}` | Delete collection | ADMIN |

### Tags
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/tags` | List all tags with product counts | ADMIN |
| POST | `/api/v1/admin/tags` | Create tag (auto-slug) | ADMIN |
| PATCH | `/api/v1/admin/tags/{id}` | Rename tag | ADMIN |
| DELETE | `/api/v1/admin/tags/{id}` | Delete tag (cascades to all products) | ADMIN |

### Attributes
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/attributes/{type}` | Get attribute values by type | ADMIN |
| POST | `/api/v1/admin/attributes/{type}` | Add custom attribute value | ADMIN |
| DELETE | `/api/v1/admin/attributes/{type}/{value}` | Remove attribute value | ADMIN |

Valid attribute types: `color`, `material`, `occasion`, `holiday`, `recipient`, `style`, `sustainability`, `hat-type`

### Shop Sections
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/shop-sections` | List (scoped tới store của seller; super-admin thấy tất cả) | ADMIN |
| POST | `/api/v1/admin/shop-sections` | Tạo shop section | ADMIN |
| PATCH | `/api/v1/admin/shop-sections/{id}` | Cập nhật | ADMIN |
| DELETE | `/api/v1/admin/shop-sections/{id}` | Xoá (gỡ `shopSectionId` khỏi products liên quan) | ADMIN |

### Production Partners
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/production-partners` | List | ADMIN |
| POST | `/api/v1/admin/production-partners` | Tạo | ADMIN |
| PATCH | `/api/v1/admin/production-partners/{id}` | Cập nhật | ADMIN |
| DELETE | `/api/v1/admin/production-partners/{id}` | Xoá | ADMIN |

`ShopSection` và `ProductionPartner` Prisma models: xem `04_product.spec.md` §4. Shop sections filter theo `storeId` của user hiện tại (guard nội bộ `resolveStoreId`); production partners không scope theo store.

## 3. Data Sources

### Categories — PostgreSQL (Prisma)
```prisma
model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  level       Int        // 1=L1, 2=L2, 3=L3
  parentId    String?
  parent      Category?  @relation("Subcategories", fields: [parentId], references: [id])
  children    Category[] @relation("Subcategories")
  sortOrder   Int        @default(0)
  isVisible   Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  products    ProductCategory[]
}

model Tag {
  id       String       @id @default(cuid())
  name     String
  slug     String       @unique
  products ProductTag[]
}

model ProductTag {
  productId String
  tagId     String
  tag       Tag     @relation(fields: [tagId], references: [id])
  @@id([productId, tagId])
}

model AttributeValue {
  id    String @id @default(cuid())
  type  String
  value String
  @@unique([type, value], name: "type_value")
}
```

### Collections — PostgreSQL
```prisma
model Collection {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  bannerUrl   String?
  occasion    String?
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime  @default(now())
  products    CollectionProduct[]
}

model CollectionProduct {
  collectionId String
  productId    String
  sortOrder    Int    @default(0)
  @@id([collectionId, productId])
}
```

### Category Menu — MongoDB
Collection: `category_menus`
```typescript
interface CategoryMenu {
  navLabel: string;      // unique — top-level nav tab label
  navSlug: string;       // unique
  categoryId: string;    // FK to PostgreSQL Category.id (L1)
  sortOrder: number;
  isVisible: boolean;
  iconUrl?: string;
  groups: {             // columns in mega-menu (L2)
    title: string;
    categoryId: string; // L2
    slug: string;
    items: {            // L3
      name: string;
      categoryId: string;
      slug: string;
      sortOrder: number;
    }[];
    sortOrder: number;
  }[];
}
```

## 4. Mega Menu Caching

- Route: `GET /api/v1/catalog/mega-menu`
- Redis cache TTL: 10 minutes (key: `mega-menu:v1`)
- Fallback: fetch từ MongoDB trực tiếp khi Redis không khả dụng
- Client: Next.js `fetch({ next: { revalidate: 600 } })`
- Admin rebuild: `POST /api/v1/admin/catalog/sync-mega-menu` → trả về `{ synced: number }`

## 5. Category Tree Response

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Home & Living",
      "slug": "home-living",
      "level": 1,
      "children": [
        { "id": "...", "name": "Canvas Art", "slug": "canvas-art", "level": 2, "children": [] }
      ]
    }
  ]
}
```

## 6. Admin Categories — limit param

`GET /api/v1/admin/categories?limit=N` — default 500, max 2000

## 7. Collections — occasion filter

`GET /api/v1/collections?occasion=christmas` — lọc theo occasion string (optional)
Admin `GET /api/v1/admin/collections` — trả về tất cả kể cả inactive

## 8. Frontend Pages

- `/[locale]/categories/[slug]` — Category listing with product grid
- `/[locale]/collections` — All collections
- `/[locale]/collections/[slug]` — Collection landing page
- Mega menu component: `apps/client/src/components/layout/MegaMenu.tsx`
- Category data fetched server-side for SEO

Admin (`apps/admin/src/app/(admin)/catalog/`):
- `/catalog/categories` — Category tree management
- `/catalog/collections` — Collections management
- `/catalog/tags` — Tags management
- `/catalog/shop-sections` — Shop sections management
- `/catalog/production-partners` — Production partners management

## 9. Business Rules

- Categories support L1/L2/L3 nesting (level field)
- Only `isVisible: true` categories shown in public tree
- `sortOrder` controls display order within same level
- Collections support date ranges (`startDate`, `endDate`) cho seasonal visibility
- `GET /collections` chỉ trả về collections active trong ngày hiện tại + `isActive: true`
- Deleting a category with active products bị rejected bởi API
- Tag slug tự động generated từ name (lowercase, replace spaces với `-`)
- Tag delete cascades to all products (via FK `onDelete: Cascade`)
- Attribute types hardcoded: `color`, `material`, `occasion`, `holiday`, `recipient`, `style`, `sustainability`, `hat-type`
