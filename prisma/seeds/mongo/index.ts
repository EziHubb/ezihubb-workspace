import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { prisma, pool } from '../shared/prisma-client';

// Force Node.js c-ares to use real DNS servers instead of local proxy (127.0.0.1)
// which blocks SRV record queries needed by mongodb+srv:// connection strings.
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { seedCategoriesMegaMenu } from './02-categories-mega-menu';
import { seedProductDetails }     from './01-product-details';

async function connectMongo(retries = 3, delayMs = 2000): Promise<boolean> {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(`\n🍃 Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(uri, { dbName: 'dailydaisy', serverSelectionTimeoutMS: 3000 });
      console.log('  ✅ MongoDB connected');
      return true;
    } catch (err) {
      console.warn(`  ⚠  MongoDB attempt ${i + 1}/${retries} failed: ${(err as Error).message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

export async function runMongoSeeds(productIds: Record<string, string>): Promise<boolean> {
  const connected = await connectMongo();
  if (!connected) return false;

  await seedCategoriesMegaMenu(prisma);
  await seedProductDetails(productIds);

  await mongoose.disconnect();
  console.log('  ✅ MongoDB disconnected');
  return true;
}

// Allow running standalone: tsx prisma/seeds/mongo/index.ts
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runMongoSeeds({})
    .then(() => { console.log('\n✅ Mongo seed complete'); })
    .catch(e  => { console.error('❌ Mongo seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect().then(() => pool.end()));
}
