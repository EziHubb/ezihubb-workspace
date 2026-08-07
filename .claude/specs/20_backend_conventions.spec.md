# Module 20 — Backend Conventions

## 1. NestJS Module Structure

Every feature module follows:
```
apps/api/src/modules/<module>/
  <module>.module.ts
  <module>.controller.ts          # public endpoints
  admin-<module>.controller.ts    # admin endpoints (optional)
  <module>.service.ts
  dto/
    create-<module>.dto.ts
    update-<module>.dto.ts
    <module>-query.dto.ts
  schemas/                        # Mongoose schemas (if module has MongoDB)
    <entity>.schema.ts
```

### Modules present in `apps/api/src/modules/` (33 modules)
`admin`, `admin-users`, `affiliates`, `analytics`, `assets`, `auth`, `campaigns`, `cart`, `catalog`, `currency`, `customization`, `database` (mongodb), `fulfillment` (provider-agnostic POD integration — `PrintifyProvider` + `MerchizeProvider`; see §18), `messages`, `moderation`, `notifications` (includes FcmService + PushService), `order-tracking`, `orders`, `partner-api` (API-key-authenticated public API for 3rd-party tools; see §19), `payments`, `pdf`, `products` (includes LowStockService), `promotions`, `referrals`, `reviews`, `search`, `shipping`, `shop-stats`, `stores`, `tax`, `translations`, `unsubscribe`, `users`

## 2. Controller Conventions

```typescript
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products' })
  @ApiResponse({ status: 200, type: PaginatedProductDto })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }
}
```

- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse` for Swagger
- `@Controller('products')` (plural, lowercase, kebab-case)
- Admin controllers: use `@AdminController('products')` shorthand decorator
  - Prefixes route with `/admin/{path}`
  - Applies `UseGuards(JwtAuthGuard, RolesGuard)`, `Roles(ADMIN, SUPER_ADMIN)`
  - Adds `@ApiBearerAuth()` and `@ApiTags('Admin — Products')`
- Methods return plain objects/arrays — `TransformInterceptor` wraps them

## 3. Service Conventions

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel('ProductDetail') private readonly productDetailModel: Model<ProductDetail>,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}
}
```

- `PrismaService` for PostgreSQL queries
- `@InjectModel()` for Mongoose models (MongoDB)
- `RedisService`: check `redis.available` before using cache
- Services injected cross-module via module exports
- Optional services injected with `@Optional()` to avoid circular dependency crashes

## 4. DTO Validation

```typescript
import { IsString, IsEmail, IsOptional, MinLength, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;
}
```

- Use `class-validator` decorators (NOT Zod for NestJS DTOs)
- Global pipe: `whitelist: true, forbidNonWhitelisted: true` — extra props REJECTED (400), not stripped
- `transformOptions: { enableImplicitConversion: true }` — handles string→number in query params
- `@Type(() => Number)` required for nested number coercion in query DTOs
- `@ValidateNested() @Type(() => SubDto)` for nested object validation
- `@Transform` for normalizing input (e.g. `toUpperCase().trim()` for country codes)

## 5. Prisma Usage

```typescript
// prisma.config.ts — driver adapter pattern (Prisma 7)
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

**Critical:** No `url` in datasource block of schema.prisma (Prisma 7 driver adapter pattern).

```typescript
// Service usage
async findOne(id: string) {
  return this.prisma.product.findUniqueOrThrow({
    where: { id },
    include: { images: true, productCategories: { include: { category: true } } }
  });
}
```

- `findUniqueOrThrow` preferred over `findUnique` when absence is an error
- No raw SQL — use Prisma query builder throughout
- Transactions: `this.prisma.$transaction(async (tx) => { ... })` for atomicity

## 6. MongoDB / Mongoose Usage

```typescript
// Schema
@Schema({ timestamps: true, collection: 'product_details' })
export class ProductDetail extends Document {
  @Prop({ required: true, unique: true, index: true })
  productId: string;

  @Prop({ type: Object })
  customization?: object;
}

export const ProductDetailSchema = SchemaFactory.createForClass(ProductDetail);
```

```typescript
// Service usage
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel('ProductDetail') private model: Model<ProductDetail>
  ) {}

  async upsertDetail(productId: string, dto: CreateProductDetailDto) {
    return this.model.findOneAndUpdate(
      { productId },
      {
        $set: { ...fields },
        $setOnInsert: { productId },
      },
      { upsert: true, returnDocument: 'after' },  // use returnDocument: 'after' (not new: true)
    );
  }
}
```

**Note:** Use `returnDocument: 'after'` (not deprecated `new: true`) for `findOneAndUpdate`.

## 7. Error Handling

```typescript
// Use NestJS built-ins
throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
throw new ConflictException({ code: 'ERR_EMAIL_ALREADY_EXISTS', message: 'Email in use' });
throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Invalid credentials' });
throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'Validation failed' });
throw new ForbiddenException({ code: 'ERR_FORBIDDEN', message: 'Insufficient permissions' });
throw new ForbiddenException({ code: 'ERR_PERMISSION_DENIED', message: 'Permission denied: products:delete' });

// HttpExceptionFilter formats as ApiError:
// { success: false, error: { code, message, details[] }, meta: { ... } }
```

Pass structured object `{ code, message }` to exception constructors so `HttpExceptionFilter` can extract the code.

## 8. Guards & Decorators

```typescript
// Protect routes
@UseGuards(JwtAuthGuard)              // require auth
@UseGuards(OptionalAuthGuard)         // auth if present (guest-friendly)
@UseGuards(JwtAuthGuard, RolesGuard)  // require specific role
@Roles('ADMIN', 'SUPER_ADMIN')

// Permission-gated (RBAC+ABAC)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('orders:edit')     // "resource:action" format

// Custom decorators
@CurrentUser()    // extracts user from request (set by JwtAuthGuard)
@Public()         // skip JwtAuthGuard (used with global guard setup)
```

### Guards available
| Guard | File | Purpose |
|---|---|---|
| `JwtAuthGuard` | `common/guards/jwt-auth.guard.ts` | Validates Bearer JWT, sets `req.user` |
| `OptionalAuthGuard` | `common/guards/optional-auth.guard.ts` | Auth if present, passes through if absent |
| `RolesGuard` | `common/guards/roles.guard.ts` | Checks `@Roles()` against `req.user.role` |
| `PermissionsGuard` | `common/guards/permissions.guard.ts` | Hybrid RBAC+ABAC via `PermissionDocument` |
| `StripeWebhookGuard` | `common/guards/stripe-webhook.guard.ts` | Verifies Stripe-Signature header |
| `JwtRefreshGuard` | `common/guards/jwt-refresh.guard.ts` | Validates refresh token |
| `ThrottlerGuard` | `common/guards/throttler.guard.ts` | Rate limiting |

### Custom Decorators
| Decorator | File | Usage |
|---|---|---|
| `@CurrentUser()` | `common/decorators/current-user.decorator.ts` | Extract `JwtPayload` from request |
| `@Roles(...)` | `common/decorators/roles.decorator.ts` | Set required roles for `RolesGuard` |
| `@Public()` | `common/decorators/public.decorator.ts` | Skip global `JwtAuthGuard` |
| `@RequirePermission(p)` | `common/decorators/require-permission.decorator.ts` | Gate on `resource:action` |
| `@AdminController(path)` | `common/decorators/admin-controller.decorator.ts` | Composite admin controller |
| `@ApiPaginated(Dto)` | `common/decorators/api-paginated.decorator.ts` | Swagger paginated response |

## 9. Permission System (Hybrid RBAC+ABAC)

File: `libs/shared/constants/src/lib/permissions.ts`

```typescript
// PermissionDocument stored as JSON on User.permissions field
interface PermissionDocument {
  roles: string[];           // built-in role names: 'shop_owner' | 'editor' | 'viewer'
  overrides?: {
    allow?: string[];        // explicit allow (e.g. 'orders:refund')
    deny?:  string[];        // explicit deny — wins over roles
  };
  conditions?: Record<string, Record<string, unknown>>;  // attribute conditions
}
```

### Built-in Roles
| Role | Permissions |
|---|---|
| `shop_owner` | Full shop management (all resources: view/edit/add/delete) |
| `editor` | Content management (no financial, no delete) |
| `viewer` | Read-only (dashboard, products, orders, analytics, messages) |

### Resources & Actions
```
dashboard:  view
products:   view, edit, add, delete
orders:     view, edit
reviews:    view, edit, delete
payouts:    view, edit
analytics:  view
settings:   view, edit
shipping:   view, edit, add, delete
coupons:    view, edit, add, delete
messages:   view, edit
```

### Evaluation Order (deny wins)
1. `overrides.deny` → explicit deny → return `false`
2. `overrides.allow` → explicit allow → return `true`
3. `roles` → role-based grant check (union of all roles)
4. default → `false`

### Key Functions
```typescript
can(systemRole, permDoc, 'products:delete')  // → boolean
canDo(systemRole, permDoc, 'products', 'delete')  // convenience overload
getConditions(permDoc, 'orders:view')  // → { owner_only: true } | null
resolveEffectivePermissions(systemRole, permDoc)  // → flat map for frontend
```

### Default Document
```typescript
const DEFAULT_PERMISSION_DOCUMENT: PermissionDocument = { roles: ['shop_owner'] };
// Assigned automatically when a store is approved
```

### Guard Behavior
- `SUPER_ADMIN`: bypasses all permission checks
- `ADMIN` without `@RequirePermission`: only `RolesGuard` applies (passes for ADMIN/SUPER_ADMIN)
- `ADMIN` with `@RequirePermission`: `PermissionsGuard` fetches `User.permissions` from DB
- `request.userPermissions` and `request.permissionConditions` set after guard passes (for controller use)

## 10. BullMQ Queues

```typescript
// Queue names (from apps/api/src/queue/queue.constants.ts)
QUEUES.EMAIL                 // 'email'
QUEUES.IMAGE_PROCESSING      // 'image-processing'
QUEUES.ORDER_PROCESSING      // 'order-processing'
QUEUES.SCHEDULED             // 'scheduled'
QUEUES.ABANDONED_CART        // 'abandoned-cart'
QUEUES.AFFILIATE_COMMISSION  // 'affiliate-commission'
QUEUES.LOW_STOCK             // 'low-stock'
QUEUES.TRANSLATIONS          // 'translations'
QUEUES.REFERRAL              // 'referral'
QUEUES.MODERATION            // 'moderation'
QUEUES.ORDER_TRACKING        // 'order-tracking' (constant defined but not registered — dead, pre-existing)
QUEUES.FULFILLMENT           // 'fulfillment' — pushes confirmed StoreOrders to a connected POD provider (Printify or Merchize)

// Dev mode (DISABLE_QUEUE=true)
// DevBullModule provides no-op tokens
// Processors not registered — jobs silently discarded
// All inject points work normally
```

## 11. Redis Usage

```typescript
// RedisService checks this.available before any operation
if (!this.redis.available) return null;  // graceful fallback

// Cache patterns:
await this.redis.set('mega-menu:v1', JSON.stringify(data), { EX: 600 });
const cached = await this.redis.get('mega-menu:v1');

// PayPal token cache:
await client.set('paypal:access_token', token, 'EX', Math.floor(expiresIn * 0.9));

// Trending search (sorted set):
await this.redis.zIncrBy('search:trending', 1, query);
const top10 = await this.redis.zRangeWithScores('search:trending', 0, 9, { REV: true });

// Webhook idempotency (24h TTL):
const key = `webhook:stripe:${intentId}`;
await this.redis.set(key, '1', { EX: WEBHOOK_IDEMPOTENCY_TTL });
```

## 12. Logging

```typescript
// Use NestJS Logger (not console.log)
private readonly logger = new Logger(ProductsService.name);
this.logger.log('Product fetched');
this.logger.error('Failed to fetch', error.stack);
this.logger.warn('Cache miss for key: ' + key);
this.logger.debug('EasyPost webhook: no order found for trackerId=...');
```

## 13. Code Style

- TypeScript strict mode
- No `any` types (use `unknown` + type guards)
- Async/await (no `.then()` chains)
- Named exports (no default exports except Next.js pages/layouts)
- Barrel exports via `index.ts`
- File naming: `kebab-case.service.ts`, `PascalCase` for classes
- No comments unless WHY is non-obvious

## 14. Testing

**Temporarily removed** (all of it — unit, integration, and E2E) — no Jest/Playwright
config, no `*.spec.ts`/`*.test.ts` files, no test-related CI jobs. Do not generate new
test files or reference these commands until testing is reinstated.

## 15. Email Templates (Handlebars)

- Location: `apps/api/src/assets/email-templates/` (32 templates — NOT under `modules/notifications/`)
- Format: `.hbs` Handlebars templates
- Compiled via nodemailer with handlebars
- Templates span far more than transactional order emails — covers auth (`welcome`, `email-verify`, `reset-password`), orders (`order-confirmation`, `order-shipped`, `order-delivered`, `refund-notification`, `abandoned-cart`, `low-stock-alert`), reviews (`review-reminder`), messages (`new-message`, `contact-message`), affiliates (`affiliate-approved`, `affiliate-rejected`, `commission-confirmed`, `payout-processed`), stores/seller onboarding (`application-received`, `new-store-application`, `store-application-received`, `store-approved`, `store-rejected`, `new-store-order`, `team-invite`), moderation (`content-flagged`, `content-warning`, `content-rejected-critical`, `moderation-critical-alert`, `store-strike-warning`, `store-suspended`), and gift cards (`gift-card-delivery`)

## 16. Key Shared Services

### AuditLogService
File: `apps/api/src/common/services/audit-log.service.ts`
```typescript
auditLogService.log({ userId, action, entityType, entityId, before?, after?, ip?, userAgent? })
```
Called in: order status change, order cancel, order ship, product CRUD, user role change, settings update.

### AutoTranslateService
File: `apps/api/src/modules/translations/auto-translate.service.ts` (own `translations` module, not under `products`)
- Provider priority: Google Cloud → DeepL → LibreTranslate
- Called via `translation-queue` job (async)

### FcmService / PushService
File: `apps/api/src/modules/notifications/fcm.service.ts` / `push.service.ts`
- `firebase-admin` SDK
- `pushService.sendToUser(userId, { title, body, data })`

### LabelService
File: `apps/api/src/modules/shipping/label.service.ts`
- axios-based EasyPost integration (no SDK)
- `labelService.getRates(orderId)`, `labelService.purchaseLabel(orderId, rateId)`
- Warehouse address from env vars (`WAREHOUSE_NAME`, `WAREHOUSE_STREET`, `WAREHOUSE_CITY`, `WAREHOUSE_STATE`, `WAREHOUSE_ZIP`, `WAREHOUSE_PHONE`)

### TrackingService
File: `apps/api/src/modules/shipping/tracking.service.ts`
- `detectCarrier(trackingNumber)` → auto-detects USPS/UPS/FedEx/DHL from number pattern
- `buildTrackingUrl(carrier, trackingNumber)` → returns carrier tracking URL
- EasyPost tracker registration via API

### PdfService
File: `apps/api/src/modules/pdf/pdf.service.ts`
- `@react-pdf/renderer` for PDF generation (React-based, no headless browser)
- `pdfService.generateInvoice(orderId, giftReceipt?, userId?)` — auto-detects giftReceipt flag, verifies ownership when userId provided
- `pdfService.generatePackingSlip(orderId)`
- PDFs cached in R2
- Templates: `InvoiceDocument.tsx`, `PackingSlipDocument.tsx` (React components rendered to PDF)

### OrderTrackingService
File: `apps/api/src/modules/order-tracking/order-tracking.service.ts`
- Manages `OrderTracking` + `TrackingEvent` records (Prisma)
- `getTracking(orderId)` — auto-creates record if order exists but no tracking yet
- `updateStage(orderId, stage, title, source, carrierName?, trackingNumber?)` — upserts + creates event
- POD provider webhooks (Printify, Merchize) live in `apps/api/src/modules/fulfillment/` (`FulfillmentWebhookController`/`.Service`), which calls back into `updateStage()` here — not handled directly by `OrderTrackingService` anymore

## 17. Presigned Upload Flow (Assets)

```typescript
// POST /admin/assets/presign
// Returns presigned PUT URLs for direct browser upload to R2
// Browser uploads directly to R2 (avoids streaming through API)
// Then: POST /admin/products/:id/images/from-urls to register URLs
```

Steps:
1. Admin client: `POST /admin/assets/presign` → `{ urls: [{ uploadUrl, publicUrl, key }] }`
2. Browser: `PUT uploadUrl` with file (direct to R2)
3. Admin client: `POST /admin/products/:id/images/from-urls { urls: [publicUrl] }`

## 18. Fulfillment Providers (POD)

Provider-agnostic print-on-demand integration — adding a new provider is: implement `FulfillmentProvider`, add it to the `useFactory` array in `fulfillment.module.ts`, add the enum value. No other code changes needed.

### Architecture
- `interfaces/fulfillment-provider.interface.ts` — the `FulfillmentProvider` contract (`verifyConnection`, `listShopProducts`, `createOrder`, `getOrderStatus`, `cancelOrder`, `getShippingRateCents`, `registerWebhooks`/`unregisterWebhooks`, `parseWebhookPayload`)
- `FulfillmentRegistryService` — resolves a provider impl by `FulfillmentProviderType` (`PRINTIFY` | `MERCHIZE`)
- `FulfillmentConnectionsService` — per-store `StoreFulfillmentConnection` CRUD (encrypted API key via `EncryptionService`, opaque `webhookToken`)
- `printify/printify.provider.ts`, `merchize/merchize.provider.ts` — concrete implementations; `docs/merchize-api.md` at the repo root documents every real Merchize endpoint used (verified against the seller's own dashboard docs, not guessed)
- `ProductFulfillmentMapping` — maps an internal Product/variant → a provider's external product/variant id
- `StoreOrderFulfillment` — one row per (StoreOrder, connection) push attempt; `externalOrderId` is the provider's own order id (Printify) or the caller's own reference id (Merchize — it supports lookup-by-`external_number` everywhere, unlike Printify)

### Webhooks
- Single route for every provider: `POST /webhooks/:provider/:token` — `:provider` is cosmetic only, `FulfillmentWebhookGuard` resolves the connection purely from the opaque `:token`
- Printify has no signing mechanism at all (verified against its OpenAPI spec) — security is the unguessable token alone
- Merchize additionally sends a `merchize-webhook-key` header (shared secret, direct string compare) — configured manually in the seller's Merchize dashboard (no webhook-registration API exists), so `MerchizeProvider.registerWebhooks()` is a no-op and the seller pastes the callback URL themselves (surfaced via `connect()`'s `webhookCallbackUrl` + a "Save secret" endpoint, `PUT /admin/fulfillment/connections/:id/webhook-secret`)
- `FulfillmentWebhookService.handlePrintifyEvent()` / `.handleMerchizeEvent()` — provider-specific payload parsing, both call into `OrderTrackingService.updateStage()`

### Admin UI
`apps/admin/src/app/(admin)/settings/fulfillment/page.tsx` — provider selector (Printify default), connect form, and (for Merchize) a webhook-setup panel. `FulfillmentTab.tsx` in the product editor — per-product/variant mapping picker (`listShopProducts()` backs the picker for both providers — Merchize's is its global blank-product catalog via `GET /product/catalog`, not a per-seller published list like Printify).

## 19. Partner API

API-key-authenticated public REST API so a seller's own 3rd-party tools (listing automation, etc.) can manage their store's catalog directly — analogous to Shopify's Admin API. Distinct from the fulfillment connections above: that's *us* calling a provider; this is a 3rd party calling *us*.

### Key management (seller self-service, JWT-gated)
- `ApiKeysService`/`AdminApiKeysController` (`@AdminController('api-keys')`) — `GET/POST/DELETE /admin/api-keys`
- Hash-and-lookup like `RefreshToken.tokenHash` — SHA-256, not reversible encryption (the raw key is shown once at creation, never again)
- Admin UI: `apps/admin/src/app/(admin)/settings/api-keys/page.tsx`

### Public endpoints (API-key-gated)
- `ApiKeyGuard` (`common/guards/api-key.guard.ts`) — reads `X-Api-Key` header, hashes + looks up `ApiKey`, sets `request.store`/`request.apiKey`; `ApiKeyThrottlerGuard` rate-limits per-key (`req.apiKey.id`) instead of per-IP
- `PartnerProductsController` (`/partner/products`) — full CRUD, always scoped to the key's own store; reuses `ProductsService`/`CreateProductDto`/`UpdateProductDto`
- `PartnerSearchController` (`/partner/search`) — reuses `SearchService`, force-injects the key's `storeId` server-side (never client-suppliable) — including in the raw-SQL full-text-search path, which doesn't automatically inherit Prisma `where` filters
- Both controllers live in `PartnerCatalogModule` (`modules/partner-api/partner-catalog.module.ts`), kept separate from `PartnerApiModule` (which owns the JWT-gated key-management controller) so the public Swagger doc below never leaks internal admin routes

### Public Swagger docs
Separate `SwaggerModule.createDocument()` call in `main.ts` (`include: [PartnerCatalogModule]`), mounted at `/partner/docs`, enabled in **every** environment including production (unlike the internal `/api/docs`, which is dev-only) — 3rd-party integrators need real docs.
