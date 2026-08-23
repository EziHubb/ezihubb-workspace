import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { ConversationStatus, SenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import type { AdminConversationFolder } from './dto/admin-conversation-query.dto';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/** Not in the working inbox: filed away, junk, or deleted. One list so the
 *  folder filter and the folder counts cannot drift apart. */
const OUT_OF_INBOX: ConversationStatus[] = [
  ConversationStatus.ARCHIVED,
  ConversationStatus.SPAM,
  ConversationStatus.TRASHED,
];

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
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  async createConversation(userId: string | null, dto: CreateConversationDto) {
    const { orderId, subject, guestEmail, guestName, body, ..._ } = dto;

    // Resolve storeId from the order's storeOrders (single-store orders only)
    let storeId: string | undefined;
    if (orderId) {
      const storeOrders = await this.prisma.storeOrder.findMany({
        where:  { orderId },
        select: { storeId: true },
        take:   2,
      });
      if (storeOrders.length === 1) storeId = storeOrders[0].storeId;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        ...(userId && { userId }),
        ...(orderId && { orderId }),
        ...(storeId && { storeId }),
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

  /** storeId only supplied for the admin/shop-reply path — undefined for customer-facing calls (no store ownership concept there). */
  async sendMessage(
    conversationId: string,
    senderType: SenderType,
    senderId: string | null,
    dto: SendMessageDto,
    storeId?: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user:  { select: { email: true, firstName: true } },
        order: { select: { orderNumber: true } },
      },
    });
    if (!conversation || (storeId !== undefined && conversation.storeId !== storeId)) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }

    const isCustomer = senderType === SenderType.CUSTOMER;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderType,
          senderId,
          body: dto.body,
          attachmentUrls: dto.attachmentUrls ?? [],
          attachedProductId: dto.attachedProductId ?? null,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: dto.body,
          lastMessageAt: new Date(),
          ...(isCustomer
            ? { unreadByAdmin: { increment: 1 } }
            // Set on every shop reply, not only the first: it is a flag, and
            // writing it unconditionally is cheaper than reading it to decide.
            // Without this the Sent folder and the reply arrow on each inbox
            // row would only ever reflect the migration's backfill.
            : { unreadByCustomer: { increment: 1 }, hasSellerReplied: true }),
        },
      }),
    ]);

    // fire-and-forget
    this.moderationService?.queueMessageModeration(message.id).catch((e) => this.logger.error('mod queue failed', e));

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

  /**
   * Turns a folder name into a filter.
   *
   * Trash is the only folder that shows trashed threads, and every other one
   * excludes them — including "All", which means "everything still in the
   * mailbox". A bin that leaks into every view is not a bin.
   */
  private folderWhere(folder: AdminConversationFolder = 'inbox') {
    const notTrashed = { status: { not: ConversationStatus.TRASHED } };

    switch (folder) {
      case 'trash':   return { status: ConversationStatus.TRASHED };
      case 'spam':    return { status: ConversationStatus.SPAM };
      case 'starred': return { ...notTrashed, isStarred: true };
      case 'unread':  return { ...notTrashed, unreadByAdmin: { gt: 0 } };
      case 'sent':    return { ...notTrashed, hasSellerReplied: true };
      // A thread attached to an order is help with that order; one without is
      // from someone who has not bought yet. The order link is the only real
      // signal either way.
      case 'order_help':         return { ...notTrashed, orderId: { not: null } };
      case 'prospective_buyers': return { ...notTrashed, orderId: null };
      case 'from_platform':      return { ...notTrashed, messages: { some: { senderType: SenderType.SYSTEM } } };
      case 'all':     return notTrashed;
      case 'inbox':
      default:
        // The working folder: not filed away, not junk, not deleted.
        return { status: { notIn: OUT_OF_INBOX } };
    }
  }

  async adminListConversations(query: AdminConversationQueryDto, storeId?: string) {
    const { status, search, folder, labelIds, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(storeId !== undefined && { storeId }),
      ...this.folderWhere(folder),
      // An explicit status overrides the folder's own — used by the status
      // dropdown, which is a different control from the folder list.
      ...(status && { status }),
      // AND, not OR: picking two labels means threads carrying both, which is
      // how a label filter narrows rather than widens.
      ...(labelIds?.length && {
        AND: labelIds.map((id) => ({ labels: { some: { labelId: id } } })),
      }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' as const } },
          { guestEmail: { contains: search, mode: 'insensitive' as const } },
          { lastMessage: { contains: search, mode: 'insensitive' as const } },
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
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          order: { select: { id: true, orderNumber: true } },
          labels: { include: { label: { select: { id: true, name: true, color: true } } } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: items.map((c) => ({ ...c, labels: c.labels.map((l) => l.label) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * The number beside each folder in the sidebar.
   *
   * Counted in one round trip rather than ten: the folders are all filters
   * over the same small set of columns, so a single fetch of those columns and
   * a pass in memory beats ten COUNT queries a shop hits on every inbox open.
   * Threads carrying a SYSTEM message are the one folder that cannot be
   * answered from those columns, so it gets its own count.
   */
  async adminFolderCounts(storeId?: string) {
    const scope     = storeId !== undefined ? { storeId } : {};
    const notTrashed = { ...scope, status: { not: ConversationStatus.TRASHED } };

    // Counted in the database, one indexed COUNT per folder.
    //
    // An earlier version fetched every conversation's columns and tallied them
    // in memory to save round trips. That is fine at ten threads and quietly
    // terrible at fifty thousand: the inbox is opened constantly, and the cost
    // grows with the shop's whole history rather than with what is on screen.
    // Ten small counts in one transaction is the cheaper trade at every size
    // that matters.
    const [inbox, starred, orderHelp, prospective, fromPlatform, sent, all, unread, spam, trash] =
      await this.prisma.$transaction([
        this.prisma.conversation.count({ where: { ...scope, status: { notIn: OUT_OF_INBOX } } }),
        this.prisma.conversation.count({ where: { ...notTrashed, isStarred: true } }),
        this.prisma.conversation.count({ where: { ...notTrashed, orderId: { not: null } } }),
        this.prisma.conversation.count({ where: { ...notTrashed, orderId: null } }),
        this.prisma.conversation.count({ where: { ...notTrashed, messages: { some: { senderType: SenderType.SYSTEM } } } }),
        this.prisma.conversation.count({ where: { ...notTrashed, hasSellerReplied: true } }),
        this.prisma.conversation.count({ where: notTrashed }),
        this.prisma.conversation.count({ where: { ...notTrashed, unreadByAdmin: { gt: 0 } } }),
        this.prisma.conversation.count({ where: { ...scope, status: ConversationStatus.SPAM } }),
        this.prisma.conversation.count({ where: { ...scope, status: ConversationStatus.TRASHED } }),
      ]);

    return {
      inbox, starred, order_help: orderHelp, prospective_buyers: prospective,
      from_platform: fromPlatform, sent, all, unread, spam, trash,
    };
  }

  async adminGetConversation(conversationId: string, storeId?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        ...CONVERSATION_INCLUDE,
        // The shop side needs more than the buyer's view: the product card on
        // a shared listing, and the thread's labels for the detail toolbar.
        // Price comes from the product row, live, so a card never quotes a
        // price the shop has since changed.
        messages: {
          orderBy: { createdAt: 'asc' as const },
          take: 100,
          include: {
            attachedProduct: {
              select: {
                id: true, name: true, slug: true, basePrice: true, compareAtPrice: true,
                images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
        },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
      },
    });
    if (!conversation || (storeId !== undefined && conversation.storeId !== storeId)) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }

    return {
      ...conversation,
      labels: conversation.labels.map((l) => l.label),
      messages: conversation.messages.map((m) => ({
        ...m,
        attachedProduct: m.attachedProduct && {
          id:   m.attachedProduct.id,
          name: m.attachedProduct.name,
          slug: m.attachedProduct.slug,
          price:        Number(m.attachedProduct.basePrice),
          compareAtPrice: m.attachedProduct.compareAtPrice ? Number(m.attachedProduct.compareAtPrice) : null,
          imageUrl:     m.attachedProduct.images[0]?.url ?? null,
        },
      })),
    };
  }

  async adminUpdateStatus(conversationId: string, status: ConversationStatus, storeId?: string) {
    const exists = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, storeId: true } });
    if (!exists || (storeId !== undefined && exists.storeId !== storeId)) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  async markAdminRead(conversationId: string, storeId?: string) {
    if (storeId !== undefined) {
      const exists = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { storeId: true } });
      if (!exists || exists.storeId !== storeId) {
        throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
      }
    }
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
