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
`admin`, `analytics`, `assets`, `auth`, `cart`, `catalog`, `customization`, `database`, `notifications`, `orders`, `payments`, `products`, `promotions`, `reviews`, `search`, `shipping`, `users`

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
- Admin controllers prefixed: `@Controller('admin/products')` with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN', 'SUPER_ADMIN')`
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

- PrismaService for PostgreSQL queries
- `@InjectModel()` for Mongoose models (MongoDB)
- RedisService: check `redis.available` before using cache
- Services injected cross-module via module exports

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
- Global pipe: `whitelist: true, forbidNonWhitelisted: true` — extra props are REJECTED (400), not stripped
- `transformOptions: { enableImplicitConversion: true }` — handles string→number in query params
- `@Type(() => Number)` required for nested number coercion in query DTOs
- `@ValidateNested() @Type(() => SubDto)` for nested object validation

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

// HttpExceptionFilter formats as ApiError:
// { success: false, error: { code, message, details[] }, meta: { ... } }
```

Pass structured object `{ code, message }` to exception constructors so HttpExceptionFilter can extract the code.

## 8. Guards & Decorators

```typescript
// Protect routes
@UseGuards(JwtAuthGuard)              // require auth
@UseGuards(JwtOptionalGuard)          // auth if present (guest-friendly)
@UseGuards(JwtAuthGuard, RolesGuard)  // require specific role
@Roles('ADMIN', 'SUPER_ADMIN')

// Custom decorators
@CurrentUser()    // extracts user from request (set by JwtAuthGuard)
@Public()         // skip JwtAuthGuard (used with global guard setup)
```

## 9. BullMQ Queues

```typescript
// Queue names (apps/api/src/modules/notifications/ and customization/)
'email-queue'           // email sending jobs
'image-processing-queue' // background removal, art style
'order-processing-queue'

// Dev mode (DISABLE_QUEUE=true)
// DevBullModule provides no-op tokens
// Processors not registered — jobs silently discarded
// All inject points work normally
```

## 10. Redis Usage

```typescript
// RedisService checks this.available before any operation
if (!this.redis.available) return null;  // graceful fallback

// Cache patterns:
await this.redis.set('mega-menu:v1', JSON.stringify(data), { EX: 600 });
const cached = await this.redis.get('mega-menu:v1');

// Trending search (sorted set):
await this.redis.zIncrBy('search:trending', 1, query);
const top10 = await this.redis.zRangeWithScores('search:trending', 0, 9, { REV: true });
```

## 11. Logging

```typescript
// Use NestJS Logger (not console.log)
private readonly logger = new Logger(ProductsService.name);
this.logger.log('Product fetched');
this.logger.error('Failed to fetch', error.stack);
this.logger.warn('Cache miss for key: ' + key);
```

## 12. Code Style

- TypeScript strict mode
- No `any` types (use `unknown` + type guards)
- Async/await (no `.then()` chains)
- Named exports (no default exports except Next.js pages/layouts)
- Barrel exports via `index.ts`
- File naming: `kebab-case.service.ts`, `PascalCase` for classes
- No comments unless WHY is non-obvious

## 13. Testing

```bash
pnpm nx test api           # Unit tests (Jest)
pnpm nx e2e api-e2e        # E2E tests
```

- Unit tests: `*.spec.ts` next to source files
- E2E tests: `apps/api-e2e/`
- Test database: separate `DATABASE_URL` in `.env.test`
- No mocking database — use real test DB (integration tests)

## 14. Email Templates (Handlebars)

- Location: `apps/api/src/modules/notifications/templates/`
- Format: `.hbs` Handlebars templates
- Compiled via `@nestjs-modules/mailer` or nodemailer with handlebars
- Templates: `welcome`, `verify-email`, `reset-password`, `order-confirmation`, `order-shipped`, `order-delivered`, `order-cancelled`

## 15. Presigned Upload Flow (Assets)

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
