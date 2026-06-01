# Module 20 — Backend Conventions

## 1. NestJS Module Structure

Every feature module follows:
```
apps/api/src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  dto/
    create-<module>.dto.ts
    update-<module>.dto.ts
    <module>-response.dto.ts
  entities/
    <module>.entity.ts        # (if Mongoose)
```

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
- Methods return plain objects/arrays — `TransformInterceptor` wraps them

## 3. Service Conventions

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoProductDetail: MongoProductDetailService,
    private readonly redis: RedisService,
  ) {}
}
```

- PrismaService for PostgreSQL queries
- Separate Mongoose services for MongoDB collections
- RedisService for cache (check `redis.available` before using)

## 4. DTO Validation

```typescript
import { IsString, IsEmail, IsOptional, MinLength, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;
}
```

- Use `class-validator` decorators
- DTOs use `whitelist: true` (extra props stripped)
- `transformOptions: { enableImplicitConversion: true }` handles string→number coercion in query params

## 5. Prisma Usage

```typescript
// prisma.config.ts
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
    include: { variants: true, category: true }
  });
}
```

## 6. MongoDB / Mongoose Usage

```typescript
// Entity
@Schema({ timestamps: true })
export class ProductDetail extends Document {
  @Prop({ required: true, unique: true })
  productId: string;

  @Prop({ type: Object })
  customization?: object;
}

// Service
@Injectable()
export class MongoProductDetailService {
  constructor(@InjectModel('ProductDetail') private model: Model<ProductDetail>) {}

  async findByProductId(productId: string) {
    return this.model.findOne({ productId }).lean();
  }
}
```

**Note:** Use `returnDocument: 'after'` (not deprecated `new: true`) for findOneAndUpdate.

## 7. Error Handling

```typescript
// Controller-level (use NestJS built-ins)
throw new NotFoundException('Product not found');
throw new ConflictException('Email already exists');
throw new UnauthorizedException('Invalid credentials');
throw new BadRequestException('Validation failed');

// HttpExceptionFilter formats as ApiError:
// { success: false, error: { code, message, details[] }, meta: { ... } }
```

## 8. Guards & Decorators

```typescript
// Protect routes
@UseGuards(JwtAuthGuard)             // require auth
@UseGuards(JwtOptionalGuard)         // auth if present
@UseGuards(JwtAuthGuard, RolesGuard) // require specific role
@Roles('ADMIN', 'SUPER_ADMIN')

// Custom decorators
@CurrentUser()   // extracts user from request (set by JwtAuthGuard)
@Public()        // skip JwtAuthGuard (used with global guard setup)
```

## 9. BullMQ Queues

```typescript
// Queue names
'email-queue'
'image-processing-queue'
'order-processing-queue'

// Dev mode (DISABLE_QUEUE=true)
// DevBullModule provides no-op tokens — processors not registered
// All queue inject points work but jobs are silently discarded
```

## 10. Logging

```typescript
// Use NestJS Logger (not console.log)
private readonly logger = new Logger(ProductsService.name);
this.logger.log('Product fetched');
this.logger.error('Failed to fetch', error.stack);
this.logger.warn('Cache miss for key: ' + key);
```

## 11. Code Style

- TypeScript strict mode
- No `any` types (use `unknown` + type guards when needed)
- Async/await (no .then() chains)
- Named exports (no default exports except Next.js pages)
- Barrel exports via `index.ts`
- File naming: `kebab-case.service.ts`, `PascalCase` for classes

## 12. Testing

```bash
pnpm nx test api           # Unit tests (Jest)
pnpm nx e2e api            # E2E tests
```

- Unit tests: `*.spec.ts` next to source files
- E2E tests: `apps/api-e2e/`
- Test database: separate `DATABASE_URL` in `.env.test`
- No mocking database — use real test DB
