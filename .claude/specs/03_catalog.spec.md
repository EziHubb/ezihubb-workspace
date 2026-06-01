# Module 03 — Catalog (Categories & Collections)

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/catalog/categories` | Cây danh mục (tree) | No |
| GET | `/api/v1/catalog/categories/{slug}` | Chi tiết danh mục | No |
| GET | `/api/v1/catalog/mega-menu` | Mega-menu data từ MongoDB | No |
| GET | `/api/v1/catalog/collections` | Danh sách collections | No |
| GET | `/api/v1/catalog/collections/{slug}` | Chi tiết collection | No |

## 2. Data Sources

### Categories — PostgreSQL (Prisma)
```prisma
model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("Subcategories", fields: [parentId], references: [id])
  children    Category[] @relation("Subcategories")
  products    Product[]
  sortOrder   Int        @default(0)
  isActive    Boolean    @default(true)
}
```

### Mega Menu — MongoDB
Collection: `mega_menus`
```typescript
interface MegaMenu {
  _id: ObjectId;
  categories: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    subcategories?: {
      id: string; name: string; slug: string; imageUrl?: string;
    }[];
    featured?: {
      productSlug: string; imageUrl: string; label: string;
    }[];
  }[];
  updatedAt: Date;
}
```

### Collections — PostgreSQL
```prisma
model Collection {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  imageUrl    String?
  isActive    Boolean   @default(true)
  products    CollectionProduct[]
}
```

## 3. Mega Menu Caching

- Route: `GET /api/v1/catalog/mega-menu`
- Redis cache TTL: 1 hour (key: `mega-menu:v1`)
- Fallback: fetch from MongoDB directly when Redis unavailable
- Client: cached with Next.js `fetch({ next: { revalidate: 3600 } })`

## 4. Category Tree Response

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Home & Living",
      "slug": "home-living",
      "children": [
        { "id": "...", "name": "Canvas Art", "slug": "canvas-art", "children": [] }
      ]
    }
  ]
}
```

## 5. Frontend Pages

- `/[locale]/categories/[slug]` — Category listing page with product grid
- Breadcrumb shows parent → child hierarchy
- Mega menu component: `apps/client/src/components/layout/MegaMenu.tsx`
- Category data fetched server-side for SEO

## 6. Business Rules

- Categories support unlimited nesting (parent/children relationship)
- Only `isActive: true` categories shown in mega menu
- sortOrder field controls display order within same level
- Collections are curated product sets (e.g. "Best Sellers", "New Arrivals")
