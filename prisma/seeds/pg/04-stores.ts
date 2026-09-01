import { PrismaClient } from '@prisma/client';

export async function seedStores(prisma: PrismaClient, adminUserId: string): Promise<{ storeId: string }> {
  console.log('  🏪 Seeding stores & platform settings...');

  // ── PlatformSettings singleton (Etsy-style seller fees) ────────────────────
  await prisma.platformSettings.upsert({
    where:  { id: 'singleton' },
    update: { platformName: 'EziHubb' },
    create: {
      id:                        'singleton',
      transactionFeeRate:        0.065,
      paymentProcessingFeeRate:  0.05,
      paymentProcessingFixedFee: 0.25,
      listingFee:                0.20,
      regulatoryFeeRate:         0.0124,
      regulatoryFeeCountries:    [],
      platformName:              'EziHubb',
      allowPublicRegistration:   false,
      minPayoutAmount:           100.00,
      payoutSchedule:            'monthly',
      maintenanceMode:           false,
      freeShippingThreshold:     100.00,
    },
  });
  console.log('    ✓ PlatformSettings');

  // ── Default store: EziHubb (owned by super admin) ────────────────────
  const store = await prisma.store.upsert({
    where:  { slug: 'ezihubb' },
    update: {},
    create: {
      slug:         'ezihubb',
      name:         'EziHubb',
      description:  'The official EziHubb store — unique personalized gifts and handcrafted keepsakes for every occasion.',
      ownerId:      adminUserId,
      status:       'ACTIVE',
      verifiedAt:   new Date(),
      approvedById: adminUserId,
    },
  });
  console.log(`    ✓ Default store: ${store.name} (slug: ${store.slug})`);

  // ── Update admin user as seller ───────────────────────────────────────────
  await prisma.user.update({
    where: { id: adminUserId },
    data:  { isSeller: true, storeId: store.id },
  });
  console.log('    ✓ Admin user marked as seller');

  // ── Backfill existing products → EziHubb ────────────────────────────
  const { count: backfilledProducts } = await prisma.product.updateMany({
    where: { storeId: null },
    data:  { storeId: store.id },
  });
  console.log(`    ✓ Backfilled ${backfilledProducts} products → ${store.name}`);

  // ── Backfill existing categories → PLATFORM scope ────────────────────────
  const { count: backfilledCategories } = await prisma.category.updateMany({
    where: { scope: 'PLATFORM', storeId: null },
    data:  { scope: 'PLATFORM' },
  });
  console.log(`    ✓ Confirmed ${backfilledCategories} platform categories`);

  // ── Backfill existing ShopSections → EziHubb ────────────────────────
  const { count: backfilledSections } = await prisma.shopSection.updateMany({
    where: { storeId: null },
    data:  { storeId: store.id },
  });
  console.log(`    ✓ Backfilled ${backfilledSections} shop sections → ${store.name}`);

  // ── Backfill ShippingProfiles → EziHubb ─────────────────────────────
  const { count: backfilledProfiles } = await prisma.shippingProfile.updateMany({
    where: { storeId: null },
    data:  { storeId: store.id },
  });
  console.log(`    ✓ Backfilled ${backfilledProfiles} shipping profiles → ${store.name}`);

  // ── Update denormalized totalProducts on store ─────────────────────────────
  const productCount = await prisma.product.count({ where: { storeId: store.id } });
  await prisma.store.update({
    where: { id: store.id },
    data:  { totalProducts: productCount },
  });

  return { storeId: store.id };
}
