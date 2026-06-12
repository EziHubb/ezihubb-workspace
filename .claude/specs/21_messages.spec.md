# Module 21 — Messages System

## 1. Tổng quan

Hệ thống tin nhắn hai chiều giữa customer và admin (MSG-01 đến MSG-05). Customer gửi tin nhắn, admin reply từ inbox riêng, có email notification khi có tin nhắn mới.

## 2. API Endpoints

### Customer Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/messages` | Gửi tin nhắn mới cho shop | Bearer / Optional |
| GET | `/api/v1/messages/me` | Lấy toàn bộ thread của tôi (phân trang) | Bearer |
| GET | `/api/v1/messages/me/{threadId}` | Chi tiết thread + replies | Bearer |
| POST | `/api/v1/messages/me/{threadId}/reply` | Customer reply trong thread | Bearer |
| PATCH | `/api/v1/messages/me/{threadId}/read` | Đánh dấu thread đã đọc | Bearer |

### Admin Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/messages` | All message threads (phân trang, filter) | ADMIN |
| GET | `/api/v1/admin/messages/{threadId}` | Chi tiết thread + toàn bộ messages | ADMIN |
| POST | `/api/v1/admin/messages/{threadId}/reply` | Admin reply vào thread | ADMIN |
| PATCH | `/api/v1/admin/messages/{threadId}/status` | Cập nhật status (OPEN/CLOSED/ARCHIVED) | ADMIN |

## 3. Prisma Models

```prisma
enum MessageThreadStatus { OPEN CLOSED ARCHIVED }
enum MessageSender       { CUSTOMER ADMIN }

model MessageThread {
  id          String              @id @default(cuid())
  userId      String?
  guestEmail  String?
  guestName   String?
  subject     String
  status      MessageThreadStatus @default(OPEN)
  orderId     String?             // optional: linked to order
  isReadByAdmin    Boolean        @default(false)
  isReadByCustomer Boolean        @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  messages    Message[]
  user        User?               @relation(fields: [userId], references: [id])
}

model Message {
  id        String        @id @default(cuid())
  threadId  String
  sender    MessageSender
  senderId  String?       // userId if sender=CUSTOMER; adminId if sender=ADMIN
  body      String
  imageUrls String[]
  createdAt DateTime      @default(now())
  thread    MessageThread @relation(fields: [threadId], references: [id])
}
```

## 4. DTOs

### CreateMessageDto (customer)
```typescript
interface CreateMessageDto {
  subject: string;     // max 200 chars
  body: string;        // max 5000 chars
  orderId?: string;
  guestEmail?: string; // required if not authenticated
  guestName?: string;
}
```

### MessageThreadDto
```typescript
interface MessageThreadDto {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  orderId?: string;
  isReadByAdmin: boolean;
  isReadByCustomer: boolean;
  lastMessageAt: string;
  createdAt: string;
  messages?: MessageDto[];
}

interface MessageDto {
  id: string;
  sender: 'CUSTOMER' | 'ADMIN';
  body: string;
  imageUrls: string[];
  createdAt: string;
}
```

## 5. Email Notifications

- **Customer gửi tin nhắn** → email notification đến admin (`ADMIN_NEW_MESSAGE` type)
- **Admin reply** → email notification đến customer
- Queue: `email-queue` (BullMQ)
- Templates Handlebars: `new-message-admin.hbs`, `message-reply-customer.hbs`

## 6. Admin Inbox UI

File: `apps/admin/src/app/(admin)/messages/page.tsx`

Features:
- Thread list với unread badge
- Filter: OPEN / CLOSED / ARCHIVED
- Thread detail panel (drawer hoặc split view)
- Reply form với markdown support
- Status change dropdown

## 7. Client Inbox UI

File: `apps/client/src/app/[locale]/(account)/account/messages/page.tsx`

Features:
- Thread list với timestamps
- Thread detail page với conversation view
- Reply form
- New message modal (contact form)

## 8. Business Rules

- Guest user có thể gửi tin nhắn (cần email)
- Authenticated user gửi từ account → linked với userId
- Thread tự động đánh dấu `isReadByAdmin: false` khi customer gửi/reply
- Thread tự động đánh dấu `isReadByCustomer: false` khi admin reply
- Admin inbox badge đếm threads có `isReadByAdmin: false`
- Xoá thread: chỉ ADMIN (soft delete không cần thiết — archive thay thế)
- Image upload trong message: max 5 ảnh, 10MB, lưu R2
