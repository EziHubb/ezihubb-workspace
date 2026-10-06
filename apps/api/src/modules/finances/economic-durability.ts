import { randomBytes } from 'node:crypto';
import { EconomicOutbox, EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { ECONOMIC_POLICY_VERSION } from './economic-policy';

// Deliberately not registered in a Nest module or scheduler. No provider calls.
// Callers must activate a coordinated versioned producer/reader/consumer chain.
const MAX_MINOR = 9223372036854775807n;
const MAX_OUTBOX_ATTEMPTS = 5;
const LEASE_MS = 30_000;
type Database = Pick<PrismaClient, '$transaction' | 'economicOperation' | 'economicOutbox'>;
type OperationInput = Pick<Prisma.EconomicOperationCreateManyInput,
  'contextId' | 'provenance' | 'currency' | 'provider' | 'providerAccount' | 'kind'
  | 'idempotencyKey' | 'requestHash'> & { amountMinor: bigint };

function requireText(value: string, max: number): void {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error('Invalid economic identifier');
  }
}

/** Persist and commit this intent BEFORE any provider request. */
export async function prepareEconomicOperation(tx: Prisma.TransactionClient, input: OperationInput) {
  requireText(input.providerAccount, 100);
  requireText(input.idempotencyKey, 100);
  if (!/^[a-f0-9]{64}$/.test(input.requestHash) || !/^[A-Z]{3}$/.test(input.currency)
    || typeof input.amountMinor !== 'bigint' || input.amountMinor <= 0n || input.amountMinor > MAX_MINOR) {
    throw new Error('Invalid economic operation amount or fingerprint');
  }
  const context = await tx.economicOrderContext.findUniqueOrThrow({ where: { id: input.contextId } });
  if (context.policyVersion !== ECONOMIC_POLICY_VERSION
    || context.currency !== input.currency || context.provenance !== input.provenance) {
    throw new Error('Economic context mismatch');
  }
  // ON CONFLICT DO NOTHING avoids aborting a PostgreSQL transaction on replay.
  await tx.economicOperation.createMany({ data: [{
    contextId: input.contextId, provenance: input.provenance, currency: input.currency,
    provider: input.provider, providerAccount: input.providerAccount, kind: input.kind,
    idempotencyKey: input.idempotencyKey, requestHash: input.requestHash, amountMinor: input.amountMinor,
    state: 'PREPARED',
  }], skipDuplicates: true });
  const existing = await tx.economicOperation.findUniqueOrThrow({ where: {
    provider_providerAccount_provenance_kind_idempotencyKey: {
      provider: input.provider, providerAccount: input.providerAccount,
      provenance: input.provenance, kind: input.kind, idempotencyKey: input.idempotencyKey,
    },
  } });
  if (existing.contextId !== input.contextId || existing.amountMinor !== input.amountMinor
    || existing.currency !== input.currency || existing.requestHash !== input.requestHash) {
    throw new Error('Idempotency key reused for a different operation');
  }
  return existing;
}

/** Only PREPARED is dispatchable. Timeout/expiry is NEVER permission to resend. */
export async function claimEconomicOperation(db: Pick<PrismaClient, 'economicOperation'>, id: string, now = new Date()) {
  const token = randomBytes(24).toString('hex');
  const result = await db.economicOperation.updateMany({
    where: { id, state: 'PREPARED' },
    data: { state: 'DISPATCHED', dispatchToken: token, dispatchedAt: now,
      reconcileAfter: new Date(now.getTime() + LEASE_MS) },
  });
  return result.count === 1 ? token : null;
}

export async function markEconomicOperationAmbiguous(db: Database, id: string, token: string) {
  return db.economicOperation.updateMany({
    where: { id, state: 'DISPATCHED', dispatchToken: token },
    data: { state: 'NEEDS_RECONCILIATION' },
  });
}

/** Read provider evidence for these operations; do not create a fresh request. */
export async function quarantineExpiredOperations(db: Database, now = new Date()) {
  return db.economicOperation.updateMany({
    where: { state: 'DISPATCHED', reconcileAfter: { lte: now } },
    data: { state: 'NEEDS_RECONCILIATION' },
  });
}

type EventInput = {
  contextId: string;
  eventKey: string;
  eventType: 'capture.verified.v1' | 'refund.verified.v1';
  operationId: string;
};

/** Call inside the SAME transaction as the corresponding economic effects. */
export async function appendEconomicEvent(tx: Prisma.TransactionClient, input: EventInput) {
  requireText(input.eventKey, 150);
  const operation = await tx.economicOperation.findUniqueOrThrow({ where: { id: input.operationId } });
  const expectedKind = input.eventType === 'capture.verified.v1' ? 'CAPTURE'
    : input.eventType === 'refund.verified.v1' ? 'REFUND' : null;
  if (!expectedKind || operation.contextId !== input.contextId || operation.kind !== expectedKind
    || operation.state !== 'SUCCEEDED' || !operation.providerReference) {
    throw new Error('Verified event requires matching successful provider evidence');
  }
  // Explicit construction excludes accidental PII/tokens in caller input.
  const payload = { operationId: input.operationId };
  await tx.economicOutbox.createMany({ data: [{
    contextId: input.contextId, eventKey: input.eventKey, eventType: input.eventType, payload,
  }], skipDuplicates: true });
  const existing = await tx.economicOutbox.findUniqueOrThrow({ where: { eventKey: input.eventKey } });
  if (existing.contextId !== input.contextId || existing.eventType !== input.eventType
    || JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
    throw new Error('Event key reused for different evidence');
  }
  return existing;
}

export async function claimEconomicEvent(db: Database, now = new Date()) {
  const eligible: Prisma.EconomicOutboxWhereInput = {
    attempts: { lt: MAX_OUTBOX_ATTEMPTS },
    OR: [
      { state: 'PENDING', availableAt: { lte: now } },
      { state: 'CLAIMED', leaseUntil: { lte: now } },
    ],
  };
  const event = await db.economicOutbox.findFirst({
    where: eligible, orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
  });
  if (!event) return null;
  const leaseToken = randomBytes(24).toString('hex');
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const claimed = await db.economicOutbox.updateMany({
    where: { AND: [{ id: event.id }, eligible] },
    data: { state: 'CLAIMED', attempts: { increment: 1 }, leaseToken, leaseUntil },
  });
  // A competing worker can win; the scheduler can poll again without blocking.
  return claimed.count === 1 ? { ...event, attempts: event.attempts + 1, leaseToken, leaseUntil } : null;
}

/** A stale publisher cannot acknowledge or release another worker's lease. */
export async function finishEconomicEvent(
  db: Database, id: string, leaseToken: string, published: boolean, now = new Date(),
) {
  return db.$transaction(async tx => {
    const event = await tx.economicOutbox.findUniqueOrThrow({ where: { id } });
    return tx.economicOutbox.updateMany({
      where: { id, state: 'CLAIMED', leaseToken, leaseUntil: { gt: now } },
      data: published
        ? { state: 'PUBLISHED', publishedAt: now, leaseToken: null, leaseUntil: null }
        : { state: event.attempts >= MAX_OUTBOX_ATTEMPTS ? 'DEAD' : 'PENDING',
          availableAt: new Date(now.getTime() + Math.min(60_000, 1000 * 2 ** event.attempts)),
          leaseToken: null, leaseUntil: null },
    });
  });
}

/** Last-attempt worker death must not leave an unclaimable row forever. */
export async function quarantineExhaustedEvents(db: Database, now = new Date()) {
  return db.economicOutbox.updateMany({
    where: { state: 'CLAIMED', attempts: { gte: MAX_OUTBOX_ATTEMPTS }, leaseUntil: { lte: now } },
    data: { state: 'DEAD', leaseToken: null, leaseUntil: null },
  });
}

/**
 * Receipt + DB-only effects commit/rollback together. No HTTP/email/provider calls
 * inside effect: external effects require another durable operation/outbox.
 * Queue delivery is at-least-once; only these transactional effects are deduped.
 */
export async function consumeEconomicEvent(
  db: Database, eventId: string, consumer: string,
  expected: { provenance: EconomicProvenance; eventType: EventInput['eventType'] },
  effect: (tx: Prisma.TransactionClient, event: EconomicOutbox) => Promise<void>,
): Promise<boolean> {
  requireText(consumer, 80);
  return db.$transaction(async tx => {
    const event = await tx.economicOutbox.findUniqueOrThrow({
      where: { id: eventId }, include: { context: true },
    });
    if (event.context.policyVersion !== ECONOMIC_POLICY_VERSION
      || event.context.provenance !== expected.provenance || event.eventType !== expected.eventType) {
      throw new Error('Unsupported event policy, provenance or type');
    }
    const receipt = await tx.economicConsumerReceipt.createMany({
      data: [{ eventId, consumer }], skipDuplicates: true,
    });
    if (!receipt.count) return false;
    await effect(tx, event);
    return true;
  });
}
