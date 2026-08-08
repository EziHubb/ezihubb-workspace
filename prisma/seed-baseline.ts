/**
 * Baseline seed — production-safe subset.
 *
 * Unlike prisma/seed.ts (full demo dataset: fake products, orders, reviews,
 * test customers with published passwords), this only creates the reference
 * data a freshly-migrated database needs to function: the admin account,
 * catalog categories, and shipping zones.
 *
 * Run:  pnpm db:seed:baseline
 */

import { prisma, pool } from './seeds/shared/prisma-client';
import { seedAdminUser }    from './seeds/pg/01-users';
import { seedCategories }   from './seeds/pg/02-categories';
import { seedShippingZones } from './seeds/pg/10-shipping-zones';

async function main() {
  console.log('🌱 Seeding baseline (production-safe) data...\n');

  await seedAdminUser(prisma);
  await seedCategories(prisma);
  await seedShippingZones(prisma);

  console.log('\n✅ Baseline seed complete!');
}

main()
  .catch(e => { console.error('❌ Baseline seed failed:', e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
