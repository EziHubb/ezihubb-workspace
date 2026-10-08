import { Prisma } from '@prisma/client';

/** Old receipt/ledger reports are not evidence of v1 captured funds. Do not
 * infer LIVE/TEST from their payment status, key format or creation date. */
export const LEGACY_FINANCE_REPORT = {
  classification: 'LEGACY_UNKNOWN', versionedFundsIncluded: false,
  requiresReconciliation: true,
} as const;

export function legacyOrderWhere(where: Prisma.OrderWhereInput = {}): Prisma.OrderWhereInput {
  return { AND: [where, { economicContext: { is: null } }] };
}
export function legacyPaymentWhere(where: Prisma.PaymentWhereInput = {}): Prisma.PaymentWhereInput {
  return { AND: [where, { order: legacyOrderWhere() }] };
}
export function legacyStoreOrderWhere(where: Prisma.StoreOrderWhereInput = {}): Prisma.StoreOrderWhereInput {
  return { AND: [where, { order: legacyOrderWhere() }] };
}
export function legacyLedgerWhere(where: Prisma.SellerLedgerEntryWhereInput = {}): Prisma.SellerLedgerEntryWhereInput {
  return { AND: [where, { OR: [{ storeOrderId: null }, { storeOrder: legacyStoreOrderWhere() }] }] };
}
export const LEGACY_LEDGER_SQL = Prisma.sql`("storeOrderId" IS NULL OR EXISTS (
  SELECT 1 FROM "StoreOrder" legacy_shop WHERE legacy_shop."id"="SellerLedgerEntry"."storeOrderId"
    AND NOT EXISTS (SELECT 1 FROM "EconomicOrderContext" finance_scope WHERE finance_scope."orderId"=legacy_shop."orderId")))`;
/** Pass only a static Prisma.sql column expression, never a user identifier. */
export function legacyOrderSql(orderId: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (SELECT 1 FROM "EconomicOrderContext" finance_scope WHERE finance_scope."orderId" = ${orderId})`;
}
