import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { Prisma, ConversationStatus, ConversationReportReason, SenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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

/**
 * The window of a thread that comes back on one fetch.
 *
 * It has to be taken from the NEWEST end. Reading ascending and capping was
 * fine while a thread was one order long; it is not now that a thread is a
 * whole relationship, where the 101st message means the buyer stops seeing
 * anything said this year and the shop answers a question that is off screen.
 * Fetched descending and reversed, so the order on the wire is still oldest
 * first and no renderer had to change.
 */
const MESSAGE_WINDOW = 100;

/**
 * What may be attached to a message.
 *
 * Wider than the product-image allowlist on purpose — a buyer sending a brief
 * and a seller sending a proof both mean a PDF, and refusing one made the
 * feature answer a different question than the one people had.
 *
 * SVG is deliberately absent and must stay absent. It is an image to a
 * renderer and a script host to a browser, and these files are served from our
 * own origin to the other party in the conversation.
 */
const MESSAGE_ATTACHMENT_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);
export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Matches Message.attachmentUrls' documented ceiling and both composers'. */
export const MAX_MESSAGE_ATTACHMENTS = 3;

/** Default size of a "load older" page. Smaller than the first window: the
 *  reader has already decided to go digging, and a smaller page scrolls back
 *  to where they were with less of a jump. */
const MESSAGE_PAGE = 50;

const oldestFirst = <T extends { createdAt: Date }>(messages: T[]): T[] =>
  [...messages].reverse();

/**
 * One extra row, so "is there more" is an answer rather than a guess.
 *
 * Taking exactly the window size and reporting `length === window` is wrong on
 * the thread that happens to hold exactly 100 messages: the client would offer
 * "load earlier", fetch nothing, and offer it again. Asking for one more and
 * throwing it away costs a single row and makes the flag exact.
 */
const TAKE_WITH_PROBE = MESSAGE_WINDOW + 1;

const CONVERSATION_INCLUDE = {
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: TAKE_WITH_PROBE,
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
  order: { select: { id: true, orderNumber: true } },
  /**
   * The shop the buyer is talking to.
   *
   * `slug` so the storefront can link its name and picture back to the shop
   * page — a buyer expects the shop's avatar to be a way in, and it was inert
   * markup. `ownerId` because presence is per user: the shop is "online" when
   * the person who owns it is, and the buyer may query exactly that id (they
   * share this conversation, which is what visibleTo authorises on).
   */
  store: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
};

/**
 * Empties out what the shop took back, on the way out of the API.
 *
 * The row keeps its body in the database — a moderation report about a message
 * that no longer exists is unanswerable, and the shop should not be able to
 * erase what it said. But "hidden by the renderer" is not hidden: the text was
 * still in the JSON, so anyone who opened the network tab could read a message
 * that had been unsent from them, which is the entire thing the feature is
 * supposed to prevent.
 *
 * Attachments go the same way. An unsent message whose picture still loads
 * has not been unsent.
 */
function redactUnsent<T extends { deletedAt?: Date | null; body?: string; attachmentUrls?: string[] }>(
  messages: T[],
): T[] {
  return messages.map((m) =>
    m.deletedAt ? { ...m, body: '', attachmentUrls: [] } : m,
  );
}

/** The attached listing as Prisma returns it, before it is flattened. */
type RawAttachedProduct = {
  id: string; name: string; slug: string;
  basePrice: unknown; compareAtPrice: unknown;
  images: { url: string }[];
};

/**
 * Flattens a message's attached listing into the shape the readers expect.
 *
 * Prisma hands back `basePrice` as a Decimal and `images` as an array; every
 * consumer wants `price` as a number and a single `imageUrl`. That conversion
 * used to be written inline at each read site, which is why the realtime push
 * did not have it — and a message arriving over the socket was therefore
 * unusable to the seller's inbox, whose type expects the flattened form. It
 * answered every push by refetching the whole thread instead.
 */
function withMappedProduct<T extends { attachedProduct?: RawAttachedProduct | null }>(m: T) {
  return {
    ...m,
    attachedProduct: m.attachedProduct && {
      id:   m.attachedProduct.id,
      name: m.attachedProduct.name,
      slug: m.attachedProduct.slug,
      price:          Number(m.attachedProduct.basePrice),
      compareAtPrice: m.attachedProduct.compareAtPrice ? Number(m.attachedProduct.compareAtPrice) : null,
      imageUrl:       m.attachedProduct.images[0]?.url ?? null,
    },
  };
}

/**
 * Turns a newest-first fetch of `size + 1` rows into what a thread renders.
 *
 * One place, because the three things it does have to happen together and in
 * this order: drop the probe row, put the page back into oldest-first, and
 * redact. Getting the probe out AFTER reversing would delete the oldest
 * message on the page instead of the extra one.
 */
function messageWindow<T extends { id: string; createdAt: Date; deletedAt?: Date | null; body?: string; attachmentUrls?: string[] }>(
  rows: T[],
  size: number,
): { messages: T[]; hasMoreMessages: boolean; oldestMessageId: string | null } {
  const hasMoreMessages = rows.length > size;
  const page = hasMoreMessages ? rows.slice(0, size) : rows;
  const messages = redactUnsent(oldestFirst(page));
  return {
    messages,
    hasMoreMessages,
    // The cursor for the next page, handed back rather than left for the
    // client to derive: it is the id of the oldest row it now holds, and a
    // client that computed it from a list it had re-sorted would send the
    // wrong end.
    oldestMessageId: messages[0]?.id ?? null,
  };
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly storage:        StorageService,
    private readonly notifications:  NotificationsService,
    private readonly pushService:    PushService,
    /**
     * Optional so this service still constructs where the gateway is not
     * wired — unit tests, and the CLI paths that import it for seeding. A
     * missing gateway costs the live push and nothing else; the message is
     * already committed by the time it would be used.
     */
    @Optional() private readonly realtime?: RealtimeGateway,
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  /**
   * May this caller act as the buyer on this thread?
   *
   * The rule this replaces was `callerId && thread.userId && they differ`,
   * which let both halves through when either side was null: any signed-in
   * account could read — and write into — any GUEST thread, buyer's email and
   * order numbers included. Nothing published a conversation id and the global
   * rate limit makes guessing one impractical, so it was never an open door;
   * it was an unlocked one.
   *
   * A guest thread stays readable without a session, because that is how a
   * guest reaches their own: they have no account to sign in to. What changes
   * is that being signed in as SOMEONE ELSE is no longer a way in. Once a
   * guest registers, linkGuestConversations gives their threads a userId and
   * this first branch is what protects them from then on.
   */
  private assertBuyerAccess(
    conversation: { userId: string | null },
    callerId: string | null,
  ): void {
    const denied = conversation.userId
      ? conversation.userId !== callerId
      : callerId !== null;
    if (denied) {
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN', message: 'Access denied' });
    }
  }

  /**
   * One gate for every route that reaches into a thread from outside.
   *
   * Both sides are here rather than one rule per endpoint, because the routes
   * that read a thread, page through it, attach a file to it and unfurl a link
   * in it all have to agree about who may. Somewhere for a new route to plug
   * into is what stops the next one inventing a fifth answer.
   */
  async assertThreadAccess(
    conversationId: string,
    viewer: { storeId?: string; userId?: string | null; forShop: boolean },
  ): Promise<{ id: string; storeId: string | null; userId: string | null }> {
    const conversation = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { id: true, storeId: true, userId: true },
    });
    if (!conversation) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }
    if (viewer.forShop) {
      // Not-found rather than forbidden: a shop asking about another shop's
      // thread should not learn that the id exists.
      if (viewer.storeId !== undefined && conversation.storeId !== viewer.storeId) {
        throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
      }
    } else {
      this.assertBuyerAccess(conversation, viewer.userId ?? null);
    }
    return conversation;
  }

  /**
   * Files attached to a message, uploaded before the message that carries them.
   *
   * Two steps rather than one multipart send: the composer shows a thumbnail
   * as soon as each file lands, and a message that fails to send does not take
   * the upload with it. The cost is that a file picked and then abandoned stays
   * in the bucket — cheaper than making the seller upload twice.
   */
  async uploadAttachments(
    conversationId: string,
    files: Express.Multer.File[],
    viewer: { storeId?: string; userId?: string | null; forShop: boolean },
  ): Promise<{ name: string; url: string }[]> {
    await this.assertThreadAccess(conversationId, viewer);

    if (!files?.length) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'No file was uploaded' });
    }
    if (files.length > MAX_MESSAGE_ATTACHMENTS) {
      throw new BadRequestException({
        code:    'ERR_VALIDATION',
        message: `Up to ${MAX_MESSAGE_ATTACHMENTS} files per message`,
      });
    }

    // Validated in full before the first upload, so a rejected second file
    // cannot leave the first one orphaned in the bucket.
    for (const file of files) {
      if (!MESSAGE_ATTACHMENT_MIMETYPES.has(file.mimetype)) {
        throw new BadRequestException({
          code:    'ERR_INVALID_FILE_TYPE',
          message: `${file.originalname}: only images and PDFs can be attached`,
        });
      }
      if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException({
          code:    'ERR_FILE_TOO_LARGE',
          message: `${file.originalname}: max 10 MB per file`,
        });
      }
    }

    const uploaded: { name: string; url: string }[] = [];
    for (const file of files) {
      // Keyed on the conversation, not the uploader: it is the one thing both
      // sides of a thread share, so a guest's upload lands beside the shop's.
      const key = this.storage.generateKey(`messages/${conversationId}`, file.originalname);
      const url = await this.storage.uploadFile(file.buffer, key, file.mimetype);
      uploaded.push({ name: file.originalname, url });
    }
    return uploaded;
  }

  /**
   * Hands a new account the threads it wrote as a guest.
   *
   * Without this, registering LOSES the conversation: assertBuyerAccess above
   * refuses a signed-in caller on a thread with no userId, and the buyer would
   * watch their own history become unreachable the moment they made an
   * account.
   *
   * Merging, not just relabelling, because the partial unique index means a
   * buyer who already has a thread with the shop cannot simply have a second
   * one relabelled onto them — the update would take a P2002. This is the same
   * fold the one_conversation_per_buyer migration performs, at the one other
   * moment two threads can turn out to be the same person.
   *
   * Returns how many were linked. Never throws: registration must not fail
   * because a fold did.
   */
  async linkGuestConversations(userId: string, email: string): Promise<number> {
    try {
      const guestThreads = await this.prisma.conversation.findMany({
        where:  { guestEmail: email.toLowerCase(), userId: null },
        select: { id: true, storeId: true },
      });
      if (!guestThreads.length) return 0;

      let linked = 0;
      for (const guest of guestThreads) {
        // A thread with no shop is outside the unique index, so nothing can
        // collide with it and there is nothing to fold into.
        const keeper = guest.storeId
          ? await this.prisma.conversation.findFirst({
              where:  { storeId: guest.storeId, userId },
              select: { id: true },
            })
          : null;

        if (keeper) await this.foldConversation(guest.id, keeper.id);
        else {
          await this.prisma.conversation.update({
            where: { id: guest.id },
            // guestEmail is left in place: it is how the shop reached them and
            // is part of the record. The guest index only binds rows with a
            // null userId, so it stops applying here anyway.
            data:  { userId },
          });
        }
        linked++;
      }

      this.logger.log(`Linked ${linked} guest conversation(s) to ${email}`);
      return linked;
    } catch (err) {
      this.logger.error(`Failed to link guest conversations for ${email}: ${String(err)}`);
      return 0;
    }
  }

  /** Moves everything from one thread onto another and deletes the source. */
  private async foldConversation(fromId: string, intoId: string): Promise<void> {
    const [from, into] = await this.prisma.$transaction([
      this.prisma.conversation.findUniqueOrThrow({ where: { id: fromId } }),
      this.prisma.conversation.findUniqueOrThrow({ where: { id: intoId } }),
    ]);

    // Labels first: the link table's key is composite, so moving one the
    // keeper already carries would violate it. Insert what is missing, then
    // drop the originals — the same order the migration uses.
    const links = await this.prisma.conversationLabelLink.findMany({
      where:  { conversationId: fromId },
      select: { labelId: true },
    });

    await this.prisma.$transaction([
      this.prisma.conversationLabelLink.createMany({
        data: links.map((l) => ({ conversationId: intoId, labelId: l.labelId })),
        skipDuplicates: true,
      }),
      this.prisma.conversationLabelLink.deleteMany({ where: { conversationId: fromId } }),
      this.prisma.message.updateMany({
        where: { conversationId: fromId },
        data:  { conversationId: intoId },
      }),
      this.prisma.conversation.update({
        where: { id: intoId },
        data: {
          // Counters add up rather than being kept: taking only the keeper's
          // would silently mark the other thread's unread messages as read.
          unreadByAdmin:    into.unreadByAdmin    + from.unreadByAdmin,
          unreadByCustomer: into.unreadByCustomer + from.unreadByCustomer,
          isStarred:        into.isStarred        || from.isStarred,
          hasSellerReplied: into.hasSellerReplied || from.hasSellerReplied,
          ...(from.lastMessageAt && (!into.lastMessageAt || from.lastMessageAt > into.lastMessageAt)
            ? { lastMessageAt: from.lastMessageAt, lastMessage: from.lastMessage }
            : {}),
          ...(into.orderId ? {} : { orderId: from.orderId }),
        },
      }),
      this.prisma.conversation.delete({ where: { id: fromId } }),
    ]);
  }

  /**
   * The one thread between a shop and a buyer.
   *
   * A thread used to be created per order, so a buyer with five orders from the
   * same shop had five of them — all captioned with the same shop name, none
   * carrying the history. The order is now context ON the thread rather than
   * the thing that identifies it, which is also what lets "their other orders"
   * be answerable at all.
   *
   * Guests are keyed on a lower-cased email, matching the partial unique index
   * the migration installs. Without the same casing rule on both sides the
   * database would reject a row this method thought was new.
   */
  async openThreadWithBuyer(
    storeId:  string,
    buyer:    { userId?: string | null; guestEmail?: string | null; guestName?: string | null },
    orderId?: string | null,
    subject?: string | null,
  ) {
    return this.findOrCreateConversation(storeId, buyer, orderId, subject);
  }

  /**
   * The platform's own thread with a customer, opened from the admin side.
   *
   * storeId stays null on purpose: this is EziHubb talking to the customer,
   * not a shop. The seller inbox is store-scoped and never sees it; the
   * platform inbox applies no store filter at all, so it does.
   *
   * Find-or-create, and the "find" half is the point. The existing no-store
   * branch in createConversation writes a fresh row every time, which is why
   * one customer already has two of these. The partial unique index that
   * protects shop threads is on (storeId, userId) and does not cover a null
   * store, so nothing in the database stops a third.
   *
   * Registered accounts only. A guest has no stable identity to open a
   * thread against — they are keyed by an email that anyone can type — and
   * the caller here is a list of accounts.
   */
  async findOrCreatePlatformConversation(userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where:   { storeId: null, userId },
      orderBy: { createdAt: 'asc' },
      select:  { id: true },
    });
    if (existing) return { conversationId: existing.id, created: false };

    const created = await this.prisma.conversation.create({
      data:   { userId, status: ConversationStatus.OPEN },
      select: { id: true },
    });
    return { conversationId: created.id, created: true };
  }

  private async findOrCreateConversation(
    storeId:  string,
    buyer:    { userId?: string | null; guestEmail?: string | null; guestName?: string | null },
    orderId?: string | null,
    subject?: string | null,
  ) {
    const userId     = buyer.userId ?? null;
    const guestEmail = userId ? null : (buyer.guestEmail?.toLowerCase() ?? null);

    const existing = await this.prisma.conversation.findFirst({
      where: userId ? { storeId, userId } : { storeId, userId: null, guestEmail },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      // The order the thread is "about" follows the latest thing said, so the
      // panel beside it shows what the buyer most recently wrote in about
      // rather than whichever order happened to start the thread years ago.
      if (orderId && existing.orderId !== orderId) {
        return this.prisma.conversation.update({
          where: { id: existing.id },
          data:  { orderId },
        });
      }
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        storeId,
        ...(userId ? { userId } : { guestEmail, guestName: buyer.guestName ?? null }),
        ...(orderId ? { orderId } : {}),
        subject: subject ?? null,
        status:  ConversationStatus.OPEN,
      },
    });
  }

  async createConversation(userId: string | null, dto: CreateConversationDto) {
    const { orderId, subject, guestEmail, guestName, body, ..._ } = dto;

    /**
     * Which shop, from the order if there is one and from the caller if not.
     *
     * The order is preferred because it is the stronger claim — it is a fact
     * about a purchase rather than something the browser said. The fallback is
     * what "Message seller" on a product page needs: it has a shop and no
     * order, and without it every such message landed on a conversation with
     * no store, which no shop's inbox can see.
     *
     * Verified to exist before it is used. An id that names nothing would sail
     * past the foreign key as `undefined` and recreate the same orphan this is
     * here to prevent.
     */
    let storeId: string | undefined;
    if (orderId) {
      const storeOrders = await this.prisma.storeOrder.findMany({
        where:  { orderId },
        select: { storeId: true },
        take:   2,
      });
      if (storeOrders.length === 1) storeId = storeOrders[0].storeId;
    }
    if (!storeId && dto.storeId) {
      const store = await this.prisma.store.findUnique({
        where:  { id: dto.storeId },
        select: { id: true },
      });
      if (!store) {
        throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Shop not found' });
      }
      storeId = store.id;
    }

    /**
     * Find-or-create, not create.
     *
     * Writing a fresh row here is what produced a thread per order. It is also
     * now a database error: the partial unique index on (storeId, userId) and
     * (storeId, lower(guestEmail)) would reject the second one, so a buyer
     * writing to a shop they had messaged before would simply fail.
     *
     * Without a store there is nothing to key on — a general enquiry that
     * matched no single shop — so those keep the old behaviour and stand alone.
     */
    const thread = storeId
      ? await this.findOrCreateConversation(
          storeId,
          { userId, guestEmail, guestName },
          orderId,
          subject,
        )
      : await this.prisma.conversation.create({
          data: {
            ...(userId && { userId }),
            ...(orderId && { orderId }),
            subject,
            // Lower-cased on the way in even here, where no unique index
            // depends on it. One casing rule for the column, so a row written
            // by this branch is still findable by every lookup that assumes
            // the other one.
            guestEmail: userId ? undefined : guestEmail?.toLowerCase(),
            guestName:  userId ? undefined : guestName,
            status: ConversationStatus.OPEN,
          },
        });

    // The message and the thread's own counters, in one write, so a failure
    // cannot leave a thread claiming an unread message it does not have.
    const [, conversation] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: thread.id,
          senderType: SenderType.CUSTOMER,
          senderId: userId ?? null,
          body,
        },
      }),
      this.prisma.conversation.update({
        where: { id: thread.id },
        data: {
          lastMessage: body,
          lastMessageAt: new Date(),
          unreadByAdmin: { increment: 1 },
          /**
           * Reopens a thread the shop had resolved or filed: a new question is
           * not answered just because the last one was.
           *
           * Except spam. Marking a sender as spam is a decision about the
           * person, not about one message, and writing again is exactly what
           * a spammer does — letting the next message undo it would put them
           * back in the inbox and make the button pointless.
           */
          ...(thread.status === ConversationStatus.SPAM
            ? {}
            : { status: ConversationStatus.OPEN }),
        },
        include: {
          ...CONVERSATION_INCLUDE,
          user:  { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      }),
    ]);

    // Notify admin of new conversation (fire-and-forget)
    this.notifications.sendNewMessageNotification({
      senderType:     'CUSTOMER',
      senderName:     conversation.user?.firstName ?? conversation.guestName ?? conversation.guestEmail ?? 'Guest',
      recipientEmail: '',
      messagePreview: body.slice(0, 200) + (body.length > 200 ? '...' : ''),
      orderNumber:    conversation.order?.orderNumber ?? undefined,
      orderId:        conversation.orderId ?? undefined,
    }).catch((err: unknown) => this.logger.warn(`Email notification failed: ${String(err)}`));

    // This is now a find-or-create, so what comes back can be a thread with
    // years of history on it rather than the one message just written — and
    // any of those may have been unsent.
    return { ...conversation, ...messageWindow(conversation.messages, MESSAGE_WINDOW) };
  }

  /** storeId only supplied for the admin/shop-reply path — undefined for customer-facing calls (no store ownership concept there). */
  async sendMessage(
    conversationId: string,
    senderType: SenderType,
    senderId: string | null,
    dto: SendMessageDto,
    storeId?: string,
  ) {
    /**
     * Say something, or attach something. One of the two.
     *
     * The DTO used to demand a non-empty body, which made a photo on its own
     * an invalid message — while both composers offer exactly that. Checked
     * here because it is the only place that sees the body and the
     * attachments together; a per-field validator can only ever see one.
     *
     * Before the conversation is even read: nothing about this depends on
     * which thread it is, and rejecting it names the actual problem instead of
     * a bare "Validation failed".
     */
    if (!dto.body?.trim() && (dto.attachmentUrls?.length ?? 0) === 0) {
      throw new BadRequestException({
        code:    'ERR_EMPTY_MESSAGE',
        message: 'Write a message or attach a file.',
      });
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        // avatarUrl and logoUrl are what the recipient's toast shows in place
        // of a generic glyph. An explicit select drops every field it does not
        // name, which is exactly what this compiled against before they were
        // added — and the compiler is the only thing that says so.
        user:  { select: { email: true, firstName: true, avatarUrl: true } },
        order: { select: { orderNumber: true } },
        // ownerId is who a buyer's message is addressed to, and name is what
        // the buyer's own toast says it came from.
        store: { select: { name: true, ownerId: true, logoUrl: true } },
      },
    });
    if (!conversation || (storeId !== undefined && conversation.storeId !== storeId)) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }

    const isCustomer = senderType === SenderType.CUSTOMER;

    /**
     * Writing as the buyer needs the same proof as reading as the buyer.
     *
     * Locking the read and leaving the write open would have been worse than
     * leaving both: anyone reaching a thread could put words in the buyer's
     * mouth, in a place the shop reads as coming from them. SHOP and SYSTEM
     * are scoped by `storeId` above and by the admin guards before that.
     */
    if (isCustomer) this.assertBuyerAccess(conversation, senderId);

    // A retry that carries the key of an attempt which actually landed returns
    // that message untouched — no second row, no second unread, no second
    // notification. Checked before the write as the common case; the unique
    // index below is what makes it correct when two retries race.
    if (dto.clientMessageId) {
      const existing = await this.prisma.message.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId,
            clientMessageId: dto.clientMessageId,
          },
        },
      });
      if (existing) return existing;
    }

    const write = () => this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderType,
          senderId,
          body: dto.body,
          attachmentUrls: dto.attachmentUrls ?? [],
          attachedProductId: dto.attachedProductId ?? null,
          clientMessageId: dto.clientMessageId ?? null,
        },
        // The row that comes back here is the one pushed over the socket, so
        // it has to be complete enough to render. It used to be the bare
        // scalars, which meant the seller's inbox could not use the push at
        // all — its message type needs attachedProduct — and answered every
        // arrival by refetching the whole thread instead. One join on send
        // buys back a round trip on every message either side receives.
        include: {
          attachedProduct: {
            select: {
              id: true, name: true, slug: true, basePrice: true, compareAtPrice: true,
              images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
            },
          },
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
            : {
                unreadByCustomer: { increment: 1 },
                hasSellerReplied: true,
                // A thread the buyer had cleared from their list comes back
                // when there is something new in it. Otherwise "delete" would
                // quietly mute the shop for good, and a buyer waiting on an
                // answer would never learn it had arrived.
                hiddenByCustomerAt: null,
              }),
        },
      }),
    ]);

    /**
     * The check above is the fast path; this is the correct one.
     *
     * Two retries can both find nothing and both go on to insert. The unique
     * index on (conversationId, clientMessageId) lets exactly one win, and the
     * loser lands here — where the right answer is the row the winner wrote,
     * not an error. The whole transaction rolls back with it, so the loser also
     * leaves no extra unread behind.
     */
    let message: Awaited<ReturnType<typeof write>>[0];
    try {
      [message] = await write();
    } catch (e) {
      const isDuplicate =
        dto.clientMessageId &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002';
      if (!isDuplicate) throw e;

      const winner = await this.prisma.message.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId,
            clientMessageId: dto.clientMessageId as string,
          },
        },
      });
      // Only when it is genuinely absent: a P2002 from some other unique index
      // would otherwise be swallowed and reported as a message that vanished.
      if (!winner) throw e;
      return winner;
    }

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

    // Last, and only after the transaction above has committed: a socket
    // delivery is not undoable, so emitting earlier would let a rolled-back
    // message appear in someone's thread and stay there until they reloaded.
    //
    // Every sender reaches this method — the buyer's endpoint, the seller's
    // inbox reply, and the order panel all delegate here — so this one call
    // covers all of them without a second emit site to keep in step.
    // Pushed in the shape the readers already expect, not the raw row. The
    // seller's inbox types attachedProduct as { price, imageUrl }, so a raw
    // relation on the wire was unusable there and every arriving message cost
    // a refetch of the whole thread to render.
    this.realtime?.emitMessage(conversationId, withMappedProduct(message));

    // And to the recipient personally, so their sidebar badge and toast fire
    // wherever they are — the conversation room only reaches people who
    // currently have the thread open.
    //
    // A buyer's message goes to whoever owns the shop; the shop's goes to the
    // buyer. A guest conversation has no account on the buyer side, so there
    // is nobody to address and it is skipped rather than guessed at.
    const recipientId = isCustomer ? conversation.store?.ownerId : conversation.userId;
    if (recipientId) {
      this.realtime?.emitInboxChanged(recipientId, {
        conversationId,
        from: isCustomer
          ? (conversation.user?.firstName ?? conversation.guestName ?? 'A customer')
          : (conversation.store?.name ?? 'The shop'),
        // Trimmed here rather than in the client: this crosses the wire to
        // every open tab, and a 5,000-character body would too.
        preview: dto.body.slice(0, 120),
        // The sender's own picture, so the toast can show who wrote rather
        // than a generic info glyph. Null for a guest, who has no account and
        // therefore no avatar — the toast falls back to their initials.
        avatarUrl: isCustomer
          ? (conversation.user?.avatarUrl ?? null)
          : (conversation.store?.logoUrl ?? null),
      });
    }

    return message;
  }

  /**
   * Takes a thread off the buyer's own list.
   *
   * Not a delete, and the distinction is the whole design. The shop is the
   * other party to this conversation and keeps its copy — the same reason
   * unsending a message blanks it rather than dropping the row. A buyer who
   * could destroy the record could also destroy the evidence in a dispute
   * they started.
   *
   * The flag clears itself when the shop writes again, so this behaves the way
   * people expect from a messenger: it clears the list until there is
   * something new to say, rather than muting the shop for good.
   */
  async hideForBuyer(conversationId: string, userId: string | null) {
    const conversation = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { id: true, userId: true },
    });
    if (!conversation) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }
    this.assertBuyerAccess(conversation, userId);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { hiddenByCustomerAt: new Date() },
    });
    return { success: true };
  }

  /**
   * A buyer saying this conversation is a problem.
   *
   * One open report per person per thread. Enforced here rather than by a
   * unique index, because the index would also refuse a legitimate SECOND
   * report months later about something new — the thing being limited is
   * piling on while the first is still unread, not ever reporting twice.
   *
   * Reporting does not hide the thread. Those are separate decisions and a
   * buyer may well want to keep reading while someone looks at it.
   */
  async reportConversation(
    conversationId: string,
    userId: string | null,
    reason: ConversationReportReason,
    note?: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { id: true, userId: true },
    });
    if (!conversation) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Conversation not found' });
    }
    this.assertBuyerAccess(conversation, userId);

    const open = await this.prisma.conversationReport.findFirst({
      where:  { conversationId, reportedById: userId, resolvedAt: null },
      select: { id: true },
    });
    if (open) {
      throw new BadRequestException({
        code:    'ERR_ALREADY_REPORTED',
        message: 'You have already reported this conversation. Someone is looking at it.',
      });
    }

    const report = await this.prisma.conversationReport.create({
      data: { conversationId, reportedById: userId, reason, note: note?.trim() || null },
      select: { id: true, createdAt: true },
    });
    this.logger.warn(`Conversation ${conversationId} reported (${reason}) — report ${report.id}`);
    return { success: true, reportId: report.id };
  }

  async getMyConversations(userId: string) {
    return this.prisma.conversation.findMany({
      // A hidden thread stays hidden until the shop writes again, which is
      // what clears the flag in sendMessage.
      where: { userId, hiddenByCustomerAt: null },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true } },
        // Every row names the shop it is with, so this has to come back here
        // and not only on the thread. Without it the list falls through to its
        // placeholder and prints "Shop" beside a blank circle on every row —
        // which is what it did while the name was a hard-coded literal.
        store: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
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

    this.assertBuyerAccess(conversation, userId);

    return { ...conversation, ...messageWindow(conversation.messages, MESSAGE_WINDOW) };
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

    // Tells the shop its messages have been seen, so the double tick updates
    // while both sides are looking at the thread instead of on the next fetch.
    this.realtime?.emitRead(conversationId, 'CUSTOMER');
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
        // Newest end, same as CONVERSATION_INCLUDE — this overrides it, so a
        // fix applied only there would leave the seller's own inbox stuck on
        // the oldest hundred.
        messages: {
          orderBy: { createdAt: 'desc' as const },
          take: TAKE_WITH_PROBE,
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

    // Redacted on this side too. The shop knows what it unsent, but the
    // inbox and the order panel both render it as unsent, and a body
    // nobody is allowed to show has no reason to leave the database.
    const window = messageWindow(conversation.messages, MESSAGE_WINDOW);

    return {
      ...conversation,
      labels: conversation.labels.map((l) => l.label),
      hasMoreMessages: window.hasMoreMessages,
      oldestMessageId: window.oldestMessageId,
      messages: window.messages.map(withMappedProduct),
    };
  }

  /**
   * The page of messages immediately older than `before`.
   *
   * The thread endpoints hand back the newest window and say whether anything
   * lies behind it; this is how the reader walks backwards through the rest.
   * Split out rather than folded into those endpoints as an offset, because a
   * thread grows at the end while it is being read — see MessagePageQueryDto.
   *
   * `storeId` scopes it for a shop the same way the rest of the admin surface
   * does; `userId` does it for a buyer. Exactly one of them is meaningful per
   * caller, and both are checked here rather than in the controllers so a new
   * route cannot forget.
   */
  async getMessagePage(
    conversationId: string,
    cursor: { before?: string; limit?: number },
    viewer: { storeId?: string; userId?: string | null; forShop: boolean },
  ) {
    await this.assertThreadAccess(conversationId, viewer);

    const size = cursor.limit ?? MESSAGE_PAGE;
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      // id as a tiebreaker, not decoration. Two messages written in the same
      // millisecond — a system message beside the one that triggered it — sort
      // arbitrarily on createdAt alone, and an unstable sort under a cursor
      // repeats one row and drops another.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
      ...(cursor.before ? { cursor: { id: cursor.before }, skip: 1 } : {}),
      ...(viewer.forShop
        ? {
            include: {
              attachedProduct: {
                select: {
                  id: true, name: true, slug: true, basePrice: true, compareAtPrice: true,
                  images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
                },
              },
            },
          }
        : {}),
    });

    const window = messageWindow(rows, size);
    return {
      messages: window.messages.map((m) => {
        const p = (m as { attachedProduct?: {
          id: string; name: string; slug: string;
          basePrice: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null;
          images: { url: string }[];
        } | null }).attachedProduct;
        if (p === undefined) return m;
        return {
          ...m,
          attachedProduct: p && {
            id: p.id, name: p.name, slug: p.slug,
            price: Number(p.basePrice),
            compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
            imageUrl: p.images[0]?.url ?? null,
          },
        };
      }),
      hasMoreMessages: window.hasMoreMessages,
      oldestMessageId: window.oldestMessageId,
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

  /**
   * Unsends a message the shop sent.
   *
   * Shop messages only. A seller deleting what a buyer wrote would be editing
   * the record of a conversation they are a party to — and the buyer would
   * have no way to tell it had happened.
   *
   * Soft: the row and its body stay IN THE DATABASE, so a moderation report
   * about the message remains answerable and the shop cannot erase what it
   * said. Neither side is sent the text again — see redactUnsent. The
   * bubble stays in place saying it was unsent, because the buyer may
   * already have read it and closing the gap would rewrite a conversation
   * they were part of.
   */
  async deleteMessage(messageId: string, adminUserId: string, storeId?: string) {
    const message = await this.prisma.message.findUnique({
      where:  { id: messageId },
      select: {
        id: true, senderType: true, deletedAt: true,
        conversation: { select: { id: true, storeId: true } },
      },
    });
    if (!message) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Message not found' });
    }
    // Scoped for a shop owner; a platform SUPER_ADMIN passes no storeId.
    if (storeId !== undefined && message.conversation.storeId !== storeId) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Message not found' });
    }
    if (message.senderType !== SenderType.SHOP) {
      throw new ForbiddenException({
        code:    'ERR_FORBIDDEN',
        message: 'Only the shop\'s own messages can be unsent',
      });
    }
    // Already unsent: return rather than throw. A double click is not an
    // error, and the second one asked for a state that already holds.
    if (message.deletedAt) return { success: true };

    await this.prisma.message.update({
      where: { id: messageId },
      data:  { deletedAt: new Date(), deletedBy: adminUserId },
    });

    await this.refreshPreview(message.conversation.id);

    this.realtime?.emitDeleted(message.conversation.id, messageId);
    return { success: true };
  }

  /**
   * Re-derives the thread's one-line preview from what is still visible.
   *
   * `lastMessage` is a copy of a body, kept on the conversation so the inbox
   * list does not have to join. Unsending the newest message left that copy
   * behind: the bubble said "Message unsent" while the list beside it, and
   * the buyer's own list, went on printing the text it was meant to take back.
   *
   * The unread counter goes with it. An unsent message is not something the
   * buyer still has to read, and leaving it counted means a badge promising
   * something that is no longer there.
   */
  private async refreshPreview(conversationId: string): Promise<void> {
    const latest = await this.prisma.message.findFirst({
      where:   { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select:  { body: true, createdAt: true },
    });

    const unreadByCustomer = await this.prisma.message.count({
      where: {
        conversationId,
        senderType: { not: SenderType.CUSTOMER },
        isRead: false,
        deletedAt: null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        // Null rather than an empty string when everything has been unsent:
        // the list already renders "No messages yet" for null.
        lastMessage: latest?.body ?? null,
        // Only moved when there is still something to point at. Postgres sorts
        // NULLS FIRST on a DESC order, so nulling it would send a thread whose
        // every message had been unsent to the top of the inbox — the one
        // place an unsent thread has no business being.
        ...(latest ? { lastMessageAt: latest.createdAt } : {}),
        unreadByCustomer,
      },
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

    this.realtime?.emitRead(conversationId, 'SHOP');
    return { success: true };
  }
}
