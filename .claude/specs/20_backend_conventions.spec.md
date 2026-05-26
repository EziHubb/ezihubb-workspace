# Module 20 — Backend Technical Conventions (NestJS)

## 1. Module Structure (chuẩn mọi module)

```
src/modules/products/
├── products.module.ts
├── products.controller.ts       — public endpoints
├── products.service.ts
├── admin-products.controller.ts — admin endpoints
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   ├── product-query.dto.ts
│   └── product-response.dto.ts
├── entities/
│   └── product.entity.ts        — Prisma result type + transforms
└── products.service.spec.ts
```

---

## 2. Global Pipes, Filters, Interceptors

```typescript
// main.ts — bootstrap
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // strip unknown fields
  forbidNonWhitelisted: true,
  transform: true,           // auto-transform types
  transformOptions: { enableImplicitConversion: true },
}))

app.useGlobalFilters(new HttpExceptionFilter())     // format lỗi theo envelope
app.useGlobalInterceptors(
  new RequestIdInterceptor(),   // gắn requestId
  new LoggingInterceptor(),     // log mỗi request
  new TransformInterceptor(),   // wrap response vào envelope
)
app.setGlobalPrefix('api/v1')
```

---

## 3. Guards

```
src/common/guards/
├── jwt-auth.guard.ts        — verify JWT, inject user vào request
├── roles.guard.ts           — kiểm tra Role (dùng sau jwt-auth)
├── optional-auth.guard.ts   — không bắt buộc login (cho public endpoints)
└── stripe-webhook.guard.ts  — verify Stripe-Signature
```

**Sử dụng:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Patch(':id/status')
async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {}

// Public endpoint không cần guard — mặc định
@Get(':slug')
async getProduct(@Param('slug') slug: string) {}

// Optional auth (lấy user nếu có)
@UseGuards(OptionalAuthGuard)
@Get(':slug')
async getProduct(@Param('slug') slug: string, @CurrentUser() user?: User) {}
```

---

## 4. Custom Decorators

```typescript
// @CurrentUser() — lấy user từ request
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user
    return data ? user?.[data] : user
  }
)

// @Roles() — metadata cho RolesGuard
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles)

// @Public() — skip auth guard
export const Public = () => SetMetadata('isPublic', true)

// @ApiPaginatedResponse() — Swagger decorator
```

---

## 5. DTO Conventions

```typescript
// Tất cả DTO dùng class-validator + class-transformer

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @IsString()
  @MinLength(10)
  description: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  basePrice: number

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  compareAtPrice?: number

  @IsBoolean()
  @IsOptional()
  isPersonalizable?: boolean = true

  @IsCuid()
  categoryId: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[]
}

// Response DTO — expose chỉ những gì cần thiết
export class ProductResponseDto {
  id: string
  name: string
  slug: string
  basePrice: number
  compareAtPrice?: number
  discountPercent?: number    // computed
  images: ProductImageDto[]
  primaryImage?: ProductImageDto  // computed
  rating?: number             // computed từ reviews
  reviewCount?: number
  soldCount: number
  isPersonalizable: boolean
  category: CategoryDto
  tags: TagDto[]
  createdAt: Date

  static fromPrisma(product: PrismaProduct): ProductResponseDto {
    // transform logic
  }
}
```

---

## 6. Service Patterns

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private s3: S3Service,
  ) {}

  // List với pagination + filter
  async findAll(query: ProductQueryDto): Promise<PaginatedResult<ProductResponseDto>> {
    const { page = 1, limit = 24, sort = 'newest', categorySlug, minPrice, maxPrice } = query
    const skip = (page - 1) * limit

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(minPrice !== undefined && { basePrice: { gte: minPrice } }),
      ...(maxPrice !== undefined && { basePrice: { lte: maxPrice } }),
    }

    const orderBy = this.buildOrderBy(sort)

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy, skip, take: limit,
        include: { images: true, category: true, tags: { include: { tag: true } } }
      }),
      this.prisma.product.count({ where }),
    ])

    return {
      data: items.map(ProductResponseDto.fromPrisma),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total, hasPrev: page > 1 }
    }
  }

  // Throw chuẩn error
  async findBySlug(slug: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug, isActive: true },
      include: { images: true, category: true, variants: true,
        tags: { include: { tag: true } } }
    })
    if (!product) throw new NotFoundException('ERR_PRODUCT_NOT_FOUND')
    return ProductResponseDto.fromPrisma(product)
  }
}
```

---

## 7. Exception Filter (Response Envelope)

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()
    const exceptionResponse = exception.getResponse() as any

    // Map NestJS validation errors → ERR_VALIDATION format
    if (exceptionResponse.message instanceof Array) {
      return response.status(status).json({
        success: false,
        error: {
          code: 'ERR_VALIDATION',
          message: 'Validation failed.',
          details: exceptionResponse.message.map(msg => ({
            field: msg.split(' ')[0],
            message: msg,
          }))
        },
        meta: { timestamp: new Date().toISOString(), requestId: request['requestId'] }
      })
    }

    response.status(status).json({
      success: false,
      error: {
        code: exceptionResponse.code || exceptionResponse.error || 'ERR_INTERNAL',
        message: exceptionResponse.message || 'Internal server error.',
        details: []
      },
      meta: { timestamp: new Date().toISOString(), requestId: request['requestId'] }
    })
  }
}
```

---

## 8. PrismaService

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  // Helper: soft delete (set isActive=false thay vì xóa)
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    })
  }
}
```

---

## 9. RedisService

```typescript
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis

  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL)
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key)
    return val ? JSON.parse(val) : null
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized)
    } else {
      await this.client.set(key, serialized)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern)
    if (keys.length > 0) await this.client.del(...keys)
  }
}

// Cache keys convention:
// products:list:{hash-of-filters}      TTL: 60s
// product:{slug}                        TTL: 300s
// categories:tree                       TTL: 600s
// reviews:summary:{productId}           TTL: 300s
// search:autocomplete:{query}           TTL: 60s
```

---

## 10. Queue Setup (BullMQ)

```typescript
// Queue names
export const QUEUES = {
  EMAIL: 'email',
  IMAGE_PROCESSING: 'image-processing',
  ORDER_PROCESSING: 'order-processing',
  SCHEDULED: 'scheduled',
} as const

// Job names
export const JOBS = {
  // Email
  SEND_EMAIL: 'send-email',

  // Image
  REMOVE_BACKGROUND: 'remove-background',
  GENERATE_PREVIEW: 'generate-preview',
  APPLY_ART_STYLE: 'apply-art-style',
  CLEANUP_TEMP_IMAGES: 'cleanup-temp-images',

  // Order
  ORDER_CONFIRMED: 'order-confirmed',      // gửi email + notify production
  ORDER_AUTO_COMPLETE: 'order-auto-complete',

  // Scheduled (dùng với cron)
  DAILY_REVIEW_REMINDERS: 'daily-review-reminders',
  DAILY_ORDER_AUTO_COMPLETE: 'daily-order-auto-complete',
  WEEKLY_CLEANUP_CARTS: 'weekly-cleanup-carts',
} as const

// Queue config
const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}
```

---

## 11. Testing Strategy

```
Unit tests:     Service layer (mock Prisma + Redis)
Integration:    Controller → Service → Prisma (test DB)
E2E:            Full HTTP request → response (Supertest)
```

### Test file pattern
```typescript
// products.service.spec.ts
describe('ProductsService', () => {
  let service: ProductsService
  let prisma: DeepMockProxy<PrismaService>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile()
    service = module.get(ProductsService)
    prisma = module.get(PrismaService)
  })

  describe('findBySlug', () => {
    it('returns product when found', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct)
      const result = await service.findBySlug('custom-mug')
      expect(result.slug).toBe('custom-mug')
    })

    it('throws NotFoundException when not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null)
      await expect(service.findBySlug('not-exist'))
        .rejects.toThrow(NotFoundException)
    })
  })
})
```

### Coverage targets
| Layer | Target |
|-------|--------|
| Services | ≥ 80% |
| Controllers | ≥ 70% |
| Guards/Pipes | ≥ 90% |
| Utils | ≥ 95% |

---

## 12. Swagger / OpenAPI

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('MapleLoomHandmade API')
  .setDescription('MapleLoomHandmade Clone REST API')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('Auth')
  .addTag('Products')
  .addTag('Cart')
  .addTag('Orders')
  .addTag('Payments')
  .build()

const document = SwaggerModule.createDocument(app, config)
SwaggerModule.setup('api/docs', app, document)
// Chỉ enable trong development và staging
```

Mọi DTO phải có `@ApiProperty()` decorators.
Mọi endpoint phải có `@ApiOperation()`, `@ApiResponse()`.
