import { PrismaClient } from '@prisma/client';

export async function seedPromotions(prisma: PrismaClient) {
  console.log('  🏷️  Seeding promotions...');

  const promos = [
    {
      code:           'WELCOME10',
      type:           'PERCENTAGE' as const,
      value:          10,
      maxUsesPerUser: 1,
      isActive:       true,
      description:    '10% off your first order',
    },
    {
      code:           'FREESHIP50',
      type:           'FREE_SHIPPING' as const,
      value:          0,
      minOrderAmount: 50,
      maxUsesPerUser: 3,
      isActive:       true,
      description:    'Free shipping on orders over $50',
    },
    {
      code:           'DAISY15',
      type:           'PERCENTAGE' as const,
      value:          15,
      minOrderAmount: 75,
      maxUsesPerUser: 2,
      maxUses:        500,
      isActive:       true,
      description:    '15% off orders over $75 — EziHubb members only',
    },
    {
      code:           'SAVE20NOW',
      type:           'PERCENTAGE' as const,
      value:          20,
      minOrderAmount: 100,
      maxUsesPerUser: 1,
      maxUses:        200,
      isActive:       true,
      description:    '20% off orders over $100',
      expiresAt:      new Date(new Date().setMonth(new Date().getMonth() + 3)),
    },
    {
      code:           'FLAT5OFF',
      type:           'FIXED_AMOUNT' as const,
      value:          5,
      maxUsesPerUser: 5,
      isActive:       true,
      description:    '$5 off any order',
    },
    {
      code:           'HOLIDAY25',
      type:           'PERCENTAGE' as const,
      value:          25,
      minOrderAmount: 60,
      maxUsesPerUser: 1,
      maxUses:        1000,
      isActive:       false,
      description:    'Holiday sale — 25% off orders over $60 (seasonal)',
      startsAt:       new Date('2026-12-01'),
      expiresAt:      new Date('2026-12-31'),
    },
    {
      code:           'MOTHERDAY',
      type:           'PERCENTAGE' as const,
      value:          12,
      maxUsesPerUser: 1,
      maxUses:        300,
      isActive:       false,
      description:    "Mother's Day special — 12% off",
      startsAt:       new Date('2026-05-01'),
      expiresAt:      new Date('2026-05-12'),
    },
    {
      code:           'VIPFREE',
      type:           'FREE_SHIPPING' as const,
      value:          0,
      maxUsesPerUser: 10,
      isActive:       true,
      description:    'VIP members: free shipping on every order',
    },
  ];

  for (const promo of promos) {
    await prisma.promotion.upsert({
      where:  { code: promo.code },
      update: {},
      create: promo,
    });
  }

  console.log(`    ✓ ${promos.length} promotions seeded`);
}
