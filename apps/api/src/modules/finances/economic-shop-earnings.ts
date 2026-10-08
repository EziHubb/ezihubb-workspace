import { NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { canonicalEconomicJson, EconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';
import { EconomicRefundPlan } from './economic-refund-plan';
import { plannedRefundJournal } from './economic-refund-journal';

/** Shop-only read model. A quote/payment status is not capture evidence, a
 * prepared refund is not a settlement, and a seller allocation is not profit
 * or currently withdrawable cash. No legacy fallback for a versioned context. */
export async function readEconomicShopEarnings(db: Pick<PrismaClient, '$transaction'>, storeId: string, storeOrderId: string) {
  return db.$transaction(async tx => {
    const shop = await tx.storeOrder.findFirst({ where: { id: storeOrderId, storeId },
      select: { orderId: true, order: { select: { economicContext: true } } } });
    if (!shop) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    const context = shop.order.economicContext;
    if (!context) return null;
    const quote = context.quote as unknown as EconomicQuote;
    if (quoteFingerprint(quote) !== context.quoteHash || quote.orderId !== shop.orderId
      || quote.currency !== context.currency || quote.minorExponent !== context.minorExponent
      || !quote.stores.some(row => row.storeId === storeId && row.storeOrderId === storeOrderId)) {
      throw new Error('Original shop quote requires reconciliation');
    }
    const base = { version: 'economic-v1' as const, provenance: context.provenance, currency: context.currency,
      minorExponent: context.minorExponent, storeId, storeOrderId, orderId: shop.orderId,
      basis: 'IMMUTABLE_VERIFIED_SHOP_ALLOCATION' as const, readOnly: true, legacyIncluded: false,
      actualProviderCostMinor: null, actualShippingCostMinor: null, profitMinor: null,
      taxBasis: 'ORDER_LEVEL_TAX_NOT_ALLOCATED_TO_SHOP' as const };
    const capture = await tx.economicCapture.findUnique({ where: { contextId: context.id }, include: {
      operation: true, allocations: { where: { storeId, storeOrderId }, orderBy: { partKey: 'asc' } },
      refundRequests: { include: { operation: true, settlement: { include: { journalEntries: true } } } },
    } });
    if (!capture) return { ...base, state: 'AWAITING_CAPTURE' as const, captureId: null, amounts: null, feeLines: [], pendingRefundCount: 0 };
    if (capture.provenance !== context.provenance || capture.currency !== context.currency || capture.quoteHash !== context.quoteHash
      || capture.amountMinor !== exactMinor(quote.customerTotalMinor) || !capture.evidenceHash
      || capture.operation.state !== 'SUCCEEDED' || capture.operation.kind !== 'CAPTURE'
      || capture.operation.contextId !== context.id || capture.operation.providerReference !== capture.providerReference
      || capture.operation.provider !== capture.provider || capture.operation.providerAccount !== capture.providerAccount
      || capture.operation.provenance !== context.provenance || capture.operation.currency !== context.currency
      || capture.operation.amountMinor !== capture.amountMinor) {
      throw new Error('Original capture requires reconciliation');
    }
    const parts = quote.parts.filter(part => part.storeId === storeId && part.storeOrderId === storeOrderId);
    if (!parts.length || parts.length !== capture.allocations.length) throw new Error('Original shop allocation coverage mismatch');
    const fields = ['customerMinor', 'platformFundingMinor', 'sellerGrossMinor', 'sellerFeeMinor', 'sellerNetMinor'] as const;
    for (const part of parts) {
      const row = capture.allocations.find(value => value.partKey === part.key);
      if (!row || row.kind !== part.kind || row.lineId !== part.lineId || row.quantity !== part.quantity
        || row.currency !== context.currency || fields.some(key => row[key] !== exactMinor(part[key]))
        || canonicalEconomicJson(row.fees) !== canonicalEconomicJson(part.fees)) throw new Error('Original shop allocation mismatch');
    }
    const refunded = new Map(parts.map(part => [part.key, { customerMinor: 0n, sellerNetMinor: 0n, sellerFeeMinor: 0n }]));
    const feeLines = new Map<string, { code: string; ruleReference: string; capturedMinor: bigint; reversedMinor: bigint }>();
    for (const part of parts) for (const fee of part.fees) {
      const key = canonicalEconomicJson([fee.code, fee.ruleReference]);
      const value = feeLines.get(key) ?? { code: fee.code, ruleReference: fee.ruleReference, capturedMinor: 0n, reversedMinor: 0n };
      value.capturedMinor += exactMinor(fee.amountMinor); feeLines.set(key, value);
    }
    for (const request of capture.refundRequests) {
      if (!request.settlement) continue;
      const plan = request.plan as unknown as EconomicRefundPlan, settlement = request.settlement;
      const journal = plannedRefundJournal(plan, quote);
      const actual = settlement.journalEntries.map(row => ({ entryKey: row.entryKey, account: row.account,
        beneficiaryId: row.beneficiaryId, currency: row.currency, amountMinor: row.amountMinor.toString() }));
      const byKey = (a: { entryKey: string }, b: { entryKey: string }) => a.entryKey < b.entryKey ? -1 : a.entryKey > b.entryKey ? 1 : 0;
      if (!settlement.evidenceHash || settlement.amountMinor !== exactMinor(plan.customerMinor)
        || request.operation.state !== 'SUCCEEDED' || request.operation.kind !== 'REFUND'
        || request.operation.providerReference !== settlement.providerReference
        || canonicalEconomicJson(journal) !== canonicalEconomicJson(request.plannedJournal)
        || canonicalEconomicJson([...journal].sort(byKey)) !== canonicalEconomicJson(actual.sort(byKey))) {
        throw new Error('Original settled refund requires reconciliation');
      }
      for (const part of plan.parts) {
        const totals = refunded.get(part.partKey);
        if (!totals) continue; // Other shops' parts are never included in the response.
        totals.customerMinor += exactMinor(part.customerMinor);
        totals.sellerNetMinor += exactMinor(part.sellerNetMinor);
        totals.sellerFeeMinor += exactMinor(part.sellerFeeMinor);
        for (const fee of part.fees) {
          const line = feeLines.get(canonicalEconomicJson([fee.code, fee.ruleReference]));
          if (!line) throw new Error('Unknown original refund fee');
          line.reversedMinor += exactMinor(fee.amountMinor);
        }
      }
    }
    for (const part of parts) {
      const totals = refunded.get(part.key);
      if (!totals || Object.entries(totals).some(([key, value]) => value > exactMinor(part[key as keyof typeof totals]))) {
        throw new Error('Settled refunds exceed original shop allocation');
      }
    }
    const lots = await tx.economicBalanceLot.findMany({ where: { captureId: capture.id, sourceKey: { in: parts.map(part => part.key) },
      account: { kind: 'SELLER', beneficiaryId: storeId, currency: context.currency, provenance: context.provenance } } });
    if (lots.length !== parts.filter(part => exactMinor(part.sellerNetMinor) > 0n).length) throw new Error('Original seller lots missing');
    for (const lot of lots) {
      const part = parts.find(row => row.key === lot.sourceKey), reversal = refunded.get(lot.sourceKey);
      if (!part || !reversal || lot.amountMinor !== exactMinor(part.sellerNetMinor) || lot.reversedMinor !== reversal.sellerNetMinor
        || [lot.reservedMinor, lot.paidMinor, lot.debtRecoveredMinor].some(value => value < 0n)
        || lot.reservedMinor + lot.paidMinor + lot.debtRecoveredMinor > lot.amountMinor) throw new Error('Original seller lot requires reconciliation');
    }
    const sum = (field: typeof fields[number]) => parts.reduce((total, part) => total + exactMinor(part[field]), 0n);
    const reverse = (field: 'customerMinor' | 'sellerNetMinor' | 'sellerFeeMinor') => [...refunded.values()].reduce((total, part) => total + part[field], 0n);
    const customer = sum('customerMinor'), net = sum('sellerNetMinor'), fees = sum('sellerFeeMinor');
    return { ...base, state: 'CAPTURE_VERIFIED' as const, captureId: capture.id,
      pendingRefundCount: capture.refundRequests.filter(request => !request.settlement
        && ['PREPARED', 'DISPATCHED', 'NEEDS_RECONCILIATION'].includes(request.operation.state)
        && (request.plan as unknown as EconomicRefundPlan).parts.some(part => part.storeOrderId === storeOrderId)).length,
      amounts: { customerCapturedMinor: customer.toString(), customerRefundedMinor: reverse('customerMinor').toString(),
        netCustomerCollectedMinor: (customer - reverse('customerMinor')).toString(),
        platformFundingMinor: sum('platformFundingMinor').toString(), sellerGrossMinor: sum('sellerGrossMinor').toString(),
        sellerAllocatedMinor: net.toString(), sellerReversedMinor: reverse('sellerNetMinor').toString(),
        netSellerAllocationMinor: (net - reverse('sellerNetMinor')).toString(),
        sellerFeeMinor: fees.toString(), reversedFeeMinor: reverse('sellerFeeMinor').toString(),
        netFeeMinor: (fees - reverse('sellerFeeMinor')).toString(),
        paidMinor: lots.reduce((total, lot) => total + lot.paidMinor, 0n).toString(),
        reservedMinor: lots.reduce((total, lot) => total + lot.reservedMinor, 0n).toString(),
        debtRecoveredMinor: lots.reduce((total, lot) => total + lot.debtRecoveredMinor, 0n).toString() },
      feeLines: [...feeLines.values()].map(line => ({ ...line, capturedMinor: line.capturedMinor.toString(),
        reversedMinor: line.reversedMinor.toString(), netMinor: (line.capturedMinor - line.reversedMinor).toString() })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
