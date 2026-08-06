# Module 29 — Admin Extended Features

Tập hợp các tính năng admin được implement trong các phase sau ban đầu: CSV import, Q&A, Bulk Actions, Hotjar Analytics, Admin Settings, Team Management, Email Template Management, CSV Export, AuditLog, AI Features dashboard, và Permission System.

---

## 1. CSV Bulk Product Import (P2-03)

### Endpoints

> **Lưu ý:** Path segment thực tế là `products/import/*`, KHÔNG phải `products/csv/*`.

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/admin/products/import/validate` | Validate CSV (dry run, trả về errors) | ADMIN |
| POST | `/api/v1/admin/products/import/execute` | Execute import sau khi validate | ADMIN |
| GET | `/api/v1/admin/products/import/template` | Download CSV template | ADMIN |

### CSV Format (17 cột — `CSV_COLUMNS` trong `csv-import.service.ts`)

> **Bộ cột đã thay đổi hoàn toàn so với bản spec trước** — không còn `sku`/`primaryColors`/`materials`/`occasions`/`imageUrls`/`quantity`; thay bằng `collectionSlugs`/`isFeatured`/`variationGroupName`/`variationGroupType`/`variationOptions`/`images`.

| Column | Required | Notes |
|---|---|---|
| name | Yes | Bắt buộc (không phải `slug`) |
| slug | No | Auto-slugify từ `name` nếu để trống; là upsert key sau khi resolve |
| description | No | |
| shortDescription | No | |
| basePrice | Yes | Phải > 0 |
| compareAtPrice | No | Phải > `basePrice` nếu có |
| status | No | DRAFT/ACTIVE/INACTIVE/ARCHIVED (default DRAFT nếu invalid) |
| categorySlug | Yes | Phải match category có sẵn |
| tags | No | Comma-separated (upsert tag theo tên) |
| collectionSlugs | No | **Pipe-separated** (không phải comma) — không có trong bản spec trước |
| isPersonalizable | No | true/false (default true) |
| isFeatured | No | true/false (default false) — không có trong bản spec trước |
| processingDays | No | Int |
| variationGroupName | No | Tên nhóm biến thể — không có trong bản spec trước |
| variationGroupType | No | Loại nhóm biến thể — không có trong bản spec trước |
| variationOptions | No | Format `Name:price\|Name:price` (pipe-separated) — không có trong bản spec trước |
| images | No | Pipe-separated URLs (không phải `imageUrls`, không phải comma) |

> Không có cột `sku` (luôn auto-generate, không nhận input) và không có cột `quantity`/`primaryColors`/`materials`/`occasions` trong CSV import.

### Import Behavior
- Upsert by resolved `slug` (auto từ `name` nếu cột `slug` trống): nếu tồn tại thì UPDATE, nếu không thì INSERT
- `sku` luôn auto-generate theo format `{PREFIX}-{base8}-{rand}` khi CREATE — không nhận từ CSV
- Errors returned per-row: `{ row: number, column: string, message: string }` (field tên là `column`, không phải `field`)
- **Max 1000 rows per import** (không phải 500)
- Validate → Execute flow: validate không lưu, execute mới lưu

### Admin UI
File: `apps/admin/src/app/(admin)/products/import/page.tsx`
- Drag & drop CSV upload zone
- Preview table (**first 20 rows** — `valid.slice(0, 20)`, không phải 10)
- Validation errors panel
- "Execute Import" button (disabled until validate passes)
- Progress indicator during execute

---

## 2. Product Q&A (P2-04)

### Endpoints

> **Lưu ý:** Toàn bộ mục này khác đáng kể so với bản spec trước — không có enum `QuestionStatus`, không có model field `userId`/`guestEmail`/`isPublic`. Admin endpoints nằm dưới `/admin/products/:id/questions/...` (scoped theo product), không phải `/admin/questions/{id}` (flat).

#### Public (`QaController`, không yêu cầu auth kể cả khi ask)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/products/{slug}/questions` | No — published Q&A only |
| POST | `/api/v1/products/{slug}/questions` | **No** (Public, không phải Bearer) — body: `{ name, email?, question }` |
| POST | `/api/v1/questions/{id}/upvote` | No — đánh dấu câu trả lời hữu ích (không có trong bản spec trước) |

#### Admin (`AdminQaController`, path scoped theo product, không phải flat `/admin/questions/{id}`)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/questions/unanswered-count` | ADMIN — đếm câu hỏi chưa trả lời (badge) |
| GET | `/api/v1/admin/products/{id}/questions?filter=all\|unanswered` | ADMIN — list Q&A của 1 product |
| POST | `/api/v1/admin/products/{id}/questions/{qId}/answer` | ADMIN — trả lời (body: `{ answer, publish? }`) |
| PATCH | `/api/v1/admin/products/{id}/questions/{qId}` | ADMIN — sửa answer/`isPublished` (không phải endpoint "/status" riêng) |
| DELETE | `/api/v1/admin/products/{id}/questions/{qId}` | ADMIN |
| POST | `/api/v1/admin/products/{id}/questions/{qId}/spam` | ADMIN — đánh dấu spam (không có trong bản spec trước) |

### Prisma Model

```prisma
// KHÔNG có enum QuestionStatus — dùng booleans isPublished/isSpam thay vì status enum
model ProductQuestion {
  id           String    @id @default(cuid())
  productId    String
  product      Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  question     String    @db.VarChar(500)
  askedByName  String    @db.VarChar(100)   // KHÔNG có userId — luôn lưu tên người hỏi
  askedByEmail String?
  isGuest      Boolean   @default(true)
  answer       String?   @db.Text
  answeredAt   DateTime?
  isPublished  Boolean   @default(false)    // thay cho "status"/"isPublic"
  isSpam       Boolean   @default(false)
  upvotes      Int       @default(0)        // không có trong bản spec trước
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

> Mỗi câu hỏi mới được đưa qua `ModerationService.queueQAModeration()` (fire-and-forget, optional dependency) — giống pattern của module Messages.

### Frontend Q&A Section

File: `apps/client/src/components/product/QaSection.tsx`
- Displayed in `ProductTabs` (new "Q&A" tab)
- Published Q&A rendered as accordion (điều kiện `isPublished === true`, không phải "approved")
- "Ask a question" form — **mở cho cả guest lẫn user đã đăng nhập**, không yêu cầu Bearer token
- FAQ Structured Data (`@type: FAQPage`) for answered questions

### Admin Q&A Tab

File: `apps/admin/src/components/products/edit/tabs/QaTab.tsx`
- List of pending + answered questions (scoped theo 1 product đang edit)
- Answer input form
- Publish/spam/delete controls (không phải "approve/reject" — dùng `isPublished`/`isSpam`)

### Business Rules
- Questions visible publicly khi `isPublished === true` (không có khái niệm `isPublic` riêng biệt với status)
- Admin có thể publish ngay khi trả lời (`publish: true` trong body answer) hoặc để pending
- Guest can ask (tên bắt buộc, email optional) — hoàn toàn không cần authentication, kể cả user đã đăng nhập cũng gọi endpoint public này
- Đánh dấu spam (`isSpam: true`) thay cho "reject"

---

## 3. Bulk Product Actions (P2-05)

### Endpoint

> **Lưu ý:** Method thực tế là `PATCH`, không phải `POST`. Export KHÔNG phải một bulk action — nó là endpoint CSV export riêng (xem mục 8).

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| PATCH | `/api/v1/admin/products/bulk` | Execute bulk action (max 200 ids) | ADMIN |

### BulkActionDto

```typescript
interface BulkActionDto {
  ids: string[];  // product IDs, max 200 (@ArrayMaxSize(200))
  action: 'publish' | 'unpublish' | 'archive' | 'set-sale';  // lowercase-hyphen, KHÔNG phải UPPER_SNAKE; không có 'export'
  payload?: {
    discountPercent?: number;  // for set-sale action — KHÔNG phải "salePercentage"
  };
}
```

### Actions

| Action | Effect |
|---|---|
| publish | `status → ACTIVE, isActive → true` |
| unpublish | `status → INACTIVE, isActive → false` |
| archive | `status → ARCHIVED, isActive → false` — **KHÔNG set `deletedAt`** (khác với claim ở bản spec trước) |
| set-sale | `discountPercent` phải 1–99; `compareAtPrice = basePrice cũ`, `basePrice = basePrice × (1 - discountPercent/100)` (round 2 chữ số thập phân) |

- Ghi `AuditLog` với `action: 'BULK_UPDATE'` sau mỗi lần chạy

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

File: `apps/client/src/lib/analytics/hotjar.ts` (KHÔNG phải `apps/client/src/lib/hotjar.ts` — nằm trong subfolder `analytics/`)

```typescript
export function initHotjar(siteId: number): void { ... }               // chỉ 1 tham số, không có hjsv
export function identifyHotjarUser(userId: string, attrs: ...): void   // tên là identifyHotjarUser
export function hotjarEvent(eventName: string): void { ... }           // tên là hotjarEvent, không phải trackHotjarEvent
export function triggerFeedback(feedbackId: string): void { ... }      // thêm — không có trong bản spec trước
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

> **Thiết kế thực tế khác hẳn spec cũ:** không có generic key-value `AdminSetting` model hay endpoint `/admin/settings/{key}`. Settings được chia theo **5 category cố định** (`store`, `email`, `notifications`, `seo`, `theme`), mỗi category là 1 route GET/PATCH riêng, lưu trong model `AppSettings` (key/value Json), cache Redis 5 phút (`settings:{key}`). Các con số như referral/affiliate rate **không nằm trong hệ thống settings này** — chúng có bảng singleton riêng (`ReferralSettings`, `AffiliateSettings` — xem spec 22).

### Endpoints (`AdminSettingsController`, prefix `/api/v1/admin/settings`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET/PATCH | `/admin/settings/store` | Store info (name, contact, address, currency, taxRate...) | ADMIN |
| GET/PATCH | `/admin/settings/email` | SMTP config (host/port/user/password/fromName/fromEmail) | ADMIN |
| POST | `/admin/settings/email/test` | Gửi test email (template `welcome`) | ADMIN |
| GET/PATCH | `/admin/settings/notifications` | Toggle newOrder/orderNeedsAction/newReview/dailySummary + Slack webhook | ADMIN |
| GET/PATCH | `/admin/settings/seo` | gaId, googleVerification, metaPixelId | ADMIN |
| GET/PATCH | `/admin/settings/theme` | primaryRgb, primaryDark, primaryLight | ADMIN |
| POST | `/api/v1/admin/cache/flush` | Flush settings cache (Redis `settings:*`) — route riêng, không nằm trong spec cũ | ADMIN |

### Model thực tế

```prisma
// Dùng chung AppSettings — KHÔNG có model "AdminSetting" với type/label/group/updatedBy
model AppSettings {
  id        String   @id @default(cuid())
  key       String   @unique   // "store" | "email" | "notifications" | "seo" | "theme"
  value     Json
  updatedAt DateTime @updatedAt
}
```

Mỗi category có `DEFAULTS` hardcode trong `settings.service.ts` (ví dụ `store.name = 'EziHubb'`, `store.currency = 'USD'`, `store.taxRate = 0`) — response luôn là `{ ...DEFAULTS[key], ...savedOverrides }`.

### Admin Settings Page

File: `apps/admin/src/app/(admin)/settings/page.tsx` (route trực tiếp, không có subfolder)
- Tab-grouped settings form theo 5 category trên
- "Save" button per group
- Không có "audit trail hiển thị ngay trên trang settings" — audit log là trang riêng (mục 9)

---

## 6. Team Management (GAP-P2-02)

### Endpoints (`AdminTeamController`, prefix `/api/v1/admin/team`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/admin/team` | List admin/super-admin users | ADMIN |
| POST | `/admin/team/invite` | Tạo tài khoản admin ngay với **temp password ngẫu nhiên** + gửi email `team-invite` chứa password đó — KHÔNG phải link mời qua email | ADMIN |
| PATCH | `/admin/team/{id}` | Đổi role (body: `{ role }`) — path KHÔNG có suffix `/role` | ADMIN |
| DELETE | `/admin/team/{id}` | Hạ role xuống `CUSTOMER` (không xoá user) | ADMIN |

- Chỉ 2 role: `ADMIN` / `SUPER_ADMIN`
- Không cho phép tự đổi role hoặc tự revoke chính mình (`ForbiddenException` nếu `id === caller.sub`)
- `AdminController` guard áp dụng chung (không thấy phân biệt riêng SUPER_ADMIN-only cho route này trong controller)

### Admin UI

File: `apps/admin/src/app/(admin)/settings/team/page.tsx` (phần của settings)
- Team member table (name, email, role, last active)
- "Invite Admin" modal — tạo tài khoản ngay, không phải gửi lời mời chờ chấp nhận
- Role picker: ADMIN / SUPER_ADMIN
- Remove access button with confirm

---

## 7. Email Template Management (GAP-P2-03)

> **Không có endpoint preview hay reset** — cả hai đều không tồn tại trong `AdminEmailTemplatesController`. Template chỉ lưu `body` (Handlebars string), không có field `subject` riêng.

### Endpoints (`AdminEmailTemplatesController`, prefix `/api/v1/admin/email-templates`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/admin/email-templates` | List templates (từ file `.hbs` trong `assets/email-templates/` + override list) | ADMIN |
| GET | `/admin/email-templates/{slug}` | Lấy nội dung (`EmailTemplateOverride` trong DB nếu có, fallback đọc file `.hbs`) | ADMIN |
| PATCH | `/admin/email-templates/{slug}` | Lưu override — body: `{ body: string }` **(chỉ có `body`, không có `subject`)** | ADMIN |

- Không có `POST .../preview` (gửi test email chung là `/admin/settings/email/test`, không scope theo từng template)
- Không có `POST .../reset` — muốn revert phải xoá thẳng row `EmailTemplateOverride` (không có API cho việc này)

### Prisma Model

```prisma
model EmailTemplateOverride {
  id        String   @id @default(cuid())
  slug      String   @unique
  body      String   @db.Text   // KHÔNG có field subject
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Admin UI

File: `apps/admin/src/app/(admin)/settings/email-templates/page.tsx`
- Template list (welcome, order-confirmation, v.v. — tên hiển thị từ map cứng `TEMPLATE_NAMES` trong `settings.service.ts`)
- Editor cho HTML/Handlebars body
- Không xác nhận được việc có "variable reference panel" hay "send preview button" trong UI hiện tại vì backend không có endpoint hỗ trợ preview theo template

---

## 8. CSV Export (GAP-P2-04)

> **Cấu trúc hoàn toàn khác bản spec trước** — không có 3 endpoint export riêng theo `/admin/{orders,customers,products}/export` với query filter ngày/status. Thực tế có 2 endpoint export độc lập, không filter theo ngày/status:

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/export/data` | Export **gộp cả Orders và Customers** trong 1 file CSV (2 section `=== ORDERS ===` / `=== CUSTOMERS ===`), toàn bộ record, không filter | ADMIN |
| POST | `/api/v1/admin/products/export` | Export products (body optional: `{ ids?: string[] }`, tối đa 2000 ids; không truyền `ids` = export tất cả) | ADMIN |

- Không có query param `startDate`/`endDate`/`status`/`format` ở bất kỳ export endpoint nào
- Response: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="ezihubb-export-{date}.csv"` (orders+customers) hoặc `"products-export-{timestamp}.csv"` (products)

---

## 9. AuditLog Service (Phase 5)

> File thực tế và tên field khác spec cũ.

### Service

File: `apps/api/src/common/services/audit-log.service.ts` (KHÔNG phải `apps/api/src/modules/admin/audit-log.service.ts`)

```typescript
@Injectable()
export class AuditLogService {
  // Fire-and-forget — KHÔNG async/Promise<void>, không throw, không block request
  log(entry: AuditLogEntry): void;
  // Không có findByUser()/findByEntity() — query trực tiếp qua Prisma trong AdminAuditLogController
}

interface AuditLogEntry {   // tên là AuditLogEntry, không phải AuditLogEvent
  userId:     string;
  action:     string;
  entityType: string;   // KHÔNG phải "entity"
  entityId:   string;
  before?:    Record<string, unknown> | null;
  after?:     Record<string, unknown> | null;
  ip?:        string;
  userAgent?: string;
}
```

### Prisma Model

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  entityType String   // KHÔNG phải "entity"
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### Query Endpoints (`AdminAuditLogController`, prefix `/api/v1/admin/audit-logs` — số nhiều "logs")
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/audit-logs?page=&limit=&userId=&entityType=&action=` | Paginated list, filter theo userId/entityType/action |
| GET | `/admin/audit-logs/entity-types` | Danh sách distinct `entityType` cho filter dropdown |

### Integration Points

Gọi `auditLogService.log()` trong: Order create/status change, Product create/update, bulk actions (`BULK_UPDATE`), v.v. (fire-and-forget, không chờ kết quả)

### Admin UI

Audit log viewer: `apps/admin/src/app/(admin)/settings/audit-log/page.tsx`
- Filterable by: userId, entityType, action
- Không xác nhận được "before/after diff view" cụ thể ở tầng API (API chỉ trả `ip`/`createdAt`/`action`/`entityType`/`entityId` trong list — không select `before`/`after` trong response phân trang, dù model có lưu 2 field này)

---

## 10. Translation & AutoTranslate (FEAT-04)

> **Thiết kế thực tế: bảng polymorphic dùng chung cho nhiều entity type, không phải bảng riêng cho Product.** Model là `Translation` (đã có trong Prisma schema tổng, dùng cho cả Product/Category/Collection/Tag/ShopSection), không phải `ProductTranslation`. Không có field `approvedAt` (không có khái niệm "approve" bản dịch).

### Prisma Model

```prisma
model Translation {
  id               String   @id @default(cuid())
  entityType       String   // "Product" | "Category" | "Collection" | "Tag" | "ShopSection"
  entityId         String
  locale           String   // "vi" | "fr" | "zh" ... — never "en" (English là source, lưu trực tiếp trên entity)
  field            String   // "name" | "description" | "seoTitle" | "seoDescription" | ...
  value            String   @db.Text
  isAutoTranslated Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@unique([entityType, entityId, locale, field])
}
```

Mỗi (entityType, entityId, locale, field) là 1 row riêng — khác hẳn thiết kế "1 row = 1 locale với các cột name/description" của bản spec trước.

### AutoTranslate Service

File: `apps/api/src/modules/translations/auto-translate.service.ts` (module `translations`, KHÔNG phải nằm trong `products` module)

Provider chọn qua env `TRANSLATE_PROVIDER` (`google` | `deepl` | `libre`) — **không phải chuỗi fallback ưu tiên tự động**, chỉ dùng đúng 1 provider được cấu hình:
1. `google` → Google Cloud Translation API (`GOOGLE_TRANSLATE_API_KEY`)
2. `deepl` → DeepL API (`DEEPL_API_KEY`)
3. `libre` → LibreTranslate (self-hosted)

### Endpoints (`AdminTranslationsController`, prefix `/api/v1/admin/translations`)

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/translations/{entityType}/{entityId}` | ADMIN — lấy tất cả bản dịch (mọi locale) của 1 entity |
| PATCH | `/admin/translations/{entityType}/{entityId}` | ADMIN — lưu bản dịch (body: `{ locale, translations: Record<string,string> }`), đánh dấu `isAutoTranslated: false` |
| POST | `/admin/translations/{entityType}/{entityId}/retranslate` | ADMIN — queue lại auto-translate cho entity này |

> Path KHÔNG scope theo `products/{id}/translations` và KHÔNG có locale trong URL path (locale nằm trong body của PATCH).

---

## 11. Permission System (PERMISSION-00→04)

### Architecture: Hybrid RBAC + ABAC

Each ADMIN user (shop owner) has a `permissions` JSON field on their `User` record:

```json
{
  "roles": ["editor"],
  "overrides": {
    "allow": ["orders:refund"],
    "deny":  ["products:delete"]
  },
  "conditions": {
    "orders:view": { "owner_only": true },
    "reports:export": { "max_rows": 1000 }
  }
}
```

**Evaluation order (deny wins):**
1. `overrides.deny` → explicit deny → return `false` immediately
2. `overrides.allow` → explicit allow → return `true` immediately
3. `roles` → role-based grant check (union of all assigned roles)
4. default → `false`

SUPER_ADMIN always passes every check — no document needed.

### Resources & Actions

File: `libs/shared/constants/src/lib/permissions.ts`

```typescript
export const PERMISSION_RESOURCES = [
  'dashboard', 'products', 'orders', 'reviews',
  'payouts', 'analytics', 'settings', 'shipping',
  'coupons', 'messages',
] as const;

export const PERMISSION_ACTIONS = ['view', 'edit', 'add', 'delete'] as const;

export const RESOURCE_ACTIONS: Record<PermissionResource, PermissionAction[]> = {
  dashboard: ['view'],
  products:  ['view', 'edit', 'add', 'delete'],
  orders:    ['view', 'edit'],
  reviews:   ['view', 'edit', 'delete'],
  payouts:   ['view', 'edit'],
  analytics: ['view'],
  settings:  ['view', 'edit'],
  shipping:  ['view', 'edit', 'add', 'delete'],
  coupons:   ['view', 'edit', 'add', 'delete'],
  messages:  ['view', 'edit'],
};
```

### Built-in Roles (3 roles)

```typescript
export const BUILTIN_ROLES = {
  /** Full shop management — granted on store approval. */
  shop_owner: [
    'dashboard:view',
    'products:view', 'products:edit', 'products:add', 'products:delete',
    'orders:view', 'orders:edit',
    'reviews:view', 'reviews:edit', 'reviews:delete',
    'payouts:view', 'payouts:edit',
    'analytics:view',
    'settings:view', 'settings:edit',
    'shipping:view', 'shipping:edit', 'shipping:add', 'shipping:delete',
    'coupons:view', 'coupons:edit', 'coupons:add', 'coupons:delete',
    'messages:view', 'messages:edit',
  ],
  /** Can manage content but not financial or destructive actions. */
  editor: [
    'dashboard:view',
    'products:view', 'products:edit', 'products:add',
    'orders:view', 'orders:edit',
    'reviews:view',
    'analytics:view',
    'settings:view',
    'messages:view', 'messages:edit',
  ],
  /** Read-only access. */
  viewer: [
    'dashboard:view',
    'products:view',
    'orders:view',
    'analytics:view',
    'messages:view',
  ],
};
```

### Default Document

```typescript
export const DEFAULT_PERMISSION_DOCUMENT: PermissionDocument = {
  roles: ['shop_owner'],
};
```

Applied when a store is approved — shop owner gets full `shop_owner` role.

### Core Runtime Functions

```typescript
// Check single permission
can(systemRole: string, permDoc: PermissionDocument | null, permission: string): boolean

// Check with resource + action pair
canDo(systemRole, permDoc, resource: PermissionResource, action: PermissionAction): boolean

// Get ABAC conditions for a permission
getConditions(permDoc, permission: string): Record<string, unknown> | null

// Returns flat map { "products:delete": true, ... } for all known perms
resolveEffectivePermissions(systemRole, permDoc): Record<string, boolean>
```

### API Endpoints (AdminUsersController)

File: `apps/api/src/modules/admin-users/admin-users.controller.ts`

Controller: `@Controller('admin/users')` — requires SUPER_ADMIN role

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/users` | List all shop-owner admin accounts (with effectivePermissions) |
| GET | `/api/v1/admin/users/:id/permissions` | Get permission document + effective map |
| PUT | `/api/v1/admin/users/:id/permissions` | Update permissions (body: `{ document: PermissionDocument }`) |
| PUT | `/api/v1/admin/users/:id/permissions/reset` | Reset to `DEFAULT_PERMISSION_DOCUMENT` |

**GET /admin/users/:id/permissions response:**
```typescript
{
  userId: string;
  email: string;
  name: string;
  document: PermissionDocument;
  effectivePermissions: Record<string, boolean>;  // flat map
  availableRoles: BuiltinRole[];  // ['shop_owner', 'editor', 'viewer']
}
```

**PUT /admin/users/:id/permissions** sanitizes input — only allows known role names and `resource:action` strings from PERMISSION_RESOURCES.

### Admin UI: Permission Matrix Page

File: `apps/admin/src/app/(admin)/stores/[id]/permissions/page.tsx`

Route: `/stores/[storeId]/permissions`

Features:
- Header: store name + owner info
- Role pills: toggle built-in roles (multiple allowed, union semantics)
- Permission matrix table (resources × actions: view/edit/add/delete)
- 4 cell states with color coding:
  - 🔵 Indigo: from role grant (`resolveEffectivePermissions` via assigned role)
  - 🟢 Emerald: explicit allow (overrides.allow)
  - 🔴 Red: explicit deny (overrides.deny)
  - ⬜ Gray: not granted
- Toggle cycle on click: none → allow → deny → remove deny
- Save / Cancel / Reset buttons (Reset returns to `DEFAULT_PERMISSION_DOCUMENT`)
- Loads via `GET /admin/users/:ownerId/permissions` (fetches owner ID from store detail first)

**permissionSource() logic:**
```typescript
function permissionSource(doc, perm): 'deny' | 'allow' | 'role' | 'none' {
  if (doc.overrides?.deny?.includes(perm))  return 'deny';
  if (doc.overrides?.allow?.includes(perm)) return 'allow';
  for (const role of doc.roles) {
    if (resolveEffectivePermissions('ADMIN', { roles: [role] })[perm]) return 'role';
  }
  return 'none';
}
```

### Shop Owner Access Model

- Shop owners use the **same admin UI** as SUPER_ADMIN (same Next.js app)
- API scopes data by `storeId` — shop owners only see their own store's data
- Routes marked `SUPER_ADMIN_ONLY` block ADMIN role users
- Default on store approval: `permissions = { roles: ['shop_owner'] }`

---

## 12. Admin Pages Reference (Complete List)

```
apps/admin/src/app/(admin)/
  dashboard/
  products/
    new/
    [id]/edit/
    copy/[id]/
    seo/
    import/               # CSV bulk import
  orders/
    [id]/                 # Order detail
  customers/
    [id]/
  messages/
  payments/
  reviews/
  promotions/
  shipping/
  affiliates/
    [id]/
    payouts/
  creators/               # Creator Network management
    members/
    payouts/
    settings/
  referrals/
    users/
    payouts/
    settings/
  stores/
    [id]/
      permissions/        # Permission matrix editor
    settings/             # Platform-wide seller fees, payouts, registration, maintenance
  catalog/
    categories/
    collections/
    tags/
    shop-sections/
    production-partners/
  campaigns/
  moderation/
    queue/
    rules/
    history/
    ip-scan/
    settings/
  finance/
  payouts/
  stats/
    listings/
      [id]/
  settings/
    page.tsx              # General settings — route trực tiếp tại /settings, KHÔNG có subfolder /settings/index
    affiliates/
    audit-log/            # Audit log viewer
    fulfillment/          # POD provider connections (Printify/Merchize)
    api-keys/             # Partner API key management
```

## 13. Marketplace Seller Fees (Etsy-style)

Sellers cannot negotiate or choose their fee rate — one platform-wide fee schedule applies to everyone (Etsy doesn't offer this either; there is no "Seller Plans" tier system, which was fully removed — `SellerPlan`/`SubscriptionBilling` models and their admin/UI no longer exist).

### Fee types (`PlatformSettings`, admin-editable at `/admin/platform-settings`)
| Field | Default | Applies to |
|---|---|---|
| `transactionFeeRate` | 6.5% | `subtotal + shippingCost` per `StoreOrder`, every sale |
| `paymentProcessingFeeRate` + `paymentProcessingFixedFee` | 5% + $0.25 | same base, every sale |
| `listingFee` | $0.20 | charged once per product created (no 4-month renewal cycle, unlike real Etsy) |
| `regulatoryFeeRate` + `regulatoryFeeCountries` | 1.24%, `[]` | only if the seller's `Store.country` is in the configured list |

Calculation: `apps/api/src/modules/stores/fees.util.ts` (`calculateOrderFees`) — pure function, called from `orders.service.ts` at checkout. Per-store tax isn't tracked (`Order.taxAmount` is order-level only), so fees apply to `subtotal + shippingCost`, not tax.

### `SellerLedgerEntry` — itemized statement (source of truth for payouts)
```prisma
enum SellerLedgerEntryType { SALE TRANSACTION_FEE PAYMENT_PROCESSING_FEE REGULATORY_FEE LISTING_FEE ADJUSTMENT }

model SellerLedgerEntry {
  storeId, storeOrderId?, type, amount (signed — positive for SALE, negative for fees), description, payoutId?, createdAt
}
```
- One row per fee type per order (mirrors Etsy's real itemized "Payment account" statement) — created inside the same transaction as the `StoreOrder` in `orders.service.ts`
- One `LISTING_FEE` row per product creation — `ProductsService.chargeListingFee()`, called from both `create()` (when `storeId` is set) and `createDraftForStore()`
- `StoreOrder.platformFee`/`.sellerEarnings` are kept as denormalized per-order display totals only — `SellerLedgerEntry` is authoritative for **payouts**, since listing fees aren't tied to any order

### Payouts
`StoreOrdersService.requestPayout()` (`/seller/payouts/request`) sums every unpaid (`payoutId: null`) `SellerLedgerEntry` for the store — not `StoreOrder.sellerEarnings` — so listing fees are correctly netted out. Creates one `SellerPayout`, stamps `payoutId` onto every included ledger entry and `StoreOrder`.

> **Đã xoá khỏi list:** `flash-deals/`, `gift-chains/`, `gift-pools/`, `blind-match/`, `ai/` (creator-dna/pricing/trends/usage/settings) — toàn bộ các tính năng này đã bị xoá khỏi codebase để đưa site về đúng nghĩa bán hàng thuần tuý (cùng đợt với loyalty/coins/vip/store-credits/flash-deals ở batch 1, và bounties/design-licensing/canva/memberships/creator-dna/trends/pricing/drops/bundles ở batch 2-3).
