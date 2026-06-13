import { PrismaClient } from '@prisma/client';

export async function seedStores(prisma: PrismaClient, adminUserId: string): Promise<{ storeId: string }> {
  console.log('  🏪 Seeding stores & seller plans...');

  // ── PlatformSettings singleton ─────────────────────────────────────────────
  await prisma.platformSettings.upsert({
    where:  { id: 'singleton' },
    update: { platformName: 'Daily Daisy' },
    create: {
      id:                      'singleton',
      defaultCommissionRate:   0.15,
      minCommissionRate:       0.05,
      maxCommissionRate:       0.30,
      platformName:            'Daily Daisy',
      allowPublicRegistration: false,
      minPayoutAmount:         100.00,
      payoutSchedule:          'monthly',
      maintenanceMode:         false,
    },
  });
  console.log('    ✓ PlatformSettings');

  // ── SellerPlans ────────────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.sellerPlan.upsert({
      where:  { id: 'plan-starter' },
      update: {},
      create: {
        id:             'plan-starter',
        name:           'Starter',
        monthlyPrice:   0,
        maxProducts:    50,
        maxOrders:      null,
        commissionRate: 0.15,
        features:       ['Basic analytics', 'Standard support', 'Store page'],
        isActive:       true,
        sortOrder:      0,
      },
    }),
    prisma.sellerPlan.upsert({
      where:  { id: 'plan-pro' },
      update: {},
      create: {
        id:             'plan-pro',
        name:           'Pro',
        monthlyPrice:   29,
        maxProducts:    200,
        maxOrders:      null,
        commissionRate: 0.10,
        features:       ['Advanced analytics', 'Priority support', 'Featured listing', 'Promotional tools'],
        isActive:       true,
        sortOrder:      1,
      },
    }),
    prisma.sellerPlan.upsert({
      where:  { id: 'plan-elite' },
      update: {},
      create: {
        id:             'plan-elite',
        name:           'Elite',
        monthlyPrice:   79,
        maxProducts:    null,
        maxOrders:      null,
        commissionRate: 0.07,
        features:       ['Full analytics suite', 'Dedicated support', 'Featured listing', 'Promotional tools', 'API access'],
        isActive:       true,
        sortOrder:      2,
      },
    }),
  ]);
  console.log(`    ✓ ${plans.length} seller plans`);

  // ── Default store: Daily Daisy (owned by super admin) ────────────────────
  const store = await prisma.store.upsert({
    where:  { slug: 'daily-daisy' },
    update: {},
    create: {
      slug:           'daily-daisy',
      name:           'Daily Daisy',
      description:    'The official Daily Daisy store — unique personalized gifts and handcrafted keepsakes for every occasion.',
      ownerId:        adminUserId,
      status:         'ACTIVE',
      planType:       'COMMISSION',
      commissionRate: 0,
      verifiedAt:     new Date(),
      approvedById:   adminUserId,
    },
  });
  console.log(`    ✓ Default store: ${store.name} (slug: ${store.slug})`);

  // ── Update admin user as seller ───────────────────────────────────────────
  await prisma.user.update({
    where: { id: adminUserId },
    data:  { isSeller: true, storeId: store.id },
  });
  console.log('    ✓ Admin user marked as seller');

  // ── Backfill existing products → Daily Daisy ────────────────────────────
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

  // ── Backfill existing ShopSections → Daily Daisy ────────────────────────
  const { count: backfilledSections } = await prisma.shopSection.updateMany({
    where: { storeId: null },
    data:  { storeId: store.id },
  });
  console.log(`    ✓ Backfilled ${backfilledSections} shop sections → ${store.name}`);

  // ── Backfill ShippingProfiles → Daily Daisy ─────────────────────────────
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
