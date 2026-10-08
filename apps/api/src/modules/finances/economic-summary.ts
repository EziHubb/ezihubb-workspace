import { EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';

/** Immutable evidence, not receipt totals or provider balances. No PII and no
 * implicit mode merging. Actual provider/shipping costs remain unknown until
 * there is a separately verified cost receipt; never report a guessed zero. */
export async function readEconomicSummary(db: Pick<PrismaClient, '$transaction'>,
  scope: { currency: string; provenance: EconomicProvenance }) {
  return db.$transaction(async tx => {
    const captures = await tx.economicCapture.aggregate({ where: scope, _sum: { amountMinor: true }, _count: true });
    const refunds = await tx.economicRefund.aggregate({ where: { request: { capture: scope } }, _sum: { amountMinor: true }, _count: true });
    const payouts = await tx.economicPayout.aggregate({ where: { account: scope, state: 'PAID' }, _sum: { amountMinor: true }, _count: true });
    const accounts = await tx.economicBalanceAccount.aggregate({ where: scope, _sum: { debtMinor: true } });
    const recoveries = await tx.economicDebtRecovery.aggregate({ where: { lot: { account: scope } }, _sum: { amountMinor: true } });
    const rounding = await tx.economicRefundJournalEntry.aggregate({ where: { currency: scope.currency,
      account: 'PLATFORM_ROUNDING', refund: { request: { capture: scope } } }, _sum: { amountMinor: true } });
    const [lifecycleAppliedCount, notificationProjectionCount, podVerifiedCount, externalUnknownCount, smtpAcceptedCount] = await Promise.all([
      tx.economicConsumerReceipt.count({ where: { consumer: 'lifecycle.v1', event: { context: scope } } }),
      tx.economicConsumerReceipt.count({ where: { consumer: 'notifications.v1', event: { context: scope } } }),
      tx.economicExternalEffect.count({ where: { kind: 'POD_PRINTIFY', state: 'SUCCEEDED', context: scope } }),
      tx.economicExternalEffect.count({ where: { state: { in: ['DISPATCHED','NEEDS_RECONCILIATION'] }, context: scope } }),
      tx.economicExternalEffect.count({ where: { kind: 'EMAIL_TRANSACTIONAL', state: 'SUCCEEDED', context: scope } }),
    ]);
    const collected = captures._sum.amountMinor ?? 0n, refunded = refunds._sum.amountMinor ?? 0n;
    if (refunded > collected) throw new Error('Verified refund totals exceed captures');
    return { version: 'economic-v1', ...scope, minorExponent: 2, readOnly: true,
      basis: 'IMMUTABLE_VERIFIED_EVIDENCE', legacyIncluded: false,
      capturedMinor: collected.toString(), refundedMinor: refunded.toString(),
      netCollectedMinor: (collected - refunded).toString(),
      paidOutMinor: (payouts._sum.amountMinor ?? 0n).toString(),
      outstandingDebtMinor: (accounts._sum.debtMinor ?? 0n).toString(),
      recoveredDebtMinor: (recoveries._sum.amountMinor ?? 0n).toString(),
      bookedRefundRoundingMinor: (rounding._sum.amountMinor ?? 0n).toString(),
      captureCount: captures._count, refundCount: refunds._count, paidPayoutCount: payouts._count,
      actualProviderFeeMinor: null, actualShippingCostMinor: null,
      downstream: { lifecycleAppliedCount, notificationProjectionCount, podVerifiedCount, externalUnknownCount, smtpAcceptedCount,
        smtpBasis: 'SMTP_ACCEPTANCE_NOT_INBOX_DELIVERY' },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
