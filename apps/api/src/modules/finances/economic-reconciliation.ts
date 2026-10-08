import { Prisma, PrismaClient } from '@prisma/client';
import { EconomicReconciliationQueryDto } from './dto/economic-finances.dto';

/** Platform-authorized read model. Unknown provider outcomes stay unknown:
 * this report neither calls a provider nor promotes operation state to proof.
 */
export async function listEconomicReconciliation(db: Pick<PrismaClient, '$transaction'>, query: EconomicReconciliationQueryDto) {
  const where: Prisma.EconomicOperationWhereInput = {
    provenance: query.provenance, currency: query.currency,
    state: query.state ?? { in: ['DISPATCHED', 'NEEDS_RECONCILIATION'] },
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.orderId || query.storeId ? { context: {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.storeId ? { order: { storeOrders: { some: { storeId: query.storeId } } } } : {}),
    } } : {}),
    ...(query.reference ? { OR: [{ id: query.reference }, { providerReference: query.reference },
      { context: { order: { orderNumber: query.reference } } }] } : {}),
  };
  return db.$transaction(async tx => {
    const total = await tx.economicOperation.count({ where });
    const rows = await tx.economicOperation.findMany({ where, take: query.limit, skip: (query.page - 1) * query.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, kind: true, state: true, provenance: true, currency: true, amountMinor: true,
        provider: true, providerReference: true, createdAt: true, dispatchedAt: true, reconcileAfter: true, completedAt: true,
        context: { select: { orderId: true, minorExponent: true, order: { select: { orderNumber: true } } } },
        capture: { select: { id: true, amountMinor: true, verifiedAt: true } },
        refundRequest: { select: { id: true, captureId: true, requestedBy: true, reason: true, createdAt: true, platformRoundingMinor: true,
          settlement: { select: { id: true, amountMinor: true, verifiedAt: true } } } },
      } });
    return { version: 'economic-v1', provenance: query.provenance, currency: query.currency,
      page: query.page, limit: query.limit, total, readOnly: true,
      data: rows.map(row => {
        const proof = row.kind === 'REFUND' ? row.refundRequest?.settlement : row.kind === 'CAPTURE' ? row.capture : null;
        const request = row.refundRequest;
        return { id: row.id, orderId: row.context.orderId, orderNumber: row.context.order.orderNumber,
        kind: row.kind, state: row.state, provider: row.provider, providerReference: row.providerReference,
        expectedMinor: row.amountMinor.toString(),
        verifiedMinor: proof?.amountMinor.toString() ?? null,
        differenceMinor: proof ? (proof.amountMinor - row.amountMinor).toString() : null,
        evidenceStatus: proof ? row.kind === 'REFUND' ? 'REFUND_VERIFIED' : 'CAPTURE_VERIFIED' : 'NOT_VERIFIED',
        minorExponent: row.context.minorExponent, currency: row.currency, provenance: row.provenance,
        createdAt: row.createdAt, dispatchedAt: row.dispatchedAt, reconcileAfter: row.reconcileAfter,
        completedAt: row.completedAt, verifiedAt: proof?.verifiedAt ?? null,
        captureId: row.capture?.id ?? row.refundRequest?.captureId ?? null,
        refundRequest: request ? { id: request.id, captureId: request.captureId, requestedBy: request.requestedBy,
          reason: request.reason, createdAt: request.createdAt, platformRoundingMinor: request.platformRoundingMinor.toString() } : null,
      }; }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
