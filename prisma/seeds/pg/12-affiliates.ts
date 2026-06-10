import { PrismaClient } from '@prisma/client';

export async function seedAffiliates(prisma: PrismaClient) {
  console.log('  🤝 Seeding affiliate settings...');

  await prisma.affiliateSettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: {
      id:               'singleton',
      defaultRate:      0.10,
      buyerDiscountRate: 0.05,
      cookieDays:       30,
      minPayoutAmount:  50.00,
      lockDays:         14,
      isEnabled:        true,
    },
  });

  await prisma.affiliateAccount.upsert({
    where:  { email: 'affiliate@test.com' },
    update: {},
    create: {
      email:          'affiliate@test.com',
      firstName:      'Sarah',
      lastName:       'Demo',
      referralCode:   'SARAH2024',
      status:         'ACTIVE',
      commissionRate: null,
      balance:        0,
      totalEarned:    0,
    },
  });

  console.log('    ✓ AffiliateSettings + 1 test affiliate (Sarah Demo)');
}
