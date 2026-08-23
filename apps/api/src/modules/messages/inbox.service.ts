import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, Prisma } from '@prisma/client';
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

  /** How many threads this buyer has had with this shop — drives "hasn't messaged you before". */
  countBuyerThreads(storeId: string, userId: string | null, guestEmail: string | null) {
    if (!userId && !guestEmail) return Promise.resolve(0);
    return this.prisma.conversation.count({
      where: {
        storeId,
        ...(userId ? { userId } : { guestEmail }),
      },
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
    const [note, threadCount] = await Promise.all([
      buyerKey ? this.getBuyerNote(storeId, buyerKey) : null,
      this.countBuyerThreads(storeId, convo.userId, convo.guestEmail),
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
      // 1 means this thread and no other.
      isFirstContact: threadCount <= 1,
      threadCount,
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
