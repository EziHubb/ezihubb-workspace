# Module 16 — API Conventions

## 1. Base URL & Prefix

- Global prefix: `/api/v1`
- Full URL: `http://localhost:3002/api/v1`
- Swagger docs (dev only): `http://localhost:3002/api/docs`

## 2. Standard Response Envelope

Tất cả responses đều bọc trong:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;    // ISO 8601
    requestId: string;    // UUID từ X-Request-ID header
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
  whitelist: true,           // strip unknown properties
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})
```

## 5. Authentication

### Guards
- `JwtAuthGuard` — validates Bearer token, rejects 401
- `JwtOptionalGuard` — validates if present, passes through if absent (guest)
- `RolesGuard` — used with `@Roles('ADMIN')` decorator

### Token Refresh
- Client apiClient: on 401 → `POST /auth/refresh` → retry original request
- httpOnly cookie contains refresh token (SameSite=Lax)

## 6. Headers

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

## 7. Rate Limiting

- Global: 300 requests / 60 seconds / IP (configurable via THROTTLE_TTL, THROTTLE_LIMIT)
- Auth endpoints: stricter (5 req/min for login, forgot-password)
- ThrottlerModule from `@nestjs/throttler`

## 8. CORS Configuration

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

**Key:** `origin: '*'` is invalid with `credentials: true`. Use explicit list or `origin: true`.

## 9. Swagger Tags

`Auth`, `Users`, `Products`, `Catalog`, `Cart`, `Orders`, `Payments`, `Shipping`, `Reviews`, `Promotions`, `Search`, `Admin`, `Webhooks`

## 10. Error Code Conventions

- `ERR_` prefix for all error codes
- Format: `ERR_<NOUN>_<VERB>` or `ERR_<DESCRIPTION>`
- Examples: `ERR_NOT_FOUND`, `ERR_CREDENTIALS_INVALID`, `ERR_EMAIL_ALREADY_EXISTS`, `ERR_TOKEN_EXPIRED`, `ERR_VALIDATION`

## 11. apiClient (Frontend)

File: `libs/shared/api-client/src/client.ts`

```typescript
// Auto-unwraps { success, data, meta } envelope
// baseUrl strips /api/v1 suffix from NEXT_PUBLIC_API_URL
// then adds /api/v1 prefix in apiRequest()

export const apiClient = {
  get:    <T>(path, options?) => apiRequest<T>(path, { method: 'GET', ...options }),
  post:   <T>(path, body?, options?) => apiRequest<T>(path, { method: 'POST', body, ...options }),
  patch:  <T>(path, body?, options?) => apiRequest<T>(path, { method: 'PATCH', body, ...options }),
  put:    <T>(path, body?, options?) => apiRequest<T>(path, { method: 'PUT', body, ...options }),
  delete: <T>(path, options?) => apiRequest<T>(path, { method: 'DELETE', ...options }),
};
```

**Important:** `apiClient.get<ProductDto>('/products/my-slug')` returns `ProductDto` directly (not `ApiResponse<ProductDto>`).
