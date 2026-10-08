import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { EconomicScope, economicTransaction, readEconomicBalance, recoverEconomicDebt, rejectEconomicPayout, reserveEconomicPayout } from '../../apps/api/src/modules/finances/economic-balance';
import { verifyAndBookEconomicCapture } from '../../apps/api/src/modules/finances/economic-capture';
import { consumeVerifiedEconomics } from '../../apps/api/src/modules/finances/economic-consumers';
import { claimEconomicEvent, claimEconomicOperation, consumeEconomicEvent, finishEconomicEvent, prepareEconomicOperation, quarantineExhaustedEvents, quarantineExpiredOperations } from '../../apps/api/src/modules/finances/economic-durability';
import { prepareQuantityRefund } from '../../apps/api/src/modules/finances/economic-refund';
import { EconomicRefundPlan } from '../../apps/api/src/modules/finances/economic-refund-plan';
import { executeEconomicRefund } from '../../apps/api/src/modules/finances/economic-refund-settlement';
import { readEconomicSummary } from '../../apps/api/src/modules/finances/economic-summary';
import { TransferReader, verifyAndSettleEconomicPayout } from '../../apps/api/src/modules/finances/economic-transfer';
import { legacyOrderWhere } from '../../apps/api/src/modules/finances/finance-reporting-scope';
import { RefundProvider } from '../../apps/api/src/modules/payments/economic-refund-evidence';
import { releaseEconomicInventory, reserveEconomicInventory } from '../../apps/api/src/modules/products/inventory-reservation';
import { Catalog, createCatalog, createOrder, createProduct, captureReader, ScenarioOrder } from './contention-fixtures';
import { expectSuccesses, race } from './contention-support';
import scenarioNames from './scenario-contract.json';

export const SCENARIOS = scenarioNames;
export type CaseEvidence = { name: typeof SCENARIOS[number]; outcome: 'PASS'; assertions: 'EXACT_DB_STATE'; backendPids: number[] };
type Clients = [PrismaClient, PrismaClient];

function fulfilled<T>(results: PromiseSettledResult<T>[]) {
  return results.filter((row): row is PromiseFulfilledResult<T> => row.status === 'fulfilled').map(row => row.value);
}
function stripeRefundProvider(): RefundProvider {
  return { provider: 'STRIPE', providerAccount: 'acct_m52_synthetic', provenance: 'TEST',
    create: async () => `re_m52${randomBytes(12).toString('hex')}`,
    read: async expected => ({ refund: { id: expected.refundReference, status: 'succeeded', charge: expected.captureReference,
      payment_intent: expected.paymentReference, currency: 'usd', amount: Number(expected.amountMinor),
      metadata: { economicRefundOperationId: expected.operationId, economicCaptureId: expected.captureId, quoteHash: expected.quoteHash } },
    original: { id: expected.captureReference, payment_intent: expected.paymentReference, livemode: false, paid: true, captured: true,
      disputed: false, currency: 'usd', amount_captured: Number(expected.capturedMinor), amount_refunded: Number(expected.amountMinor) } }) };
}
const transferReader: TransferReader = { provider: 'STRIPE', providerAccount: 'acct_m52_synthetic', provenance: 'TEST',
  read: async expected => ({ id: expected.transferReference, livemode: false, amount: Number(expected.amountMinor), currency: 'usd',
    destination: expected.destination, reversed: false, amount_reversed: 0, balance_transaction: 'txn_m52_synthetic',
    metadata: { economicPayoutId: expected.payoutId } }) };
const scopeFor = (catalog: Catalog, index = 0): EconomicScope => ({ kind: 'SELLER', beneficiaryId: catalog.stores[index].id, currency: 'USD', provenance: 'TEST' });
const payoutInput = (catalog: Catalog, key: string, amount = '1200') => ({ scope: scopeFor(catalog), amountMinor: amount,
  minimumMinor: 1n, idempotencyKey: key, actorId: catalog.admin.id, destination: 'acct_m52_destination' });
async function book(db: PrismaClient, order: ScenarioOrder) {
  await claimEconomicOperation(db, order.operation.id);
  return verifyAndBookEconomicCapture(db, order.operation.id, captureReader(order));
}
async function confirm(db: PrismaClient, order: ScenarioOrder) {
  const event = await db.economicOutbox.findUniqueOrThrow({ where: { eventKey: `capture:${(await db.economicCapture.findUniqueOrThrow({ where: { contextId: order.context.id } })).id}` } });
  await consumeVerifiedEconomics(db, event, 'TEST');
  return event;
}
async function paidOrder(db: PrismaClient, catalog: Catalog, options: { shipping?: boolean; wrap?: boolean; multi?: boolean; affiliate?: boolean; guest?: boolean } = {}) {
  const a = await createProduct(db, catalog, { name: `a-${randomBytes(4).toString('hex')}` });
  const b = options.multi ? await createProduct(db, catalog, { name: `b-${randomBytes(4).toString('hex')}`, store: 1 }) : null;
  const order = await createOrder(db, catalog, [{ ...a, quantity: 2 }, ...(b ? [{ ...b, quantity: 3 }] : [])], options);
  await reserveEconomicInventory(db, order.context.id);
  const capture = await book(db, order);
  await confirm(db, order);
  return { ...order, capture, products: [a, ...(b ? [b] : [])] };
}
async function balance(db: PrismaClient, scope: EconomicScope, now?: Date) {
  return economicTransaction(db, tx => readEconomicBalance(tx, scope, now));
}
async function refund(db: PrismaClient, catalog: Catalog, order: Awaited<ReturnType<typeof paidOrder>>, quantity = 1, key = randomBytes(6).toString('hex')) {
  const part = order.quote.parts.find(part => part.kind === 'ITEM' && part.storeId === catalog.stores[0].id); assert(part);
  return prepareQuantityRefund(db, { captureId: order.capture.id, actorId: catalog.admin.id, reason: 'M5.2 synthetic refund',
    idempotencyKey: key, selection: [{ partKey: part.key, quantity }] });
}

export async function runScenario(name: typeof SCENARIOS[number], clients: Clients, runId: string): Promise<CaseEvidence> {
  const db = clients[0], catalog = await createCatalog(db, runId, name);
  const backendPids: number[] = [];
  async function compete<T>(work: (database: PrismaClient, index: number) => Promise<T>) {
    const result = await race(clients, work); backendPids.push(...result.backendPids); return result.results;
  }
  if (name === 'outbox-lease-fencing-and-exhaustion') {
    // First case in each run. Previous runs must have no dispatchable events.
    assert.equal(await db.economicOutbox.count({ where: { OR: [{ state: 'PENDING', availableAt: { lte: new Date() } }, { state: 'CLAIMED' }] } }), 0);
    const order = await paidOrder(db, catalog);
    const event = await db.economicOutbox.findFirstOrThrow({ where: { contextId: order.context.id } });
    const now = new Date(Date.now() + 1000);
    const claims = await compete(database => economicTransaction(database, tx => claimEconomicEvent(tx as unknown as PrismaClient, now, 'TEST')));
    expectSuccesses(claims, 2);
    const won = fulfilled(claims).filter(row => row !== null);
    assert.equal(won.length, 1); const first = won[0]; assert(first); assert.equal(first.id, event.id);
    const later = new Date(first.leaseUntil.getTime() + 1);
    const next = await claimEconomicEvent(db, later, 'TEST'); assert(next);
    assert.equal((await finishEconomicEvent(db, event.id, first.leaseToken, true, later)).count, 0);
    assert.equal((await finishEconomicEvent(db, event.id, next.leaseToken, true, later)).count, 1);
    assert.equal((await db.economicOutbox.findUniqueOrThrow({ where: { id: event.id } })).attempts, 2);
    const another = await paidOrder(db, catalog);
    let clock = new Date(Date.now() + 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const lease = await claimEconomicEvent(db, clock, 'TEST'); assert(lease); assert.equal(lease.contextId, another.context.id);
      clock = new Date(lease.leaseUntil.getTime() + 1);
    }
    assert.equal(await claimEconomicEvent(db, clock, 'TEST'), null);
    assert.equal((await quarantineExhaustedEvents(db, clock, 'TEST')).count, 1);
    assert.equal(await db.economicOutbox.count({ where: { contextId: another.context.id, state: 'DEAD' } }), 1);
  } else if (name === 'operation-intent-and-dispatch-replay') {
    const product = await createProduct(db, catalog, { name: 'intent' });
    const order = await createOrder(db, catalog, [{ ...product, quantity: 1 }]);
    const input = { contextId: order.context.id, provenance: 'TEST' as const, currency: 'USD', provider: 'STRIPE' as const,
      providerAccount: 'acct_m52_synthetic', kind: 'PAYMENT_CREATE' as const, idempotencyKey: `intent:${order.order.id}`,
      requestHash: order.context.quoteHash, amountMinor: 1000n };
    const intents = await compete(database => economicTransaction(database, tx => prepareEconomicOperation(tx, input)));
    expectSuccesses(intents, 2); assert.equal(new Set(fulfilled(intents).map(op => op.id)).size, 1);
    await assert.rejects(economicTransaction(db, tx => prepareEconomicOperation(tx, { ...input, amountMinor: 1001n })), /different operation/);
    const op = fulfilled(intents)[0];
    const claims = await compete(database => economicTransaction(database, tx => claimEconomicOperation(tx, op.id)));
    expectSuccesses(claims, 2); assert.equal(fulfilled(claims).filter(Boolean).length, 1);
    await quarantineExpiredOperations(db, new Date(Date.now() + 60_000), 'TEST');
    assert.equal(await claimEconomicOperation(db, op.id), null);
    assert.equal((await db.economicOperation.findUniqueOrThrow({ where: { id: op.id } })).state, 'NEEDS_RECONCILIATION');
  } else if (name === 'last-product-unit' || name === 'last-variant-unit') {
    const product = await createProduct(db, catalog, { name: 'last', quantity: name === 'last-product-unit' ? 1 : 20, variant: name === 'last-variant-unit' });
    const orders = await Promise.all([0, 1].map(() => createOrder(db, catalog, [{ ...product, quantity: 1 }])));
    const results = await compete((database, index) => reserveEconomicInventory(database, orders[index].context.id));
    expectSuccesses(results, 1, /Insufficient inventory/);
    assert.equal(await db.economicInventoryReservation.count({ where: { contextId: { in: orders.map(row => row.context.id) } } }), 1);
    if (product.variant) {
      assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: product.variant.id } })).quantity, 0);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 20);
    } else assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 0);
  } else if (name === 'grouped-pool-replay-and-release') {
    const product = await createProduct(db, catalog, { name: 'group', quantity: 5 });
    const order = await createOrder(db, catalog, [{ ...product, quantity: 2 }, { ...product, quantity: 3 }]);
    const reserved = await compete(database => reserveEconomicInventory(database, order.context.id)); expectSuccesses(reserved, 2);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 0);
    const pools = await db.economicInventoryReservation.findMany({ where: { contextId: order.context.id } });
    assert.equal(pools.length, 1); assert.equal(pools[0].quantity, 5); assert.equal((pools[0].lines as unknown[]).length, 2);
    const originalExpiry = pools[0].expiresAt.getTime();
    expectSuccesses(await compete(database => releaseEconomicInventory(database, order.context.id, 'CANCELLED')), 2);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 5);
    const replay = await reserveEconomicInventory(db, order.context.id); assert.equal(replay[0].state, 'RELEASED');
    assert.equal(replay[0].expiresAt.getTime(), originalExpiry);
  } else if (name === 'unlimited-and-digital-pools') {
    const a = await createProduct(db, catalog, { name: 'unlimited', unlimited: true });
    const b = await createProduct(db, catalog, { name: 'digital', unlimited: true, digital: true, store: 1 });
    const orders = await Promise.all([0, 1].map(() => createOrder(db, catalog, [{ ...a, quantity: 7 }, { ...b, quantity: 9 }])));
    expectSuccesses(await compete((database, index) => reserveEconomicInventory(database, orders[index].context.id)), 2);
    const rows = await db.economicInventoryReservation.findMany({ where: { contextId: { in: orders.map(order => order.context.id) } } });
    assert.equal(rows.length, 4); assert(rows.every(row => row.target === 'UNLIMITED'));
    assert((await db.product.findMany({ where: { id: { in: [a.product.id, b.product.id] } } })).every(row => row.quantity === null));
  } else if (name === 'multi-pool-rollback') {
    const a = await createProduct(db, catalog, { name: 'available', quantity: 1 });
    const b = await createProduct(db, catalog, { name: 'sold-out', quantity: 0, store: 1 });
    const order = await createOrder(db, catalog, [{ ...a, quantity: 1 }, { ...b, quantity: 1 }]);
    await assert.rejects(reserveEconomicInventory(db, order.context.id), /Insufficient inventory/);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: a.product.id } })).quantity, 1);
    assert.equal(await db.economicInventoryReservation.count({ where: { contextId: order.context.id } }), 0);
  } else if (name === 'duplicate-capture-and-lifecycle') {
    const product = await createProduct(db, catalog, { name: 'capture', quantity: 5 });
    const order = await createOrder(db, catalog, [{ ...product, quantity: 2 }], { guest: true });
    await reserveEconomicInventory(db, order.context.id); await claimEconomicOperation(db, order.operation.id);
    const results = await compete(database => verifyAndBookEconomicCapture(database, order.operation.id, captureReader(order)));
    assert(fulfilled(results).length >= 1); expectSuccesses(results, fulfilled(results).length, /Concurrent capture changed/);
    const capture = await verifyAndBookEconomicCapture(db, order.operation.id, captureReader(order));
    await verifyAndBookEconomicCapture(clients[1], order.operation.id, captureReader(order));
    assert.equal(await db.economicCapture.count({ where: { contextId: order.context.id } }), 1);
    assert.equal(await db.economicBalanceLot.count({ where: { captureId: capture.id } }), order.quote.parts.length);
    const journal = await db.economicJournalEntry.aggregate({ where: { captureId: capture.id }, _sum: { amountMinor: true } });
    assert.equal(journal._sum.amountMinor, 0n);
    const event = await db.economicOutbox.findFirstOrThrow({ where: { contextId: order.context.id } });
    const consumption = await compete(database => consumeVerifiedEconomics(database, event, 'TEST')); expectSuccesses(consumption, 2);
    assert.equal(fulfilled(consumption).filter(Boolean).length, 1);
    assert.equal(await db.economicConsumerReceipt.count({ where: { eventId: event.id, consumer: 'lifecycle.v1' } }), 1);
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.order.id, status: 'CONFIRMED' } }), 1);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 3);
  } else if (name === 'consumer-effect-rollback') {
    const order = await paidOrder(db, catalog), product = order.products[0].product;
    const event = await db.economicOutbox.findFirstOrThrow({ where: { contextId: order.context.id } });
    const input = { provenance: 'TEST' as const, eventType: 'capture.verified.v1' as const };
    await assert.rejects(consumeEconomicEvent(db, event.id, 'm52.rollback', input, async tx => {
      await tx.product.update({ where: { id: product.id }, data: { quantity: { decrement: 1 } } }); throw new Error('M52_INJECTED_FAILURE');
    }), /M52_INJECTED_FAILURE/);
    assert.equal(await db.economicConsumerReceipt.count({ where: { eventId: event.id, consumer: 'm52.rollback' } }), 0);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).quantity, 18);
    expectSuccesses(await compete(database => consumeEconomicEvent(database, event.id, 'm52.rollback', input, async tx => {
      await tx.product.update({ where: { id: product.id }, data: { quantity: { decrement: 1 } } });
    })), 2);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).quantity, 17);
    assert.equal(await db.economicConsumerReceipt.count({ where: { eventId: event.id, consumer: 'm52.rollback' } }), 1);
  } else if (name === 'payout-overspend-and-reject') {
    await paidOrder(db, catalog);
    const requests = await compete((database, index) => reserveEconomicPayout(database, payoutInput(catalog, `compete-${index}`)));
    expectSuccesses(requests, 1, /exceeds captured/);
    const payout = fulfilled(requests)[0];
    assert.equal((await balance(db, scopeFor(catalog))).reserved, 1200n);
    const rejected = await compete(database => rejectEconomicPayout(database, payout.id, catalog.admin.id, 'M5.2', scopeFor(catalog)));
    expectSuccesses(rejected, 1, /already terminal|state changed/);
    const after = await balance(db, scopeFor(catalog)); assert.equal(after.reserved, 0n); assert.equal(after.available, 1899n);
  } else if (name === 'payout-settle-versus-reject') {
    await paidOrder(db, catalog); const payout = await reserveEconomicPayout(db, payoutInput(catalog, 'settle-reject'));
    const results = await compete<unknown>((database, index) => index === 0
      ? verifyAndSettleEconomicPayout(database, payout.id, catalog.admin.id, `tr_m52${payout.id}`, transferReader, scopeFor(catalog))
      : rejectEconomicPayout(database, payout.id, catalog.admin.id, 'M5.2', scopeFor(catalog)));
    expectSuccesses(results, 1, /terminal|Rejected payout|state changed/);
    const saved = await db.economicPayout.findUniqueOrThrow({ where: { id: payout.id } });
    assert(['PAID', 'REJECTED'].includes(saved.state));
    const after = await balance(db, scopeFor(catalog)); assert.equal(after.reserved, 0n);
    assert.equal(after.paid, saved.state === 'PAID' ? 1200n : 0n); assert.equal(after.available + after.paid, 1899n);
  } else if (name === 'tenant-mode-and-legacy-report-isolation') {
    const order = await paidOrder(db, catalog, { multi: true });
    assert.equal((await balance(db, scopeFor(catalog))).captured, 1899n);
    assert.equal((await balance(db, scopeFor(catalog, 1))).captured, 2899n);
    assert.equal((await balance(db, { ...scopeFor(catalog), provenance: 'LIVE' })).captured, 0n);
    assert.equal((await balance(db, { ...scopeFor(catalog), currency: 'EUR' })).captured, 0n);
    const payout = await reserveEconomicPayout(db, payoutInput(catalog, 'tenant'));
    await assert.rejects(rejectEconomicPayout(db, payout.id, catalog.admin.id, 'M5.2', scopeFor(catalog, 1)), /does not belong/);
    assert.equal((await db.economicPayout.findUniqueOrThrow({ where: { id: payout.id } })).state, 'REQUESTED');
    const live = await readEconomicSummary(db, { currency: 'USD', provenance: 'LIVE' }); assert.equal(live.capturedMinor, '0');
    assert.equal(await db.order.count({ where: legacyOrderWhere({ id: order.order.id }) }), 0);
    await rejectEconomicPayout(db, payout.id, catalog.admin.id, 'M5.2 cleanup via business transition', scopeFor(catalog));
  } else if (name === 'refund-intent-idempotency') {
    const order = await paidOrder(db, catalog);
    const results = await compete(database => refund(database, catalog, order, 1, 'same-key')); expectSuccesses(results, 2);
    assert.equal(new Set(fulfilled(results).map(request => request.id)).size, 1);
    await assert.rejects(refund(db, catalog, order, 2, 'same-key'), /different details/);
    await assert.rejects(refund(db, catalog, order, 1, 'other-key'), /existing refund/);
    assert.equal(await db.economicRefundRequest.count({ where: { captureId: order.capture.id } }), 1);
    assert.equal(await db.economicRefund.count({ where: { request: { captureId: order.capture.id } } }), 0);
  } else if (name === 'refund-settlement-replay') {
    const order = await paidOrder(db, catalog), request = await refund(db, catalog, order);
    await claimEconomicOperation(db, request.operationId);
    const provider = stripeRefundProvider(); let writes = 0;
    provider.create = async () => { writes++; throw new Error('M52_UNEXPECTED_REDISPATCH'); };
    const reference = `re_m52${request.id}`;
    const results = await compete(database => executeEconomicRefund(database, request.id, catalog.admin.id, provider, reference)); expectSuccesses(results, 2);
    assert.equal(new Set(fulfilled(results).map(row => row.id)).size, 1); assert.equal(writes, 0);
    await executeEconomicRefund(db, request.id, catalog.admin.id, provider, reference);
    const plan = request.plan as unknown as EconomicRefundPlan;
    assert.equal((await balance(db, scopeFor(catalog))).reversed, BigInt(plan.parts[0].sellerNetMinor));
    const saved = await db.economicRefund.findUniqueOrThrow({ where: { requestId: request.id } });
    assert.equal((await db.economicRefundJournalEntry.aggregate({ where: { refundId: saved.id }, _sum: { amountMinor: true } }))._sum.amountMinor, 0n);
    assert.equal(await db.economicRefundLotReversal.count({ where: { refundId: saved.id } }), 1);
  } else if (name === 'payout-versus-refund') {
    const order = await paidOrder(db, catalog);
    const results = await compete<unknown>((database, index) => index === 0
      ? reserveEconomicPayout(database, payoutInput(catalog, 'payout-refund', '1000')) : refund(database, catalog, order));
    expectSuccesses(results, 1, /reserved payouts|exceeds captured/);
    const requests = await db.economicRefundRequest.count({ where: { captureId: order.capture.id } });
    const payouts = await db.economicPayout.count({ where: { account: scopeFor(catalog), state: 'REQUESTED' } });
    assert.equal(requests + payouts, 1);
  } else if (name === 'post-payout-refund-and-debt-recovery') {
    const order = await paidOrder(db, catalog);
    const payout = await reserveEconomicPayout(db, payoutInput(catalog, 'full', '1899'));
    await verifyAndSettleEconomicPayout(db, payout.id, catalog.admin.id, `tr_m52${payout.id}`, transferReader);
    const request = await refund(db, catalog, order); await executeEconomicRefund(db, request.id, catalog.admin.id, stripeRefundProvider());
    const debt = BigInt((request.plan as unknown as EconomicRefundPlan).parts[0].sellerNetMinor);
    assert.equal((await balance(db, scopeFor(catalog))).debt, debt); assert.equal((await balance(db, scopeFor(catalog))).paid, 1899n);
    await paidOrder(db, catalog); // New captured funds from the same beneficiary, not invented balances.
    const recovered = await compete(database => economicTransaction(database, tx => recoverEconomicDebt(tx, scopeFor(catalog), catalog.admin.id)));
    expectSuccesses(recovered, 2); assert.equal(fulfilled(recovered).reduce((sum, value) => sum + value, 0n), debt);
    const after = await balance(db, scopeFor(catalog)); assert.equal(after.debt, 0n); assert.equal(after.debtRecovered, debt);
    assert.equal(await db.economicDebtRecovery.count({ where: { lot: { account: scopeFor(catalog) } } }), 1);
  } else if (name === 'multi-shop-partial-refund-rounding') {
    const order = await paidOrder(db, catalog, { multi: true, affiliate: true });
    const untouched = await balance(db, scopeFor(catalog, 1));
    for (let quantity = 0; quantity < 2; quantity++) {
      const request = await refund(db, catalog, order, 1, `unit-${quantity}`);
      const result = await executeEconomicRefund(db, request.id, catalog.admin.id, stripeRefundProvider());
      const event = await db.economicOutbox.findFirstOrThrow({ where: { contextId: order.context.id, eventType: 'refund.verified.v1', payload: { path: ['operationId'], equals: request.operationId } } });
      await consumeVerifiedEconomics(db, event, 'TEST'); assert.equal(result.amountMinor, '1000');
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.order.id } })).status, 'CONFIRMED');
    }
    assert.equal((await balance(db, scopeFor(catalog))).reversed, 1899n);
    const after = await balance(db, scopeFor(catalog, 1)); assert.equal(after.captured, untouched.captured); assert.equal(after.reversed, 0n);
    assert.equal((await db.economicRefund.aggregate({ where: { request: { captureId: order.capture.id } }, _sum: { amountMinor: true } }))._sum.amountMinor, 2000n);
    for (const row of await db.economicRefund.findMany({ where: { request: { captureId: order.capture.id } } })) {
      assert.equal((await db.economicRefundJournalEntry.aggregate({ where: { refundId: row.id }, _sum: { amountMinor: true } }))._sum.amountMinor, 0n);
    }
  } else if (name === 'gift-wrap-explicit-approval') {
    const order = await paidOrder(db, catalog, { wrap: true });
    const part = order.quote.parts.find(part => part.kind === 'GIFT_WRAP'); assert(part);
    const input = { captureId: order.capture.id, actorId: catalog.admin.id, reason: 'M5.2 separate approval', idempotencyKey: 'wrap', selection: [{ partKey: part.key, quantity: 1 }] };
    await assert.rejects(prepareQuantityRefund(db, input), /explicitly approved gift wrap/);
    assert.equal(await db.economicRefundRequest.count({ where: { captureId: order.capture.id } }), 0);
    const request = await prepareQuantityRefund(db, { ...input, approveGiftWrap: true });
    assert.equal((request.plan as unknown as EconomicRefundPlan).giftWrapApproval?.approvedBy, catalog.admin.id);
    await executeEconomicRefund(db, request.id, catalog.admin.id, stripeRefundProvider());
    assert.equal((await db.economicRefund.findUniqueOrThrow({ where: { requestId: request.id } })).amountMinor, 300n);
  } else if (name === 'shipping-pre-handoff-eligibility') {
    const order = await paidOrder(db, catalog, { multi: true, shipping: true });
    const parts = order.quote.parts.filter(part => part.storeId === catalog.stores[0].id && ['SHIPPING', 'ITEM'].includes(part.kind));
    const input = { captureId: order.capture.id, actorId: catalog.admin.id, reason: 'M5.2 pre-handoff shipping', idempotencyKey: 'shipping', selection: parts.map(part => ({ partKey: part.key, quantity: part.quantity })) };
    await assert.rejects(prepareQuantityRefund(db, input), /fully cancelled shop/);
    await db.storeOrder.update({ where: { id: parts[0].storeOrderId }, data: { status: 'CANCELLED' } });
    const request = await prepareQuantityRefund(db, input); await executeEconomicRefund(db, request.id, catalog.admin.id, stripeRefundProvider());
    assert.equal((await db.economicRefund.findUniqueOrThrow({ where: { requestId: request.id } })).amountMinor, 2500n);
    const other = order.quote.parts.filter(part => part.storeId === catalog.stores[1].id && ['SHIPPING', 'ITEM'].includes(part.kind));
    await db.storeOrder.update({ where: { id: other[0].storeOrderId }, data: { status: 'CANCELLED', shippedAt: new Date() } });
    await assert.rejects(prepareQuantityRefund(db, { ...input, idempotencyKey: 'after-handoff', selection: other.map(part => ({ partKey: part.key, quantity: part.quantity })) }), /fully cancelled shop/);
  } else if (name === 'late-capture-reacquisition' || name === 'late-capture-sold-out') {
    const product = await createProduct(db, catalog, { name: 'late', quantity: 1 });
    const order = await createOrder(db, catalog, [{ ...product, quantity: 1 }]);
    const past = new Date(Date.now() - 120_000);
    await reserveEconomicInventory(db, order.context.id, past, 1); await releaseEconomicInventory(db, order.context.id, 'EXPIRED');
    if (name === 'late-capture-sold-out') {
      const another = await createOrder(db, catalog, [{ ...product, quantity: 1 }]); await reserveEconomicInventory(db, another.context.id);
    }
    const capture = await book(db, order), event = await db.economicOutbox.findFirstOrThrow({ where: { contextId: order.context.id } });
    if (name === 'late-capture-sold-out') {
      await assert.rejects(consumeVerifiedEconomics(db, event, 'TEST'), /Late capture stock unavailable/);
      assert.equal(await db.economicConsumerReceipt.count({ where: { eventId: event.id } }), 0);
      assert.equal(await db.economicInventoryReacquisition.count({ where: { captureId: capture.id } }), 0);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.order.id } })).status, 'PENDING_PAYMENT');
    } else {
      expectSuccesses(await compete(database => consumeVerifiedEconomics(database, event, 'TEST')), 2);
      assert.equal(await db.economicInventoryReacquisition.count({ where: { captureId: capture.id } }), 1);
      assert.equal((await db.economicInventoryReservation.findFirstOrThrow({ where: { contextId: order.context.id } })).state, 'EXPIRED');
    }
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.product.id } })).quantity, 0);
  } else if (name === 'affiliate-delivery-maturity') {
    const order = await paidOrder(db, catalog, { multi: true, affiliate: true });
    const scope: EconomicScope = { kind: 'AFFILIATE', beneficiaryId: catalog.affiliate.id, currency: 'USD', provenance: 'TEST' };
    assert.equal((await balance(db, scope)).pending, 50n); assert.equal((await balance(db, scope)).available, 0n);
    const deliveredAt = new Date(Date.now() - 2 * 86400000);
    await db.storeOrder.updateMany({ where: { orderId: order.order.id }, data: { status: 'DELIVERED', deliveredAt } });
    assert.equal((await balance(db, scope)).available, 50n);
    assert.equal((await balance(db, { ...scope, provenance: 'LIVE' })).captured, 0n);
  } else if (name === 'immutable-financial-evidence') {
    const order = await paidOrder(db, catalog);
    await assert.rejects(db.economicCapture.update({ where: { id: order.capture.id }, data: { amountMinor: 1n } }));
    await assert.rejects(db.economicOrderContext.update({ where: { id: order.context.id }, data: { quoteHash: '0'.repeat(64) } }));
    await assert.rejects(db.economicCapture.delete({ where: { id: order.capture.id } }));
    assert.equal((await db.economicCapture.findUniqueOrThrow({ where: { id: order.capture.id } })).amountMinor, 2000n);
    assert.equal((await db.economicOrderContext.findUniqueOrThrow({ where: { id: order.context.id } })).quoteHash, order.context.quoteHash);
  } else throw new Error('M5_UNKNOWN_SCENARIO');
  // Test-only scheduling containment: keep evidence, do NOT pretend it published.
  // Later runs' scheduler races must not consume this case's pending messages.
  await db.economicOutbox.updateMany({ where: { state: 'PENDING', context: { order: { storeOrders: {
    some: { storeId: { in: catalog.stores.map(store => store.id) } },
  } } } }, data: { availableAt: new Date('9999-01-01T00:00:00.000Z') } });
  return { name, outcome: 'PASS', assertions: 'EXACT_DB_STATE', backendPids: [...new Set(backendPids)] };
}
