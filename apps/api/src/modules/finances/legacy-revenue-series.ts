import { Prisma, PrismaClient } from '@prisma/client';
import { legacyOrderSql } from './finance-reporting-scope';

export type LegacyRevenueDay = { date: string; orders: number; revenue: number };

/** Historical receipt projection, NOT capture, profit or available cash. One
 * aggregate query keeps counts and money on the same DB snapshot. Redis purchase
 * counters cannot establish ownership, mode, refunds or replay uniqueness. */
export async function readLegacyRevenueSeries(
  db: Pick<PrismaClient, '$queryRaw'>,
  start: Date,
  end: Date,
  storeId?: string | null,
): Promise<LegacyRevenueDay[]> {
  const duration = end.getTime() - start.getTime();
  if (!Number.isFinite(duration) || duration < 0 || duration > 91 * 86_400_000) {
    throw new Error('Invalid historical revenue window');
  }
  if (storeId !== undefined && storeId !== null && !storeId.trim()) {
    throw new Error('Invalid historical revenue shop scope');
  }

  // Prisma DateTime columns are UTC timestamps without time zone. Formatting the
  // stored UTC date directly avoids a session-timezone-dependent timestamptz cast.
  // Shop shipping support is NOT collected from the buyer or seller revenue.
  // Parent total contains other shops and order-level extras; never expose it in
  // a shop report. Shop gross here is merchandise less shop discount plus only
  // customer-paid shipping, not seller earnings after fees.
  const rows = storeId
    ? await db.$queryRaw<{ date: string; orders: bigint; revenue: string }[]>(Prisma.sql`
        SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS orders,
          COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN
            so.subtotal - so."discountAmount" + GREATEST(0, so."shippingCost" - so."shippingSubsidy")
            ELSE 0 END), 0)::text AS revenue
        FROM "StoreOrder" so
        JOIN "Order" o ON o.id = so."orderId"
        LEFT JOIN "Payment" p ON p."orderId" = o.id
        WHERE so."storeId" = ${storeId}
          AND o."createdAt" >= ${start} AND o."createdAt" <= ${end}
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          AND so.status NOT IN ('CANCELLED', 'REFUNDED')
          AND ${legacyOrderSql(Prisma.sql`o.id`)}
        GROUP BY date ORDER BY date ASC`)
    : await db.$queryRaw<{ date: string; orders: bigint; revenue: string }[]>(Prisma.sql`
        SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS orders,
          COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN o.total ELSE 0 END), 0)::text AS revenue
        FROM "Order" o
        LEFT JOIN "Payment" p ON p."orderId" = o.id
        WHERE o."createdAt" >= ${start} AND o."createdAt" <= ${end}
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          AND ${legacyOrderSql(Prisma.sql`o.id`)}
        GROUP BY date ORDER BY date ASC`);

  const timeline = new Map<string, LegacyRevenueDay>();
  const day = new Date(start);
  day.setUTCHours(0, 0, 0, 0);
  const lastDate = end.toISOString().slice(0, 10);
  while (day.toISOString().slice(0, 10) <= lastDate) {
    const date = day.toISOString().slice(0, 10);
    timeline.set(date, { date, orders: 0, revenue: 0 });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  for (const row of rows) {
    const orders = Number(row.orders);
    const revenue = Number(row.revenue);
    if (!timeline.has(row.date) || !Number.isSafeInteger(orders) || orders < 0 ||
      !/^-?\d+(?:\.\d+)?$/.test(row.revenue) || !Number.isFinite(revenue)) {
      throw new Error('Invalid historical revenue aggregate');
    }
    timeline.set(row.date, { date: row.date, orders, revenue });
  }
  return [...timeline.values()];
}
