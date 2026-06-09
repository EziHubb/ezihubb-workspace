import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, SenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

const CONVERSATION_INCLUDE = {
  messages: {
    orderBy: { createdAt: 'asc' as const },
    take: 100,
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
  order: { select: { id: true, orderNumber: true } },
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly notifications:  NotificationsService,
    private readonly pushService:    PushService,
  ) {}

  async createConversation(userId: string | null, dto: CreateConversationDto) {
    const { orderId, subject, guestEmail, guestName, body, ..._ } = dto;

    const conversation = await this.prisma.conversation.create({
      data: {
        ...(userId && { userId }),
        ...(orderId && { orderId }),
        subject,
        guestEmail: userId ? undefined : guestEmail,
        guestName:  userId ? undefined : guestName,
        status: ConversationStatus.OPEN,
        lastMessage: body,
        lastMessageAt: new Date(),
        unreadByAdmin: 1,
        messages: {
          create: {
            senderType: SenderType.CUSTOMER,
            senderId: userId ?? null,
            body,
          },
        },
      },
      include: {
        ...CONVERSATION_INCLUDE,
        user:  { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });

    // Notify admin of new conversation (fire-and-forget)
    this.notifications.sendNewMessageNotification({
      senderType:     'CUSTOMER',
      senderName:     conversation.user?.firstName ?? conversation.guestName ?? conversation.guestEmail ?? 'Guest',
      recipientEmail: '',
      messagePreview: body.slice(0, 200) + (body.length > 200 ? '...' : ''),
      orderNumber:    conversation.order?.orderNumber ?? undefined,
      orderId:        conversation.orderId ?? undefined,
    }).catch((err: unknown) => this.logger.warn(`Email notification failed: ${String(err)}`));

    return conversation;
  }

  async sendMessage(
    conversationId: string,
    senderType: SenderType,
    senderId: string | null,
    dto: SendMessageDto,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user:  { select: { email: true, firstName: true } },
        order: { select: { orderNumber: true } },
      },
    });
    if (!conversation) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });

    const isCustomer = senderType === SenderType.CUSTOMER;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderType,
          senderId,
          body: dto.body,
          attachmentUrls: dto.attachmentUrls ?? [],
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: dto.body,
          lastMessageAt: new Date(),
          ...(isCustomer
            ? { unreadByAdmin: { increment: 1 } }
            : { unreadByCustomer: { increment: 1 } }),
        },
      }),
    ]);

    // Fire email notification (non-blocking)
    const recipientEmail = isCustomer
      ? undefined
      : (conversation.user?.email ?? conversation.guestEmail ?? undefined);

    if (recipientEmail !== undefined || isCustomer) {
      this.notifications.sendNewMessageNotification({
        senderType:     isCustomer ? 'CUSTOMER' : 'SHOP',
        senderName:     conversation.user?.firstName ?? conversation.guestEmail ?? 'Guest',
        recipientEmail: recipientEmail ?? '',
        messagePreview: dto.body.slice(0, 200) + (dto.body.length > 200 ? '...' : ''),
        orderNumber:    conversation.order?.orderNumber ?? undefined,
        orderId:        conversation.orderId ?? undefined,
      }).catch((err: unknown) => this.logger.warn(`Email notification failed: ${String(err)}`));
    }

    // Push notification to customer when shop replies (fire-and-forget)
    if (!isCustomer && conversation.userId) {
      this.pushService
        .notifyNewMessage(conversation.userId, conversationId)
        .catch((err: unknown) =>
          this.logger.warn(`Push notify failed for conversation ${conversationId}: ${String(err)}`),
        );
    }

    return message;
  }

  async getMyConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  async getConversation(conversationId: string, userId: string | null) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });

    if (userId && conversation.userId && conversation.userId !== userId) {
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN', message: 'Access denied' });
    }

    return conversation;
  }

  async markCustomerRead(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadByCustomer: 0 },
    });
    await this.prisma.message.updateMany({
      where: { conversationId, senderType: { not: SenderType.CUSTOMER }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async adminListConversations(query: AdminConversationQueryDto) {
    const { status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' as const } },
          { guestEmail: { contains: search, mode: 'insensitive' as const } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          order: { select: { id: true, orderNumber: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async adminGetConversation(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    return conversation;
  }

  async adminUpdateStatus(conversationId: string, status: ConversationStatus) {
    const exists = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  async markAdminRead(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadByAdmin: 0 },
    });
    await this.prisma.message.updateMany({
      where: { conversationId, senderType: SenderType.CUSTOMER, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }
}
