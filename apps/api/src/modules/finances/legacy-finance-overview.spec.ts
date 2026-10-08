import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancesService } from './finances.service';
import { legacyLedgerWhere } from './finance-reporting-scope';

describe('legacy finance overview isolation', () => {
  it('keeps positive historical balances readable without advertising withdrawable funds', async () => {
    const prisma = {
      sellerLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('9999.99') } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      store: { findUnique: jest.fn().mockResolvedValue({ currency: 'USD', billingCards: [], bankAccount: null, autoBillingEnabled: false }) },
    };
    const service = new FinancesService(
      prisma as unknown as PrismaService,
      {} as EncryptionService,
      new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_local_fixture_not_real' }),
    );

    expect(await service.getOverview('store-fixture')).toMatchObject({
      current: 9999.99,
      total: 9999.99,
      financialClassification: 'LEGACY_UNKNOWN',
      requiresReconciliation: true,
      includedInAvailable: false,
      hasFundsReadyForDeposit: false,
    });
    expect(prisma.sellerLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: legacyLedgerWhere({ storeId: 'store-fixture', payoutId: null }),
      _sum: { amount: true },
    });
  });
});
