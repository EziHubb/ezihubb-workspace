import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SenderType, ConversationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The shop-owned parts of the inbox: labels, starring, filing, buyer notes and
 * the away-message.
 *
 * Kept apart from MessagesService, which owns conversations themselves and is
 * shared with the buyer-facing controller. Nothing here has a buyer-facing
 * counterpart — a buyer must never learn that a shop labelled their thread
 * "time waster" or wrote a note about them.
 */

/**
 * States a thread is filed INTO rather than worked in.
 *
 * All three, not just archive and trash. Leaving SPAM out meant marking an
 * already-spam thread as spam again recorded SPAM as its "previous" status,
 * and Restore then put it straight back in the Spam folder — a button that
 * did nothing. Filing something that is already filed must never overwrite
 * where it originally came from.
 */
const FILED: readonly ConversationStatus[] = [
  ConversationStatus.ARCHIVED,
  ConversationStatus.TRASHED,
  ConversationStatus.SPAM,
];

/**
 * How many of a buyer's orders the thread panel lists.
 *
 * A capped list, not the whole history: the panel is context for the reply in
 * front of the seller, and the Orders page is where a full history belongs.
 */
const BUYER_ORDERS_SHOWN = 10;

export type BulkAction =
  | 'star' | 'unstar'
  | 'read' | 'unread'
  | 'archive' | 'trash' | 'spam' | 'restore';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rejects ids belonging to another shop before anything is written. */
  private async ownedIds(storeId: string, conversationIds: string[]): Promise<string[]> {
    const rows = await this.prisma.conversation.findMany({
      where:  { id: { in: conversationIds }, storeId },
      select: { id: true },
    });
    if (!rows.length) throw new NotFoundException('No matching conversations');
    return rows.map((r) => r.id);
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  listLabels(storeId: string) {
    return this.prisma.conversationLabel.findMany({
      where:   { storeId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { links: true } } },
    });
  }

  async createLabel(storeId: string, name: string, color: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('A label needs a name');

    // Caught rather than pre-checked: a read-then-write race between two tabs
    // would still hit the unique index, so the index is the real guard and
    // this only turns it into a sentence a person can read.
    try {
      return await this.prisma.conversationLabel.create({
        data: { storeId, name: trimmed, color },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('This shop already has a label with that name');
      }
      throw e;
    }
  }

  async renameLabel(storeId: string, labelId: string, name: string, color?: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('A label needs a name');

    const { count } = await this.prisma.conversationLabel.updateMany({
      where: { id: labelId, storeId },
      data:  { name: trimmed, ...(color ? { color } : {}) },
    });
    if (!count) throw new NotFoundException('Label not found');
    return this.prisma.conversationLabel.findUnique({ where: { id: labelId } });
  }

  /** Deleting a label unfiles every thread carrying it — the links cascade. */
  async deleteLabel(storeId: string, labelId: string) {
    const { count } = await this.prisma.conversationLabel.deleteMany({ where: { id: labelId, storeId } });
    if (!count) throw new NotFoundException('Label not found');
    return { deleted: true };
  }

  async setConversationLabels(storeId: string, conversationId: string, labelIds: string[]) {
    const [owned] = await this.ownedIds(storeId, [conversationId]);

    // Every label must belong to this shop. Without the check a client could
    // attach another shop's label and read its name back out of the response.
    if (labelIds.length) {
      const valid = await this.prisma.conversationLabel.count({
        where: { id: { in: labelIds }, storeId },
      });
      if (valid !== new Set(labelIds).size) {
        throw new BadRequestException('A label in this list does not belong to this shop');
      }
    }

    await this.prisma.$transaction([
      this.prisma.conversationLabelLink.deleteMany({ where: { conversationId: owned } }),
      this.prisma.conversationLabelLink.createMany({
        data: [...new Set(labelIds)].map((labelId) => ({ conversationId: owned, labelId })),
      }),
    ]);

    return this.listConversationLabels(owned);
  }

  private listConversationLabels(conversationId: string) {
    return this.prisma.conversationLabel.findMany({
      where:   { links: { some: { conversationId } } },
      orderBy: { name: 'asc' },
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  /**
   * The toolbar above the message list.
   *
   * Filing remembers the previous status so "move back to inbox" has somewhere
   * to go — `status` is a single column, so archiving otherwise overwrites
   * whether the thread had been resolved and restoring would have to guess.
   * Restoring puts that status back and clears the memory.
   */
  async bulk(storeId: string, conversationIds: string[], action: BulkAction) {
    const ids = await this.ownedIds(storeId, conversationIds);

    switch (action) {
      case 'star':
      case 'unstar':
        await this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data:  { isStarred: action === 'star' },
        });
        break;

      case 'read':
        await this.prisma.conversation.updateMany({ where: { id: { in: ids } }, data: { unreadByAdmin: 0 } });
        break;

      case 'unread':
        // 1, not a restored original count: the badge asks "is there anything
        // here for me", and inventing a number would be a guess either way.
        await this.prisma.conversation.updateMany({ where: { id: { in: ids } }, data: { unreadByAdmin: 1 } });
        break;

      case 'archive':
      case 'trash':
      case 'spam': {
        const target = action === 'archive'
          ? ConversationStatus.ARCHIVED
          : action === 'trash' ? ConversationStatus.TRASHED : ConversationStatus.SPAM;

        // Per-row, because each remembers its own previous status. Only rows
        // not already filed record one.
        const rows = await this.prisma.conversation.findMany({
          where:  { id: { in: ids } },
          select: { id: true, status: true },
        });

        await this.prisma.$transaction(
          rows.map((row) => this.prisma.conversation.update({
            where: { id: row.id },
            data: {
              status: target,
              ...(FILED.includes(row.status)
                ? {}
                : { statusBeforeFiling: row.status }),
            },
          })),
        );
        break;
      }

      case 'restore': {
        const rows = await this.prisma.conversation.findMany({
          where:  { id: { in: ids } },
          select: { id: true, statusBeforeFiling: true },
        });

        await this.prisma.$transaction(
          rows.map((row) => this.prisma.conversation.update({
            where: { id: row.id },
            data: {
              // OPEN when nothing was recorded — a thread restored from a
              // state that predates this feature has to land somewhere, and
              // the inbox is the safe place for it.
              status: row.statusBeforeFiling ?? ConversationStatus.OPEN,
              statusBeforeFiling: null,
            },
          })),
        );
        break;
      }
    }

    return { affected: ids.length, action };
  }

  // ── Buyer note ────────────────────────────────────────────────────────────

  /** `guest:<email>` when there is no account, so guests get notes too. */
  buyerKeyFor(userId: string | null, guestEmail: string | null): string | null {
    if (userId) return userId;
    if (guestEmail) return `guest:${guestEmail.toLowerCase()}`;
    return null;
  }

  getBuyerNote(storeId: string, buyerKey: string) {
    return this.prisma.buyerNote.findUnique({ where: { storeId_buyerKey: { storeId, buyerKey } } });
  }

  async setBuyerNote(storeId: string, buyerKey: string, body: string) {
    const trimmed = body.trim();

    // Clearing the box deletes the note rather than storing an empty one, so
    // "no note" is one state and not two that render the same.
    if (!trimmed) {
      await this.prisma.buyerNote.deleteMany({ where: { storeId, buyerKey } });
      return null;
    }

    return this.prisma.buyerNote.upsert({
      where:  { storeId_buyerKey: { storeId, buyerKey } },
      update: { body: trimmed },
      create: { storeId, buyerKey, body: trimmed },
    });
  }

  /** Everything the right-hand panel shows about the buyer on one thread. */
  async buyerPanel(storeId: string, conversationId: string) {
    const convo = await this.prisma.conversation.findFirst({
      where:  { id: conversationId, storeId },
      select: {
        userId: true, guestEmail: true, guestName: true,
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true, avatarUrl: true,
            addresses: {
              where:   { isDefault: true },
              select:  { city: true, state: true, country: true },
              take:    1,
            },
          },
        },
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');

    const buyerKey = this.buyerKeyFor(convo.userId, convo.guestEmail);

    // Shared by the list and the total so the two can never disagree about
    // whose orders they are counting.
    const ordersWhere = {
      storeId,
      order: convo.userId
        ? { userId: convo.userId }
        : { guestEmail: convo.guestEmail ?? undefined },
    };

    const [note, buyerMessages, orders, orderCount] = await Promise.all([
      buyerKey ? this.getBuyerNote(storeId, buyerKey) : null,
      /**
       * Counted from THIS thread's messages, not from how many threads exist.
       *
       * There is one thread per buyer now, so a thread count is always 1 and
       * "hasn't messaged you before" would be permanently true — the panel
       * would greet a regular customer as a stranger on every reply.
       */
      this.prisma.message.count({
        where: { conversationId, senderType: SenderType.CUSTOMER },
      }),
      /**
       * Their orders with THIS shop, newest first.
       *
       * The reason the thread is no longer keyed on an order: a buyer with
       * five of them had five threads and the seller could not see the
       * relationship. Here it is, in one list, on the thread that is now about
       * the person.
       *
       * Capped: a long-standing customer's whole order history is not what
       * this panel is for, and the page it links to is.
       */
      this.prisma.storeOrder.findMany({
        where:   ordersWhere,
        orderBy: { createdAt: 'desc' },
        take: BUYER_ORDERS_SHOWN,
        select: {
          id: true, status: true, sellerEarnings: true, createdAt: true,
          order: { select: { id: true, orderNumber: true } },
          _count: { select: { items: true } },
        },
      }),
      /**
       * The real total, not the length of the capped list above.
       *
       * "How many times has this person bought from me" is the question the
       * panel is answering, and a list that stops at ten would answer it with
       * "ten" for a buyer on their fortieth order.
       */
      this.prisma.storeOrder.count({ where: ordersWhere }),
    ]);

    const place = convo.user?.addresses?.[0];

    return {
      buyerKey,
      name: [convo.user?.firstName, convo.user?.lastName].filter(Boolean).join(' ')
            || convo.guestName || convo.guestEmail || 'Guest',
      avatarUrl: convo.user?.avatarUrl ?? null,
      // Only ever the coarse part of the default address. The panel is a hint
      // about who is writing, not a place to surface someone's street.
      location: place ? [place.city, place.state, place.country].filter(Boolean).join(', ') : null,
      note: note?.body ?? null,
      // Their first message, not their first thread.
      isFirstContact: buyerMessages <= 1,
      orders: orders.map((o) => ({
        storeOrderId: o.id,
        orderId:      o.order.id,
        orderNumber:  o.order.orderNumber,
        status:       o.status,
        itemCount:    o._count.items,
        // Decimal serialises as a string over JSON, and a UI that formats it
        // as currency would print "$12.34.00". Converted at the boundary.
        total:        Number(o.sellerEarnings),
        createdAt:    o.createdAt.toISOString(),
      })),
      orderCount,
    };
  }

  async setBuyerNoteForConversation(storeId: string, conversationId: string, body: string) {
    const convo = await this.prisma.conversation.findFirst({
      where:  { id: conversationId, storeId },
      select: { userId: true, guestEmail: true },
    });
    if (!convo) throw new NotFoundException('Conversation not found');

    const buyerKey = this.buyerKeyFor(convo.userId, convo.guestEmail);
    if (!buyerKey) {
      // A thread with neither an account nor an email has no subject to hang a
      // note on, and inventing a key off the conversation id would silently
      // make it a per-thread note instead.
      throw new BadRequestException('This thread has no identifiable buyer to note');
    }

    const note = await this.setBuyerNote(storeId, buyerKey, body);
    return { note: note?.body ?? null };
  }

  // ── Auto-reply ────────────────────────────────────────────────────────────

  async getAutoReply(storeId: string) {
    const row = await this.prisma.storeAutoReply.findUnique({ where: { storeId } });
    return {
      message:     row?.message ?? '',
      activeUntil: row?.activeUntil ?? null,
      // Computed, never stored: a stored boolean would still read "on" the
      // morning after it lapsed.
      isActive:    Boolean(row?.activeUntil && row.activeUntil > new Date()),
    };
  }

  async setAutoReply(storeId: string, message: string, activeUntil: Date | null) {
    const trimmed = message.trim();
    if (activeUntil && !trimmed) {
      throw new BadRequestException('An auto-reply needs a message');
    }
    if (activeUntil && activeUntil <= new Date()) {
      throw new BadRequestException('The end date must be in the future');
    }

    await this.prisma.storeAutoReply.upsert({
      where:  { storeId },
      update: { message: trimmed, activeUntil },
      create: { storeId, message: trimmed, activeUntil },
    });

    return this.getAutoReply(storeId);
  }
}
