import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { applyVerifiedEconomicLifecycle } from './economic-consumers';
import { EconomicRecoveryService } from './economic-recovery.service';

jest.mock('./economic-consumers', () => ({ applyVerifiedEconomicLifecycle: jest.fn() }));
function fixture() {
  const event = { id: 'event', state: 'DEAD', eventType: 'capture.verified.v1', contextId: 'context',
    context: { provenance: 'TEST', currency: 'USD', policyVersion: '2026-10-03.v1' }, lifecycleRecovery: null as null | { id: string; applied: boolean } };
  const receipt = { count: 1 };
  const tx = { $queryRaw: jest.fn(), economicOutbox: { findUnique: jest.fn(async () => event) },
    economicConsumerReceipt: { createMany: jest.fn(async () => receipt) },
    economicLifecycleRecovery: { create: jest.fn(async input => ({ id: 'audit', ...input.data })) } };
  const prisma = { $transaction: jest.fn(async work => work(tx)) };
  const config = { get: jest.fn(() => 'true') };
  return { event, receipt, tx, prisma, config, service: new EconomicRecoveryService(prisma as unknown as PrismaService, config as unknown as ConfigService) };
}
describe('audited DB-only recovery for terminal outbox events', () => {
  const oldEnabled = process.env['ECONOMIC_V1_ENABLED'], oldMode = process.env['ECONOMIC_V1_MODE'];
  beforeEach(() => { jest.clearAllMocks(); process.env['ECONOMIC_V1_ENABLED'] = 'true'; process.env['ECONOMIC_V1_MODE'] = 'TEST'; });
  afterAll(() => {
    if (oldEnabled === undefined) delete process.env['ECONOMIC_V1_ENABLED']; else process.env['ECONOMIC_V1_ENABLED'] = oldEnabled;
    if (oldMode === undefined) delete process.env['ECONOMIC_V1_MODE']; else process.env['ECONOMIC_V1_MODE'] = oldMode;
  });
  it('records receipt, original effects and audit in the same serializable transaction without resetting DEAD', async () => {
    const h = fixture();
    expect(await h.service.recover('event', 'operator', 'TEST', 'Original stock restored')).toEqual({ id: 'audit', applied: true, alreadyRecovered: false });
    expect(applyVerifiedEconomicLifecycle).toHaveBeenCalledWith(h.tx, h.event, 'TEST');
    expect(h.tx.economicLifecycleRecovery.create).toHaveBeenCalledWith({ data: { eventId: 'event', actorId: 'operator', reason: 'Original stock restored', applied: true } });
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(h.event.state).toBe('DEAD');
  });
  it('acknowledges an already applied receipt without consuming inventory or changing money twice', async () => {
    const h = fixture(); h.receipt.count = 0;
    expect(await h.service.recover('event', 'operator', 'TEST', 'Confirm original receipt')).toMatchObject({ applied: false });
    expect(applyVerifiedEconomicLifecycle).not.toHaveBeenCalled();
  });
  it('is idempotent after successful recovery and does not overwrite original audit identity', async () => {
    const h = fixture(); h.event.lifecycleRecovery = { id: 'original-audit', applied: true };
    expect(await h.service.recover('event', 'different-operator', 'TEST', 'Another attempt')).toEqual({ id: 'original-audit', applied: true, alreadyRecovered: true });
    expect(h.tx.economicConsumerReceipt.createMany).not.toHaveBeenCalled(); expect(h.tx.economicLifecycleRecovery.create).not.toHaveBeenCalled();
  });
  it('propagates failed reacquisition so DB receipt and audit roll back', async () => {
    const h = fixture(); jest.mocked(applyVerifiedEconomicLifecycle).mockRejectedValueOnce(new Error('Original pool unavailable'));
    await expect(h.service.recover('event', 'operator', 'TEST', 'Restore stock')).rejects.toThrow('pool unavailable');
    expect(h.tx.economicLifecycleRecovery.create).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'CLAIMED', 'PUBLISHED'])('does not recover a nonterminal %s event', async state => {
    const h = fixture(); h.event.state = state;
    await expect(h.service.recover('event', 'operator', 'TEST', 'Audit')).rejects.toThrow('Only a terminal');
    expect(h.tx.economicConsumerReceipt.createMany).not.toHaveBeenCalled();
  });
  it('enforces disabled flags, configured mode, original mode and supported event type', async () => {
    const h = fixture();
    process.env['ECONOMIC_V1_ENABLED'] = 'false';
    await expect(h.service.recover('event', 'operator', 'TEST', 'Audit')).rejects.toThrow('not enabled');
    process.env['ECONOMIC_V1_ENABLED'] = 'true';
    await expect(h.service.recover('event', 'operator', 'LIVE', 'Audit')).rejects.toThrow('not enabled');
    h.event.context.provenance = 'LIVE';
    await expect(h.service.recover('event', 'operator', 'TEST', 'Audit')).rejects.toThrow('not found');
    h.event.context.provenance = 'TEST'; h.event.eventType = 'legacy.paid';
    await expect(h.service.recover('event', 'operator', 'TEST', 'Audit')).rejects.toThrow('Unsupported');
    expect(h.tx.economicConsumerReceipt.createMany).not.toHaveBeenCalled();
  });
});
