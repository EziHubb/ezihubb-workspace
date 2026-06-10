import { PrismaClient } from '@prisma/client';

export async function seedShopSections(prisma: PrismaClient) {
  console.log('  🏪 Seeding shop sections...');

  await prisma.shopSection.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Mugs & Drinkware',  sortOrder: 0 },
      { name: 'Wall Art & Canvas', sortOrder: 1 },
      { name: 'Apparel',           sortOrder: 2 },
      { name: 'Home Decor',        sortOrder: 3 },
    ],
  });

  console.log('    ✓ 4 shop sections');
}
