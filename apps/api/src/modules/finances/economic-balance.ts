import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EconomicBeneficiaryKind, EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { EconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';

export type EconomicScope = { kind: EconomicBeneficiaryKind; beneficiaryId: string; currency: string; provenance: EconomicProvenance };
type Database = Pick<PrismaClient, '$transaction'>;

/** Only retries DB-only transactions. Never put provider calls inside this callback. */
export async function economicTransaction<T>(db: Database, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (attempt >= 2 || !(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error;
    }
  }
}

export function minorDecimal(amount: bigint, exponent: number): string {
  const sign = amount < 0n ? '-' : '';
  const digits = (amount < 0n ? -amount : amount).toString().padStart(exponent + 1, '0');
  return exponent ? `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}` : `${sign}${digits}`;
}

export async function seedCapturedBalanceLots(tx: Prisma.TransactionClient, captureId: string, quote: EconomicQuote, provenance: EconomicProvenance, now: Date) {
  quoteFingerprint(quote);
  const sources = quote.parts.filter(part => exactMinor(part.sellerNetMinor) > 0n).map(part => ({
    kind: 'SELLER' as EconomicBeneficiaryKind, beneficiaryId: part.storeId, sourceKey: part.key,
    amountMinor: exactMinor(part.sellerNetMinor), eligibleAt: now as Date | null,
  }));
  if (quote.affiliate && exactMinor(quote.affiliate.commissionMinor) > 0n) sources.push({
    kind: 'AFFILIATE', beneficiaryId: quote.affiliate.id, sourceKey: 'affiliate-pending',
    amountMinor: exactMinor(quote.affiliate.commissionMinor), eligibleAt: null,
  });
  for (const source of sources) {
    const scope: EconomicScope = { kind: source.kind, beneficiaryId: source.beneficiaryId, currency: quote.currency, provenance };
    await tx.economicBalanceAccount.createMany({ data: [{ ...scope, minorExponent: quote.minorExponent }], skipDuplicates: true });
    const account = await tx.economicBalanceAccount.findUniqueOrThrow({ where: { kind_beneficiaryId_currency_provenance: scope } });
    if (account.minorExponent !== quote.minorExponent) throw new Error('Currency exponent changed');
    await tx.economicBalanceLot.create({ data: { accountId: account.id, captureId,
      sourceKey: source.sourceKey, amountMinor: source.amountMinor, eligibleAt: source.eligibleAt } });
  }
}

async function accountForScope(tx: Prisma.TransactionClient, scope: EconomicScope, lock = false) {
  const account = await tx.economicBalanceAccount.findUnique({ where: { kind_beneficiaryId_currency_provenance: scope } });
  if (account && lock) await tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" WHERE "id" = ${account.id} FOR UPDATE`;
  return account;
}

/** Re-evaluate current order safety every time, including immediately before payout. */
export async function readEconomicBalance(tx: Prisma.TransactionClient, scope: EconomicScope, now = new Date()) {
  const account = await accountForScope(tx, scope);
  const lots = account ? await tx.economicBalanceLot.findMany({
    where: { accountId: account.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { capture: { include: { context: { include: { operations: { where: { kind: 'REFUND', state: { not: 'FAILED' } } }, order: { include: { storeOrders: true, payment: true } } } } } } },
  }) : [];
  let pending = 0n, held = 0n, available = 0n, reserved = 0n, paid = 0n, captured = 0n;
  const eligible: Array<{ id: string; free: bigint }> = [];
  for (const lot of lots) {
    captured += lot.amountMinor; reserved += lot.reservedMinor; paid += lot.paidMinor;
    const free = lot.amountMinor - lot.reservedMinor - lot.paidMinor;
    const order = lot.capture.context.order;
    const unsafe = !!order.adminArchivedAt || ['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'].includes(order.status)
      || order.payment?.status !== 'PAID' || lot.capture.context.operations.length > 0
      || order.storeOrders.some(shop => (scope.kind === 'AFFILIATE' || shop.storeId === scope.beneficiaryId)
        && ['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'].includes(shop.status));
    if (unsafe || account?.holdReason || lot.holdReason) { held += free; continue; }
    let eligibleAt = lot.eligibleAt;
    if (scope.kind === 'AFFILIATE') {
      const quote = lot.capture.context.quote as unknown as EconomicQuote;
      quoteFingerprint(quote);
      const delivered = order.storeOrders.length > 0 && order.storeOrders.every(shop =>
        ['DELIVERED', 'COMPLETED'].includes(shop.status) && shop.deliveredAt !== null);
      const latest = delivered ? Math.max(...order.storeOrders.map(shop => shop.deliveredAt?.getTime() ?? 0)) : null;
      eligibleAt = latest !== null && quote.affiliate ? new Date(latest + quote.affiliate.lockDays * 86400000) : null;
    }
    if (!eligibleAt || eligibleAt > now) { pending += free; continue; }
    available += free; eligible.push({ id: lot.id, free });
  }
  const debt = account?.debtMinor ?? 0n;
  available = available > debt ? available - debt : 0n;
  return { account, eligible, captured, available, pending, held, reserved, paid, debt };
}

export function economicBalanceDto(balance: Awaited<ReturnType<typeof readEconomicBalance>>, scope: EconomicScope) {
  return { version: 'economic-v1' as const, ...scope, minorExponent: balance.account?.minorExponent ?? 2,
    capturedMinor: balance.captured.toString(), availableMinor: balance.available.toString(), pendingMinor: balance.pending.toString(),
    heldMinor: balance.held.toString(), reservedMinor: balance.reserved.toString(), paidMinor: balance.paid.toString(), debtMinor: balance.debt.toString() };
}

function requireIdentifier(value: string, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw new BadRequestException('Invalid payout identity');
}

/** Destination is supplied by trusted configuration/verified account settings, never a payout DTO. */
export async function reserveEconomicPayout(db: Database, input: {
  scope: EconomicScope; amountMinor: string; minimumMinor: bigint; idempotencyKey: string; actorId: string; destination: string;
}) {
  requireIdentifier(input.idempotencyKey, 100); requireIdentifier(input.actorId); requireIdentifier(input.destination);
  const amount = exactMinor(input.amountMinor);
  if (amount <= 0n || amount < input.minimumMinor) throw new BadRequestException('Payout below minimum');
  return economicTransaction(db, async tx => {
    const account = await accountForScope(tx, input.scope, true);
    if (!account) throw new BadRequestException('No captured funds available');
    const prior = await tx.economicPayout.findUnique({ where: { accountId_idempotencyKey: { accountId: account.id, idempotencyKey: input.idempotencyKey } } });
    if (prior) {
      if (prior.amountMinor !== amount || prior.destination !== input.destination || prior.requestedBy !== input.actorId) throw new ConflictException('Payout key reused with different details');
      return prior;
    }
    const balance = await readEconomicBalance(tx, input.scope);
    if (amount > balance.available) throw new BadRequestException('Requested payout exceeds captured eligible funds');
    const payout = await tx.economicPayout.create({ data: { accountId: account.id, amountMinor: amount,
      idempotencyKey: input.idempotencyKey, requestedBy: input.actorId, destination: input.destination } });
    let remainder = amount;
    for (const lot of balance.eligible) {
      if (remainder === 0n) break;
      const take = lot.free < remainder ? lot.free : remainder;
      if (take === 0n) continue;
      const result = await tx.economicBalanceLot.updateMany({ where: { id: lot.id, accountId: account.id }, data: { reservedMinor: { increment: take } } });
      if (result.count !== 1) throw new ConflictException('Payout allocation changed');
      await tx.economicPayoutAllocation.create({ data: { payoutId: payout.id, lotId: lot.id, amountMinor: take } });
      remainder -= take;
    }
    if (remainder !== 0n) throw new ConflictException('Payout allocation incomplete');
    return payout;
  });
}

export async function rejectEconomicPayout(db: Database, id: string, actorId: string, reason: string, scope?: EconomicScope) {
  requireIdentifier(actorId); requireIdentifier(reason, 500);
  return economicTransaction(db, async tx => {
    const payout = await tx.economicPayout.findUniqueOrThrow({ where: { id }, include: { account: true, allocations: true } });
    assertPayoutScope(payout.account, scope);
    await accountForScope(tx, payout.account, true);
    if (payout.state !== 'REQUESTED') throw new ConflictException('Payout is already terminal');
    const claim = await tx.economicPayout.updateMany({ where: { id, state: 'REQUESTED' }, data: { state: 'REJECTED', processedAt: new Date(), processedBy: actorId, rejectionReason: reason } });
    if (claim.count !== 1) throw new ConflictException('Payout state changed');
    for (const part of payout.allocations) await tx.economicBalanceLot.update({ where: { id: part.lotId }, data: { reservedMinor: { decrement: part.amountMinor } } });
    return { id, state: 'REJECTED' as const };
  });
}

export function assertPayoutScope(actual: EconomicScope, requested?: EconomicScope) {
  if (requested && (actual.kind !== requested.kind || actual.beneficiaryId !== requested.beneficiaryId
    || actual.currency !== requested.currency || actual.provenance !== requested.provenance)) throw new ForbiddenException('Payout does not belong to this account');
}
