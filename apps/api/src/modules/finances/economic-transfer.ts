import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { EconomicProvider, EconomicProvenance, PrismaClient } from '@prisma/client';
import { canonicalEconomicJson, exactMinor } from './economic-quote';
import { parseMinorUnits } from './economic-policy';
import { assertPayoutScope, EconomicScope, economicTransaction } from './economic-balance';

export type TransferExpectation = {
  payoutId: string; provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  transferReference: string; destination: string; amountMinor: string; currency: string; minorExponent: number;
};
export type TransferReader = {
  provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  read: (expected: TransferExpectation) => Promise<unknown>;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing transfer evidence');
  return value as Record<string, unknown>;
}
export function verifyTransferEvidence(raw: unknown, expected: TransferExpectation) {
  const data = object(raw);
  if (expected.provider === 'STRIPE') {
    const metadata = object(data['metadata']);
    if (data['id'] !== expected.transferReference || data['livemode'] !== (expected.provenance === 'LIVE')
      || !Number.isSafeInteger(data['amount']) || BigInt(data['amount'] as number) !== exactMinor(expected.amountMinor)
      || data['currency'] !== expected.currency.toLowerCase() || data['destination'] !== expected.destination
      || data['reversed'] !== false || data['amount_reversed'] !== 0 || !data['balance_transaction']
      || metadata['economicPayoutId'] !== expected.payoutId) throw new Error('Stripe transfer requires reconciliation');
  } else {
    const item = object(data['payout_item']); const amount = object(item['amount']);
    if (data['payout_item_id'] !== expected.transferReference || data['transaction_status'] !== 'SUCCESS'
      || !data['transaction_id'] || item['receiver'] !== expected.destination || item['sender_item_id'] !== expected.payoutId
      || amount['currency'] !== expected.currency || typeof amount['value'] !== 'string'
      || parseMinorUnits(amount['value'], expected.minorExponent) !== exactMinor(expected.amountMinor)) throw new Error('PayPal transfer requires reconciliation');
  }
  return createHash('sha256').update(canonicalEconomicJson(expected)).digest('hex');
}

/** No transfer is initiated here: admin supplies a lookup reference, never proof. */
export async function verifyAndSettleEconomicPayout(db: Pick<PrismaClient, '$transaction' | 'economicPayout'>,
  id: string, actorId: string, reference: string, reader: TransferReader, scope?: EconomicScope) {
  if (!actorId || !/^[A-Za-z0-9_]{1,150}$/.test(reference)) throw new Error('Invalid settlement identity');
  const before = await economicTransaction(db, async tx => {
    const payout = await tx.economicPayout.findUniqueOrThrow({ where: { id }, include: { account: true } });
    assertPayoutScope(payout.account, scope);
    if (reader.provenance !== payout.account.provenance || !reader.providerAccount) throw new Error('Transfer reader scope mismatch');
    await tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" WHERE "id" = ${payout.accountId} FOR UPDATE`;
    if (payout.state === 'REJECTED') throw new ConflictException('Rejected payout cannot be settled');
    if (payout.state !== 'REQUESTED') {
      if (payout.transferProvider !== reader.provider || payout.transferAccount !== reader.providerAccount
        || payout.transferProvenance !== reader.provenance || payout.transferReference !== reference) throw new ConflictException('Transfer lookup is already bound');
      return payout;
    }
    const claimed = await tx.economicPayout.updateMany({ where: { id, state: 'REQUESTED' }, data: {
      state: 'VERIFYING', verificationStartedAt: new Date(), verificationStartedBy: actorId,
      transferProvider: reader.provider, transferAccount: reader.providerAccount,
      transferProvenance: reader.provenance, transferReference: reference,
    } });
    if (claimed.count !== 1) throw new ConflictException('Payout state changed');
    return payout;
  });
  const expected: TransferExpectation = { payoutId: id, provider: reader.provider, providerAccount: reader.providerAccount,
    provenance: before.account.provenance, transferReference: reference, destination: before.destination,
    amountMinor: before.amountMinor.toString(), currency: before.account.currency, minorExponent: before.account.minorExponent };
  const evidenceHash = verifyTransferEvidence(await reader.read(expected), expected);
  return economicTransaction(db, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" WHERE "id" = ${before.accountId} FOR UPDATE`;
    const payout = await tx.economicPayout.findUniqueOrThrow({ where: { id }, include: { allocations: true } });
    if (payout.accountId !== before.accountId || payout.amountMinor !== before.amountMinor || payout.destination !== before.destination) throw new ConflictException('Payout identity changed');
    if (payout.state === 'PAID' && payout.transferEvidenceHash === evidenceHash) return { id, state: 'PAID' as const };
    if (payout.state !== 'VERIFYING') throw new ConflictException('Payout already terminal');
    const updated = await tx.economicPayout.updateMany({ where: { id, state: 'VERIFYING' }, data: { state: 'PAID',
      processedAt: new Date(), processedBy: actorId, transferProvider: reader.provider, transferAccount: reader.providerAccount,
      transferProvenance: reader.provenance, transferReference: reference, transferEvidenceHash: evidenceHash } });
    if (updated.count !== 1) throw new ConflictException('Payout state changed');
    for (const part of payout.allocations) await tx.economicBalanceLot.update({ where: { id: part.lotId }, data: {
      reservedMinor: { decrement: part.amountMinor }, paidMinor: { increment: part.amountMinor },
    } });
    // No blanket AffiliateCommission PAID mutation: only allocated lots settle.
    return { id, state: 'PAID' as const };
  });
}
