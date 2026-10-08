import { PrismaClient } from '@prisma/client';
import { executeExternalEffect, externalEffectHash } from './economic-external-effect';

function harness() {
  const row = { id: 'effect', contextId: 'ctx', context: { provenance: 'LIVE' }, kind: 'POD_PRINTIFY',
    providerAccount: '123', payload: { version: 'pod-v1' }, payloadHash: externalEffectHash({ version: 'pod-v1' }),
    state: 'PREPARED', providerReference: null as string | null, evidenceHash: null as string | null };
  const table = { findUniqueOrThrow: jest.fn(async () => ({ ...row })), updateMany: jest.fn(async ({ where, data }) => {
    if (typeof where.state === 'string' ? row.state !== where.state : !where.state.in.includes(row.state)) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  }) };
  const tx = { economicExternalEffect: table, $queryRaw: jest.fn() };
  const db = { economicExternalEffect: table, $transaction: jest.fn(async work => work(tx)) } as unknown as PrismaClient;
  const adapter = { kind: 'POD_PRINTIFY', providerAccount: '123', provenance: 'LIVE' as const,
    create: jest.fn(async () => 'original-order'), verify: jest.fn(async () => 'a'.repeat(64)) };
  const authorize = jest.fn(async () => undefined);
  return { row, table, db, adapter, authorize };
}
describe('durable external effects: no ambiguous redispatch', () => {
  it('commits a claim before one POST and independently verifies original evidence', async () => {
    const h = harness(); h.adapter.create.mockImplementation(async () => {
      expect(h.row.state).toBe('DISPATCHED'); expect(h.authorize).toHaveBeenCalledTimes(1); return 'original-order';
    });
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).resolves.toMatchObject({ state: 'SUCCEEDED' });
    expect(h.adapter.verify).toHaveBeenCalledWith(expect.objectContaining({ payloadHash: h.row.payloadHash }), 'original-order');
    await executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize);
    expect(h.adapter.create).toHaveBeenCalledTimes(1); expect(h.adapter.verify).toHaveBeenCalledTimes(1);
  });
  it('holds a timeout, then recovers by independent GET without another POST', async () => {
    const h = harness(); h.adapter.create.mockRejectedValue(new Error('Timeout after possible acceptance'));
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).rejects.toThrow('Timeout');
    expect(h.row.state).toBe('NEEDS_RECONCILIATION');
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).rejects.toThrow('unknown');
    await executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize, 'original-order');
    expect(h.adapter.create).toHaveBeenCalledTimes(1); expect(h.adapter.verify).toHaveBeenCalledTimes(1);
  });
  it('never turns an unverified lookup hint into successful evidence', async () => {
    const h = harness(); h.row.state = 'NEEDS_RECONCILIATION'; h.adapter.verify.mockRejectedValue(new Error('Foreign original items'));
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize, 'foreign')).rejects.toThrow('Foreign');
    expect(h.row.providerReference).toBeNull(); expect(h.row.state).toBe('NEEDS_RECONCILIATION'); expect(h.adapter.create).not.toHaveBeenCalled();
  });
  it('a lost claim cannot POST', async () => {
    const h = harness(); h.table.updateMany.mockImplementationOnce(async () => { h.row.state = 'DISPATCHED'; return { count: 0 }; });
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).rejects.toThrow('unknown');
    expect(h.adapter.create).not.toHaveBeenCalled();
  });
  it('rejects foreign mode, altered payload, bound reference changes and undispatched recovery', async () => {
    const h = harness();
    await expect(executeExternalEffect(h.db, 'effect', 'TEST', h.adapter, h.authorize)).rejects.toThrow('scope');
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize, 'hint')).rejects.toThrow('undispatched');
    h.row.payloadHash = 'b'.repeat(64);
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).rejects.toThrow('payload');
    h.row.payloadHash = externalEffectHash(h.row.payload); h.row.providerReference = 'original-order'; h.row.state = 'SUCCEEDED';
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize, 'foreign')).rejects.toThrow('bound');
    expect(h.adapter.create).not.toHaveBeenCalled();
  });
  it('authorization failure leaves intent undispatched', async () => {
    const h = harness(); h.authorize.mockRejectedValue(new Error('Cancelled or held'));
    await expect(executeExternalEffect(h.db, 'effect', 'LIVE', h.adapter, h.authorize)).rejects.toThrow('held');
    expect(h.row.state).toBe('PREPARED'); expect(h.adapter.create).not.toHaveBeenCalled();
  });
});
