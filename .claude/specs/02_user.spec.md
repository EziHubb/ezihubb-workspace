# Module 02 — User Profile & Account

## 1. Tổng quan

Quản lý hồ sơ cá nhân, danh sách địa chỉ giao hàng, wishlist và lịch sử hoạt động của khách hàng.

---

## 2. User Stories

### 2.1 Hồ sơ cá nhân
- **US-USER-001:** Là người dùng, tôi muốn xem và cập nhật thông tin cá nhân (tên, avatar, email).
- **US-USER-002:** Là người dùng, tôi muốn upload ảnh đại diện.
- **US-USER-003:** Là người dùng, tôi muốn xem toàn bộ lịch sử đơn hàng của mình.

### 2.2 Địa chỉ giao hàng
- **US-USER-004:** Là người dùng, tôi muốn thêm nhiều địa chỉ giao hàng.
- **US-USER-005:** Là người dùng, tôi muốn chọn một địa chỉ làm mặc định.
- **US-USER-006:** Là người dùng, tôi muốn sửa / xóa địa chỉ đã lưu.

### 2.3 Wishlist
- **US-USER-007:** Là người dùng, tôi muốn lưu sản phẩm yêu thích vào wishlist.
- **US-USER-008:** Là người dùng, tôi muốn xem và quản lý wishlist của mình.
- **US-USER-009:** Là người dùng, tôi muốn thêm sản phẩm từ wishlist thẳng vào giỏ hàng.

### 2.4 Tự động điền customization
- **US-USER-010:** Là người dùng, hệ thống nhớ lần customization cuối để tôi có thể auto-fill khi mua lại sản phẩm tương tự.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/users/me` | Lấy thông tin người dùng hiện tại | Yes |
| PATCH | `/users/me` | Cập nhật thông tin cá nhân | Yes |
| POST | `/users/me/avatar` | Upload avatar | Yes |
| GET | `/users/me/addresses` | Danh sách địa chỉ | Yes |
| POST | `/users/me/addresses` | Thêm địa chỉ | Yes |
| PATCH | `/users/me/addresses/:id` | Sửa địa chỉ | Yes |
| DELETE | `/users/me/addresses/:id` | Xóa địa chỉ | Yes |
| PATCH | `/users/me/addresses/:id/default` | Đặt làm mặc định | Yes |
| GET | `/users/me/wishlist` | Xem wishlist | Yes |
| POST | `/users/me/wishlist` | Thêm vào wishlist | Yes |
| DELETE | `/users/me/wishlist/:productId` | Xóa khỏi wishlist | Yes |
| GET | `/users/me/orders` | Lịch sử đơn hàng | Yes |
| GET | `/users/me/customization-history` | Lịch sử customization | Yes |

---

## 4. Data Models

```prisma
model Address {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  fullName     String
  phone        String
  addressLine1 String
  addressLine2 String?
  city         String
  state        String?
  postalCode   String
  country      String   @default("US")
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, productId])
}
```

---

## 5. Business Rules

- Mỗi user có tối đa **10 địa chỉ** lưu.
- Chỉ có **1 địa chỉ mặc định**; khi đặt mới thì tự động bỏ default của cái cũ.
- Avatar tối đa **5MB**, định dạng: `jpg`, `png`, `webp`.
- Wishlist không giới hạn số lượng sản phẩm.
- Customization history lưu **20 bản gần nhất** theo từng product template.
