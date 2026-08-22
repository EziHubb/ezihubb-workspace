import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

const OFFER_EXPIRY_HOURS = 48;
const SHOP_URL = process.env['CLIENT_URL'] ?? 'https://ezihubb.com';
const ACTIVE_STATUSES = ['PENDING', 'COUNTERED'] as const;

@Injectable()
export class BuyerOffersService {
  private readonly logger = new Logger(BuyerOffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Seller settings ──────────────────────────────────────────────────────────

  async getSettings(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { offersEnabled: true, offersScope: true, offersMaxDiscountPercent: true },
    });
    if (!store) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Store not found' });
    const listings = await this.prisma.storeOfferListing.findMany({ where: { storeId }, select: { productId: true } });
    return {
      offersEnabled: store.offersEnabled,
      offersScope: store.offersScope,
      offersMaxDiscountPercent: store.offersMaxDiscountPercent !== null ? Number(store.offersMaxDiscountPercent) : null,
      productIds: listings.map((l) => l.productId),
    };
  }

  async updateSettings(storeId: string, input: {
    offersEnabled: boolean;
    offersScope: 'ALL_LISTINGS' | 'SPECIFIC_LISTINGS';
    offersMaxDiscountPercent: number | null;
    productIds?: string[];
  }) {
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        offersEnabled: input.offersEnabled,
        offersScope: input.offersScope,
        offersMaxDiscountPercent: input.offersMaxDiscountPercent,
      },
    });
    if (input.offersScope === 'SPECIFIC_LISTINGS' && input.productIds) {
      await this.prisma.storeOfferListing.deleteMany({ where: { storeId } });
      await this.prisma.storeOfferListing.createMany({
        data: input.productIds.map((productId) => ({ storeId, productId })),
      });
    }
    return this.getSettings(storeId);
  }

  /** Whether a specific product currently accepts offers — for the buyer-facing "Make an offer" button. */
  async isEligible(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { storeId: true } });
    if (!product?.storeId) return false;
    const store = await this.prisma.store.findUnique({
      where: { id: product.storeId },
      select: { offersEnabled: true, offersScope: true },
    });
    if (!store?.offersEnabled) return false;
    if (store.offersScope === 'ALL_LISTINGS') return true;
    const listed = await this.prisma.storeOfferListing.findFirst({ where: { storeId: product.storeId, productId } });
    return !!listed;
  }

  // ── Buyer ────────────────────────────────────────────────────────────────────

  async createOffer(buyerId: string, productId: string, offeredPrice: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, storeId: true, basePrice: true },
    });
    if (!product || !product.storeId) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const store = await this.prisma.store.findUnique({
      where: { id: product.storeId },
      select: { offersEnabled: true, offersScope: true, offersMaxDiscountPercent: true, name: true, owner: { select: { email: true, firstName: true } } },
    });
    if (!store?.offersEnabled) {
      throw new BadRequestException({ code: 'ERR_OFFERS_DISABLED', message: 'This shop is not accepting offers' });
    }

    if (store.offersScope === 'SPECIFIC_LISTINGS') {
      const eligible = await this.prisma.storeOfferListing.findFirst({ where: { storeId: product.storeId, productId } });
      if (!eligible) {
        throw new BadRequestException({ code: 'ERR_OFFERS_NOT_ELIGIBLE', message: 'This listing does not accept offers' });
      }
    }

    const basePrice = Number(product.basePrice);
    if (offeredPrice <= 0 || offeredPrice >= basePrice) {
      throw new BadRequestException({ code: 'ERR_OFFER_INVALID', message: 'Offer must be a positive amount less than the listing price' });
    }
    if (store.offersMaxDiscountPercent !== null) {
      const floor = basePrice * (1 - Number(store.offersMaxDiscountPercent) / 100);
      if (offeredPrice < floor) {
        throw new BadRequestException({
          code: 'ERR_OFFER_TOO_LOW',
          message: `The lowest offer this seller accepts is ${floor.toFixed(2)}`,
        });
      }
    }

    const existing = await this.prisma.buyerOffer.findFirst({
      where: { buyerId, productId, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (existing) {
      throw new BadRequestException({ code: 'ERR_OFFER_PENDING', message: 'You already have an active offer on this listing' });
    }

    const offer = await this.prisma.buyerOffer.create({
      data: {
        productId,
        buyerId,
        storeId: product.storeId,
        offeredPrice,
        expiresAt: new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    if (store.owner?.email) {
      this.emailQueue
        .add(JOBS.SEND_EMAIL, {
          to: store.owner.email,
          template: 'new-buyer-offer',
          subject: `New offer on ${product.name}: $${offeredPrice.toFixed(2)}`,
          data: {
            storeName: store.name,
            firstName: store.owner.firstName ?? 'there',
            productName: product.name,
            listPrice: basePrice.toFixed(2),
            offeredPrice: offeredPrice.toFixed(2),
            inboxUrl: `${SHOP_URL}/admin/marketing/sales`,
            year: new Date().getFullYear(),
          },
        }, DEFAULT_JOB_OPTIONS)
        .catch((err) => this.logger.warn(`Failed to queue new-buyer-offer email: ${(err as Error).message}`));
    }

    return offer;
  }

  /**
   * The buyer's offers, each accepted one carrying the code it produced.
   *
   * Accepting an offer does not change the listing price — it mints a
   * single-use Promotion scoped to that buyer and that product. Without the
   * code, an ACCEPTED offer is worth nothing, and this endpoint used to return
   * only the offer row: the buyer saw a green "accepted" badge on the page
   * built to track offers, while the one thing that made it redeemable existed
   * solely in an email. A missed or filtered mail left them with no way back to
   * it.
   *
   * The link is the promotion's description, which acceptOffer writes as
   * `buyer-offer:<offerId>`. That is a string join rather than a foreign key —
   * not ideal, but it is the link that already exists, and adding a real column
   * would be a migration for data that is already recoverable.
   */
  async listMyOffers(buyerId: string) {
    await this.expireStale({ buyerId });

    const offers = await this.prisma.buyerOffer.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, slug: true, basePrice: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } } },
    });

    const acceptedIds = offers.filter((o) => o.status === 'ACCEPTED').map((o) => o.id);
    if (acceptedIds.length === 0) {
      return offers.map((o) => ({ ...o, code: null, codeExpiresAt: null, codeUsed: false }));
    }

    // One query for every accepted offer rather than one per row.
    const promos = await this.prisma.promotion.findMany({
      where: { description: { in: acceptedIds.map((id) => `buyer-offer:${id}`) } },
      select: {
        code: true,
        description: true,
        expiresAt: true,
        // Promotion has no usage counter of its own; redemption lives in
        // PromotionUsage, so presence of a row is what "already used" means.
        _count: { select: { usages: true } },
      },
    });

    const byOfferId = new Map(
      promos
        .filter((pr) => pr.description?.startsWith('buyer-offer:'))
        .map((pr) => [pr.description!.slice('buyer-offer:'.length), pr]),
    );

    return offers.map((o) => {
      const pr = byOfferId.get(o.id);
      return {
        ...o,
        // Null rather than absent for offers with no code, so the client has
        // one shape to render instead of two.
        code:          pr?.code ?? null,
        codeExpiresAt: pr?.expiresAt ?? null,
        codeUsed:      (pr?._count.usages ?? 0) > 0,
      };
    });
  }

  async respondToCounter(buyerId: string, offerId: string, accept: boolean) {
    const offer = await this.prisma.buyerOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.buyerId !== buyerId) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Offer not found' });
    if (await this.expireIfPast(offer)) {
      throw new BadRequestException({ code: 'ERR_OFFER_EXPIRED', message: 'This offer has expired' });
    }
    if (offer.status !== 'COUNTERED') throw new BadRequestException({ code: 'ERR_INVALID_STATE', message: 'This offer has no active counter' });

    if (!accept) {
      await this.prisma.buyerOffer.update({ where: { id: offerId }, data: { status: 'REJECTED' } });
      return { status: 'REJECTED' };
    }

    return this.accept(offer.id, offer.counterPrice ? Number(offer.counterPrice) : Number(offer.offeredPrice));
  }

  // ── Seller ───────────────────────────────────────────────────────────────────

  async listInbox(storeId: string, status?: string) {
    await this.expireStale({ storeId });
    return this.prisma.buyerOffer.findMany({
      where: { storeId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, slug: true, basePrice: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
        buyer: { select: { firstName: true, lastName: true, email: true } },
      },
      take: 100,
    });
  }

  async sellerAccept(storeId: string, offerId: string) {
    const offer = await this.requireOwnedOffer(storeId, offerId);
    if (await this.expireIfPast(offer)) {
      throw new BadRequestException({ code: 'ERR_OFFER_EXPIRED', message: 'This offer has expired' });
    }
    return this.accept(offer.id, Number(offer.offeredPrice));
  }

  async sellerReject(storeId: string, offerId: string) {
    const offer = await this.requireOwnedOffer(storeId, offerId);
    if (await this.expireIfPast(offer)) {
      return { status: 'EXPIRED' };
    }
    if (!ACTIVE_STATUSES.includes(offer.status as (typeof ACTIVE_STATUSES)[number])) {
      throw new BadRequestException({ code: 'ERR_INVALID_STATE', message: 'This offer is no longer active' });
    }
    await this.prisma.buyerOffer.update({ where: { id: offerId }, data: { status: 'REJECTED' } });
    return { status: 'REJECTED' };
  }

  async sellerCounter(storeId: string, offerId: string, counterPrice: number) {
    const offer = await this.requireOwnedOffer(storeId, offerId);
    if (await this.expireIfPast(offer)) {
      throw new BadRequestException({ code: 'ERR_OFFER_EXPIRED', message: 'This offer has expired' });
    }
    if (offer.status !== 'PENDING') {
      throw new BadRequestException({ code: 'ERR_INVALID_STATE', message: 'Only a pending offer can be countered' });
    }
    const updated = await this.prisma.buyerOffer.update({
      where: { id: offerId },
      data: { status: 'COUNTERED', counterPrice },
      include: {
        product: { select: { name: true } },
        buyer: { select: { email: true, firstName: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    if (updated.buyer.email) {
      this.emailQueue
        .add(JOBS.SEND_EMAIL, {
          to: updated.buyer.email,
          template: 'offer-countered',
          subject: `${updated.store.name} countered your offer on ${updated.product.name}`,
          data: {
            storeName: updated.store.name,
            firstName: updated.buyer.firstName ?? 'there',
            productName: updated.product.name,
            yourOffer: Number(updated.offeredPrice).toFixed(2),
            counterPrice: counterPrice.toFixed(2),
            offersUrl: `${SHOP_URL}/account/offers`,
            expiresAt: updated.expiresAt.toLocaleDateString(),
            year: new Date().getFullYear(),
          },
        }, DEFAULT_JOB_OPTIONS)
        .catch((err) => this.logger.warn(`Failed to queue offer-countered email: ${(err as Error).message}`));
    }

    return updated;
  }

  // ── Shared: expiry + accept → generate a single-use targeted code ──────────

  private async requireOwnedOffer(storeId: string, offerId: string) {
    const offer = await this.prisma.buyerOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.storeId !== storeId) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Offer not found' });
    return offer;
  }

  /** Bulk-flips any stale PENDING/COUNTERED rows to EXPIRED before a list read, so status badges stay accurate without a scheduled job. */
  private async expireStale(scope: { buyerId?: string; storeId?: string }): Promise<void> {
    await this.prisma.buyerOffer.updateMany({
      where: { ...scope, status: { in: [...ACTIVE_STATUSES] }, expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  /** Per-offer expiry check used before a mutating action — flips the single row and reports whether it was (already) expired. */
  private async expireIfPast(offer: { id: string; status: string; expiresAt: Date }): Promise<boolean> {
    if (!ACTIVE_STATUSES.includes(offer.status as (typeof ACTIVE_STATUSES)[number])) return false;
    if (offer.expiresAt >= new Date()) return false;
    await this.prisma.buyerOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } });
    return true;
  }

  private async accept(offerId: string, acceptedPrice: number) {
    const offer = await this.prisma.buyerOffer.findUnique({
      where: { id: offerId },
      include: {
        product: { select: { name: true, basePrice: true } },
        buyer: { select: { email: true, firstName: true } },
        store: { select: { name: true, slug: true } },
      },
    });
    if (!offer) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Offer not found' });
    if (offer.status !== 'PENDING' && offer.status !== 'COUNTERED') {
      throw new BadRequestException({ code: 'ERR_INVALID_STATE', message: 'This offer can no longer be accepted' });
    }

    const discount = Math.round((Number(offer.product.basePrice) - acceptedPrice) * 100) / 100;
    const code = `OFFER-${randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000);

    // updateMany + affected-row check makes the PENDING/COUNTERED → ACCEPTED
    // transition atomic (guards a double-click / accept+accept-counter race)
    // AND re-validates expiry inside the same query, closing the gap between
    // the expireIfPast() check above and this write.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.buyerOffer.updateMany({
        where: { id: offerId, status: { in: [...ACTIVE_STATUSES] }, expiresAt: { gt: new Date() } },
        data: { status: 'ACCEPTED' },
      });
      if (count === 0) {
        throw new BadRequestException({ code: 'ERR_INVALID_STATE', message: 'This offer can no longer be accepted' });
      }
      await tx.promotion.create({
        data: {
          code,
          type: 'FIXED_AMOUNT',
          value: discount,
          maxUses: 1,
          maxUsesPerUser: 1,
          storeId: offer.storeId,
          scope: 'SPECIFIC_LISTINGS',
          targetUserId: offer.buyerId,
          expiresAt,
          description: `buyer-offer:${offer.id}`,
          products: { create: [{ productId: offer.productId }] },
        },
      });
    });

    this.emailQueue
      .add(JOBS.SEND_EMAIL, {
        to: offer.buyer.email,
        template: 'targeted-offer',
        subject: `Your offer on ${offer.product.name} was accepted!`,
        data: {
          storeName: offer.store.name,
          firstName: offer.buyer.firstName ?? 'there',
          headline: 'Your offer was accepted!',
          message: `Great news — ${offer.store.name} accepted your offer of $${acceptedPrice.toFixed(2)} on ${offer.product.name}. Use the code below at checkout.`,
          code,
          discountLabel: `$${discount.toFixed(2)}`,
          expiresAt: expiresAt.toLocaleDateString(),
          shopUrl: `${SHOP_URL}/shops/${offer.store.slug}`,
          year: new Date().getFullYear(),
        },
      }, DEFAULT_JOB_OPTIONS)
      .catch((err) => this.logger.warn(`Failed to queue offer-accepted email: ${(err as Error).message}`));

    return { status: 'ACCEPTED', code };
  }
}
