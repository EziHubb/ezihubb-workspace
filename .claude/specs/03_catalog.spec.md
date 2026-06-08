# Module 03 — Catalog (Categories, Collections & Tags)

## 1. Public Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/catalog/mega-menu` | Mega-menu data từ MongoDB | No |
| GET | `/api/v1/catalog/categories` | Cây danh mục (tree, visible only) | No |
| GET | `/api/v1/catalog/categories/{slug}` | Chi tiết danh mục + L2/L3 children | No |
| GET | `/api/v1/catalog/tags` | All active tags | No |
| GET | `/api/v1/catalog/categories/{slug}/filterable-attributes` | Filterable attributes for category | No |
| GET | `/api/v1/collections` | Danh sách active collections | No |
| GET | `/api/v1/collections/{slug}` | Chi tiết collection + paginated products | No |
| GET | `/api/v1/tags` | All tags with product counts | No |

## 2. Admin Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/catalog/sync-mega-menu` | Rebuild MongoDB mega-menu from Prisma | ADMIN |
| GET | `/api/v1/admin/categories` | All categories (flat, including hidden) | ADMIN |
| POST | `/api/v1/admin/categories` | Create category | ADMIN |
| PATCH | `/api/v1/admin/categories/{id}` | Update category | ADMIN |
| DELETE | `/api/v1/admin/categories/{id}` | Delete (rejected if has active products) | ADMIN |
| GET | `/api/v1/admin/collections` | List all collections | ADMIN |
| POST | `/api/v1/admin/collections` | Create collection | ADMIN |
| PATCH | `/api/v1/admin/collections/{id}` | Update collection | ADMIN |
| DELETE | `/api/v1/admin/collections/{id}` | Delete collection | ADMIN |

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
  @@id([productId, tagId])
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
- Fallback: fetch from MongoDB directly when Redis unavailable
- Client: Next.js `fetch({ next: { revalidate: 600 } })`
- Admin rebuild: `POST /api/v1/admin/catalog/sync-mega-menu`

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

## 6. Frontend Pages

- `/[locale]/categories/[slug]` — Category listing with product grid
- `/[locale]/collections` — All collections
- `/[locale]/collections/[slug]` — Collection landing page
- Mega menu component: `apps/client/src/components/layout/MegaMenu.tsx`
- Category data fetched server-side for SEO

## 7. Business Rules

- Categories support L1/L2/L3 nesting (level field)
- Only `isVisible: true` categories shown in public tree
- `sortOrder` controls display order within same level
- Collections support date ranges (`startDate`, `endDate`) for seasonal visibility
- `GET /collections` only returns collections active within current date range
- Deleting a category with active products is rejected by the API
