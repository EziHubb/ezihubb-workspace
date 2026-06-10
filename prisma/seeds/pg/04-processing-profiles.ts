import { PrismaClient } from '@prisma/client';

export async function seedProcessingProfiles(prisma: PrismaClient) {
  console.log('  ⚙️  Seeding processing profiles...');

  await prisma.processingProfile.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Made to order', type: 'MADE_TO_ORDER',  minDays: 6, maxDays: 10, isDefault: false },
      { name: 'Standard POD',  type: 'MADE_TO_ORDER',  minDays: 3, maxDays: 7,  isDefault: true  },
      { name: 'Ready to ship', type: 'READY_TO_SHIP',  minDays: 1, maxDays: 3,  isDefault: false },
    ],
  });

  console.log('    ✓ 3 processing profiles');
}
