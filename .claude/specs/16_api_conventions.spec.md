# Module 16 — API Conventions

## 1. Base URL & Prefix

- Global prefix: `/api/v1`
- Full URL: `http://localhost:3002/api/v1`
- Swagger docs (dev only): `http://localhost:3002/api/docs`

## 2. Standard Response Envelope

All responses wrapped in:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;    // ISO 8601
    requestId: string;    // UUID from X-Request-ID header
  };
}
```

### Paginated Response
```typescript
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

### Error Response
```typescript
interface ApiError {
  success: false;
  error: {
    code: string;       // e.g. "ERR_NOT_FOUND", "ERR_VALIDATION"
    message: string;    // human-readable
    details?: {         // validation errors
      field: string;
      message: string;
    }[];
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

## 3. Global Interceptors & Filters

Order: `RequestIdInterceptor → LoggingInterceptor → TransformInterceptor → Controller → HttpExceptionFilter`

| Component | File | Role |
|---|---|---|
| RequestIdInterceptor | `common/interceptors/request-id.interceptor.ts` | Assign `X-Request-ID` UUID to every request |
| LoggingInterceptor | `common/interceptors/logging.interceptor.ts` | Log method, path, status, duration |
| TransformInterceptor | `common/interceptors/transform.interceptor.ts` | Wrap response in `ApiResponse<T>` envelope |
| HttpExceptionFilter | `common/filters/http-exception.filter.ts` | Format errors as `ApiError` |

## 4. Global Validation Pipe

```typescript
new ValidationPipe({
  whitelist: true,              // strip unknown properties
  forbidNonWhitelisted: true,   // reject requests with unknown properties (400)
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})
```

**Critical:** `forbidNonWhitelisted: true` means sending ANY property not declared in the DTO causes a 400 error. All save payloads must only include fields declared in the corresponding DTO.

## 5. Authentication

### Guards
- `JwtAuthGuard` — validates Bearer token, rejects 401
- `OptionalAuthGuard` (`JwtOptionalGuard`) — validates if present, passes through if absent (guest)
- `RolesGuard` — used with `@Roles('ADMIN', 'SUPER_ADMIN')` decorator
- `PermissionsGuard` — hybrid RBAC+ABAC; used with `@RequirePermission('resource:action')`
- `StripeWebhookGuard` — verifies `Stripe-Signature` header before controller runs

### Permission System (Hybrid RBAC+ABAC)
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('orders:edit')
async updateOrder(...) {}
```
- `SUPER_ADMIN` bypasses all permission checks
- `ADMIN` checked against their `PermissionDocument` in DB
- Evaluation order: `overrides.deny` → `overrides.allow` → `roles` → false
- `request.userPermissions` and `request.permissionConditions` set after guard passes

### Token Refresh
- Client apiClient: on 401 → `POST /auth/refresh` → retry original request
- httpOnly cookie contains refresh token (SameSite=Lax)
- Admin app: `ApiError` class carries HTTP status → auto-logout on 401

## 6. Admin Controller Shorthand

```typescript
@AdminController('products')
export class AdminProductsController {}
```

`@AdminController(path)` composite decorator automatically applies:
- `@Controller('admin/<path>')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`
- `@Roles(Role.ADMIN, Role.SUPER_ADMIN)`
- `@ApiBearerAuth()`
- `@ApiTags('Admin — <Path>')`

File: `apps/api/src/common/decorators/admin-controller.decorator.ts`

## 7. Headers

### Request Headers
| Header | Mô tả |
|---|---|
| `Authorization: Bearer <token>` | Access token (JWT) |
| `Content-Type: application/json` | JSON body |
| `X-Session-ID: <uuid>` | Guest cart session ID |
| `X-Request-ID: <uuid>` | Optional: client-provided request ID |

### Response Headers
| Header | Mô tả |
|---|---|
| `X-Request-ID` | Echo back request ID |
| `X-RateLimit-Limit` | Rate limit max |
| `X-RateLimit-Remaining` | Rate limit remaining |
| `Retry-After` | Seconds until rate limit resets |

## 8. Rate Limiting

- Global: 300 requests / 60 seconds / IP (env: `THROTTLE_TTL=60000`, `THROTTLE_LIMIT=300`)
- Auth endpoints: stricter (5 req/min for login, forgot-password)
- `@nestjs/throttler` ThrottlerModule
- Webhooks tagged `@SkipThrottle()` — exempt from global limit

## 9. CORS Configuration

```typescript
app.enableCors({
  origin: corsOrigin,           // string[] from CORS_ORIGINS env, or true (reflect) fallback
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  credentials: true,
  maxAge: 86400,
});
```

**Key:** `origin: '*'` is invalid with `credentials: true`. Use explicit list via `CORS_ORIGINS` env.

Env: `CORS_ORIGINS="http://localhost:3000,http://localhost:3001"` (comma-separated)

## 10. Swagger Tags

Most admin controllers get their tag automatically from the `@AdminController(path)` shorthand (`Admin — <Path>`, e.g. `Admin — Orders`, `Admin — Products`). Public/feature controllers set their own literal tag. Observed tags include:

`Auth`, `Users`, `Products`, `Catalog`, `Cart`, `Orders`, `Payments`, `Webhooks`, `Shipping`, `Reviews`, `Promotions`, `Search`, `Customization`, `Wishlist`, `Messages`, `Loyalty`, `Affiliates`, `admin-referrals`/`referrals`, `Currency`, `Coins`, `VIP`, `Stores`, `Campaigns`, `creators`, `Unsubscribe`, `notifications`, `newsletter`, `Admin AI`, `Admin Stats`, `Admin — User Permissions`, plus per-module `Admin — <Path>` tags from `@AdminController`.

**Note:** older versions of this doc listed `NFT`, `Wallet`, `Labels`, `Bounties`, and `PDF` as Swagger tags — those literal tags are no longer present in the codebase (NFT/Wallet features were removed entirely; PDF and label purchase are invoked from the Orders/Admin-Orders controllers rather than having their own tag). Always grep `@ApiTags(` in `apps/api/src` for the current authoritative list rather than trusting this table.

## 11. Error Code Conventions

- `ERR_` prefix for all error codes
- Format: `ERR_<NOUN>_<VERB>` or `ERR_<DESCRIPTION>`
- Examples: `ERR_NOT_FOUND`, `ERR_CREDENTIALS_INVALID`, `ERR_EMAIL_ALREADY_EXISTS`, `ERR_TOKEN_EXPIRED`, `ERR_VALIDATION`, `ERR_FORBIDDEN`, `ERR_PERMISSION_DENIED`, `ERR_PAYPAL_NOT_CONFIGURED`, `ERR_FILE_TOO_LARGE`, `ERR_FILE_TYPE_INVALID`

## 12. apiClient (Client Frontend)

File: `libs/shared/api-client/src/client.ts`

```typescript
// Auto-unwraps { success, data, meta } envelope
// baseUrl: strips /api/v1 suffix from NEXT_PUBLIC_API_URL, then adds it back
// NEXT_PUBLIC_API_URL must NOT include /api/v1 suffix

export const apiClient = {
  get:    <T>(path, options?) => apiRequest<T>(path, { method: 'GET', ...options }),
  post:   <T>(path, body?, options?) => apiRequest<T>(path, { method: 'POST', body, ...options }),
  patch:  <T>(path, body?, options?) => apiRequest<T>(path, { method: 'PATCH', body, ...options }),
  put:    <T>(path, body?, options?) => apiRequest<T>(path, { method: 'PUT', body, ...options }),
  delete: <T>(path, options?) => apiRequest<T>(path, { method: 'DELETE', ...options }),
};
```

**Important:** `apiClient.get<ProductDto>('/products/my-slug')` returns `ProductDto` directly (not `ApiResponse<ProductDto>`).

## 13. clientFetch (Admin App)

File: `apps/admin/src/lib/api.ts`

Admin app uses `clientFetch` (raw fetch wrapper using NextAuth session token) rather than `apiClient`:
```typescript
import { clientFetch, API_BASE } from '../lib/api';

// Returns raw Response (not unwrapped)
// Caller must check res.ok and res.json() manually
const res = await clientFetch(`/admin/products/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});
```

## 14. Pagination

File: `apps/api/src/common/dto/pagination.dto.ts`

Default parameters: `?page=1&limit=24` (max `limit` is 48; also carries `sort`/`order` fields, `order` defaults to `desc` via a `SortOrder` enum — do NOT send a default `sort` value from the client, an invalid/unexpected value fails enum validation)

```typescript
class PaginationDto {
  page?: number = 1;
  limit?: number = 24;  // max 48
  sort?: string;
  order?: SortOrder = SortOrder.DESC;  // 'asc' | 'desc'
}
```

Admin order list supports additional filters via `AdminOrderQueryDto` (status, dateFrom, dateTo, search, etc.).

## 15. React Query Hooks (Shared)

File: `libs/shared/api-client/src/hooks/`

Available hooks (this lib only covers the storefront's most common data needs — most feature pages, especially admin and the newer marketplace modules like loyalty/affiliates/messages/currency, call `apiClient` directly with raw paths rather than through a shared hook):
- `useProducts()`, `useProduct(slug)`, `useRelatedProducts(id)`, `usePrefetchProduct()`
- `useCategories()`, `useCategory(slug)`, `useCollections()`, `useCollection(slug)`
- `useCart()`, `useMutateCart()`, `useCheckout()`
- `useOrders()`, `useOrder(orderNumber)`, `useCancelOrder()`
- `useWishlist()`, `useMutateWishlist()`, `useWishlistToggle()`
- `useSearch(q, filters)`, `useSearchSuggestions(q)`
- `useReviews(slug)`, `useReviewSummary(slug)`
- `useProfile()`, `useMutateProfile()`, `useAddresses()`, `useMutateAddresses()`
- `useShippingOptions()`, `useNewsletterSubscribe()`

**Note:** earlier versions of this doc also listed `useLoyalty`, `useMessages`, `useAffiliateMe`, `useReferralMe`, `useCreators`, `useCurrencies`, and `useNftDrops` — none of these exist in `libs/shared/api-client/src/hooks/`. NFT/drops features were removed from the product entirely; loyalty/messages/affiliates/referrals/currency are fetched via `apiClient` directly in the relevant client pages, not via shared hooks.
