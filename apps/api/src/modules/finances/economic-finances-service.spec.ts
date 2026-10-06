import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EconomicFinancesService } from './economic-finances.service';

describe('economic finance display contracts', () => {
  it('reports the authoritative minimum and excludes legacy money even with no captured account', async () => {
    const tx = { affiliateSettings: { findUnique: jest.fn().mockResolvedValue({ minPayoutAmount: new Prisma.Decimal('75.25') }) },
      economicBalanceAccount: { findUnique: jest.fn().mockResolvedValue(null) } };
    const db = { $transaction: jest.fn(async work => work(tx)) };
    const config = { get: jest.fn().mockReturnValue('[]') };
    const service = new EconomicFinancesService(db as unknown as PrismaService, config as unknown as ConfigService);
    const base = { beneficiaryId: 'fixture', currency: 'USD', provenance: 'TEST' as const };
    const affiliate = await service.overview({ ...base, kind: 'AFFILIATE' });
    expect(affiliate).toMatchObject({ availableMinor: '0', minimumPayoutMinor: '7525', payoutRequestsEnabled: false,
      legacy: { classification: 'LEGACY_UNKNOWN', includedInAvailable: false } });
    expect(await service.overview({ ...base, kind: 'SELLER' })).toMatchObject({ minimumPayoutMinor: '1' });
    expect(tx.affiliateSettings.findUnique).toHaveBeenCalledTimes(1);
  });
  it('returns immutable verification actor/time and exact amounts without exposing recipient configuration', async () => {
    const started = new Date('2026-10-04T00:00:00Z');
    const tx = { economicPayout: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{
      id: 'payout', amountMinor: 9007199254740993n, state: 'VERIFYING', createdAt: started,
      verificationStartedAt: started, verificationStartedBy: 'operator', transferReference: 'tr_fixture',
      destination: 'private-recipient', processedAt: null, processedBy: null, rejectionReason: null,
      allocations: [{ lotId: 'lot', amountMinor: 9007199254740993n, lot: { captureId: 'capture', sourceKey: 'line' } }],
    }]) } };
    const db = { $transaction: jest.fn(async work => work(tx)) };
    const service = new EconomicFinancesService(db as unknown as PrismaService, new ConfigService());
    const result = await service.payouts({ kind: 'SELLER', beneficiaryId: 'store', currency: 'USD', provenance: 'TEST' }, { page: 1, limit: 20, currency: 'USD', provenance: 'TEST' });
    expect(result.data[0]).toMatchObject({ verificationStartedBy: 'operator', verificationStartedAt: started, amountMinor: '9007199254740993' });
    expect(JSON.stringify(result)).not.toContain('private-recipient');
    expect(result.data[0].allocations[0].amountMinor).toBe('9007199254740993');
  });
});
