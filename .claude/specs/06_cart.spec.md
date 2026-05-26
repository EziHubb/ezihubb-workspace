# Module 06 — Shopping Cart

## 1. Tổng quan

Quản lý giỏ hàng hỗ trợ cả **guest (session-based)** và **logged-in user (server-side)**. Giỏ hàng của guest được merge vào tài khoản khi đăng nhập.

---

## 2. User Stories

- **US-CART-001:** Là khách, tôi muốn thêm sản phẩm (với customization) vào giỏ hàng.
- **US-CART-002:** Là khách, tôi muốn xem giỏ hàng với ảnh preview customization, tên sản phẩm, giá, số lượng.
- **US-CART-003:** Là khách, tôi muốn thay đổi số lượng hoặc xóa sản phẩm trong giỏ.
- **US-CART-004:** Là khách, tôi muốn giỏ hàng còn nguyên khi tôi đóng tab và quay lại sau.
- **US-CART-005:** Là người dùng đăng nhập, giỏ hàng guest của tôi tự động merge vào tài khoản.
- **US-CART-006:** Là khách, tôi muốn thấy tổng tiền (subtotal), phí ship ước tính, và tổng cộng.
- **US-CART-007:** Là khách, tôi muốn nhập mã coupon và thấy số tiền được giảm ngay trong giỏ hàng.
- **US-CART-008:** Là khách, nếu sản phẩm không còn available, tôi được thông báo để xóa trước khi checkout.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/cart` | Lấy giỏ hàng hiện tại | No (session/token) |
| POST | `/cart/items` | Thêm item vào giỏ | No |
| PATCH | `/cart/items/:itemId` | Cập nhật số lượng | No |
| DELETE | `/cart/items/:itemId` | Xóa item | No |
| DELETE | `/cart` | Xóa toàn bộ giỏ hàng | No |
| POST | `/cart/merge` | Merge guest cart vào user | Yes |
| POST | `/cart/apply-coupon` | Áp dụng coupon | No |
| DELETE | `/cart/coupon` | Bỏ coupon | No |
| POST | `/cart/estimate-shipping` | Ước tính phí ship | No |

---

## 4. Data Models

```prisma
model Cart {
  id          String     @id @default(cuid())
  userId      String?    @unique
  user        User?      @relation(fields: [userId], references: [id])
  sessionId   String?    @unique   -- cho guest
  couponCode  String?
  discountAmount Decimal? @db.Decimal(10, 2)
  items       CartItem[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  expiresAt   DateTime?  -- guest cart expire sau 30 ngày
}

model CartItem {
  id                String   @id @default(cuid())
  cartId            String
  cart              Cart     @relation(fields: [cartId], references: [id])
  productId         String
  product           Product  @relation(fields: [productId], references: [id])
  variantId         String?
  variant           ProductVariant? @relation(fields: [variantId], references: [id])
  quantity          Int      @default(1)
  unitPrice         Decimal  @db.Decimal(10, 2)  -- snapshot giá lúc thêm
  customizationData Json?    -- toàn bộ customization
  previewUrl        String?  -- ảnh preview để hiển thị trong cart
  createdAt         DateTime @default(now())
}
```

---

## 5. Business Rules

- Guest cart lưu trên server (theo `sessionId` cookie), TTL **30 ngày**.
- User cart không expire.
- Khi merge: item guest **không trùng** → thêm vào; item **trùng sản phẩm + variant + customization** → cộng quantity.
- Mỗi cart tối đa **50 items**.
- `unitPrice` snapshot tại thời điểm thêm vào giỏ — giá thực tế tính lại lúc checkout.
- Nếu giá sản phẩm thay đổi trước khi checkout → hiển thị cảnh báo, cập nhật giá mới.
- Coupon validate khi apply và validate lại khi checkout.
- Cart item có customization: coi là **unique dù cùng product** nếu customization data khác nhau.
