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

### Modules present in `apps/api/src/modules/`
`admin`, `analytics`, `assets`, `auth`, `cart`, `catalog`, `customization`, `database`, `notifications`, `orders`, `order-tracking`, `payments`, `products`, `promotions`, `reviews`, `search`, `shipping`, `store-credits`, `tax`, `users`,
`messages`, `loyalty`, `affiliate`, `referral`, `push`, `pdf`, `label`, `currency`, `creator`, `nft`, `bounty`, `wallet`, `audit-log`, `coins`

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
// Queue names (from queue.constants.ts)
QUEUES.EMAIL              // 'email-queue'
QUEUES.IMAGE_PROCESSING   // 'image-processing-queue'
QUEUES.ORDER_PROCESSING   // 'order-processing-queue'
QUEUES.LOYALTY_UNLOCK     // 'loyalty-unlock'
QUEUES.STOCK_ALERT        // 'stock-alert-queue'
QUEUES.PDF_GENERATION     // 'pdf-generation-queue'
QUEUES.PUSH_NOTIFICATION  // 'push-notification-queue'
QUEUES.TRANSLATION        // 'translation-queue'
QUEUES.AI_FEATURES        // 'ai-features'

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

```bash
pnpm nx test api           # Unit tests (Jest)
pnpm nx e2e api-e2e        # E2E tests
```

- Unit tests: `*.spec.ts` next to source files
- E2E tests: `apps/api-e2e/`
- Test database: separate `DATABASE_URL` in `.env.test`
- No mocking database — use real test DB (integration tests)

## 15. Email Templates (Handlebars)

- Location: `apps/api/src/modules/notifications/templates/`
- Format: `.hbs` Handlebars templates
- Compiled via `@nestjs-modules/mailer` or nodemailer with handlebars
- Templates: `welcome`, `verify-email`, `reset-password`, `order-confirmation`, `order-shipped`, `order-delivered`, `order-cancelled`

## 16. Key Shared Services

### AuditLogService
File: `apps/api/src/common/services/audit-log.service.ts`
```typescript
auditLogService.log({ userId, action, entityType, entityId, before?, after?, ip?, userAgent? })
```
Called in: order status change, order cancel, order ship, product CRUD, user role change, settings update.

### AutoTranslateService
File: `apps/api/src/modules/products/auto-translate.service.ts`
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
- `puppeteer` / `@sparticuz/chromium` for PDF generation
- `pdfService.generateInvoice(orderId, giftReceipt?, userId?)` — auto-detects giftReceipt flag, verifies ownership when userId provided
- `pdfService.generatePackingSlip(orderId)`
- PDFs cached in R2

### OrderTrackingService
File: `apps/api/src/modules/order-tracking/order-tracking.service.ts`
- Manages `OrderTracking` + `TrackingEvent` records (Prisma)
- `getTracking(orderId)` — auto-creates record if order exists but no tracking yet
- `updateStage(orderId, stage, title, source, carrierName?, trackingNumber?)` — upserts + creates event
- Also handles Printify webhooks via `handlePrintifyWebhook(payload)`

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
