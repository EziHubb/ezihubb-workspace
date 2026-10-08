import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EconomicDispatcherService } from './economic-dispatcher.service';
import { claimEconomicEvent, finishEconomicEvent, quarantineExpiredOperations } from './economic-durability';
import { consumeVerifiedEconomics } from './economic-consumers';
import { releaseEconomicInventory } from '../products/inventory-reservation';
import { consumeEconomicNotifications } from './economic-notifications';

jest.mock('./economic-durability', () => ({ claimEconomicEvent: jest.fn(), finishEconomicEvent: jest.fn(),
  quarantineExpiredOperations: jest.fn(), quarantineExhaustedEvents: jest.fn() }));
jest.mock('./economic-consumers', () => ({ consumeVerifiedEconomics: jest.fn() }));
jest.mock('./economic-notifications', () => ({ consumeEconomicNotifications: jest.fn() }));
jest.mock('../products/inventory-reservation', () => ({ releaseEconomicInventory: jest.fn() }));
describe('default-off mode-fenced economic dispatcher', () => {
  const previousEnabled = process.env['ECONOMIC_V1_ENABLED'], previousMode = process.env['ECONOMIC_V1_MODE'];
  beforeEach(() => { jest.clearAllMocks(); process.env['ECONOMIC_V1_ENABLED'] = 'true'; process.env['ECONOMIC_V1_MODE'] = 'TEST'; });
  afterEach(() => {
    if (previousEnabled === undefined) delete process.env['ECONOMIC_V1_ENABLED']; else process.env['ECONOMIC_V1_ENABLED'] = previousEnabled;
    if (previousMode === undefined) delete process.env['ECONOMIC_V1_MODE']; else process.env['ECONOMIC_V1_MODE'] = previousMode;
  });
  function fixture(enabled = 'true') {
    const prisma = { economicInventoryReservation: { findMany: jest.fn().mockResolvedValue([{ contextId: 'expired' }]) },
      economicOutbox: { findMany: jest.fn().mockResolvedValue([]) },
      economicOrderContext: { findUniqueOrThrow: jest.fn().mockResolvedValue({ provenance: 'TEST' }) } };
    return { prisma, service: new EconomicDispatcherService(prisma as unknown as PrismaService, new ConfigService({ ECONOMIC_CONSUMERS_ENABLED: enabled })) };
  }
  it('does no work unless both activation gates are enabled', async () => {
    const h = fixture('false'); await h.service.tick();
    expect(quarantineExpiredOperations).not.toHaveBeenCalled();
    process.env['ECONOMIC_V1_ENABLED'] = 'false';
    await fixture().service.tick(); expect(claimEconomicEvent).not.toHaveBeenCalled();
  });
  it('releases only original mode reservations and acknowledges after successful DB consumption', async () => {
    const h = fixture();
    jest.mocked(claimEconomicEvent).mockResolvedValueOnce({ id: 'event', contextId: 'ctx', leaseToken: 'lease' } as never).mockResolvedValueOnce(null);
    await h.service.tick();
    expect(quarantineExpiredOperations).toHaveBeenCalledWith(h.prisma, expect.any(Date), 'TEST');
    expect(h.prisma.economicInventoryReservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ context: { provenance: 'TEST' } }) }));
    expect(releaseEconomicInventory).toHaveBeenCalledWith(h.prisma, 'expired', 'EXPIRED');
    expect(consumeVerifiedEconomics).toHaveBeenCalledWith(h.prisma, expect.objectContaining({ id: 'event' }), 'TEST');
    expect(finishEconomicEvent).toHaveBeenCalledWith(h.prisma, 'event', 'lease', true);
  });
  it('failed consumption releases the fenced lease for bounded retry instead of publishing', async () => {
    const h = fixture();
    jest.mocked(claimEconomicEvent).mockResolvedValueOnce({ id: 'event', contextId: 'ctx', leaseToken: 'lease' } as never).mockResolvedValueOnce(null);
    jest.mocked(consumeVerifiedEconomics).mockRejectedValueOnce(new Error('Unavailable stock'));
    await h.service.tick();
    expect(finishEconomicEvent).toHaveBeenCalledWith(h.prisma, 'event', 'lease', false);
  });
  it('recovers a published notification projection only after original lifecycle proof, in the same mode', async () => {
    const h = fixture(); h.prisma.economicOutbox.findMany.mockResolvedValue([{ id: 'published', state: 'PUBLISHED' }] as never);
    jest.mocked(claimEconomicEvent).mockResolvedValue(null);
    await h.service.tick();
    expect(h.prisma.economicOutbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      context: { provenance: 'TEST' }, AND: [{ receipts: { some: { consumer: 'lifecycle.v1' } } }, { receipts: { none: { consumer: 'notifications.v1' } } }],
    }) }));
    expect(consumeEconomicNotifications).toHaveBeenCalledWith(h.prisma, expect.objectContaining({ id: 'published' }), 'TEST', expect.stringMatching(/^[a-f0-9]{64}$/));
  });
});
