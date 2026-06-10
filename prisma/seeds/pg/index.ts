import { prisma, pool } from '../shared/prisma-client';
import { seedUsers }              from './01-users';
import { seedCategories }         from './02-categories';
import { seedCollections }        from './03-collections';
import { seedProcessingProfiles } from './04-processing-profiles';
import { seedShippingProfiles }   from './05-shipping-profiles';
import { seedShopSections }       from './06-shop-sections';
import { seedProducts }           from './07-products';
import { seedCollectionLinks }    from './08-collection-links';
import { seedPromotions }         from './09-promotions';
import { seedShippingZones }      from './10-shipping-zones';
import { seedAttributeValues }    from './11-attribute-values';
import { seedAffiliates }         from './12-affiliates';
import { seedConversations }      from './13-conversations';

export async function runPgSeeds(): Promise<Record<string, string>> {
  await seedUsers(prisma);
  await seedCategories(prisma);
  const collectionIds = await seedCollections(prisma);

  // Profiles + sections must exist before products reference them
  await seedProcessingProfiles(prisma);
  await seedShippingProfiles(prisma);
  await seedShopSections(prisma);

  const productIds = await seedProducts(prisma);
  await seedCollectionLinks(prisma, collectionIds, productIds);
  await seedPromotions(prisma);
  await seedShippingZones(prisma);
  await seedAttributeValues(prisma);
  await seedAffiliates(prisma);
  await seedConversations(prisma);

  return productIds;
}

// Allow running standalone: tsx prisma/seeds/pg/index.ts
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runPgSeeds()
    .then(() => { console.log('\n✅ PG seed complete'); })
    .catch(e  => { console.error('❌ PG seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect().then(() => pool.end()));
}
