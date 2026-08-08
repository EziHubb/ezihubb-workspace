/**
 * Database seed — orchestrator.
 *
 * Delegates to:
 *   prisma/seeds/pg/index.ts   — all PostgreSQL models (13 seed files)
 *   prisma/seeds/mongo/index.ts — all MongoDB collections
 *
 * Run:  pnpm db:seed
 * Reset: pnpm db:fresh  (drop → migrate → seed)
 */

import { prisma, pool } from './seeds/shared/prisma-client';
import { runPgSeeds }    from './seeds/pg/index';
import { runMongoSeeds } from './seeds/mongo/index';

async function main() {
  console.log('🌱 Seeding database...\n');

  console.log('📦 [1/2] Seeding PostgreSQL...');
  const productIds = await runPgSeeds();

  console.log('\n🍃 [2/2] Seeding MongoDB...');
  const mongoOk = await runMongoSeeds(productIds);
  if (!mongoOk) {
    console.warn('  ⚠  MongoDB skipped (connection failed — run db:seed:mongo separately)');
  }

  // Summary
  const [users, categories, collections, products, promotions, zones, orders, reviews, giftCards, wishlistItems, qanda] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.collection.count(),
    prisma.product.count(),
    prisma.promotion.count(),
    prisma.shippingZone.count(),
    prisma.order.count(),
    prisma.review.count(),
    prisma.giftCard.count(),
    prisma.wishlistItem.count(),
    prisma.productQuestion.count(),
  ]);
  console.log('\n📊 Summary:');
  console.log(`  Users:            ${users}`);
  console.log(`  Categories:       ${categories}`);
  console.log(`  Collections:      ${collections}`);
  console.log(`  Products:         ${products}`);
  console.log(`  Orders:           ${orders}`);
  console.log(`  Reviews:          ${reviews}`);
  console.log(`  Gift Cards:       ${giftCards}`);
  console.log(`  Wishlist Items:   ${wishlistItems}`);
  console.log(`  Product Q&A:      ${qanda}`);
  console.log(`  Promotions:       ${promotions}`);
  console.log(`  Shipping zones:   ${zones}`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
