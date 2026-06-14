# Module 01 — Authentication

## 1. Tổng quan

Hệ thống xác thực dùng JWT (access + refresh tokens). Access token lưu trong memory (Zustand store, không persist), refresh token lưu trong httpOnly cookie. Hỗ trợ email/password, Google OAuth2, và TOTP 2FA cho admin.

## 2. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản (rate: 5/min) | No |
| POST | `/api/v1/auth/login` | Đăng nhập (rate: 10/min) | No |
| POST | `/api/v1/auth/logout` | Đăng xuất, revoke refresh token | Bearer |
| POST | `/api/v1/auth/refresh` | Xoay vòng refresh token (rate: 30/min) | Cookie |
| POST | `/api/v1/auth/verify-email` | Xác thực email | No |
| POST | `/api/v1/auth/resend-verification` | Gửi lại email xác thực | Bearer |
| POST | `/api/v1/auth/forgot-password` | Yêu cầu đặt lại mật khẩu (rate: 3/15min) | No |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu với token | No |
| POST | `/api/v1/auth/change-password` | Đổi mật khẩu (đã đăng nhập) | Bearer |
| GET | `/api/v1/auth/google` | Khởi tạo Google OAuth2 | No |
| GET | `/api/v1/auth/google/callback` | Callback Google OAuth2 | No |
| POST | `/api/v1/auth/totp/verify` | Hoàn tất login với TOTP code (rate: 10/min) | No |
| GET | `/api/v1/auth/totp/setup` | Tạo QR code + backup codes để setup 2FA | Bearer |
| POST | `/api/v1/auth/totp/confirm` | Xác nhận TOTP setup bằng code | Bearer |
| POST | `/api/v1/auth/totp/disable` | Tắt TOTP 2FA | Bearer |

## 3. Response Format

### Login thành công (không TOTP):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "...", "email": "...", "firstName": "...", "lastName": "...",
      "role": "CUSTOMER", "avatarUrl": null, "isEmailVerified": true,
      "storeId": null, "isSeller": false, "permissions": null
    }
  },
  "meta": null
}
```

### Login khi admin có TOTP (HTTP 202):
```json
{
  "success": true,
  "data": { "requiresTOTP": true, "partialToken": "eyJ..." },
  "meta": null
}
```
→ Client dùng `partialToken` + TOTP code để POST `/auth/totp/verify`.

### Google OAuth callback:
Redirect đến frontend: `/auth/callback?token=<accessToken>`
Client page parse token và set vào auth store.

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
  // TOTP 2FA
  totpSecret      String?   // encrypted
  totpEnabled     Boolean   @default(false)
  totpVerifiedAt  DateTime?
  backupCodes     String[]
  // Referral system
  referralCode    String?   @unique
  referredByUserId String?
  referralDepth   Int       @default(0)
  totalReferrals  Int       @default(0)
  // Seller / Permissions
  isSeller        Boolean   @default(false)
  storeId         String?
  permissions     Json?
  pushEnabled     Boolean   @default(true)
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum Role     { CUSTOMER ADMIN SUPER_ADMIN SELLER }
enum Provider { EMAIL GOOGLE FACEBOOK }

model RefreshToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  userId    String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
}

model EmailVerification {
  id        String    @id @default(cuid())
  token     String
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

model PasswordReset {
  id        String    @id @default(cuid())
  token     String
  email     String
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}
```

## 5. JWT Configuration

| Token | Secret Env | Expiry | Default |
|---|---|---|---|
| Access | JWT_ACCESS_SECRET | JWT_ACCESS_EXPIRES_IN | 15m |
| Refresh | — (random bytes, stored hashed) | 30d normal / 90d rememberMe | — |
| TOTP Partial | JWT_ACCESS_SECRET | — | 5m |

Refresh token là random 40-byte hex, stored as SHA-256 hash. Không dùng `JWT_REFRESH_SECRET`.

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
- `setUser(user, accessToken)` — legacy alias
- `clearAuth()` — clear state
- `getToken()` — return in-memory token

**Token provider registration (module import time):**
```typescript
setTokenGetter(() => _accessToken);
setTokenUpdater((token) => { _accessToken = token ?? null; });
```

## 7. Error Codes

| Code | HTTP | Mô tả |
|---|---|---|
| ERR_CREDENTIALS_INVALID | 401 | Sai email/password |
| ERR_ACCOUNT_LOCKED | 401 | Đăng nhập sai quá nhiều lần |
| ERR_EMAIL_NOT_VERIFIED | 403 | Email chưa xác thực |
| ERR_EMAIL_TAKEN | 409 | Email đã được dùng |
| ERR_TOKEN_EXPIRED | 401 | Access token hết hạn |
| ERR_TOKEN_INVALID | 401 | Token không hợp lệ |
| ERR_REFRESH_TOKEN_INVALID | 401 | Refresh token không hợp lệ |
| ERR_TOTP_TOKEN_INVALID | 401 | Partial TOTP token không hợp lệ/hết hạn |
| ERR_TOTP_CODE_INVALID | 401 | Code TOTP sai |
| ERR_TOTP_NOT_ENABLED | 400 | 2FA chưa được bật |
| ERR_ALREADY_VERIFIED | 400 | Email đã được xác thực rồi |
| ERR_VERIFICATION_TOKEN_INVALID | 400 | Token xác thực không hợp lệ |
| ERR_RESET_TOKEN_INVALID | 400 | Token đặt lại mật khẩu không hợp lệ |
| ERR_NO_PASSWORD | 400 | Tài khoản social login chưa có password |

## 8. TOTP 2FA Flow (Admin Only)

1. Admin `GET /auth/totp/setup` → nhận `{ secret, qrCodeDataUrl }`
2. Admin quét QR trên app authenticator (Google Authenticator, Authy, ...)
3. Admin `POST /auth/totp/confirm` với `{ secret, code }` → nhận `{ backupCodes: string[] }`
4. Từ lần login sau: nhập email/password → API trả về `{ requiresTOTP: true, partialToken }`
5. Admin gửi `POST /auth/totp/verify` với `{ partialToken, code }` → nhận `AuthResponseDto`
6. Backup codes (8 code, hashed) dùng khi mất thiết bị; mỗi code dùng 1 lần

## 9. Google OAuth Flow

1. User click "Continue with Google" → `GET /api/v1/auth/google`
2. Redirect đến Google consent screen
3. Google callback → `GET /api/v1/auth/google/callback`
4. API tạo/cập nhật user (link Google nếu email đã tồn tại), generate tokens
5. Redirect về client: `/auth/callback?token=<accessToken>`
6. Client page parse token và set vào auth store

## 10. Business Rules

- Access token KHÔNG lưu trong localStorage/sessionStorage (bảo mật XSS)
- Refresh token chỉ trong httpOnly cookie (`path: /api/v1/auth`)
- Cookie `secure: true, sameSite: 'none'` ở production; `sameSite: 'lax'` ở dev
- Sau 5 lần sai mật khẩu → lock 15 phút (key Redis: `auth:login:<email>`)
- Reset password → revoke tất cả refresh token hiện có
- Change password → revoke tất cả refresh token hiện có
- Soft delete: user có `deletedAt` không thể login
- apiClient auto-refresh: 401 → POST /auth/refresh → retry original request
- Admin app: auto-logout khi nhận 401
- Register: tự động tạo `referralCode` (format `XXXXNNNN`); link guest orders bằng email
- TOTP chỉ bắt buộc với ADMIN / SUPER_ADMIN roles khi `totpEnabled: true`
