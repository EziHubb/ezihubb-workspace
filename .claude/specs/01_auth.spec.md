# Module 01 — Authentication & Authorization

## 1. Tổng quan

Module xử lý toàn bộ vòng đời xác thực người dùng: đăng ký, đăng nhập, OAuth, quản lý phiên, phân quyền.

**Stack:** NestJS + Passport.js + JWT (Access + Refresh Token) + bcrypt

---

## 2. User Stories

### 2.1 Đăng ký
- **US-AUTH-001:** Là khách, tôi muốn đăng ký tài khoản bằng email/password để lưu lịch sử đơn hàng.
- **US-AUTH-002:** Là khách, tôi muốn đăng ký / đăng nhập bằng Google để không cần nhớ mật khẩu.
- **US-AUTH-003:** Là khách, sau khi đăng ký tôi nhận email xác thực để kích hoạt tài khoản.

### 2.2 Đăng nhập
- **US-AUTH-004:** Là người dùng, tôi muốn đăng nhập bằng email/password.
- **US-AUTH-005:** Là người dùng, tôi muốn chọn "Ghi nhớ đăng nhập" để không phải đăng nhập lại.
- **US-AUTH-006:** Là người dùng, tôi muốn đặt lại mật khẩu qua email khi quên.

### 2.3 Bảo mật
- **US-AUTH-007:** Là người dùng, tôi muốn đổi mật khẩu khi đã đăng nhập.
- **US-AUTH-008:** Là người dùng, tôi muốn đăng xuất khỏi tất cả thiết bị cùng lúc.
- **US-AUTH-009:** Hệ thống tự động logout khi access token hết hạn và refresh token không hợp lệ.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/auth/register` | Đăng ký tài khoản mới | No |
| POST | `/auth/login` | Đăng nhập email/password | No |
| POST | `/auth/logout` | Đăng xuất, revoke token | Yes |
| POST | `/auth/refresh` | Làm mới access token | No (refresh token) |
| GET | `/auth/verify-email?token=` | Xác thực email | No |
| POST | `/auth/forgot-password` | Gửi email reset password | No |
| POST | `/auth/reset-password` | Đặt lại mật khẩu | No |
| GET | `/auth/google` | Redirect sang Google OAuth | No |
| GET | `/auth/google/callback` | Callback từ Google | No |
| POST | `/auth/change-password` | Đổi mật khẩu | Yes |

---

## 4. Data Models

### User (Prisma)
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
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  refreshTokens   RefreshToken[]
  addresses       Address[]
  orders          Order[]
  reviews         Review[]
  wishlistItems   WishlistItem[]
}

enum Role { CUSTOMER ADMIN SUPER_ADMIN }
enum Provider { EMAIL GOOGLE FACEBOOK }

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## 5. Business Rules

- Access token TTL: **15 phút**
- Refresh token TTL: **30 ngày** (7 ngày nếu không chọn "ghi nhớ")
- Email verification token TTL: **24 giờ**
- Reset password token TTL: **1 giờ**
- Tối đa **5 lần đăng nhập sai** → lock tài khoản 15 phút
- Mật khẩu tối thiểu: **8 ký tự, có chữ hoa, số, ký tự đặc biệt**
- Giỏ hàng guest được **merge** vào tài khoản khi đăng nhập

---

## 6. Luồng xử lý chính

### Đăng ký → Xác thực Email
```
Client → POST /auth/register
  → Validate input
  → Hash password (bcrypt, rounds=12)
  → Tạo User (isEmailVerified=false)
  → Tạo emailVerificationToken
  → Gửi email xác thực (queue)
  → Trả về: { message: "Check your email" }

Client → GET /auth/verify-email?token=xxx
  → Verify token (không hết hạn)
  → Update User.isEmailVerified = true
  → Xóa token
  → Redirect về trang login
```

### Đăng nhập
```
Client → POST /auth/login
  → Tìm user theo email
  → So sánh password hash
  → Tạo accessToken (JWT, 15m)
  → Tạo refreshToken (lưu DB)
  → Set refreshToken vào httpOnly cookie
  → Trả về: { accessToken, user }
```
