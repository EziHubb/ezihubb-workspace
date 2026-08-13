import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma, SellerLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import {
  UpdateBankAccountDto,
  UpdateCurrencyDto,
  UpdateAutoBillingDto,
  UpdateTaxInfoDto,
  ActivitiesQueryDto,
} from './dto/finances.dto';

/** Etsy shows "No funds ready for deposit … above $X" for a small minimum —
 *  this system has no real hold/reserve mechanic, so it's purely a display
 *  threshold on the current ledger balance. */
const DEPOSIT_MIN_AMOUNT = 2;

const FEE_TYPES: SellerLedgerEntryType[] = [
  'TRANSACTION_FEE', 'PAYMENT_PROCESSING_FEE', 'REGULATORY_FEE', 'LISTING_FEE', 'VAT', 'DEPOSIT_FEE',
];

interface RawLedgerRow {
  id: string;
  createdAt: Date;
  type: SellerLedgerEntryType | 'PAYOUT';
  amount: Prisma.Decimal | number;
  description: string;
  storeOrderId: string | null;
  runningBalance: Prisma.Decimal | number;
}

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2026-04-22.dahlia' as const,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** [start, end) for a given month/year, or the current calendar month if omitted. */
  private monthRange(month?: number, year?: number): { start: Date; end: Date; label: string } {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1; // 1-indexed in, matches DTO
    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 1);
    return { start, end, label: `${y}-${String(m).padStart(2, '0')}` };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where:  { id: storeId },
      select: {
        currency: true, autoBillingEnabled: true, stripeCustomerId: true,
        bankAccount: { select: { bankName: true, accountHolderName: true, accountNumberLast4: true, depositSchedule: true } },
        billingCards: { orderBy: { isDefault: 'desc' }, select: { id: true, brand: true, last4: true, expMonth: true, expYear: true, cardholderName: true, isDefault: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  // ── Payment account overview ────────────────────────────────────────────

  async getOverview(storeId: string) {
    const [balanceAgg, monthSummary, store] = await Promise.all([
      this.prisma.sellerLedgerEntry.aggregate({
        where: { storeId, payoutId: null },
        _sum:  { amount: true },
      }),
      this.getActivitySummary(storeId),
      this.requireStore(storeId),
    ]);

    const current = Number(balanceAgg._sum.amount ?? 0);
    // No hold/reserve mechanic exists yet — every ledger entry is immediately
    // reflected in "current", so "pending" is always 0 for now.
    const pending = 0;
    const defaultCard = store.billingCards.find((c) => c.isDefault) ?? store.billingCards[0] ?? null;
    const amountDueThisMonth = Math.max(0, -monthSummary.netProfit);

    return {
      current,
      pending,
      total: current + pending,
      depositMinAmount: DEPOSIT_MIN_AMOUNT,
      hasFundsReadyForDeposit: current >= DEPOSIT_MIN_AMOUNT,
      bankAccount: store.bankAccount,
      currency: store.currency,
      autoBillingEnabled: store.autoBillingEnabled,
      defaultCard,
      amountDueThisMonth,
      nothingDueThisMonth: amountDueThisMonth <= 0,
    };
  }

  // ── Activity summary (Sales / Fees / Marketing cards) ───────────────────

  async getActivitySummary(storeId: string, month?: number, year?: number) {
    const { start, end } = this.monthRange(month, year);
    const entries = await this.prisma.sellerLedgerEntry.findMany({
      where:  { storeId, createdAt: { gte: start, lt: end } },
      select: { type: true, amount: true },
    });

    const sum = (types: SellerLedgerEntryType[]) =>
      Math.round(
        entries.filter((e) => types.includes(e.type)).reduce((s, e) => s + Number(e.amount), 0) * 100,
      ) / 100;

    const salesTotal = sum(['SALE']);
    const feesTotal   = sum(FEE_TYPES);
    const netProfit   = Math.round((salesTotal + feesTotal) * 100) / 100;

    return {
      netProfit,
      sales: {
        total: salesTotal,
        totalSalesCount: entries.filter((e) => e.type === 'SALE').length,
        refunds: 0,
        salesTaxRemitted: 0,
        vatRemitted: 0,
      },
      fees: {
        total: feesTotal,
        listingFees:     sum(['LISTING_FEE']),
        transactionFees: sum(['TRANSACTION_FEE']),
        processingFees:  sum(['PAYMENT_PROCESSING_FEE']),
        regulatoryFee:   sum(['REGULATORY_FEE']),
        depositFees:     sum(['DEPOSIT_FEE']),
        vatOnFees:       sum(['VAT']),
      },
      // No ads product exists yet — always zero, UI-shell only for Etsy parity.
      marketing: { total: 0, etsyAds: 0, offsiteAds: 0 },
    };
  }

  // ── All activities (itemized ledger, running balance) ───────────────────

  async getActivities(storeId: string, query: ActivitiesQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const hasMonthFilter = query.month != null && query.year != null;
    const { start, end } = hasMonthFilter ? this.monthRange(query.month, query.year) : { start: null, end: null };

    // A payout isn't its own SellerLedgerEntry row — requestPayout() only tags
    // existing entries with payoutId — so without folding payouts in here as a
    // synthetic negative "withdrawal" event, the running balance below would
    // never drop after money leaves the account, diverging from getOverview()'s
    // `current` (which already excludes payoutId != null entries).
    const [rows, ledgerCount, payoutCount] = await Promise.all([
      hasMonthFilter
        ? this.prisma.$queryRaw<RawLedgerRow[]>`
            WITH combined AS (
              SELECT id, "createdAt", type::text AS type, amount, description, "storeOrderId"
              FROM "SellerLedgerEntry"
              WHERE "storeId" = ${storeId}
              UNION ALL
              SELECT id, "createdAt", 'PAYOUT' AS type, (-amount) AS amount,
                     ('Payout · ' || period) AS description, NULL AS "storeOrderId"
              FROM "SellerPayout"
              WHERE "storeId" = ${storeId}
            ),
            ledger AS (
              SELECT id, "createdAt", type, amount, description, "storeOrderId",
                     SUM(amount) OVER (ORDER BY "createdAt" ASC, id ASC) AS "runningBalance"
              FROM combined
            )
            SELECT * FROM ledger
            WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
            ORDER BY "createdAt" DESC, id DESC
            OFFSET ${offset} LIMIT ${limit}
          `
        : this.prisma.$queryRaw<RawLedgerRow[]>`
            WITH combined AS (
              SELECT id, "createdAt", type::text AS type, amount, description, "storeOrderId"
              FROM "SellerLedgerEntry"
              WHERE "storeId" = ${storeId}
              UNION ALL
              SELECT id, "createdAt", 'PAYOUT' AS type, (-amount) AS amount,
                     ('Payout · ' || period) AS description, NULL AS "storeOrderId"
              FROM "SellerPayout"
              WHERE "storeId" = ${storeId}
            ),
            ledger AS (
              SELECT id, "createdAt", type, amount, description, "storeOrderId",
                     SUM(amount) OVER (ORDER BY "createdAt" ASC, id ASC) AS "runningBalance"
              FROM combined
            )
            SELECT * FROM ledger
            ORDER BY "createdAt" DESC, id DESC
            OFFSET ${offset} LIMIT ${limit}
          `,
      this.prisma.sellerLedgerEntry.count({
        where: { storeId, ...(hasMonthFilter ? { createdAt: { gte: start!, lt: end! } } : {}) },
      }),
      this.prisma.sellerPayout.count({
        where: { storeId, ...(hasMonthFilter ? { createdAt: { gte: start!, lt: end! } } : {}) },
      }),
    ]);
    const total = ledgerCount + payoutCount;

    return {
      data: rows.map((r) => ({
        id:             r.id,
        date:           r.createdAt,
        type:           r.type,
        description:    r.description,
        storeOrderId:   r.storeOrderId,
        amount:         Number(r.amount),
        balance:        Number(r.runningBalance),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportActivitiesCsv(storeId: string, month?: number, year?: number): Promise<string> {
    const hasMonthFilter = month != null && year != null;
    const { start, end } = hasMonthFilter ? this.monthRange(month, year) : { start: null, end: null };

    // Always walk the FULL history (not just the filtered month) so the running
    // balance carries an accurate opening total into a filtered month, and folds
    // in payouts as withdrawal events — matching getActivities()'s semantics.
    const [ledgerEntries, payouts] = await Promise.all([
      this.prisma.sellerLedgerEntry.findMany({
        where:   { storeId },
        orderBy: { createdAt: 'asc' },
        select:  { createdAt: true, type: true, description: true, amount: true },
      }),
      this.prisma.sellerPayout.findMany({
        where:   { storeId },
        orderBy: { createdAt: 'asc' },
        select:  { createdAt: true, amount: true, period: true },
      }),
    ]);

    const combined = [
      ...ledgerEntries.map((e) => ({ createdAt: e.createdAt, type: e.type as string, description: e.description, amount: Number(e.amount) })),
      ...payouts.map((p) => ({ createdAt: p.createdAt, type: 'PAYOUT', description: `Payout · ${p.period}`, amount: -Number(p.amount) })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let running = 0;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows: string[] = [];
    for (const e of combined) {
      running = Math.round((running + e.amount) * 100) / 100;
      if (hasMonthFilter && (e.createdAt < start! || e.createdAt >= end!)) continue;
      rows.push([
        e.createdAt.toISOString().slice(0, 10),
        e.type,
        escape(e.description),
        e.amount.toFixed(2),
        running.toFixed(2),
      ].join(','));
    }
    // Newest first, matching the on-page "All activities" table order.
    rows.reverse();
    return ['Date,Type,Description,Amount,Balance', ...rows].join('\n');
  }

  // ── Bank account ─────────────────────────────────────────────────────────

  async getBankAccount(storeId: string) {
    const account = await this.prisma.storeBankAccount.findUnique({
      where:  { storeId },
      select: { accountHolderName: true, bankName: true, accountNumberLast4: true, country: true, depositSchedule: true, updatedAt: true },
    });
    return account;
  }

  async updateBankAccount(storeId: string, dto: UpdateBankAccountDto) {
    const accountNumberEncrypted = this.encryption.encrypt(dto.accountNumber);
    const accountNumberLast4 = dto.accountNumber.slice(-4);

    await this.prisma.storeBankAccount.upsert({
      where:  { storeId },
      create: {
        storeId,
        accountHolderName: dto.accountHolderName,
        bankName:          dto.bankName,
        accountNumberEncrypted,
        accountNumberLast4,
        country:           dto.country.toUpperCase(),
        depositSchedule:   dto.depositSchedule,
      },
      update: {
        accountHolderName: dto.accountHolderName,
        bankName:          dto.bankName,
        accountNumberEncrypted,
        accountNumberLast4,
        country:           dto.country.toUpperCase(),
        depositSchedule:   dto.depositSchedule,
      },
    });
    return this.getBankAccount(storeId);
  }

  // ── Billing cards (Stripe SetupIntent) ──────────────────────────────────

  private async ensureStripeCustomer(storeId: string): Promise<string> {
    const store = await this.prisma.store.findUniqueOrThrow({
      where:  { id: storeId },
      select: { stripeCustomerId: true, name: true, owner: { select: { email: true } } },
    });

    if (store.stripeCustomerId) {
      // The stored ID can go stale if the customer was removed on Stripe's
      // side (e.g. manually in the dashboard) — without this check, every
      // subsequent billing action for this store would 500 forever.
      const existing = await this.stripe.customers
        .retrieve(store.stripeCustomerId)
        .catch(() => null);
      if (existing && !existing.deleted) return store.stripeCustomerId;
      this.logger.warn(`Stripe customer ${store.stripeCustomerId} for store ${storeId} is missing/deleted — recreating`);
    }

    const customer = await this.stripe.customers.create({
      name:  store.name,
      email: store.owner?.email,
      metadata: { storeId },
    });
    await this.prisma.store.update({ where: { id: storeId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async createBillingCardSetupIntent(storeId: string): Promise<{ clientSecret: string }> {
    const customerId = await this.ensureStripeCustomer(storeId);
    const setupIntent = await this.stripe.setupIntents.create({
      customer:            customerId,
      payment_method_types: ['card'],
    });
    if (!setupIntent.client_secret) {
      throw new BadRequestException('Failed to create billing setup — try again');
    }
    return { clientSecret: setupIntent.client_secret };
  }

  private static readonly BILLING_CARD_SELECT = {
    id: true, brand: true, last4: true, expMonth: true, expYear: true,
    cardholderName: true, isDefault: true,
  } satisfies Prisma.StoreBillingCardSelect;

  async listBillingCards(storeId: string) {
    return this.prisma.storeBillingCard.findMany({
      where:   { storeId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select:  FinancesService.BILLING_CARD_SELECT,
    });
  }

  async confirmBillingCard(storeId: string, stripePaymentMethodId: string) {
    const customerId = await this.ensureStripeCustomer(storeId);
    const pm = await this.stripe.paymentMethods.retrieve(stripePaymentMethodId);
    if (pm.customer !== customerId) {
      // SetupIntent already attaches the payment method to the customer on
      // confirmation — this guards against a client passing a payment
      // method that belongs to a different Stripe customer entirely.
      throw new ForbiddenException('This payment method does not belong to your store');
    }
    if (!pm.card) throw new BadRequestException('Only card payment methods are supported');
    const fingerprint: string | null = pm.card.fingerprint ?? null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Row-lock the store so two concurrent "add card" calls for the same
        // store can't both observe existingCount === 0 and both become default.
        await tx.$executeRaw`SELECT id FROM "Store" WHERE id = ${storeId} FOR UPDATE`;

        if (fingerprint) {
          const duplicate = await tx.storeBillingCard.findFirst({ where: { storeId, fingerprint } });
          if (duplicate) throw new BadRequestException('This card is already saved to your account');
        }

        const existingCount = await tx.storeBillingCard.count({ where: { storeId } });
        return tx.storeBillingCard.create({
          data: {
            storeId,
            stripePaymentMethodId,
            fingerprint,
            brand:          pm.card.brand,
            last4:          pm.card.last4,
            expMonth:       pm.card.exp_month,
            expYear:        pm.card.exp_year,
            cardholderName: pm.billing_details.name ?? '',
            isDefault:      existingCount === 0,
          },
          select: FinancesService.BILLING_CARD_SELECT,
        });
      });
    } catch (err) {
      // Don't leave a duplicate/abandoned PaymentMethod attached to the
      // Stripe customer when we're not keeping a record of it.
      if (err instanceof BadRequestException) {
        await this.stripe.paymentMethods.detach(stripePaymentMethodId).catch((detachErr: unknown) => {
          this.logger.warn(`Failed to detach duplicate Stripe payment method ${stripePaymentMethodId}: ${(detachErr as Error).message}`);
        });
      }
      throw err;
    }
  }

  async setDefaultBillingCard(storeId: string, cardId: string) {
    const card = await this.prisma.storeBillingCard.findUnique({ where: { id: cardId } });
    if (!card || card.storeId !== storeId) throw new NotFoundException('Card not found');

    await this.prisma.$transaction([
      this.prisma.storeBillingCard.updateMany({ where: { storeId }, data: { isDefault: false } }),
      this.prisma.storeBillingCard.update({ where: { id: cardId }, data: { isDefault: true } }),
    ]);
    return this.listBillingCards(storeId);
  }

  async deleteBillingCard(storeId: string, cardId: string): Promise<void> {
    const card = await this.prisma.storeBillingCard.findUnique({ where: { id: cardId } });
    if (!card || card.storeId !== storeId) throw new NotFoundException('Card not found');

    await this.stripe.paymentMethods.detach(card.stripePaymentMethodId).catch((err: unknown) => {
      this.logger.warn(`Failed to detach Stripe payment method ${card.stripePaymentMethodId}: ${(err as Error).message}`);
    });
    await this.prisma.storeBillingCard.delete({ where: { id: cardId } });

    if (card.isDefault) {
      const next = await this.prisma.storeBillingCard.findFirst({ where: { storeId }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.storeBillingCard.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  async updateAutoBilling(storeId: string, dto: UpdateAutoBillingDto) {
    await this.prisma.store.update({ where: { id: storeId }, data: { autoBillingEnabled: dto.enabled } });
    return { enabled: dto.enabled };
  }

  // ── Currency ─────────────────────────────────────────────────────────────

  async updateCurrency(storeId: string, dto: UpdateCurrencyDto) {
    await this.prisma.store.update({ where: { id: storeId }, data: { currency: dto.currency.toUpperCase() } });
    return { currency: dto.currency.toUpperCase() };
  }

  // ── Tax info ─────────────────────────────────────────────────────────────

  async getTaxInfo(storeId: string) {
    const info = await this.prisma.storeTaxInfo.findUnique({ where: { storeId } });
    if (!info) return null;
    const { taxpayerIdEncrypted, ...rest } = info;
    // Never round-trip the full taxpayer ID to the browser — same masking
    // discipline as the bank account number (last4 only).
    return {
      ...rest,
      taxpayerIdLast4: taxpayerIdEncrypted ? this.encryption.decrypt(taxpayerIdEncrypted).slice(-4) : null,
    };
  }

  async updateTaxInfo(storeId: string, dto: UpdateTaxInfoDto) {
    const data = {
      sellerType:     dto.sellerType,
      fullLegalName:  dto.fullLegalName,
      dateOfBirth:    dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      country:        dto.country.toUpperCase(),
      streetAddress:  dto.streetAddress,
      flatOther:      dto.flatOther ?? null,
      city:           dto.city,
      province:       dto.province ?? null,
      postCode:       dto.postCode ?? null,
      phone:          dto.phone ?? null,
    };
    // The edit form never receives the real taxpayer ID back (it's masked in
    // getTaxInfo), so an empty submission means "unchanged", not "clear" —
    // only overwrite the encrypted value when the seller actually typed one.
    const taxpayerIdEncrypted = dto.taxpayerId ? this.encryption.encrypt(dto.taxpayerId) : undefined;

    await this.prisma.storeTaxInfo.upsert({
      where:  { storeId },
      create: { storeId, ...data, taxpayerIdEncrypted: taxpayerIdEncrypted ?? null },
      update: { ...data, ...(taxpayerIdEncrypted !== undefined ? { taxpayerIdEncrypted } : {}) },
    });
    return this.getTaxInfo(storeId);
  }
}
