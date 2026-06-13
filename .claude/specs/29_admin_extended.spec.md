# Module 29 — Admin Extended Features

Tập hợp các tính năng admin được implement trong các phase sau ban đầu: CSV import, Q&A, Bulk Actions, Hotjar Analytics, Admin Settings, Team Management, Email Template Management, CSV Export, AuditLog, và AI Features dashboard.

---

## 1. CSV Bulk Product Import (P2-03)

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/products/csv/validate` | Validate CSV (dry run, trả về errors) | ADMIN |
| POST | `/api/v1/admin/products/csv/execute` | Execute import sau khi validate | ADMIN |
| GET | `/api/v1/admin/products/csv/template` | Download CSV template | ADMIN |

### CSV Format (17 cột)

| Column | Required | Notes |
|---|---|---|
| slug | Yes | Unique, upsert key |
| name | Yes | |
| sku | No | Auto-gen if empty |
| basePrice | Yes | Decimal |
| compareAtPrice | No | |
| status | No | DRAFT/ACTIVE/INACTIVE |
| categorySlug | Yes | Must match existing category |
| description | No | |
| shortDescription | No | |
| isPersonalizable | No | true/false |
| processingDays | No | Int |
| primaryColors | No | Comma-separated |
| materials | No | Comma-separated |
| occasions | No | Comma-separated |
| tags | No | Comma-separated tag slugs |
| imageUrls | No | Pipe-separated URLs |
| quantity | No | Stock quantity |

### Import Behavior
- Upsert by `slug`: nếu tồn tại thì UPDATE, nếu không thì INSERT
- `sku` auto-generated: `{PREFIX}-{random6}` nếu để trống
- Errors returned per-row: `{ row: 5, field: 'basePrice', message: 'Invalid number' }`
- Max 500 rows per import
- Validate → Execute flow: validate không lưu, execute mới lưu

### Admin UI
File: `apps/admin/src/app/(admin)/products/import/page.tsx`
- Drag & drop CSV upload zone
- Preview table (first 10 rows)
- Validation errors panel
- "Execute Import" button (disabled until validate passes)
- Progress indicator during execute

---

## 2. Product Q&A (P2-04)

### Endpoints

#### Public
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/products/{slug}/questions` | No — public approved Q&A |
| POST | `/api/v1/products/{slug}/questions` | Bearer — customer ask question |

#### Admin
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/questions` | ADMIN — pending Q&A |
| POST | `/api/v1/admin/questions/{id}/answer` | ADMIN — answer question |
| PATCH | `/api/v1/admin/questions/{id}/status` | ADMIN — approve/reject |
| DELETE | `/api/v1/admin/questions/{id}` | ADMIN |

### Prisma Model

```prisma
enum QuestionStatus { PENDING ANSWERED REJECTED }

model ProductQuestion {
  id          String         @id @default(cuid())
  productId   String
  userId      String?
  guestEmail  String?
  question    String
  answer      String?
  status      QuestionStatus @default(PENDING)
  answeredBy  String?        // adminId
  answeredAt  DateTime?
  isPublic    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  product     Product        @relation(fields: [productId], references: [id])
}
```

### Frontend Q&A Section

File: `apps/client/src/components/product/QaSection.tsx`
- Displayed in `ProductTabs` (new "Q&A" tab)
- Approved Q&A rendered as accordion
- "Ask a question" form (authenticated users)
- FAQ Structured Data (`@type: FAQPage`) for answered questions

### Admin Q&A Tab

File: `apps/admin/src/components/products/edit/tabs/QaTab.tsx`
- List of pending + answered questions
- Answer input form
- Approve/reject/delete controls

### Business Rules

- Questions visible when `status === ANSWERED && isPublic === true`
- Admin must answer before approving
- Guest can ask (with email) — no authentication required for public Q&A
- `isPublic: false` for sensitive questions (show privately to asker only)

---

## 3. Bulk Product Actions (P2-05)

### Endpoint

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/products/bulk` | Execute bulk action | ADMIN |

### BulkActionDto

```typescript
interface BulkActionDto {
  ids: string[];  // product IDs
  action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'SET_SALE' | 'EXPORT';
  payload?: {
    salePercentage?: number;  // for SET_SALE action
  };
}
```

### Actions

| Action | Effect |
|---|---|
| PUBLISH | `status → ACTIVE, isActive → true` |
| UNPUBLISH | `status → INACTIVE, isActive → false` |
| ARCHIVE | `status → ARCHIVED, deletedAt → now()` |
| SET_SALE | `compareAtPrice = basePrice; basePrice -= salePercentage%` |
| EXPORT | Returns CSV of selected products |

### Admin UI Components

File: `apps/admin/src/components/products/BulkActionBar.tsx`
- Shown when rows are selected in product DataTable
- Dropdown: "Publish Selected", "Unpublish Selected", "Archive Selected", "Set Sale Price", "Export"
- Confirm modal before destructive actions

`DataTable` props addition:
```typescript
onSelectionChange?: (selectedIds: string[]) => void;
```

---

## 4. Hotjar Integration (P2-06)

### Setup

File: `apps/client/src/lib/hotjar.ts`

```typescript
export function initHotjar(hjid: number, hjsv: number) { ... }
export function identifyHotjar(userId: string, attrs: Record<string, unknown>) { ... }
export function trackHotjarEvent(eventName: string) { ... }
```

### Layout Integration

In `apps/client/src/app/[locale]/(storefront)/layout.tsx`:
```tsx
<Script id="hotjar-init">
  {`hj('identify', userId, { email, country })`}
</Script>
```

Env: `NEXT_PUBLIC_HOTJAR_ID`, `NEXT_PUBLIC_HOTJAR_SV`

### 5 Funnel Events Tracked

| Event | Triggered When |
|---|---|
| `product_viewed` | Product detail page load |
| `customizer_opened` | Customizer panel opened |
| `add_to_cart` | Item added to cart |
| `checkout_started` | Checkout page entered |
| `purchase_completed` | Order success page |

### Payment Suppression

On checkout/payment pages: Hotjar session recording suppressed via `data-hj-suppress` attribute on payment form to avoid capturing card data.

### CSP Update

Added `https://static.hotjar.com` and `https://vars.hotjar.com` to Content-Security-Policy script-src and connect-src.

---

## 5. Admin Settings API (GAP-P2-01)

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/settings` | Get all settings | ADMIN |
| PATCH | `/api/v1/admin/settings` | Update settings | SUPER_ADMIN |
| GET | `/api/v1/admin/settings/{key}` | Get single setting | ADMIN |

### Prisma Model

```prisma
model AdminSetting {
  key       String   @id
  value     Json
  type      String   // "string" | "number" | "boolean" | "json"
  label     String
  group     String   // "general" | "payments" | "shipping" | "loyalty" | "referral"
  updatedAt DateTime @updatedAt
  updatedBy String?
}
```

### Configurable Settings

| Key | Group | Default |
|---|---|---|
| `store.name` | general | "Daily Daisy" |
| `store.email` | general | noreply@... |
| `loyalty.earnRate` | loyalty | 10 (pts/$1) |
| `loyalty.redeemRate` | loyalty | 100 (pts/$1) |
| `referral.l1Rate` | referral | 0.05 |
| `referral.l2Rate` | referral | 0.02 |
| `referral.l3Rate` | referral | 0.01 |
| `referral.buyerDiscount` | referral | 0.03 |
| `affiliate.defaultRate` | affiliate | 0.05 |
| `currency.defaultCurrency` | general | "USD" |
| `tax.rate` | payments | 0.08 |

### Admin Settings Page

File: `apps/admin/src/app/(admin)/settings/page.tsx`
- Tab-grouped settings form
- "Save" button per group
- Audit trail: who changed, when

---

## 6. Team Management (GAP-P2-02)

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/team` | List team members (ADMIN role) | SUPER_ADMIN |
| POST | `/api/v1/admin/team/invite` | Invite new admin user | SUPER_ADMIN |
| PATCH | `/api/v1/admin/team/{userId}/role` | Change admin role | SUPER_ADMIN |
| DELETE | `/api/v1/admin/team/{userId}` | Remove admin access | SUPER_ADMIN |

### Admin UI

File: `apps/admin/src/app/(admin)/settings/team/page.tsx`
- Team member table (name, email, role, last active)
- "Invite Admin" modal: send invitation email
- Role picker: ADMIN / SUPER_ADMIN
- Remove access button with confirm

---

## 7. Email Template Management (GAP-P2-03)

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/email-templates` | List all templates | ADMIN |
| GET | `/api/v1/admin/email-templates/{name}` | Get template content | ADMIN |
| PATCH | `/api/v1/admin/email-templates/{name}` | Update template (subject + body) | SUPER_ADMIN |
| POST | `/api/v1/admin/email-templates/{name}/preview` | Send preview to email | ADMIN |
| POST | `/api/v1/admin/email-templates/{name}/reset` | Reset to default | SUPER_ADMIN |

### Admin UI

File: `apps/admin/src/app/(admin)/settings/email-templates/page.tsx`
- Template list (welcome, order-confirmation, etc.)
- Monaco editor (HTML/Handlebars) for editing
- Variable reference panel (shows available `{{variables}}`)
- Send preview button

---

## 8. CSV Export (GAP-P2-04)

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/orders/export` | Export orders as CSV | ADMIN |
| GET | `/api/v1/admin/customers/export` | Export customers as CSV | ADMIN |
| GET | `/api/v1/admin/products/export` | Export products as CSV | ADMIN |

### Query Params (all export endpoints)
- `startDate`, `endDate` — date range filter
- `status` — filter by status
- `format` — `csv` (default) | `xlsx` (future)

Response: `Content-Type: text/csv` với `Content-Disposition: attachment; filename="orders-export-2026-06-12.csv"`

---

## 9. AuditLog Service (Phase 5)

### Service

File: `apps/api/src/modules/admin/audit-log.service.ts`

```typescript
@Injectable()
export class AuditLogService {
  async log(event: AuditLogEvent): Promise<void>;
  async findByUser(userId: string): Promise<AuditLog[]>;
  async findByEntity(entity: string, entityId: string): Promise<AuditLog[]>;
}

interface AuditLogEvent {
  userId: string;          // admin who performed action
  action: string;          // e.g. 'UPDATE_ORDER_STATUS', 'DELETE_PRODUCT'
  entity: string;          // 'Order' | 'Product' | 'User' | ...
  entityId: string;
  before?: Record<string, unknown>;  // snapshot before change
  after?: Record<string, unknown>;   // snapshot after change
  ip?: string;
  userAgent?: string;
}
```

### Prisma Model

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String
  before    Json?
  after     Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

### Integration Points

Gọi `auditLogService.log()` trong:
- Order status change
- Product create/update/delete
- User role change
- Admin settings change
- Coupon create/update/delete
- Refund issued

### Admin UI

Audit log viewer: `apps/admin/src/app/(admin)/settings/audit-log/page.tsx`
- Filterable by: admin user, entity type, date range
- Before/after diff view

---

## 10. Translation & AutoTranslate (FEAT-04)

### Prisma Model

```prisma
model ProductTranslation {
  id          String   @id @default(cuid())
  productId   String
  locale      String   // "vi" | "fr" | "de" | ...
  name        String?
  description String?
  shortDescription String?
  autoTranslated Boolean @default(false)
  approvedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([productId, locale])
}
```

### AutoTranslate Service

File: `apps/api/src/modules/products/auto-translate.service.ts`

Providers (priority order):
1. Google Cloud Translation API (`GOOGLE_TRANSLATE_API_KEY`)
2. DeepL API (`DEEPL_API_KEY`)
3. LibreTranslate (self-hosted, `LIBRETRANSLATE_URL`)

```typescript
@Injectable()
export class AutoTranslateService {
  async translate(text: string, targetLocale: string): Promise<string>;
  async translateProduct(productId: string, locale: string): Promise<void>;
}
```

### Admin UI

In `ProductEditShell` — "Translations" tab (8th tab):
- Language selector
- Auto-translate button (triggers API)
- Manual edit fields: name, description, shortDescription
- Approve translation toggle

### Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/products/{id}/translations` | ADMIN |
| PUT | `/api/v1/admin/products/{id}/translations/{locale}` | ADMIN |
| POST | `/api/v1/admin/products/{id}/translations/{locale}/auto` | ADMIN — trigger auto-translate |

---

## 11. Admin Pages Reference (Complete List)

```
apps/admin/src/app/(admin)/
  dashboard/              # Main dashboard with KPI row
  products/               # Product list + import
    new/
    [id]/edit/
    copy/[id]/
    seo/
    import/               # CSV bulk import
  orders/                 # Order list
    [id]/                 # Order detail
  customers/              # Customer list
    [id]/                 # Customer detail
  messages/               # Message inbox
  payments/
  reviews/
  promotions/
  shipping/
  affiliates/             # Affiliate management
  creators/               # Creator management
  referrals/              # Referral network
  loyalty/                # Loyalty program stats
  nft/                    # NFT drops & memberships
    drops/
    memberships/
  catalog/
    categories/
    collections/
  settings/
    index/                # General settings
    team/                 # Team management
    email-templates/      # Email template editor
    audit-log/            # Audit log viewer
  ai-features/            # AI Features section
    index/                # Dashboard + KPI row
    pricing/
    trends/
    dna/
    moderation/
```
