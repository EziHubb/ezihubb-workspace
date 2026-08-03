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
| PATCH | `/admin/messages/conversations/{id}/status` | Cập nhật status (OPEN/PENDING/RESOLVED/SPAM) | ADMIN |
| POST | `/admin/messages/conversations/{id}/read` | Đánh dấu conversation đã đọc (admin) | ADMIN |

> **Lưu ý:** Admin reply dùng `SenderType.SHOP` (không phải `ADMIN` string).

## 3. Prisma Models

```prisma
enum ConversationStatus { OPEN PENDING RESOLVED SPAM }
enum SenderType         { CUSTOMER SHOP SYSTEM }

model Conversation {
  id               String             @id @default(cuid())
  userId           String?
  guestEmail       String?
  guestName        String?
  subject          String
  status           ConversationStatus @default(OPEN)
  orderId          String?            // optional: linked to order
  storeId          String?            // which store this conversation is with
  lastMessage      String?
  lastMessageAt    DateTime?
  unreadByAdmin    Int                @default(0)
  unreadByCustomer Int                @default(0)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  messages         Message[]
  user             User?              @relation(fields: [userId], references: [id])
  store            Store?             @relation(fields: [storeId], references: [id])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  senderType     SenderType
  senderId       String?      // userId nếu senderType=CUSTOMER; adminId nếu senderType=SHOP
  body           String
  attachmentUrls String[]     // up to 3 image attachments
  isRead         Boolean      @default(false)
  readAt         DateTime?
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

> **Lưu ý:** `unreadByAdmin`/`unreadByCustomer` là counter (Int), không phải boolean `isReadByAdmin`/`isReadByCustomer` như phiên bản trước. Conversation cũng lưu `storeId` để scope theo store.

## 4. DTOs

### CreateConversationDto (customer)
```typescript
interface CreateConversationDto {
  subject?: string;    // optional, max 200 chars
  body: string;        // required, 1-5000 chars
  orderId?: string;
  guestEmail?: string; // optional (IsEmail); not enforced-required at DTO level even for guests
  guestName?: string;  // max 100 chars
}
```

### SendMessageDto
```typescript
interface SendMessageDto {
  body: string;        // 1-5000 chars
  attachmentUrls?: string[]; // must be valid URLs (IsUrl each); no server-side count limit in DTO
}
```

### ConversationDto
```typescript
interface ConversationDto {
  id: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'SPAM';
  orderId?: string;
  storeId?: string;
  unreadByAdmin: number;
  unreadByCustomer: number;
  createdAt: string;
  updatedAt: string;
  messages?: MessageDto[];
}

interface MessageDto {
  id: string;
  senderType: 'CUSTOMER' | 'SHOP' | 'SYSTEM';
  body: string;
  attachmentUrls: string[];
  createdAt: string;
}
```

## 5. Email & Push Notifications

- **Customer gửi conversation / reply** → `notifications.sendNewMessageNotification()` (fire-and-forget) thông báo cho phía shop/admin
- **Admin/shop reply** → `sendNewMessageNotification()` gửi tới `conversation.user.email` hoặc `guestEmail`
- **Admin reply + conversation có `userId`** → thêm push notification qua `PushService.notifyNewMessage()` (FCM, fire-and-forget)
- Gọi qua `NotificationsService`/`PushService` — chi tiết provider/queue implementation nằm trong module `notifications` (xem spec 24)
- **Message moderation**: mỗi message gửi đi được queue qua `ModerationService.queueMessageModeration()` (optional dependency, fire-and-forget) — xem spec moderation

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

## 8. Admin Store Scoping

Admin messages controller uses `resolveSellerStoreId()` — ADMIN role only sees conversations for their own store; SUPER_ADMIN sees all conversations.

## 9. Business Rules

- Guest user có thể gửi conversation (guestEmail optional ở DTO level, không bắt buộc phải có)
- Authenticated user gửi từ account → linked với `userId`
- Conversation tăng `unreadByAdmin` khi customer gửi/reply; tăng `unreadByCustomer` khi admin reply
- Đánh dấu đã đọc: reset counter về 0 + `Message.isRead = true, readAt = now()` cho các message phía ngược lại
- Admin inbox badge đếm conversations có `unreadByAdmin > 0`
- Không có xoá/archive cứng — status `SPAM` hoặc `RESOLVED` dùng để dọn dẹp inbox thay vì xoá
- Image upload trong message: field `attachmentUrls` (URL only, `IsUrl` validation), lưu R2; comment trong schema ghi "up to 3" nhưng không có giới hạn cứng ở DTO/service

## 10. File Structure (API)

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
