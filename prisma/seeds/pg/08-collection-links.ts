import { PrismaClient } from '@prisma/client';

export async function seedCollectionLinks(
  prisma: PrismaClient,
  collectionIds: Record<string, string>,
  productIds: Record<string, string>,
) {
  console.log('  🔗 Seeding collection links...');

  const links: Record<string, string[]> = {
    'valentines-day': ['custom-name-photo-mug','custom-photo-pillow','personalized-canvas-print','couples-mug-set','personalized-wine-glass'],
    birthday:         ['custom-name-photo-mug','monogram-tumbler','custom-birth-stats-print','custom-name-keychain','custom-photo-phone-case'],
    anniversary:      ['personalized-canvas-print','family-name-sign','pet-portrait-canvas','anniversary-map-print','couples-mug-set'],
    'mothers-day':    ['custom-photo-pillow','personalized-canvas-print','personalized-tote-bag','custom-pet-portrait-pillow','personalized-cutting-board'],
    graduation:       ['custom-name-hoodie','monogram-tumbler','personalized-tote-bag','personalized-graduation-frame','custom-family-reunion-tshirt'],
    christmas:        ['custom-photo-ornament','family-name-sign','custom-name-photo-mug','custom-baby-onesie','personalized-cutting-board'],
    'new-baby':       ['custom-baby-onesie','custom-birth-stats-print'],
    wedding:          ['anniversary-map-print','personalized-wine-glass','personalized-cutting-board'],
    retirement:       ['personalized-graduation-frame','custom-name-hoodie','monogram-tumbler'],
    'fathers-day':    ['personalized-cutting-board','custom-name-hoodie','monogram-tumbler'],
  };

  let count = 0;
  for (const [colSlug, pSlugs] of Object.entries(links)) {
    const collectionId = collectionIds[colSlug];
    if (!collectionId) continue;
    for (let i = 0; i < pSlugs.length; i++) {
      const productId = productIds[pSlugs[i]];
      if (!productId) continue;
      await prisma.collectionProduct.upsert({
        where:  { collectionId_productId: { collectionId, productId } },
        update: {},
        create: { collectionId, productId, sortOrder: i },
      });
      count++;
    }
  }

  console.log(`    ✓ ${count} collection ↔ product links`);
}
