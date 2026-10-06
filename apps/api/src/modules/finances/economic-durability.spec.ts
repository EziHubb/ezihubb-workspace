import { Prisma, PrismaClient } from '@prisma/client';
import {
  appendEconomicEvent, claimEconomicEvent, claimEconomicOperation, consumeEconomicEvent,
  finishEconomicEvent, markEconomicOperationAmbiguous, prepareEconomicOperation,
  quarantineExhaustedEvents, quarantineExpiredOperations,
} from './economic-durability';
import { ECONOMIC_POLICY_VERSION } from './economic-policy';

const input = {
  contextId: 'context1', provenance: 'TEST' as const, currency: 'USD', provider: 'STRIPE' as const,
  providerAccount: 'sandbox-account', kind: 'CAPTURE' as const, idempotencyKey: 'capture-order1-v1',
  requestHash: 'a'.repeat(64), amountMinor: 11999n,
};
const context = { id: input.contextId, policyVersion: ECONOMIC_POLICY_VERSION, currency: 'USD', provenance: 'TEST' };
const operation = { ...input, id: 'operation1', state: 'SUCCEEDED', providerReference: 'provider-capture1' };
const event = { id: 'event1', contextId: 'context1', eventKey: 'capture:operation1',
  eventType: 'capture.verified.v1' as const, payload: { operationId: 'operation1' },
  context, state: 'CLAIMED', attempts: 1 };
const expected = { provenance: 'TEST' as const, eventType: event.eventType };

function harness() {
  const tx = {
    economicOrderContext: { findUniqueOrThrow: jest.fn().mockResolvedValue(context) },
    economicOperation: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(operation),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    economicOutbox: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(event),
      findFirst: jest.fn().mockResolvedValue(event),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    economicConsumerReceipt: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const transaction = tx as unknown as Prisma.TransactionClient;
  const db = { ...tx, $transaction: jest.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(transaction)) };
  return { tx, transaction, db, database: db as unknown as PrismaClient };
}

describe('dormant economic durability contracts (modeled DB)', () => {
  it('prepares once and accepts the same intent on replay without provider I/O', async () => {
    const h = harness();
    expect(await prepareEconomicOperation(h.transaction, input)).toEqual(operation);
    h.tx.economicOperation.createMany.mockResolvedValue({ count: 0 });
    expect(await prepareEconomicOperation(h.transaction, input)).toEqual(operation);
    expect(h.tx.economicOperation.createMany).toHaveBeenCalledWith({ data: [{ ...input, state: 'PREPARED' }], skipDuplicates: true });
  });

  it('does not let unexpected caller fields create a fake successful intent', async () => {
    const h = harness();
    await prepareEconomicOperation(h.transaction, {
      ...input, state: 'SUCCEEDED', providerReference: 'untrusted', secret: 'omit',
    } as typeof input);
    expect(h.tx.economicOperation.createMany).toHaveBeenCalledWith({
      data: [{ ...input, state: 'PREPARED' }], skipDuplicates: true,
    });
  });

  it.each([
    { amountMinor: 12000n }, { requestHash: 'b'.repeat(64) }, { contextId: 'another-context' },
  ])('rejects changed evidence behind an existing idempotency key %p', async change => {
    const h = harness();
    h.tx.economicOperation.findUniqueOrThrow.mockResolvedValue({ ...operation, ...change });
    await expect(prepareEconomicOperation(h.transaction, input)).rejects.toThrow('Idempotency key reused');
  });

  it('rejects test/live, currency, version and amount mismatches before insertion', async () => {
    for (const change of [{ provenance: 'LIVE' }, { currency: 'EUR' }, { policyVersion: 'legacy' }]) {
      const h = harness();
      h.tx.economicOrderContext.findUniqueOrThrow.mockResolvedValue({ ...context, ...change });
      await expect(prepareEconomicOperation(h.transaction, input)).rejects.toThrow('context mismatch');
      expect(h.tx.economicOperation.createMany).not.toHaveBeenCalled();
    }
    const h = harness();
    for (const amountMinor of [0n, -1n, 9223372036854775808n]) {
      await expect(prepareEconomicOperation(h.transaction, { ...input, amountMinor })).rejects.toThrow();
    }
  });

  it('only one claimant can dispatch; an ambiguous operation is not resent', async () => {
    const h = harness();
    let state = 'PREPARED';
    h.tx.economicOperation.updateMany.mockImplementation(async ({ where, data }) => {
      if (state !== where.state) return { count: 0 };
      state = data.state;
      return { count: 1 };
    });
    const claims = await Promise.all([
      claimEconomicOperation(h.database, operation.id), claimEconomicOperation(h.database, operation.id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const token = claims.find(Boolean);
    if (!token) throw new Error('Expected a winning dispatch claim');
    await markEconomicOperationAmbiguous(h.database, operation.id, token);
    expect(state).toBe('NEEDS_RECONCILIATION');
    expect(await claimEconomicOperation(h.database, operation.id)).toBeNull();
  });

  it('quarantines expired provider calls instead of making them retryable', async () => {
    const h = harness();
    const now = new Date('2026-10-03T00:00:00Z');
    await quarantineExpiredOperations(h.database, now);
    expect(h.tx.economicOperation.updateMany).toHaveBeenCalledWith({
      where: { state: 'DISPATCHED', reconcileAfter: { lte: now } }, data: { state: 'NEEDS_RECONCILIATION' },
    });
  });

  it('appends a reference-only event and checks evidence on duplicate keys', async () => {
    const h = harness();
    const args = { contextId: 'context1', eventKey: event.eventKey, eventType: event.eventType, operationId: operation.id };
    await appendEconomicEvent(h.transaction, { ...args, guestEmail: 'not-for-outbox' } as typeof args);
    expect(h.tx.economicOutbox.createMany).toHaveBeenCalledWith({
      data: [{ contextId: args.contextId, eventKey: args.eventKey, eventType: args.eventType,
        payload: { operationId: operation.id } }], skipDuplicates: true,
    });
    h.tx.economicOutbox.findUniqueOrThrow.mockResolvedValue({ ...event, contextId: 'foreign' });
    await expect(appendEconomicEvent(h.transaction, args)).rejects.toThrow('Event key reused');
  });

  it.each([
    { state: 'DISPATCHED' }, { contextId: 'foreign' }, { kind: 'REFUND' }, { providerReference: null },
  ])('does not publish unverified/mismatched capture evidence %j', async change => {
    const h = harness();
    h.tx.economicOperation.findUniqueOrThrow.mockResolvedValue({ ...operation, ...change });
    await expect(appendEconomicEvent(h.transaction, {
      contextId: 'context1', eventKey: event.eventKey, eventType: event.eventType, operationId: operation.id,
    })).rejects.toThrow('Verified event');
    expect(h.tx.economicOutbox.createMany).not.toHaveBeenCalled();
  });

  it('claims with a fenced lease and acknowledges only the current unexpired lease', async () => {
    const h = harness();
    const now = new Date('2026-10-03T00:00:00Z');
    const claim = await claimEconomicEvent(h.database, now);
    expect(claim).toMatchObject({ id: event.id, attempts: 2 });
    expect(claim?.leaseToken).toMatch(/^[a-f0-9]{48}$/);
    if (!claim) throw new Error('Expected an event lease');
    await finishEconomicEvent(h.database, event.id, claim.leaseToken, true, now);
    expect(h.tx.economicOutbox.updateMany).toHaveBeenLastCalledWith({
      where: { id: event.id, state: 'CLAIMED', leaseToken: claim.leaseToken, leaseUntil: { gt: now } },
      data: { state: 'PUBLISHED', publishedAt: now, leaseToken: null, leaseUntil: null },
    });
    h.tx.economicOutbox.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimEconomicEvent(h.database, now)).toBeNull();
  });

  it('bounds retries, dead-letters exhaustion, including death on the final attempt', async () => {
    const h = harness();
    const now = new Date('2026-10-03T00:00:00Z');
    await finishEconomicEvent(h.database, event.id, 'lease1', false, now);
    expect(h.tx.economicOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'PENDING', availableAt: new Date(now.getTime() + 2000) }),
    }));
    h.tx.economicOutbox.findUniqueOrThrow.mockResolvedValue({ ...event, attempts: 5 });
    await finishEconomicEvent(h.database, event.id, 'lease2', false, now);
    expect(h.tx.economicOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'DEAD' }),
    }));
    await quarantineExhaustedEvents(h.database, now);
    expect(h.tx.economicOutbox.updateMany).toHaveBeenLastCalledWith({
      where: { state: 'CLAIMED', attempts: { gte: 5 }, leaseUntil: { lte: now } },
      data: { state: 'DEAD', leaseToken: null, leaseUntil: null },
    });
  });

  it('commits receipt and DB effects in the same transaction; replay skips the effect', async () => {
    const h = harness();
    const effect = jest.fn().mockResolvedValue(undefined);
    expect(await consumeEconomicEvent(h.database, event.id, 'inventory.v1', expected, effect)).toBe(true);
    expect(effect).toHaveBeenCalledWith(h.transaction, event);
    h.tx.economicConsumerReceipt.createMany.mockResolvedValue({ count: 0 });
    expect(await consumeEconomicEvent(h.database, event.id, 'inventory.v1', expected, effect)).toBe(false);
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('propagates effect failure to the transaction boundary so its receipt rolls back', async () => {
    const h = harness();
    let committedReceipt = false;
    h.db.$transaction.mockImplementation(async fn => {
      const result = await fn(h.transaction);
      committedReceipt = true;
      return result;
    });
    await expect(consumeEconomicEvent(h.database, event.id, 'inventory.v1', expected, async () => {
      throw new Error('inventory write failed');
    })).rejects.toThrow('inventory write failed');
    expect(committedReceipt).toBe(false);
    const effect = jest.fn().mockResolvedValue(undefined);
    expect(await consumeEconomicEvent(h.database, event.id, 'inventory.v1', expected, effect)).toBe(true);
    expect(committedReceipt).toBe(true);
  });

  it('blocks test events in a live consumer and incompatible event types/versions', async () => {
    const h = harness();
    const effect = jest.fn();
    await expect(consumeEconomicEvent(h.database, event.id, 'inventory.v1', {
      ...expected, provenance: 'LIVE',
    }, effect)).rejects.toThrow('Unsupported event');
    await expect(consumeEconomicEvent(h.database, event.id, 'inventory.v1', {
      ...expected, eventType: 'refund.verified.v1',
    }, effect)).rejects.toThrow('Unsupported event');
    h.tx.economicOutbox.findUniqueOrThrow.mockResolvedValue({ ...event, context: { ...context, policyVersion: 'legacy' } });
    await expect(consumeEconomicEvent(h.database, event.id, 'inventory.v1', expected, effect)).rejects.toThrow();
    expect(effect).not.toHaveBeenCalled();
    expect(h.tx.economicConsumerReceipt.createMany).not.toHaveBeenCalled();
  });
});
