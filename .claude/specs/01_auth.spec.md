# Module 01 — Authentication

## 1. Tổng quan

Hệ thống xác thực dùng JWT (access + refresh tokens). Access token lưu trong memory (Zustand store, không persist), refresh token lưu trong httpOnly cookie. Hỗ trợ email/password và Google OAuth2.

## 2. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản | No |
| POST | `/api/v1/auth/login` | Đăng nhập | No |
| POST | `/api/v1/auth/logout` | Đăng xuất, revoke refresh token | Bearer |
| POST | `/api/v1/auth/refresh` | Xoay vòng refresh token | Cookie |
| POST | `/api/v1/auth/verify-email` | Xác thực email | No |
| POST | `/api/v1/auth/resend-verification` | Gửi lại email xác thực | No |
| POST | `/api/v1/auth/forgot-password` | Yêu cầu đặt lại mật khẩu | No |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu với token | No |
| POST | `/api/v1/auth/change-password` | Đổi mật khẩu (đã đăng nhập) | Bearer |
| GET | `/api/v1/auth/google` | Khởi tạo Google OAuth2 | No |
| GET | `/api/v1/auth/google/callback` | Callback Google OAuth2 | No |

## 3. Response Format

### Login / Refresh thành công:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": { "id": "...", "email": "...", "firstName": "...", "role": "CUSTOMER" }
  },
  "meta": { "timestamp": "...", "requestId": "..." }
}
```
Refresh token được set trong httpOnly cookie (không trả về body).

### Google OAuth callback:
Redirect đến frontend: `/[locale]/auth/google/callback?token=<accessToken>&user=<URLencodedJSON>&redirect=<path>`
Client page parse và gọi `useAuthStore.getState().setTokens(token, user)`.

## 4. Prisma Models

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?
  firstName       String?
  lastName        String?
  avatarUrl       String?
  role            Role      @default(CUSTOMER)
  isEmailVerified Boolean   @default(false)
  provider        Provider  @default(EMAIL)
  providerId      String?
  deletedAt       DateTime?
}

model RefreshToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  userId    String
  expiresAt DateTime
  revokedAt DateTime?
}
```

## 5. JWT Configuration

| Token | Secret Env | Expiry Env | Default |
|---|---|---|---|
| Access | JWT_ACCESS_SECRET | JWT_ACCESS_EXPIRES_IN | 15m |
| Refresh | JWT_REFRESH_SECRET | JWT_REFRESH_EXPIRES_IN | 30d |
| Remember Me | — | JWT_REMEMBER_ME_EXPIRES_IN | 90d |

## 6. Client-Side Auth Store (Zustand)

File: `apps/client/src/lib/store/auth.store.ts`

**State:**
- `user: UserDto | null` — persisted to localStorage (key: `mlh-auth`)
- `accessToken: string | null` — NOT persisted, cleared on reload
- `isLoading: boolean`

**Actions:**
- `login(email, password, rememberMe?)` — POST /auth/login, set tokens, merge guest cart
- `register(dto)` — POST /auth/register
- `logout()` — POST /auth/logout, clear tokens + cart
- `fetchCurrentUser()` — GET /users/me
- `refreshToken()` — POST /auth/refresh
- `setTokens(accessToken, user)` — used by OAuth callback

**Token provider registration (module import time):**
```typescript
setTokenGetter(() => _accessToken);
setTokenUpdater((token) => { _accessToken = token ?? null; });
```

## 7. Error Codes

| Code | HTTP | Mô tả |
|---|---|---|
| ERR_CREDENTIALS_INVALID | 401 | Sai email/password |
| ERR_ACCOUNT_LOCKED | 423 | Đăng nhập sai quá nhiều lần |
| ERR_EMAIL_NOT_VERIFIED | 403 | Email chưa xác thực |
| ERR_EMAIL_ALREADY_EXISTS | 409 | Email đã được dùng |
| ERR_TOKEN_EXPIRED | 401 | Access token hết hạn |
| ERR_TOKEN_INVALID | 401 | Token không hợp lệ |
| ERR_REFRESH_TOKEN_INVALID | 401 | Refresh token không hợp lệ |

## 8. Google OAuth Flow

1. User click "Continue with Google" → `GET /api/v1/auth/google`
2. Redirect đến Google consent screen
3. Google callback → `GET /api/v1/auth/google/callback`
4. API tạo/cập nhật user, generate tokens
5. Redirect về client: `/[locale]/auth/google/callback?token=...&user=...&redirect=...`
6. Client page (`apps/client/src/app/[locale]/(auth)/auth/google/callback/page.tsx`) xử lý

## 9. Business Rules

- Access token KHÔNG lưu trong localStorage/sessionStorage (bảo mật XSS)
- Refresh token chỉ trong httpOnly Secure SameSite=Lax cookie
- Sau 5 lần sai mật khẩu → lock 15 phút
- Email xác thực bắt buộc trước khi login (trừ OAuth)
- Soft delete: user có `deletedAt` không thể login
- apiClient auto-refresh: 401 → POST /auth/refresh → retry original request
