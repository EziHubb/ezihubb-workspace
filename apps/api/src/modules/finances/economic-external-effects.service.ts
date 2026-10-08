import { BadRequestException, ConflictException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EconomicExternalEffect, EconomicProvenance, Prisma } from '@prisma/client';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { economicTransaction } from './economic-balance';
import { economicEnabled, economicMode } from './economic-checkout';
import { assertEconomicShopFulfillmentAllowed } from './economic-fulfillment-guard';
import { executeExternalEffect, externalEffectHash } from './economic-external-effect';
import { FrozenPodPayload, verifyPrintifyPod } from './economic-printify-proof';
import { EconomicQuote, quoteFingerprint } from './economic-quote';
import { EconomicExternalEffectsQueryDto } from './dto/economic-finances.dto';

@Injectable()
export class EconomicExternalEffectsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EconomicExternalEffectsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly encryption: EncryptionService) {}
  podEnabled(provenance: EconomicProvenance) {
    // Printify has no sandbox binding in the connected-account schema. TEST
    // cannot use a live seller connection even if other economic gates are on.
    return provenance === 'LIVE' && economicEnabled() && economicMode() === provenance
      && this.config.get<string>('ECONOMIC_POD_ENABLED') === 'true';
  }
  smtpAccount() { return externalEffectHash({ host: this.config.get<string>('email.host') ?? '', from: this.config.get<string>('email.from') ?? '' }); }
  private emailEnabled() { return economicEnabled() && economicMode() === 'LIVE' && this.config.get<string>('ECONOMIC_EMAIL_ENABLED') === 'true'; }
  onApplicationBootstrap() {
    if (!this.emailEnabled()) return;
    this.timer = setInterval(() => { void this.tick().catch(() => this.logger.error('External email tick failed; original intents retained')); }, 10_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async list(query: EconomicExternalEffectsQueryDto) {
    const where: Prisma.EconomicExternalEffectWhereInput = {
      context: { provenance: query.provenance, currency: query.currency, ...(query.orderId ? { orderId: query.orderId } : {}) },
      ...(query.kind ? { kind: query.kind } : {}), ...(query.state ? { state: query.state } : {}),
    };
    return this.prisma.$transaction(async tx => {
      const total = await tx.economicExternalEffect.count({ where });
      const rows = await tx.economicExternalEffect.findMany({ where, take: query.limit, skip: (query.page - 1) * query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { context: { select: { orderId: true } } } });
      return { version: 'economic-v1', provenance: query.provenance, currency: query.currency, total, page: query.page, limit: query.limit,
        podEnabled: this.podEnabled(query.provenance), data: rows.map(row => ({ id: row.id, kind: row.kind, state: row.state,
          orderId: row.context.orderId, storeOrderId: row.storeOrderId, connectionId: row.connectionId,
          sourceEventId: row.sourceEventId, providerReference: row.providerReference,
          requestedBy: row.requestedBy, reason: row.reason, createdAt: row.createdAt, completedAt: row.completedAt,
          resultBasis: row.kind === 'EMAIL_TRANSACTIONAL' ? 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' : 'ORIGINAL_PROVIDER_RESOURCE' })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async preparePod(storeOrderId: string, actorId: string, provenance: EconomicProvenance, reason: string) {
    if (!this.podEnabled(provenance)) throw new BadRequestException('Versioned POD writes are not enabled for a verified LIVE connection');
    if (!actorId || actorId !== actorId.trim() || !reason || reason !== reason.trim() || reason.length > 500) throw new BadRequestException('POD audit identity and reason required');
    return economicTransaction(this.prisma, async tx => {
      const shop = await tx.storeOrder.findUniqueOrThrow({ where: { id: storeOrderId }, include: { order: { include: { economicContext: true, user: true } }, items: true, store: true } });
      const context = shop.order.economicContext;
      if (!context || context.provenance !== provenance) throw new BadRequestException('Versioned shop scope mismatch');
      await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${context.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${shop.orderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "StoreOrder" WHERE "id" = ${storeOrderId} FOR UPDATE`;
      const existing = await tx.economicExternalEffect.findMany({ where: { contextId: context.id, storeOrderId, kind: 'POD_PRINTIFY' }, orderBy: { id: 'asc' } });
      if (existing.length) return { ids: existing.map(row => row.id), alreadyPrepared: true };
      if (shop.store.fulfillmentMode !== 'AUTOMATIC') throw new ConflictException('Shop has not selected automatic POD fulfillment');
      await this.authorizePod(tx, { contextId: context.id, storeOrderId } as EconomicExternalEffect);
      const quote = context.quote as unknown as EconomicQuote;
      if (quoteFingerprint(quote) !== context.quoteHash) throw new ConflictException('Original POD quote mismatch');
      const original = quote.parts.filter(part => part.kind === 'ITEM' && part.storeOrderId === storeOrderId);
      if (!original.length || original.length !== shop.items.length) throw new ConflictException('Original complete shop item coverage required');
      const groups = new Map<string, { account: string; items: FrozenPodPayload['items'] }>();
      for (const part of original) {
        const item = shop.items.find(row => row.id === part.lineId);
        if (!item || !part.productId || item.productId !== part.productId || item.variantId !== part.variantId || item.quantity !== part.quantity
          || item.customizationData !== null || item.previewUrl) throw new ConflictException('Personalized, removed or changed POD items require a verified artwork contract/manual fulfillment');
        const mappings = await tx.productFulfillmentMapping.findMany({ where: { productId: part.productId, variantId: part.variantId }, include: { connection: true } });
        if (mappings.length !== 1) throw new ConflictException('Every original item requires exactly one provider mapping');
        const mapping = mappings[0], connection = mapping.connection;
        if (connection.storeId !== shop.storeId || connection.status !== 'ACTIVE' || connection.provider !== 'PRINTIFY'
          || !/^[1-9]\d{0,14}$/.test(connection.externalShopId) || !/^[A-Za-z0-9_-]{1,150}$/.test(mapping.externalProductId)
          || !/^[1-9]\d{0,9}$/.test(mapping.externalVariantId) || !Number.isSafeInteger(Number(mapping.externalVariantId))) {
          throw new ConflictException('Verified owned Printify mapping required; unsupported providers stay manual');
        }
        const group = groups.get(connection.id) ?? { account: connection.externalShopId, items: [] };
        group.items.push({ lineId: item.id, productId: part.productId, variantId: part.variantId,
          externalProductId: mapping.externalProductId, externalVariantId: Number(mapping.externalVariantId), quantity: part.quantity });
        groups.set(connection.id, group);
      }
      const order = shop.order;
      if (!order.shippingName || !order.shippingAddress || !order.shippingCity || !order.shippingZip || !/^[A-Z]{2}$/.test(order.shippingCountry ?? '')) {
        throw new ConflictException('Complete original shipping address required');
      }
      const [first, ...last] = order.shippingName.trim().split(/\s+/);
      const address = { first_name: first, last_name: last.join(' ') || '-', address1: order.shippingAddress,
        city: order.shippingCity, zip: order.shippingZip, country: order.shippingCountry as string,
        region: order.shippingState ?? '', phone: order.shippingPhone ?? '', email: order.user?.email ?? order.guestEmail ?? '' };
      const ids: string[] = [];
      for (const [connectionId, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
        const payload: FrozenPodPayload = { version: 'pod-v1', address, items: group.items.sort((a,b) => a.lineId.localeCompare(b.lineId)) };
        const created = await tx.economicExternalEffect.create({ data: { contextId: context.id, storeOrderId, connectionId,
          kind: 'POD_PRINTIFY', providerAccount: group.account, effectKey: externalEffectHash({ contextId: context.id, storeOrderId, connectionId }),
          payload: payload as unknown as Prisma.InputJsonValue, payloadHash: externalEffectHash(payload), requestedBy: actorId, reason } });
        ids.push(created.id);
      }
      return { ids, alreadyPrepared: false };
    });
  }
  private async authorizePod(tx: Prisma.TransactionClient, effect: EconomicExternalEffect) {
    const context = await tx.economicOrderContext.findUniqueOrThrow({ where: { id: effect.contextId } });
    if (!effect.storeOrderId || !await assertEconomicShopFulfillmentAllowed(tx, context.orderId, [effect.storeOrderId])) throw new ConflictException('Verified versioned shop fulfillment required');
    const refunds = await tx.economicRefund.count({ where: { request: { capture: { contextId: context.id } } } });
    if (refunds) throw new ConflictException('A refunded order requires manual fulfillment reconciliation, not automatic POD');
    const attempts = await tx.storeOrderFulfillment.count({ where: { storeOrderId: effect.storeOrderId } });
    if (attempts) throw new ConflictException('Existing legacy/provider fulfillment attempt requires reconciliation');
  }
  async executePod(id: string, provenance: EconomicProvenance, reference?: string) {
    if (!this.podEnabled(provenance)) throw new BadRequestException('Versioned POD writes are not enabled');
    const effect = await this.prisma.economicExternalEffect.findUniqueOrThrow({ where: { id }, include: { context: true } });
    if (effect.kind !== 'POD_PRINTIFY' || !effect.connectionId || effect.context.provenance !== provenance) throw new BadRequestException('POD scope mismatch');
    const connection = await this.prisma.storeFulfillmentConnection.findUniqueOrThrow({ where: { id: effect.connectionId } });
    const shop = await this.prisma.storeOrder.findUniqueOrThrow({ where: { id: effect.storeOrderId as string } });
    if (connection.status !== 'ACTIVE' || connection.provider !== 'PRINTIFY' || connection.externalShopId !== effect.providerAccount || connection.storeId !== shop.storeId) {
      throw new ConflictException('Original provider connection changed or disconnected');
    }
    const client = axios.create({ baseURL: 'https://api.printify.com/v1', timeout: 10_000, maxRedirects: 0,
      headers: { Authorization: `Bearer ${this.encryption.decrypt(connection.encryptedApiKey)}`, 'User-Agent': 'EziHubb/economic-v1' } });
    const payload = effect.payload as unknown as FrozenPodPayload;
    return executeExternalEffect(this.prisma, id, provenance, { kind: effect.kind, providerAccount: effect.providerAccount, provenance,
      create: async current => {
        const shops: unknown = (await client.get('/shops.json')).data;
        if (!Array.isArray(shops) || !shops.some(row => row && String(row.id) === effect.providerAccount)) throw new Error('Provider account is not bound to the original shop');
        const result: unknown = (await client.post(`/shops/${effect.providerAccount}/orders.json`, { external_id: current.id,
          line_items: payload.items.map(item => ({ product_id: item.externalProductId, variant_id: item.externalVariantId,
            quantity: item.quantity, external_id: `${current.id}-${item.lineId}` })), address_to: payload.address,
          shipping_method: 1, send_shipping_notification: false })).data;
        const identity = result && typeof result === 'object' ? (result as { id?: unknown }).id : null;
        if (typeof identity !== 'string') throw new Error('Missing original provider resource identity');
        return identity;
      }, verify: async (current, resourceId) => verifyPrintifyPod((await client.get(`/shops/${effect.providerAccount}/orders/${encodeURIComponent(resourceId)}.json`)).data,
        current.id, resourceId, payload),
    }, (tx, current) => this.authorizePod(tx, current), reference);
  }
  async tick() {
    if (this.running || !this.emailEnabled()) return;
    this.running = true;
    try {
      await this.prisma.economicExternalEffect.updateMany({ where: { state: 'DISPATCHED', dispatchedAt: { lte: new Date(Date.now() - 30_000) },
        context: { provenance: 'LIVE' } }, data: { state: 'NEEDS_RECONCILIATION' } });
      const rows = await this.prisma.economicExternalEffect.findMany({ where: { kind: 'EMAIL_TRANSACTIONAL', state: 'PREPARED',
        context: { provenance: 'LIVE' } }, take: 20, orderBy: { createdAt: 'asc' } });
      for (const row of rows) { try { await this.sendEmail(row); } catch { this.logger.warn(`Email outcome requires reconciliation: ${row.id}`); } }
    } finally { this.running = false; }
  }
  private async sendEmail(effect: EconomicExternalEffect) {
    const host = this.config.get<string>('email.host'), from = this.config.get<string>('email.from');
    if (!host || !from || this.smtpAccount() !== effect.providerAccount || externalEffectHash(effect.payload) !== effect.payloadHash) throw new Error('Original SMTP binding unavailable');
    const payload = effect.payload as { version?: unknown; to?: unknown; subject?: unknown; text?: unknown };
    if (payload.version !== 'notification-v1' || typeof payload.to !== 'string' || typeof payload.subject !== 'string' || typeof payload.text !== 'string') throw new Error('Invalid frozen email intent');
    const token = randomBytes(24).toString('hex');
    const claimed = await this.prisma.economicExternalEffect.updateMany({ where: { id: effect.id, state: 'PREPARED' },
      data: { state: 'DISPATCHED', dispatchToken: token, dispatchedAt: new Date() } });
    if (claimed.count !== 1) return;
    try {
      const transport = nodemailer.createTransport({ host, port: this.config.get<number>('email.port') ?? 587,
        secure: this.config.get<boolean>('email.secure') ?? false, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
        auth: { user: this.config.get<string>('email.user'), pass: this.config.get<string>('email.pass') } });
      const ack = await transport.sendMail({ from, to: payload.to, subject: payload.subject, text: payload.text,
        messageId: `<economic-${effect.id}@ezihubb.com>` });
      if (!Array.isArray(ack.accepted) || !ack.accepted.some((value: unknown) => value === payload.to)
        || !Array.isArray(ack.rejected) || ack.rejected.length) throw new Error('SMTP acceptance is not verified');
      const changed = await this.prisma.economicExternalEffect.updateMany({ where: { id: effect.id, dispatchToken: token,
        state: { in: ['DISPATCHED','NEEDS_RECONCILIATION'] } }, data: { state: 'SUCCEEDED', providerReference: `smtp-${effect.id}`,
        evidenceHash: externalEffectHash({ id: effect.id, payloadHash: effect.payloadHash, accepted: payload.to, basis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' }), completedAt: new Date() } });
      if (changed.count !== 1) throw new Error('SMTP result storage changed; no resend');
    } catch (error) {
      await this.prisma.economicExternalEffect.updateMany({ where: { id: effect.id, state: 'DISPATCHED', dispatchToken: token }, data: { state: 'NEEDS_RECONCILIATION' } });
      throw error;
    }
  }
}
