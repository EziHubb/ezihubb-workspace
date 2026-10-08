import { createHash, randomBytes } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { EconomicExternalEffect, EconomicProvenance, Prisma, PrismaClient } from '@prisma/client';
import { canonicalEconomicJson } from './economic-quote';
import { economicTransaction } from './economic-balance';

export function externalEffectHash(value: unknown) { return createHash('sha256').update(canonicalEconomicJson(value)).digest('hex'); }
type Database = Pick<PrismaClient, '$transaction' | 'economicExternalEffect'>;
export type ExternalEffectAdapter = {
  kind: string; providerAccount: string; provenance: EconomicProvenance;
  /** Must make at most one irreversible POST. No internal network retries. */
  create(effect: EconomicExternalEffect): Promise<string>;
  /** Independent original resource read; reference is only an untrusted hint. */
  verify(effect: EconomicExternalEffect, reference: string): Promise<string>;
};

/** Scoped, frozen dispatch. DB-only claim commits BEFORE external I/O. A
 * timeout/crash stays consumed; recovery cannot send another POST. */
export async function executeExternalEffect(db: Database, id: string, provenance: EconomicProvenance,
  adapter: ExternalEffectAdapter, authorize: (tx: Prisma.TransactionClient, effect: EconomicExternalEffect) => Promise<void>,
  recoveryReference?: string) {
  const effect = await db.economicExternalEffect.findUniqueOrThrow({ where: { id }, include: { context: true } });
  if (effect.context.provenance !== provenance || adapter.provenance !== provenance || adapter.kind !== effect.kind
    || adapter.providerAccount !== effect.providerAccount || effect.payloadHash !== externalEffectHash(effect.payload)) {
    throw new ConflictException('External intent scope or frozen payload mismatch');
  }
  if (recoveryReference && !/^[A-Za-z0-9_-]{1,150}$/.test(recoveryReference)) throw new ConflictException('Invalid original resource reference');
  if (effect.providerReference && recoveryReference && effect.providerReference !== recoveryReference) throw new ConflictException('External lookup is already bound');
  if (effect.state === 'SUCCEEDED') return { id, state: effect.state, providerReference: effect.providerReference };
  if (effect.state === 'PREPARED' && recoveryReference) throw new ConflictException('An undispatched effect cannot be recovered');
  let token: string | null = null;
  if (effect.state === 'PREPARED') {
    token = await economicTransaction(db, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "EconomicExternalEffect" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.economicExternalEffect.findUniqueOrThrow({ where: { id } });
      if (current.state !== 'PREPARED') return null;
      await authorize(tx, current);
      const claim = randomBytes(24).toString('hex');
      const changed = await tx.economicExternalEffect.updateMany({ where: { id, state: 'PREPARED', payloadHash: effect.payloadHash },
        data: { state: 'DISPATCHED', dispatchToken: claim, dispatchedAt: new Date() } });
      return changed.count === 1 ? claim : null;
    });
  }
  try {
    const current = await db.economicExternalEffect.findUniqueOrThrow({ where: { id } });
    if (current.state === 'SUCCEEDED') return { id, state: current.state, providerReference: current.providerReference };
    const reference = token ? await adapter.create(effect) : current.providerReference ?? recoveryReference;
    if (!reference) throw new ConflictException('External outcome unknown. Look up the original resource; never redispatch');
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(reference)) throw new ConflictException('Invalid provider resource identity');
    const evidenceHash = await adapter.verify(effect, reference);
    if (!/^[a-f0-9]{64}$/.test(evidenceHash)) throw new ConflictException('Independent original evidence required');
    return economicTransaction(db, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "EconomicExternalEffect" WHERE "id" = ${id} FOR UPDATE`;
      const latest = await tx.economicExternalEffect.findUniqueOrThrow({ where: { id } });
      if (latest.state === 'SUCCEEDED') {
        if (latest.providerReference !== reference || latest.evidenceHash !== evidenceHash) throw new ConflictException('External evidence changed');
        return { id, state: latest.state, providerReference: reference };
      }
      const changed = await tx.economicExternalEffect.updateMany({ where: { id, state: { in: ['DISPATCHED','NEEDS_RECONCILIATION'] },
        OR: [{ providerReference: null }, { providerReference: reference }] },
        data: { state: 'SUCCEEDED', providerReference: reference, evidenceHash, completedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('External state changed; reload original evidence');
      return { id, state: 'SUCCEEDED' as const, providerReference: reference };
    });
  } catch (error) {
    await db.economicExternalEffect.updateMany({ where: { id, state: 'DISPATCHED', ...(token ? { dispatchToken: token } : {}) },
      data: { state: 'NEEDS_RECONCILIATION' } });
    throw error;
  }
}
