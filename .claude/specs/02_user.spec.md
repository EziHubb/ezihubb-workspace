# Module 02 — User Profile & Addresses

## 1. Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/users/me` | Lấy profile hiện tại | Bearer |
| PATCH | `/api/v1/users/me` | Cập nhật profile | Bearer |
| POST | `/api/v1/users/me/avatar` | Upload avatar (multipart) | Bearer |
| GET | `/api/v1/users/me/addresses` | Danh sách địa chỉ | Bearer |
| POST | `/api/v1/users/me/addresses` | Tạo địa chỉ | Bearer |
| PATCH | `/api/v1/users/me/addresses/{id}` | Cập nhật địa chỉ | Bearer |
| DELETE | `/api/v1/users/me/addresses/{id}` | Xoá địa chỉ | Bearer |
| PATCH | `/api/v1/users/me/addresses/{id}/default` | Đặt làm địa chỉ mặc định | Bearer |
| GET | `/api/v1/users/me/wishlist` | Lấy wishlist | Bearer |
| POST | `/api/v1/users/me/wishlist/{productId}` | Thêm vào wishlist | Bearer |
| DELETE | `/api/v1/users/me/wishlist/{productId}` | Xoá khỏi wishlist | Bearer |
| GET | `/api/v1/users/me/orders` | Đơn hàng của tôi | Bearer |

## 2. DTOs

### UserDto
```typescript
interface UserDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  phone?: string;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  isEmailVerified: boolean;
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
  user         User    @relation(fields: [userId], references: [id])
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  productId String
  createdAt DateTime @default(now())
  @@unique([userId, productId])
}
```

## 4. Avatar Upload

- Max size: 5MB
- Formats: JPG, PNG, WebP
- Upload qua multipart/form-data
- Lưu trữ trên Cloudflare R2 (dev: MinIO)
- CDN URL từ `CDN_URL` env var
- Sau upload: cập nhật `User.avatarUrl`

## 5. Business Rules

- Tối đa 10 địa chỉ mỗi user
- Xoá địa chỉ mặc định → địa chỉ đầu tiên còn lại thành mặc định
- Wishlist chỉ lưu productId (không lưu variant)
- Guest cố truy cập wishlist → 401, frontend redirect login

## 6. Account Pages (client)

- `/[locale]/(account)/account` — Dashboard overview
- `/[locale]/(account)/account/profile` — Profile + avatar + đổi mật khẩu
- `/[locale]/(account)/account/addresses` — Address book
- `/[locale]/(account)/account/orders` — Lịch sử đơn hàng
- `/[locale]/(account)/account/wishlist` — Danh sách yêu thích

Route group `(account)` dùng layout riêng với sidebar navigation.
