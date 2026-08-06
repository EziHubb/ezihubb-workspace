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
import { seedStores }             from './14-stores';
import { seedOrders }             from './16-orders';
import { seedReviews }            from './17-reviews';
import { seedGiftCards }          from './18-gift-cards';
import { seedWishlists, seedProductQandA } from './20-wishlists-qanda';
import { seedAddresses }          from './21-addresses';

export async function runPgSeeds(): Promise<Record<string, string>> {
  const { admin } = await seedUsers(prisma);
  await seedCategories(prisma);
  const collectionIds = await seedCollections(prisma);

  // Profiles + sections must exist before products reference them
  await seedProcessingProfiles(prisma);
  await seedShippingProfiles(prisma);
  await seedShopSections(prisma);

  // Store must exist before products get storeId assigned
  const { storeId } = await seedStores(prisma, admin.id);

  const productIds = await seedProducts(prisma, storeId);
  await seedCollectionLinks(prisma, collectionIds, productIds);
  await seedPromotions(prisma);
  await seedShippingZones(prisma);
  await seedAttributeValues(prisma);
  await seedAffiliates(prisma);

  // Addresses must exist before orders (for display)
  await seedAddresses(prisma);

  // Orders + conversations depend on users + products
  await seedOrders(prisma, storeId);
  await seedConversations(prisma);

  // Reviews depend on orders
  await seedReviews(prisma, storeId);

  // Gift cards, wishlists, Q&A
  await seedGiftCards(prisma);
  await seedWishlists(prisma);
  await seedProductQandA(prisma);

  return productIds;
}

// Allow running standalone: tsx prisma/seeds/pg/index.ts
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runPgSeeds()
    .then(() => { console.log('\n✅ PG seed complete'); })
    .catch(e  => { console.error('❌ PG seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect().then(() => pool.end()));
}
