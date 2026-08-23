/**
 * Database seed — the reference data a freshly-migrated database needs to
 * function, and nothing else.
 *
 * There used to be a second, larger seed (`prisma/seed.ts` → `seeds/pg/`)
 * holding a full demo dataset: fake products, orders, reviews, eight test
 * customers with passwords written into the source, seven gift cards worth
 * $617.50, and five live discount codes. In a public repository that is a set
 * of working credentials and redeemable codes published alongside the code,
 * one mistyped DATABASE_URL away from a real database. It had also been broken
 * since the shipping schema changed under it, so nothing was lost by removing
 * it — `db:seed` now runs this file instead.
 *
 * What stays: the admin account, its default "EziHubb" store + platform
 * settings (the admin owns this store like any other seller, and Partner API
 * keys are store-scoped), the catalog category tree, the occasion collection
 * shells, and the Mongo mega-menu derived from those categories.
 *
 * Run:  pnpm db:seed   (or pnpm db:seed:baseline)
 */

import { prisma, pool } from './seeds/shared/prisma-client';
import { seedAdminUser }    from './seeds/pg/01-users';
import { seedCategories }   from './seeds/pg/02-categories';
import { seedCollections }  from './seeds/pg/03-collections';
import { seedStores }       from './seeds/pg/04-stores';
import { seedTranslations } from './seeds/pg/05-translations';
import { runMongoSeeds }    from './seeds/mongo/index';

async function main() {
  console.log('🌱 Seeding baseline data...\n');

  console.log('📦 [1/2] Seeding PostgreSQL...');
  const { admin } = await seedAdminUser(prisma);
  await seedCategories(prisma);
  await seedCollections(prisma);
  await seedStores(prisma, admin.id);

  // After categories and collections exist — it resolves them by slug. The
  // mega-menu below is built from the English tree and translated per-request,
  // so it does not need to run after this.
  await seedTranslations(prisma);

  // Non-fatal: the mega-menu is derived data and Postgres is already correct
  // without it. A missing Mongo should not fail a run that has done its main
  // job — `pnpm db:seed:mongo` catches it up.
  console.log('\n🍃 [2/2] Seeding MongoDB...');
  const mongoOk = await runMongoSeeds();
  if (!mongoOk) {
    console.warn('  ⚠  MongoDB skipped (connection failed — run db:seed:mongo separately)');
  }

  const [users, categories, collections, stores] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.collection.count(),
    prisma.store.count(),
  ]);
  console.log('\n📊 Summary:');
  console.log(`  Users:       ${users}`);
  console.log(`  Categories:  ${categories}`);
  console.log(`  Collections: ${collections}`);
  console.log(`  Stores:      ${stores}`);

  console.log('\n✅ Baseline seed complete!');
}

main()
  .catch(e => { console.error('❌ Baseline seed failed:', e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
