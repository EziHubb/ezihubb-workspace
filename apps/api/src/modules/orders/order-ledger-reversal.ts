import { Prisma } from '@prisma/client';
import { releaseEconomicInventoryInTransaction } from '../products/inventory-reservation';

/** Reverse booked seller proceeds/fees, not a refund through a payment gateway.
 * Keep the original type so fees and sales remain in their accounting category.
 * The unique reversalOfId makes retries and concurrent cancellations harmless.
 */
export async function reverseCancelledOrderLedger(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const context=await tx.economicOrderContext.findUnique({where:{orderId}});
  if(context){
    // Lock the same context as capture consumption/expiry. Only original HELD
    // pools are restored; consumed/reacquired goods need separate return proof.
    await releaseEconomicInventoryInTransaction(tx,context.id,'CANCELLED');
    // Cancellation is not provider refund evidence; do not reverse captured v1
    // liabilities or update legacy credits here. Balance readers hold the order.
    return;
  }
  const entries = await tx.sellerLedgerEntry.findMany({
    where: { storeOrder: { orderId }, reversalOfId: null },
    select: { id: true, storeId: true, storeOrderId: true, type: true, amount: true, description: true },
  });
  if (!entries.length) return;
  await tx.sellerLedgerEntry.createMany({
    data: entries.map((entry) => ({
      storeId: entry.storeId,
      storeOrderId: entry.storeOrderId,
      type: entry.type,
      amount: entry.amount.negated(),
      description: `Cancellation reversal: ${entry.description}`,
      reversalOfId: entry.id,
    })),
    skipDuplicates: true,
  });
}
