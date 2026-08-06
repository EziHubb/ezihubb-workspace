# Module 02 — User Profile & Addresses

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/users/me` | Lấy profile hiện tại | Bearer |
| PATCH | `/api/v1/users/me` | Cập nhật profile | Bearer |
| POST | `/api/v1/users/me/avatar` | Upload avatar (multipart) | Bearer |
| DELETE | `/api/v1/users/me/avatar` | Xoá avatar | Bearer |
| GET | `/api/v1/users/me/addresses` | Danh sách địa chỉ | Bearer |
| POST | `/api/v1/users/me/addresses` | Tạo địa chỉ (max 10) | Bearer |
| PATCH | `/api/v1/users/me/addresses/{id}` | Cập nhật địa chỉ | Bearer |
| DELETE | `/api/v1/users/me/addresses/{id}` | Xoá địa chỉ | Bearer |
| PATCH | `/api/v1/users/me/addresses/{id}/default` | Đặt làm địa chỉ mặc định | Bearer |
| GET | `/api/v1/users/me/customization-history` | Lịch sử customization drafts (phân trang) | Bearer |
| GET | `/api/v1/users/me/wishlist` | Lấy wishlist (phân trang) | Bearer |
| GET | `/api/v1/users/me/wishlist/share` | Lấy trạng thái share wishlist hiện tại | Bearer |
| POST | `/api/v1/users/me/wishlist/share` | Bật chia sẻ wishlist (tạo share token) | Bearer |
| PATCH | `/api/v1/users/me/wishlist/share` | Cập nhật tên/visibility wishlist share | Bearer |
| DELETE | `/api/v1/users/me/wishlist/share` | Thu hồi link chia sẻ wishlist | Bearer |
| POST | `/api/v1/users/me/wishlist/{productId}` | Thêm vào wishlist | Bearer |
| DELETE | `/api/v1/users/me/wishlist/{productId}` | Xoá khỏi wishlist | Bearer |
| GET | `/api/v1/users/me/wishlist/{productId}` | Kiểm tra sản phẩm trong wishlist | Bearer |
| POST | `/api/v1/users/me/fcm-token` | Đăng ký FCM token thiết bị (max 5/user) | Bearer |
| DELETE | `/api/v1/users/me/fcm-token` | Huỷ đăng ký FCM token | Bearer |
| PATCH | `/api/v1/users/me/push-preferences` | Cập nhật tuỳ chọn push notification | Bearer |
| GET | `/api/v1/wishlist/{token}` | Wishlist chia sẻ công khai (no auth) | No |

**Lưu ý routing:** Các static routes (`/wishlist/share`) PHẢI đứng trước dynamic `/:productId` để tránh xung đột.

## 2. DTOs

### UserResponseDto
```typescript
interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### AuthUserDto (dùng trong auth responses)
```typescript
interface AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  storeId: string | null;
  isSeller: boolean;
  permissions: PermissionDocument | null;
}
```

### AddressDto
```typescript
interface AddressDto {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;  // default: "US"
  isDefault: boolean;
}
```

### WishlistItemDto
```typescript
interface WishlistItemDto {
  id: string;
  productId: string;
  addedAt: string;
  product: {
    id: string; name: string; slug: string;
    basePrice: number; imageUrl?: string; isActive: boolean;
  };
}
```

## 3. Prisma Models

```prisma
model Address {
  id           String  @id @default(cuid())
  userId       String
  fullName     String
  phone        String
  addressLine1 String
  addressLine2 String?
  city         String
  state        String?
  postalCode   String
  country      String  @default("US")
  isDefault    Boolean @default(false)
  createdAt    DateTime @default(now())
  user         User    @relation(fields: [userId], references: [id])
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  productId String
  createdAt DateTime @default(now())
  @@unique([userId, productId])
}

model WishlistShare {
  id        String   @id @default(cuid())
  userId    String   @unique
  token     String   @unique  // public share token
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}

model FcmToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   @default("web")
  lastSeen  DateTime @default(now())
  createdAt DateTime @default(now())
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String
  data      Json?
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
}
```

## 4. Avatar Upload

- Max size: 5MB
- Formats: JPG, PNG, WebP
- Upload qua multipart/form-data (`POST /users/me/avatar`), field name: `avatar`
- Xoá qua `DELETE /users/me/avatar`
- Lưu trữ trên Cloudflare R2 (dev: MinIO)
- Cập nhật `User.avatarUrl` sau upload
- Tự động xoá avatar cũ trên R2 trước khi upload mới

## 5. FCM Push Notifications

- `POST /users/me/fcm-token` — upsert token, enforce max 5 per user (oldest removed)
- `DELETE /users/me/fcm-token` — xoá token khi logout
- `PATCH /users/me/push-preferences` — bật/tắt push (`{ pushEnabled: boolean }`)
- Platform: `web` | `ios` | `android`
- Xem chi tiết: `24_fcm_low_stock.spec.md`

## 6. Business Rules

- Tối đa 10 địa chỉ mỗi user
- Xoá địa chỉ mặc định → địa chỉ đầu tiên còn lại thành mặc định
- Wishlist chỉ lưu productId (không lưu variant)
- Guest cố truy cập wishlist → 401, frontend redirect login
- Customization history: paginated (`?page=&limit=`) trả về `{ data, page, limit }`
- FCM: max 5 token/user, excess removed by `lastSeen` oldest first
- Wishlist share public page (noindex): 404 khi token invalid hoặc `isActive: false`

## 7. Account Pages (client)

Route group `(account)` dùng layout riêng với sidebar navigation.

- `/[locale]/account` — Dashboard overview
- `/[locale]/account/profile` — Profile + avatar + đổi mật khẩu
- `/[locale]/account/addresses` — Address book
- `/[locale]/account/orders` — Lịch sử đơn hàng
- `/[locale]/account/orders/{orderNumber}` — Chi tiết đơn hàng
- `/[locale]/account/wishlist` — Danh sách yêu thích
- `/[locale]/account/messages` — Message inbox (xem 21_messages.spec.md)
- `/[locale]/account/referrals` — Referral hub + tree (xem 22_affiliate_referral.spec.md)
- `/[locale]/account/affiliate` — Affiliate self-serve portal (xem 22_affiliate_referral.spec.md)
- `/[locale]/account/creator` — Creator Hub (xem 26_creator_network.spec.md)

File: `apps/client/src/app/[locale]/(account)/account/`
Layout client: `apps/client/src/app/[locale]/(account)/AccountLayoutClient.tsx`
Sidebar: `apps/client/src/components/account/AccountSidebar.tsx`

Public wishlist share: `/[locale]/wishlists/shared/{token}`
- SSR page (noindex)
- Hiển thị wishlist items `isActive: true` từ active products

## 8. Additional Endpoints

Xem full spec: `24_fcm_low_stock.spec.md`, `22_affiliate_referral.spec.md`
