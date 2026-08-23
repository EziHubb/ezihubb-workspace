// No `dotenv/config` import here on purpose: dotenv is not a declared
// dependency of this workspace — it only resolves by accident, out of pnpm's
// hoisted directory, as a transitive of something else. That works locally and
// is exactly the kind of thing `pnpm prune --prod` removes from the migrate
// image, where this seed has to run after a production reset. `.env` is loaded
// by ../shared/prisma-client below, and docker-compose injects it directly.
import dns from 'dns';
import mongoose from 'mongoose';
import { prisma, pool } from '../shared/prisma-client';

// Force Node.js c-ares to use real DNS servers instead of local proxy (127.0.0.1)
// which blocks SRV record queries needed by mongodb+srv:// connection strings.
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { seedCategoriesMegaMenu } from './01-categories-mega-menu';

async function connectMongo(retries = 3, delayMs = 2000): Promise<boolean> {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(`\n🍃 Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(uri, { dbName: 'ezihubb', serverSelectionTimeoutMS: 3000 });
      console.log('  ✅ MongoDB connected');
      return true;
    } catch (err) {
      console.warn(`  ⚠  MongoDB attempt ${i + 1}/${retries} failed: ${(err as Error).message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

/**
 * Seeds only the mega-menu, which is derived from the PostgreSQL category tree.
 *
 * There was a second step here, `seedProductDetails`, holding hand-written
 * attributes and print specs for the seven demo products. It took the seeded
 * product ids as an argument, so once the demo product seed went it could only
 * ever write zero documents. `product_details` is written by the API now — see
 * apps/api/src/modules/catalog/schemas/product-detail.schema.ts, which is the
 * real model; the copy that lived beside this seed was only ever for seeding.
 */
export async function runMongoSeeds(): Promise<boolean> {
  const connected = await connectMongo();
  if (!connected) return false;

  await seedCategoriesMegaMenu(prisma);

  await mongoose.disconnect();
  console.log('  ✅ MongoDB disconnected');
  return true;
}

// Allow running standalone: tsx prisma/seeds/mongo/index.ts
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runMongoSeeds()
    .then(() => { console.log('\n✅ Mongo seed complete'); })
    .catch(e  => { console.error('❌ Mongo seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect().then(() => pool.end()));
}
