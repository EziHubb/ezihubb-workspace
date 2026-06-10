import { PrismaClient } from '@prisma/client';

export async function seedPromotions(prisma: PrismaClient) {
  console.log('  🏷️  Seeding promotions...');

  await prisma.promotion.upsert({
    where:  { code: 'WELCOME10' },
    update: {},
    create: {
      code:           'WELCOME10',
      type:           'PERCENTAGE',
      value:          10,
      maxUsesPerUser: 1,
      isActive:       true,
      description:    '10% off your first order',
    },
  });

  await prisma.promotion.upsert({
    where:  { code: 'FREESHIP50' },
    update: {},
    create: {
      code:           'FREESHIP50',
      type:           'FREE_SHIPPING',
      value:          0,
      minOrderAmount: 50,
      maxUsesPerUser: 3,
      isActive:       true,
      description:    'Free shipping on orders over $50',
    },
  });

  console.log('    ✓ 2 promotions (WELCOME10, FREESHIP50)');
}
