import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EconomicProvider, Prisma } from '@prisma/client';
import axios from 'axios';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { economicBalanceDto, EconomicScope, readEconomicBalance, rejectEconomicPayout, reserveEconomicPayout } from './economic-balance';
import { economicEnabled } from './economic-checkout';
import { parseMinorUnits } from './economic-policy';
import { TransferReader, verifyAndSettleEconomicPayout } from './economic-transfer';
import { EconomicHistoryQueryDto, EconomicPayoutRequestDto } from './dto/economic-finances.dto';

type Destination = { kind: string; beneficiaryId: string; currency: string; provenance: string;
  provider: EconomicProvider; providerAccount: string; destination: string };

/** Captured v1 funds only. No legacy rows are reclassified or transferred. */
@Injectable()
export class EconomicFinancesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async affiliateId(userId: string) {
    const affiliate = await this.prisma.affiliateAccount.findUnique({ where: { userId }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== 'ACTIVE') throw new ForbiddenException('Affiliate account is not active');
    return affiliate.id;
  }

  async overview(scope: EconomicScope) {
    return this.prisma.$transaction(async tx => {
      const settings = scope.kind === 'AFFILIATE' ? await tx.affiliateSettings.findUnique({ where: { id: 'singleton' } }) : null;
      const minimumPayoutMinor = scope.kind === 'AFFILIATE' ? parseMinorUnits((settings?.minPayoutAmount ?? new Prisma.Decimal(50)).toString(), 2) : 1n;
      return {
        ...economicBalanceDto(await readEconomicBalance(tx, scope), scope),
        legacy: { classification: 'LEGACY_UNKNOWN', includedInAvailable: false, requiresReconciliation: true },
        minimumPayoutMinor: minimumPayoutMinor.toString(),
        payoutRequestsEnabled: economicEnabled() && this.destination(scope, false) !== null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async statement(scope: EconomicScope, query: EconomicHistoryQueryDto, orderId?: string) {
    const where: Prisma.EconomicBalanceLotWhereInput = { account: scope,
      ...(orderId ? { capture: { context: { orderId } } } : {}) };
    return this.prisma.$transaction(async tx => {
      const total = await tx.economicBalanceLot.count({ where });
      const rows = await tx.economicBalanceLot.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { capture: { select: { context: { select: { orderId: true } } } } } });
      return { version: 'economic-v1', ...scope, total, page: query.page, limit: query.limit,
        data: rows.map(row => ({ id: row.id, orderId: row.capture.context.orderId, captureId: row.captureId, sourceKey: row.sourceKey,
          capturedMinor: row.amountMinor.toString(), reservedMinor: row.reservedMinor.toString(), paidMinor: row.paidMinor.toString(),
          holdReason: row.holdReason, createdAt: row.createdAt })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async payouts(scope: EconomicScope, query: EconomicHistoryQueryDto) {
    const where = { account: scope };
    return this.prisma.$transaction(async tx => {
      const total = await tx.economicPayout.count({ where });
      const rows = await tx.economicPayout.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { allocations: { include: { lot: { select: { captureId: true, sourceKey: true } } } } } });
      return { version: 'economic-v1', ...scope, total, page: query.page, limit: query.limit, data: rows.map(row => ({
        id: row.id, amountMinor: row.amountMinor.toString(), state: row.state, createdAt: row.createdAt,
        processedAt: row.processedAt, processedBy: row.processedBy, rejectionReason: row.rejectionReason,
        verificationStartedAt: row.verificationStartedAt, verificationStartedBy: row.verificationStartedBy,
        transferReference: row.transferReference, allocations: row.allocations.map(part => ({
          lotId: part.lotId, captureId: part.lot.captureId, sourceKey: part.lot.sourceKey, amountMinor: part.amountMinor.toString(),
        })),
      })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async request(scope: EconomicScope, actorId: string, dto: EconomicPayoutRequestDto) {
    if (!economicEnabled()) throw new BadRequestException('Economic payout requests are not enabled');
    const recipient = this.destination(scope, true);
    if (!recipient) throw new BadRequestException('No verified payout destination is configured');
    const settings = scope.kind === 'AFFILIATE' ? await this.prisma.affiliateSettings.findUnique({ where: { id: 'singleton' } }) : null;
    const minimumMinor = scope.kind === 'AFFILIATE' ? parseMinorUnits((settings?.minPayoutAmount ?? new Prisma.Decimal(50)).toString(), 2) : 1n;
    const result = await reserveEconomicPayout(this.prisma, { scope, actorId, amountMinor: dto.amountMinor, minimumMinor,
      idempotencyKey: dto.idempotencyKey, destination: recipient.destination });
    return { id: result.id, state: result.state, amountMinor: result.amountMinor.toString() };
  }

  reject(id: string, actorId: string, reason: string, scope: EconomicScope) {
    return rejectEconomicPayout(this.prisma, id, actorId, reason, scope);
  }

  async settle(id: string, actorId: string, reference: string, scope: EconomicScope) {
    // No transfer write; an independently completed transfer must be retrieved and verified.
    const recipient = this.destination(scope, true);
    if (!recipient) throw new BadRequestException('No verified payout destination is configured');
    const reader = this.transferReader(scope, recipient);
    return verifyAndSettleEconomicPayout(this.prisma, id, actorId, reference, reader, scope);
  }

  private destination(scope: EconomicScope, required: boolean): Destination | null {
    // Deployment/operator-managed verified recipients; NEVER taken from a request body.
    const raw = this.config.get<string>('ECONOMIC_PAYOUT_DESTINATIONS') ?? '[]';
    let entries: Destination[];
    try { entries = JSON.parse(raw); } catch { throw new BadRequestException('Payout configuration is invalid'); }
    if (!Array.isArray(entries)) throw new BadRequestException('Payout configuration is invalid');
    const matches = entries.filter(row => row && row.kind === scope.kind && row.beneficiaryId === scope.beneficiaryId
      && row.currency === scope.currency && row.provenance === scope.provenance);
    const found = matches[0];
    if (matches.length > 1 || (found && (!['STRIPE', 'PAYPAL'].includes(found.provider) || typeof found.destination !== 'string'
      || !found.destination.trim() || found.destination.length > 150 || typeof found.providerAccount !== 'string' || !found.providerAccount))) {
      throw new BadRequestException('Payout configuration is invalid');
    }
    if (!found && required) throw new BadRequestException('No verified payout destination is configured');
    return found ?? null;
  }

  private transferReader(scope: EconomicScope, recipient: Destination): TransferReader {
    const common = { provider: recipient.provider, providerAccount: recipient.providerAccount, provenance: scope.provenance };
    if (recipient.provider === 'STRIPE') {
      const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
      if (!key.startsWith(scope.provenance === 'LIVE' ? 'sk_live_' : 'sk_test_') || !/^acct_[A-Za-z0-9]+$/.test(recipient.providerAccount)) throw new BadRequestException('Stripe payout mode/account mismatch');
      const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const, timeout: 10_000, maxNetworkRetries: 0 });
      return { ...common, read: async expected => {
        if ((await stripe.accounts.retrieve(null)).id !== recipient.providerAccount || !/^tr_[A-Za-z0-9]+$/.test(expected.transferReference)) throw new Error('Stripe transfer account/reference mismatch');
        return stripe.transfers.retrieve(expected.transferReference);
      } };
    }
    if (this.config.get<string>('PAYPAL_MODE') !== (scope.provenance === 'LIVE' ? 'live' : 'sandbox')
      || this.config.get<string>('ECONOMIC_PAYPAL_MERCHANT_ID') !== recipient.providerAccount) throw new BadRequestException('PayPal payout mode/account mismatch');
    const origin = scope.provenance === 'LIVE' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    return { ...common, read: async expected => {
      if (!/^[A-Za-z0-9]{1,100}$/.test(expected.transferReference)) throw new Error('Invalid PayPal payout identity');
      const clientId = this.config.get<string>('PAYPAL_CLIENT_ID'), secret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
      if (!clientId || !secret) throw new BadRequestException('PayPal payouts are not configured');
      const token = await axios.post(`${origin}/v1/oauth2/token`, 'grant_type=client_credentials', {
        auth: { username: clientId, password: secret }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000, maxRedirects: 0,
      });
      if (typeof token.data?.access_token !== 'string' || !token.data.access_token) throw new Error('PayPal authentication failed');
      return (await axios.get(`${origin}/v1/payments/payouts-item/${expected.transferReference}`, {
        headers: { Authorization: `Bearer ${token.data.access_token}` }, timeout: 10_000, maxRedirects: 0,
      })).data;
    } };
  }
}
