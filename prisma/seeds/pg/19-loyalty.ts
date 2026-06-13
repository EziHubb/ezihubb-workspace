import { PrismaClient } from '@prisma/client';

export async function seedLoyalty(prisma: PrismaClient): Promise<void> {
  console.log('  💎 Seeding loyalty accounts & transactions...');

  // Points ratio: earn 10pts per $1 spent, redeem 100pts = $1
  const accountDefs = [
    { email: 'alice@test.com',  pointsBalance: 850,  pointsPending: 270,  pointsLifetime: 1120 },
    { email: 'bob@test.com',    pointsBalance: 1200, pointsPending: 450,  pointsLifetime: 1650 },
    { email: 'carol@test.com',  pointsBalance: 320,  pointsPending: 0,    pointsLifetime: 820  },
    { email: 'dave@test.com',   pointsBalance: 2500, pointsPending: 0,    pointsLifetime: 3100 },
    { email: 'emma@test.com',   pointsBalance: 670,  pointsPending: 120,  pointsLifetime: 790  },
    { email: 'frank@test.com',  pointsBalance: 150,  pointsPending: 490,  pointsLifetime: 640  },
    { email: 'grace@test.com',  pointsBalance: 430,  pointsPending: 0,    pointsLifetime: 430  },
    { email: 'hannah@test.com', pointsBalance: 990,  pointsPending: 100,  pointsLifetime: 1090 },
  ];

  for (const def of accountDefs) {
    const user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) { console.warn(`    ⚠  User ${def.email} not found`); continue; }

    const account = await prisma.loyaltyAccount.upsert({
      where:  { userId: user.id },
      update: {},
      create: {
        userId:        user.id,
        pointsBalance: def.pointsBalance,
        pointsPending: def.pointsPending,
        pointsLifetime: def.pointsLifetime,
      },
    });

    // Historical earning transaction
    const historicalPoints = def.pointsLifetime - def.pointsPending - def.pointsBalance;
    if (historicalPoints > 0) {
      await prisma.loyaltyTransaction.create({
        data: {
          accountId:   account.id,
          type:        'EARN',
          points:      historicalPoints,
          description: 'Earned from past orders (historical)',
          confirmedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          createdAt:   new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Pending earn transaction
    if (def.pointsPending > 0) {
      await prisma.loyaltyTransaction.create({
        data: {
          accountId:   account.id,
          type:        'EARN',
          points:      def.pointsPending,
          description: 'Earned from recent order — pending 14-day confirmation',
          confirmedAt: null,
          createdAt:   new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Current balance transaction (consolidated)
    if (def.pointsBalance > 0) {
      await prisma.loyaltyTransaction.create({
        data: {
          accountId:   account.id,
          type:        'EARN',
          points:      def.pointsBalance,
          description: 'Confirmed balance',
          confirmedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          createdAt:   new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
      });
    }

    console.log(`    ✓ Loyalty: ${def.email} — ${def.pointsBalance}pts balance, ${def.pointsPending}pts pending`);
  }
}
