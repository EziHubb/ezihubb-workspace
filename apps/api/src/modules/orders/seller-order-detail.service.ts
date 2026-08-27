import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SellerLedgerEntryType, SenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { ShippingService } from '../shipping/shipping.service';
import { MessagesService } from '../messages/messages.service';

/**
 * Everything the order detail panel shows, for ONE store's part of an order.
 *
 * Scoped to a StoreOrder rather than an Order throughout, and that is the
 * whole point of the service existing. A basket can be split across several
 * shops; `/admin/orders/:id/earnings` answers for the entire Order, so on a
 * split basket it hands one seller another seller's money. Everything here
 * starts from `(storeOrderId, storeId)`, so there is no shape of order that
 * can leak across shops.
 */

/**
 * What the seller sees for each ledger entry type. Anything not listed falls
 * back to the entry's own description — a fee type added later must still
 * appear rather than silently vanish out of a total the seller is charged.
 */
const LEDGER_LABELS: Partial<Record<SellerLedgerEntryType, string>> = {
  SALE:                   'Sale',
  TRANSACTION_FEE:        'Transaction fee',
  PAYMENT_PROCESSING_FEE: 'Payment processing fee',
  REGULATORY_FEE:         'Regulatory operating fee',
  LISTING_FEE:            'Listing fee',
  VAT:                    'VAT on fees',
  DEPOSIT_FEE:            'Deposit fee',
  SHARE_SAVE_REFUND:      'Share & Save credit',
  OFFSITE_ADS_FEE:        'Offsite ads fee',
  ADJUSTMENT:             'Adjustment',
};

/**
 * Keys in `customizationData` whose value is an uploaded file rather than
 * text, so the two are rendered differently. Compared lowercased, because the
 * key is whatever the listing's personalisation field was named.
 */
const FILE_KEYS = new Set(['photo', 'photos', 'image', 'images', 'file', 'files', 'upload', 'uploads']);

/**
 * Whether a value under one of those keys is actually a file reference.
 *
 * The key alone is not enough: a listing can ask "Photo:" and the buyer can
 * answer "the one I emailed you". Without this the answer is filed as a file
 * named "the one I emailed you" and vanishes from the personalisation lines,
 * where the seller is looking for it.
 */
const looksLikeFileRef = (value: string): boolean =>
  /^(https?:\/\/|\/)/i.test(value.trim());

const round2 = (n: number) => Math.round(n * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The same limits product image uploads already enforce
 * (products.service.ts). Deliberately identical rather than looser: an
 * attachment reaches a buyer's inbox, so it is not the place to start
 * accepting formats nothing else on the platform does.
 */
const ATTACHMENT_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Matches Message.attachmentUrls' documented ceiling and the composer's own. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

@Injectable()
export class SellerOrderDetailService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly storage:  StorageService,
    private readonly shipping: ShippingService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * Resolves the row and proves the caller owns it in one query.
   *
   * Every public method starts here. Looking the row up by id and checking
   * ownership separately is the same rule written twice, and the second copy
   * is the one that gets forgotten.
   */
  private async owned(storeId: string, storeOrderId: string) {
    const row = await this.prisma.storeOrder.findFirst({
      where: { id: storeOrderId, storeId },
    });
    if (!row) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    return row;
  }

  // ── Order details tab ──────────────────────────────────────────────────────

  async getDetail(storeId: string, storeOrderId: string) {
    // findFirst with the store in the WHERE, not owned() followed by a
    // findUnique: one query that cannot return another shop's order, rather
    // than two where the second has forgotten why the first ran.
    const row = await this.prisma.storeOrder.findFirst({
      where:   { id: storeOrderId, storeId },
      include: {
        store:        { select: { id: true, name: true, slug: true } },
        progressStep: { select: { id: true, name: true, kind: true } },
        order: {
          select: {
            id: true, orderNumber: true, status: true, createdAt: true, couponCode: true,
            isGift: true, giftMessage: true, note: true, guestEmail: true,
            shippingName: true, shippingPhone: true, shippingAddress: true,
            shippingCity: true, shippingState: true, shippingZip: true,
            shippingCountry: true, shippingMethod: true,
            user:     { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            payment:  { select: { method: true, status: true, paidAt: true } },
            tracking: { select: { estimatedDeliveryMin: true, estimatedDeliveryMax: true } },
          },
        },
        items: {
          select: {
            id: true, quantity: true, unitPrice: true,
            productName: true, productSlug: true, productImageUrl: true,
            sku: true, variantName: true, variantSnapshot: true,
            customizationData: true, previewUrl: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });

    const subtotal = Number(row.subtotal);
    const discount = Number(row.discountAmount);
    const postage  = Number(row.shippingCost);
    const total    = round2(subtotal - discount + postage);

    return {
      id:          row.id,
      orderId:     row.orderId,
      orderNumber: row.order.orderNumber,
      // The shop's own state — which of ITS orders in this basket is done.
      status:      row.status,
      // The buyer-facing lifecycle, a different thing, and what the
      // panel's status control drives. A basket split across two shops
      // has one of these and two of the above.
      orderStatus: row.order.status,
      step:        row.progressStep,
      shop:        row.store,
      orderedAt:   row.order.createdAt,
      shipByDate:  row.shipByDate,
      isGift:      row.order.isGift,
      giftMessage: row.order.giftMessage,
      buyerNote:   row.order.note,
      // Per-store, so one shop's note stays invisible to the other shop on a
      // split basket. `Order.privateNote` is shared and would not be.
      privateNote: row.sellerNotes,
      itemCount:   row.items.reduce((n, i) => n + i.quantity, 0),
      total,

      buyer: {
        id:        row.order.user?.id ?? null,
        // The name on the parcel wins over the account name — that is who the
        // seller is packing for. Guests have no account at all.
        name:      row.order.shippingName
                   ?? ([row.order.user?.firstName, row.order.user?.lastName].filter(Boolean).join(' ') || null),
        email:     row.order.user?.email ?? row.order.guestEmail ?? null,
        avatarUrl: row.order.user?.avatarUrl ?? null,
        isGuest:   !row.order.user,
      },

      shipTo: {
        name:    row.order.shippingName,
        phone:   row.order.shippingPhone,
        address: row.order.shippingAddress,
        city:    row.order.shippingCity,
        state:   row.order.shippingState,
        zip:     row.order.shippingZip,
        country: row.order.shippingCountry,
      },

      delivery: {
        methodName: row.order.shippingMethod,
        cost:       postage,
        window:     await this.deliveryWindow(row.id, row.shipByDate, row.order.shippingCountry),
      },

      items: row.items.map((i) => ({
        id:              i.id,
        quantity:        i.quantity,
        name:            i.productName,
        slug:            i.productSlug,
        imageUrl:        i.previewUrl ?? i.productImageUrl,
        sku:             i.sku,
        variantName:     i.variantName,
        variantSnapshot: i.variantSnapshot,
        personalization: this.personalizationLines(i.customizationData),
        files:           this.personalizationFiles(i.customizationData, i.previewUrl),
        lineTotal:       round2(Number(i.unitPrice) * i.quantity),
      })),

      receipt: {
        itemTotal:  subtotal,
        discount,
        couponCode: row.order.couponCode,
        subtotal:   round2(subtotal - discount),
        postage,
        total,
        paidVia:    row.order.payment?.method ?? null,
        paidAt:     row.order.payment?.status === 'PAID' ? row.order.payment.paidAt : null,
      },
    };
  }

  /**
   * The delivery window the buyer was quoted.
   *
   * Prefers what the carrier actually said, and falls back to the shop's own
   * published SLA from its delivery profile — resolved through
   * ShippingService, the same function checkout priced the order with, rather
   * than a second copy of the profile-matching rules living here.
   *
   * Returns null rather than a guess when neither exists. A made-up delivery
   * date is a promise the buyer can hold the seller to.
   */
  private async deliveryWindow(
    storeOrderId: string,
    shipByDate:   Date | null,
    country:      string | null,
  ): Promise<{ min: Date; max: Date; source: 'carrier' | 'profile' } | null> {
    const tracking = await this.prisma.orderTracking.findFirst({
      where:  { order: { storeOrders: { some: { id: storeOrderId } } } },
      select: { estimatedDeliveryMin: true, estimatedDeliveryMax: true },
    });
    if (tracking?.estimatedDeliveryMin && tracking.estimatedDeliveryMax) {
      return { min: tracking.estimatedDeliveryMin, max: tracking.estimatedDeliveryMax, source: 'carrier' };
    }

    if (!shipByDate || !country) return null;

    const items = await this.prisma.orderItem.findMany({
      where:  { storeOrderId },
      select: { quantity: true, storeId: true, product: { select: { shippingProfileId: true } } },
    });

    // A deleted product takes its profile with it (OrderItem.productId is
    // SetNull), and resolveSellerShippingCost returns null for the whole set
    // when any item lacks one — an old order simply has no window.
    const resolved = await this.shipping.resolveSellerShippingCost(
      items.map((i) => ({
        storeId:           i.storeId,
        shippingProfileId: i.product?.shippingProfileId ?? null,
        quantity:          i.quantity,
      })),
      country,
    );

    const storeId = items[0]?.storeId;
    const days = storeId ? resolved?.deliveryDays.get(storeId) : undefined;
    if (!days) return null;

    // Measured from the dispatch promise, not from today: the window is when
    // the parcel arrives once it leaves, and anchoring it to `now` would make
    // it slide forward every time the page is opened.
    return {
      min:    new Date(shipByDate.getTime() + days.minDays * DAY_MS),
      max:    new Date(shipByDate.getTime() + days.maxDays * DAY_MS),
      source: 'profile',
    };
  }

  /**
   * The buyer's personalisation, as label/value pairs.
   *
   * `customizationData` is untyped JSON written by whatever built the order,
   * so anything that is not a printable scalar is skipped — `String({})` on a
   * packing screen prints "[object Object]". File entries are pulled out
   * separately by personalizationFiles.
   */
  private personalizationLines(data: unknown): { label: string; value: string }[] {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    return Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => (
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        && String(value).trim() !== ''
      ))
      // Only actual file references move to the file list; a typed answer
      // under a "Photo:" field stays here where the seller reads it.
      .filter(([key, value]) => !(
        FILE_KEYS.has(key.toLowerCase()) && looksLikeFileRef(String(value))
      ))
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  /**
   * Files the buyer uploaded, plus the generated preview when there is one.
   *
   * `isOwn` marks the ones that live in our own storage, and the panel only
   * fetches or links to those. `customizationData` is written by the client at
   * add-to-cart time, so a buyer controls every string in it — rendering an
   * arbitrary value as an image would make the seller's browser call an
   * address the buyer chose, confirming they opened the order and handing over
   * their IP, and a download link would navigate them there outright.
   *
   * Anything else is still returned, so nothing the buyer submitted goes
   * missing from the packing screen — it is shown as plain text instead.
   */
  private personalizationFiles(
    data: unknown,
    previewUrl: string | null,
  ): { name: string; url: string; isOwn: boolean }[] {
    const files: { name: string; url: string; isOwn: boolean }[] = [];
    const add = (url: string, fallbackName: string) => {
      if (files.some((f) => f.url === url)) return;
      files.push({
        name:  url.split('/').pop() || fallbackName,
        url,
        // Root-relative counts too: it resolves against our own origin, so it
        // cannot reach an address the buyer chose. That is the whole test
        // here — not "is this a real file", but "can fetching it phone
        // somewhere a stranger picked".
        isOwn: url.startsWith('/') || this.storage.isOwnStorageUrl(url),
      });
    };

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (!FILE_KEYS.has(key.toLowerCase())) continue;
        for (const url of Array.isArray(value) ? value : [value]) {
          if (typeof url !== 'string' || !looksLikeFileRef(url)) continue;
          add(url.trim(), key);
        }
      }
    }

    if (previewUrl) add(previewUrl, 'preview');
    return files;
  }

  // ── Earnings tab ───────────────────────────────────────────────────────────

  /**
   * What this shop earned on this order.
   *
   * Read from SellerLedgerEntry, not recomputed. The ledger is what payouts
   * are batched from, so these are the numbers the seller is actually paid.
   * Re-running the fee schedule at read time would produce a different answer
   * the moment platform rates change, and the seller would be reading a
   * breakdown of a payment they never received.
   */
  async getEarnings(storeId: string, storeOrderId: string) {
    const row = await this.owned(storeId, storeOrderId);

    const entries = await this.prisma.sellerLedgerEntry.findMany({
      where:   { storeOrderId: row.id, storeId },
      orderBy: { createdAt: 'asc' },
    });

    const subtotal = Number(row.subtotal);
    const discount = Number(row.discountAmount);
    const postage  = Number(row.shippingCost);

    const fees = entries
      .filter((e) => e.type !== SellerLedgerEntryType.SALE)
      .map((e) => ({
        type:   e.type,
        label:  LEDGER_LABELS[e.type] ?? e.description,
        amount: Number(e.amount),
      }));

    const order = await this.prisma.order.findUnique({
      where:  { id: row.orderId },
      select: { couponCode: true },
    });

    return {
      buyerPaid: {
        total:      round2(subtotal - discount + postage),
        itemsPrice: subtotal,
        postage,
        discount,
        couponCode: order?.couponCode ?? null,
        subtotal:   round2(subtotal - discount),
      },
      fees: {
        total: round2(fees.reduce((sum, f) => sum + f.amount, 0)),
        lines: fees,
      },
      // The ledger's own sum, so the three numbers on screen always add up.
      // StoreOrder.sellerEarnings is written at checkout and knows nothing
      // about entries posted later — Share & Save credits, offsite ads fees,
      // manual adjustments. Showing it here would contradict the very lines
      // printed underneath it.
      youEarned: round2(entries.reduce((sum, e) => sum + Number(e.amount), 0)),
      // No ledger rows at all means nothing has been posted yet — an unpaid
      // order. "You earned $0.00" would read as a loss rather than as "not
      // yet".
      pending: entries.length === 0,
    };
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** The seller's own note. Never shown to the buyer, never to another shop. */
  async setPrivateNote(storeId: string, storeOrderId: string, note: string | null) {
    await this.owned(storeId, storeOrderId);
    const trimmed = note?.trim() || null;
    await this.prisma.storeOrder.update({
      where: { id: storeOrderId },
      data:  { sellerNotes: trimmed },
    });
    return { privateNote: trimmed };
  }

  /**
   * Uploads the files the seller picked, and returns their public URLs.
   *
   * Separate from sending so the composer can show a chip per file — and so a
   * rejected file is reported while the seller is still writing, rather than
   * discarding the whole message at Send.
   *
   * Ownership is checked before anything is written: an upload endpoint that
   * accepts a file first and asks who you are afterwards is free storage for
   * anyone with a login.
   */
  async uploadAttachments(
    storeId:      string,
    storeOrderId: string,
    files:        Express.Multer.File[],
  ): Promise<{ name: string; url: string }[]> {
    await this.owned(storeId, storeOrderId);

    if (!files?.length) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'No file was uploaded' });
    }
    if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException({
        code:    'ERR_VALIDATION',
        message: `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`,
      });
    }

    // Validated in full before the first upload, so a rejected second file
    // cannot leave the first one orphaned in the bucket.
    for (const file of files) {
      if (!ATTACHMENT_MIMETYPES.has(file.mimetype)) {
        throw new BadRequestException({
          code:    'ERR_INVALID_FILE_TYPE',
          message: `${file.originalname}: only JPEG, PNG and WebP can be attached`,
        });
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException({
          code:    'ERR_FILE_TOO_LARGE',
          message: `${file.originalname}: max 10 MB per file`,
        });
      }
    }

    const uploaded: { name: string; url: string }[] = [];
    for (const file of files) {
      const key = this.storage.generateKey(`messages/${storeId}`, file.originalname);
      const url = await this.storage.uploadFile(file.buffer, key, file.mimetype);
      uploaded.push({ name: file.originalname, url });
    }
    return uploaded;
  }

  /**
   * The thread with this order's buyer.
   *
   * Keyed on the buyer, not the order: there is one conversation per (shop,
   * buyer) now, so opening any of their orders shows the same history rather
   * than a fragment of it that starts wherever that order did.
   */
  async getThread(storeId: string, storeOrderId: string) {
    const row = await this.owned(storeId, storeOrderId);
    const order = await this.prisma.order.findUniqueOrThrow({
      where:  { id: row.orderId },
      select: { userId: true, guestEmail: true },
    });

    /**
     * An order with neither an account nor a guest email has no buyer to key
     * on, and the guard is not theoretical: `guestEmail: undefined` is not a
     * filter to Prisma, it is an absent one — the where would collapse to
     * "any guest thread in this shop" and hand the seller a different buyer's
     * conversation on the order panel.
     */
    if (!order.userId && !order.guestEmail) {
      return { conversationId: null, messages: [] };
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: order.userId
        ? { storeId, userId: order.userId }
        : { storeId, userId: null, guestEmail: order.guestEmail!.toLowerCase() },
      include: {
        // Newest hundred, reversed below. It used to be every message with no
        // cap, which was survivable while a thread was one order long — a
        // thread is now the shop's whole history with this buyer, and the
        // order panel would load all of it to show the last few.
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true, senderType: true, body: true, attachmentUrls: true,
            createdAt: true, isRead: true,
            // Without this an explicit select silently drops it, and a message
            // the shop unsent renders here in full — the one place that
            // still showed the text it was meant to take back.
            deletedAt: true,
          },
        },
      },
    });
    if (!conversation) return { conversationId: null, messages: [] };

    return {
      conversationId: conversation.id,
      // The text of an unsent message never leaves the API. The renderer
      // here already hides it, but hidden-by-the-renderer is still shipped —
      // it sat in the JSON for anyone who opened the network tab.
      messages: [...conversation.messages]
        .reverse()
        .map((m) => (m.deletedAt ? { ...m, body: '', attachmentUrls: [] } : m)),
    };
  }

  /**
   * Sends the seller's message about this order, opening the thread if this is
   * the first one.
   *
   * The send itself is delegated to MessagesService so the notification, push
   * and moderation side effects are exactly the ones every other message gets.
   * A second write path here would be a message that quietly skips all three.
   */
  async sendMessage(
    storeId:        string,
    storeOrderId:   string,
    senderId:       string,
    body:           string,
    attachmentUrls: string[] = [],
    clientMessageId?: string,
  ) {
    const row = await this.owned(storeId, storeOrderId);

    // Only files we host. The DTO proves the string is a URL; it cannot prove
    // it is ours, and these render as images in the buyer's inbox — an
    // arbitrary URL here is a tracking pixel pointed at a buyer, served by us.
    // The upload endpoint above returns exactly the URLs this accepts.
    for (const url of attachmentUrls) {
      if (!this.storage.isOwnStorageUrl(url)) {
        throw new BadRequestException({
          code:    'ERR_VALIDATION',
          message: 'Attachments must be uploaded here first',
        });
      }
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where:  { id: row.orderId },
      select: { id: true, orderNumber: true, userId: true, guestEmail: true, shippingName: true },
    });

    // One thread per (shop, buyer). Delegated so the key, the lower-casing of
    // a guest email, and the "latest order becomes the context" rule live in
    // one place — a second copy here is how the two would drift and start
    // violating the unique index from opposite directions.
    const conversation = await this.messages.openThreadWithBuyer(
      storeId,
      { userId: order.userId, guestEmail: order.guestEmail, guestName: order.shippingName },
      order.id,
      `Order #${order.orderNumber}`,
    );

    return this.messages.sendMessage(
      conversation.id,
      SenderType.SHOP,
      senderId,
      { body, attachmentUrls, clientMessageId },
      storeId,
    );
  }
}
