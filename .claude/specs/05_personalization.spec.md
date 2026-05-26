# Module 05 — Personalization Engine (Customizer)

## 1. Tổng quan

**Đây là module cốt lõi, tạo ra sự khác biệt của MapleLoomHandmade.** Cho phép khách hàng tùy chỉnh sản phẩm trực tiếp trên trình duyệt: nhập text, upload ảnh, chọn style nghệ thuật, xem preview real-time trước khi đặt hàng.

**Stack (Frontend):** Fabric.js hoặc Konva.js (canvas) trên Next.js  
**Stack (Backend):** NestJS + Bull Queue + Sharp (xử lý ảnh) + AI service (background removal)

---

## 2. User Stories

### 2.1 Customizer UI
- **US-CUST-001:** Là khách, tôi muốn thấy canvas preview sản phẩm cập nhật real-time khi tôi nhập thông tin.
- **US-CUST-002:** Là khách, tôi muốn upload ảnh từ máy tính hoặc điện thoại để personalize sản phẩm.
- **US-CUST-003:** Là khách, tôi muốn xoay/zoom/crop ảnh trong tool trước khi xác nhận.
- **US-CUST-004:** Là khách, tôi muốn dùng tính năng "Remove Background" để tách nền ảnh tự động.
- **US-CUST-005:** Là khách, tôi muốn chọn art style (Watercolor, Van Gogh, Cartoon...) cho ảnh của mình.
- **US-CUST-006:** Là khách, tôi muốn nhập tên, ngày tháng, lời nhắn để in lên sản phẩm.
- **US-CUST-007:** Là khách, tôi muốn click "Preview" để xem bản preview chất lượng cao sau 20–30 giây.
- **US-CUST-008:** Là khách, tôi muốn được hỏi có muốn auto-fill customization từ lần trước không (nếu đã đăng nhập).
- **US-CUST-009:** Là khách, nếu upload ảnh thất bại, tôi vẫn có thể checkout và gửi ảnh sau qua email.

### 2.2 Xử lý hình ảnh (Backend)
- **US-CUST-010:** Hệ thống tự động xử lý ảnh upload: resize, compress, lưu S3.
- **US-CUST-011:** Hệ thống generate preview image bằng cách composite ảnh khách lên template.
- **US-CUST-012:** Hệ thống lưu customization data cùng với order item khi khách checkout.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/customization/upload-image` | Upload ảnh tạm thời | No |
| POST | `/customization/remove-background` | Xóa background ảnh | No |
| POST | `/customization/generate-preview` | Tạo preview image | No |
| POST | `/customization/apply-art-style` | Apply AI art style | No |
| GET | `/customization/templates/:templateId` | Lấy template config | No |
| POST | `/customization/save-draft` | Lưu nháp (đã đăng nhập) | Yes |
| GET | `/customization/last/:productId` | Lấy customization cuối | Yes |

---

## 4. Data Models

```prisma
model CustomizationData {
  id          String    @id @default(cuid())
  userId      String?
  sessionId   String?   -- cho guest
  productId   String
  variantId   String?
  templateId  String
  data        Json      -- toàn bộ customization fields
  previewUrl  String?   -- URL ảnh preview đã generate
  uploadedImages Json?  -- danh sách ảnh đã upload (S3 keys)
  createdAt   DateTime  @default(now())
  expiresAt   DateTime  -- tự xóa sau 7 ngày nếu không checkout

  @@index([userId, productId])
  @@index([sessionId])
}
```

### Cấu trúc `data` (JSON lưu trong order item)
```json
{
  "templateId": "tmpl_mug_001",
  "fields": {
    "name_text": "John & Sarah",
    "anniversary_date": "June 12, 2019",
    "photo_upload": "s3://mlh-uploads/uuid-photo.png",
    "photo_processed": "s3://mlh-processed/uuid-photo-nobg.png",
    "style_select": "Watercolor",
    "message_text": "Happy Anniversary!"
  },
  "previewUrl": "s3://mlh-previews/uuid-preview.jpg",
  "variantOptions": {
    "size": "11oz",
    "color": "White"
  }
}
```

---

## 5. Luồng Customizer (Frontend → Backend)

```
1. Khách mở trang sản phẩm
   └── Load customizationConfig từ Product
   └── Khởi tạo canvas (Fabric.js/Konva.js)
   └── Nếu đã login → hỏi auto-fill từ lần trước

2. Khách tương tác
   ├── Nhập text → Real-time render lên canvas
   ├── Upload ảnh
   │   ├── POST /customization/upload-image
   │   └── Nhận tempImageUrl → Render lên canvas
   ├── Remove Background
   │   ├── POST /customization/remove-background { imageKey }
   │   ├── Trả về Job ID
   │   └── Poll /job/:id → nhận processed image URL
   └── Chọn art style → POST /customization/apply-art-style

3. Click "Preview"
   └── POST /customization/generate-preview
       { templateId, fields, uploadedImages }
   └── Hiện loading spinner (20-30 giây)
   └── Hiện preview image chất lượng cao

4. "Add to Cart"
   └── Đính kèm customizationData vào cart item
   └── Preview URL lưu cùng để hiển thị trong cart/order
```

---

## 6. Xử lý ảnh Upload

```
Upload Flow:
Client → POST /customization/upload-image (multipart)
  → Validate (max 10MB, jpg/png/webp/heic)
  → Convert to webp nếu cần (Sharp)
  → Resize nếu > 3000px (Sharp, giữ ratio)
  → Upload lên S3 (key: uploads/{uuid}.webp)
  → Trả về { tempKey, tempUrl, width, height }

Temp images → xóa sau 24h nếu không gắn vào order
Order images → chuyển sang permanent prefix khi checkout
```

---

## 7. Business Rules

- Ảnh upload tối đa **10MB**, chấp nhận: `jpg`, `png`, `webp`, `heic`.
- Background removal sử dụng queue (Bull), timeout **60 giây**.
- Nếu remove background fail → thông báo và cho phép dùng ảnh gốc.
- Preview generation chạy server-side (Sharp composite) + AI style nếu chọn.
- Customization data được **lưu vào order item** khi checkout — không bao giờ bị mất.
- Guest checkout: lưu customization theo `sessionId`, merge vào account khi đăng ký/đăng nhập.
- Fallback: nếu upload ảnh fail hoàn toàn → khách có thể checkout rồi gửi ảnh qua email, order sẽ được **manually processed**.

---

## 8. Cấu trúc Template (Admin tạo)

Template là file config xác định:
- Vị trí và kích thước từng field trên canvas
- Layer stack của sản phẩm (base image, overlay, text areas)
- Giới hạn và validation từng field
- Mockup ảnh nền để preview

Admin tạo template qua **Admin UI với visual editor** (kéo thả field lên canvas).
