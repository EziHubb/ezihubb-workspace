# Module 21 — Messages System

## 1. Tổng quan

Hệ thống tin nhắn hai chiều giữa customer và admin/shop. Customer gửi conversation, shop reply từ admin inbox, có email notification khi có tin nhắn mới. Dùng thuật ngữ **conversation** (không phải thread) trong API.

## 2. API Endpoints

### Customer Endpoints (prefix `/api/v1/messages`)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/messages/conversations` | Bắt đầu conversation mới | Optional (guest hoặc Bearer) |
| GET | `/messages/conversations` | Lấy danh sách conversations của tôi | Bearer |
| GET | `/messages/conversations/{id}` | Chi tiết conversation + messages | Optional |
| POST | `/messages/conversations/{id}/messages` | Gửi message trong conversation | Optional |
| POST | `/messages/conversations/{id}/read` | Đánh dấu conversation đã đọc | Bearer |

### Admin Endpoints (prefix `/api/v1/admin/messages`)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/admin/messages/conversations` | List tất cả conversations (phân trang, filter) | ADMIN |
| GET | `/admin/messages/conversations/{id}` | Chi tiết conversation + toàn bộ messages | ADMIN |
| POST | `/admin/messages/conversations/{id}/messages` | Admin reply vào conversation | ADMIN |
| PATCH | `/admin/messages/conversations/{id}/status` | Cập nhật status (OPEN/CLOSED/ARCHIVED) | ADMIN |
| POST | `/admin/messages/conversations/{id}/read` | Đánh dấu conversation đã đọc (admin) | ADMIN |

> **Lưu ý:** Admin reply dùng `SenderType.SHOP` (không phải `ADMIN` string).

## 3. Prisma Models

```prisma
enum ConversationStatus { OPEN CLOSED ARCHIVED }
enum SenderType         { CUSTOMER SHOP }

model Conversation {
  id               String             @id @default(cuid())
  userId           String?
  guestEmail       String?
  guestName        String?
  subject          String
  status           ConversationStatus @default(OPEN)
  orderId          String?            // optional: linked to order
  isReadByAdmin    Boolean            @default(false)
  isReadByCustomer Boolean            @default(true)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  messages         Message[]
  user             User?              @relation(fields: [userId], references: [id])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  sender         SenderType
  senderId       String?      // userId nếu sender=CUSTOMER; adminId nếu sender=SHOP
  body           String
  imageUrls      String[]
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}
```

## 4. DTOs

### CreateConversationDto (customer)
```typescript
interface CreateConversationDto {
  subject: string;     // max 200 chars
  body: string;        // max 5000 chars
  orderId?: string;
  guestEmail?: string; // required nếu chưa authenticated
  guestName?: string;
}
```

### SendMessageDto
```typescript
interface SendMessageDto {
  body: string;        // max 5000 chars
  imageUrls?: string[];
}
```

### ConversationDto
```typescript
interface ConversationDto {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  orderId?: string;
  isReadByAdmin: boolean;
  isReadByCustomer: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: MessageDto[];
}

interface MessageDto {
  id: string;
  sender: 'CUSTOMER' | 'SHOP';
  body: string;
  imageUrls: string[];
  createdAt: string;
}
```

## 5. Email Notifications

- **Customer gửi conversation** → email notification đến admin (`ADMIN_NEW_MESSAGE` type)
- **Admin reply** → email notification đến customer
- Queue: `email-queue` (BullMQ)
- Templates Handlebars: `new-message-admin.hbs`, `message-reply-customer.hbs`

## 6. Admin Inbox UI

File: `apps/admin/src/app/(admin)/messages/page.tsx`

Features:
- Conversation list với unread badge
- Filter: OPEN / CLOSED / ARCHIVED
- Conversation detail panel (drawer hoặc split view)
- Reply form
- Status change dropdown

## 7. Client Inbox UI

File: `apps/client/src/app/[locale]/(account)/account/messages/page.tsx`

Features:
- Conversation list với timestamps
- Conversation detail với conversation view
- Reply form
- New message modal (contact form)

## 8. Business Rules

- Guest user có thể gửi conversation (cần email)
- Authenticated user gửi từ account → linked với `userId`
- Conversation tự động set `isReadByAdmin: false` khi customer gửi/reply
- Conversation tự động set `isReadByCustomer: false` khi admin reply
- Admin inbox badge đếm conversations có `isReadByAdmin: false`
- Xoá conversation: chỉ ADMIN (archive thay thế cho soft delete)
- Image upload trong message: max 5 ảnh, 10MB, lưu R2

## 9. File Structure (API)

```
apps/api/src/modules/messages/
  messages.module.ts
  messages.service.ts
  messages.controller.ts          # Customer endpoints
  admin-messages.controller.ts    # Admin endpoints
  dto/
    create-conversation.dto.ts
    send-message.dto.ts
    admin-conversation-query.dto.ts
    update-conversation-status.dto.ts
```
