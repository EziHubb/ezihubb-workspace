import mongoose from 'mongoose';

async function dropMongo() {
  const mongoUrl = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  await mongoose.connect(mongoUrl, { dbName: 'mapleloomhandmade', serverSelectionTimeoutMS: 3000 });
  console.log('🗑️  Dropping MongoDB collections...');

  const collections = await mongoose.connection.db!.collections();
  for (const col of collections) {
    await col.drop().catch(() => {});
    console.log(`  ✓ Dropped: ${col.collectionName}`);
  }

  await mongoose.disconnect();
  console.log('✅ MongoDB cleared');
}

dropMongo().catch(e => { console.error('❌ Drop failed:', e); process.exit(1); });
