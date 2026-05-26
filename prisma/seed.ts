import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Super Admin ──────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mapleloomhandmade.com' },
    update: {},
    create: {
      email: 'admin@mapleloomhandmade.com',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── Categories ───────────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Mugs & Drinkware', slug: 'mugs', description: 'Custom mugs, tumblers, and drinkware' },
    { name: 'Canvas Prints', slug: 'canvas', description: 'Personalized canvas and wall art' },
    { name: 'Apparel', slug: 'apparel', description: 'Custom t-shirts, hoodies, and clothing' },
    { name: 'Ornaments', slug: 'ornaments', description: 'Holiday and year-round ornaments' },
    { name: 'Accessories', slug: 'accessories', description: 'Tote bags, pillows, and more' },
  ] as const;

  const categories: Record<string, string> = {};
  for (let i = 0; i < categoryDefs.length; i++) {
    const def = categoryDefs[i];
    const cat = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: { ...def, sortOrder: i },
    });
    categories[def.slug] = cat.id;
    console.log(`✅ Category: ${cat.name}`);
  }

  // ── Collections ──────────────────────────────────────────────────────────
  const collectionDefs = [
    { name: "Valentine's Day", slug: 'valentines-day', description: 'Perfect gifts for your loved one', occasion: 'valentines' },
    { name: 'Birthday Gifts', slug: 'birthday-gifts', description: 'Make their birthday unforgettable', occasion: 'birthday' },
    { name: 'Anniversary', slug: 'anniversary', description: 'Celebrate your special moments', occasion: 'anniversary' },
  ] as const;

  const collections: Record<string, string> = {};
  for (let i = 0; i < collectionDefs.length; i++) {
    const def = collectionDefs[i];
    const col = await prisma.collection.upsert({
      where: { slug: def.slug },
      update: {},
      create: { ...def, sortOrder: i },
    });
    collections[def.slug] = col.id;
    console.log(`✅ Collection: ${col.name}`);
  }

  // ── Products ─────────────────────────────────────────────────────────────
  type VariantDef = { name: string; options: object; price: number; isDefault: boolean };
  type ProductDef = {
    name: string; slug: string; sku: string; description: string; shortDescription: string;
    basePrice: number; compareAtPrice?: number; categorySlug: string; isFeatured?: boolean;
    variants: VariantDef[]; imageUrl: string;
  };

  const productDefs: ProductDef[] = [
    {
      name: 'Custom Name & Photo Coffee Mug',
      slug: 'custom-name-photo-mug',
      sku: 'MUG-001',
      description: 'Personalize this beautiful ceramic mug with your name and favorite photo. Dishwasher safe, microwave safe.',
      shortDescription: 'Custom ceramic mug with photo and name',
      basePrice: 27.99,
      compareAtPrice: 35.99,
      categorySlug: 'mugs',
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=800&q=80',
      variants: [
        { name: '11oz White', options: { size: '11oz', color: 'White' }, price: 27.99, isDefault: true },
        { name: '15oz White', options: { size: '15oz', color: 'White' }, price: 32.99, isDefault: false },
        { name: '11oz Black', options: { size: '11oz', color: 'Black' }, price: 29.99, isDefault: false },
      ],
    },
    {
      name: 'Personalized Family Canvas Print',
      slug: 'personalized-canvas-print',
      sku: 'CAN-001',
      description: 'Create a stunning gallery-wrapped canvas print featuring your family photo. Ready to hang, premium quality.',
      shortDescription: 'Custom family photo canvas print',
      basePrice: 49.99,
      categorySlug: 'canvas',
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=800&q=80',
      variants: [
        { name: '12×16"', options: { size: '12x16' }, price: 49.99, isDefault: true },
        { name: '16×20"', options: { size: '16x20' }, price: 69.99, isDefault: false },
        { name: '20×24"', options: { size: '20x24' }, price: 89.99, isDefault: false },
      ],
    },
    {
      name: 'Monogram Insulated Tumbler',
      slug: 'monogram-tumbler',
      sku: 'TUM-001',
      description: 'Stainless steel insulated tumbler with laser-engraved monogram. Keeps drinks cold 24h, hot 12h.',
      shortDescription: 'Insulated tumbler with monogram',
      basePrice: 29.99,
      categorySlug: 'mugs',
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=800&q=80',
      variants: [
        { name: '20oz', options: { size: '20oz' }, price: 29.99, isDefault: true },
        { name: '30oz', options: { size: '30oz' }, price: 34.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Photo Throw Pillow',
      slug: 'custom-photo-pillow',
      sku: 'PIL-001',
      description: 'Super soft throw pillow featuring your favorite photo. Premium sublimation printing, includes insert.',
      shortDescription: 'Custom photo throw pillow',
      basePrice: 34.99,
      compareAtPrice: 44.99,
      categorySlug: 'accessories',
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&q=80',
      variants: [
        { name: '16×16"', options: { size: '16x16' }, price: 34.99, isDefault: true },
        { name: '18×18"', options: { size: '18x18' }, price: 39.99, isDefault: false },
        { name: '20×20"', options: { size: '20x20' }, price: 44.99, isDefault: false },
      ],
    },
    {
      name: 'Personalized Tote Bag',
      slug: 'personalized-tote-bag',
      sku: 'TOT-001',
      description: 'Eco-friendly 12oz canvas tote bag with custom name, quote, or design. Reinforced handles.',
      shortDescription: 'Custom canvas tote bag',
      basePrice: 22.99,
      categorySlug: 'accessories',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      variants: [
        { name: 'Natural', options: { color: 'Natural' }, price: 22.99, isDefault: true },
        { name: 'Black', options: { color: 'Black' }, price: 22.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Photo Ornament',
      slug: 'custom-photo-ornament',
      sku: 'ORN-001',
      description: 'Beautiful ceramic ornament with your photo and personalized text. Perfect holiday keepsake.',
      shortDescription: 'Personalized photo ornament',
      basePrice: 18.99,
      categorySlug: 'ornaments',
      imageUrl: 'https://images.unsplash.com/photo-1512389098783-66b81f86e199?w=800&q=80',
      variants: [
        { name: 'Round', options: { shape: 'Round' }, price: 18.99, isDefault: true },
        { name: 'Heart', options: { shape: 'Heart' }, price: 18.99, isDefault: false },
        { name: 'Star', options: { shape: 'Star' }, price: 18.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Name Hoodie',
      slug: 'custom-name-hoodie',
      sku: 'HOD-001',
      description: 'Cozy pullover hoodie with your custom name or text. 80/20 cotton-poly blend, true to size.',
      shortDescription: 'Personalized pullover hoodie',
      basePrice: 44.99,
      categorySlug: 'apparel',
      imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80',
      variants: [
        { name: 'S / Black', options: { size: 'S', color: 'Black' }, price: 44.99, isDefault: false },
        { name: 'M / Black', options: { size: 'M', color: 'Black' }, price: 44.99, isDefault: true },
        { name: 'L / Black', options: { size: 'L', color: 'Black' }, price: 44.99, isDefault: false },
        { name: 'XL / Black', options: { size: 'XL', color: 'Black' }, price: 44.99, isDefault: false },
      ],
    },
    {
      name: 'Family Name Sign',
      slug: 'family-name-sign',
      sku: 'SIG-001',
      description: 'Elegant solid wood sign engraved with your family name and established date. Ready to hang.',
      shortDescription: 'Personalized family name sign',
      basePrice: 39.99,
      categorySlug: 'accessories',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      variants: [
        { name: '12" Natural', options: { size: '12in', color: 'Natural' }, price: 39.99, isDefault: true },
        { name: '18" Natural', options: { size: '18in', color: 'Natural' }, price: 54.99, isDefault: false },
      ],
    },
    {
      name: 'Pet Portrait Canvas',
      slug: 'pet-portrait-canvas',
      sku: 'PET-001',
      description: 'Turn your pet photo into a stunning watercolor-style canvas print. Gallery wrapped, ready to hang.',
      shortDescription: 'Custom pet portrait canvas',
      basePrice: 54.99,
      categorySlug: 'canvas',
      imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      variants: [
        { name: '8×10"', options: { size: '8x10', style: 'Watercolor' }, price: 54.99, isDefault: true },
        { name: '12×16"', options: { size: '12x16', style: 'Watercolor' }, price: 74.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Birth Stats Print',
      slug: 'custom-birth-stats-print',
      sku: 'BRT-001',
      description: "Commemorative print with your baby's birth stats — name, date, weight, and height. Beautiful nursery décor.",
      shortDescription: 'Personalized baby birth stats print',
      basePrice: 32.99,
      categorySlug: 'canvas',
      imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
      variants: [
        { name: '8×10"', options: { size: '8x10' }, price: 32.99, isDefault: true },
        { name: '11×14"', options: { size: '11x14' }, price: 42.99, isDefault: false },
      ],
    },
  ];

  const productIds: Record<string, string> = {};
  for (const def of productDefs) {
    const { variants, imageUrl, categorySlug, isFeatured = false, ...fields } = def;
    const existing = await prisma.product.findUnique({ where: { slug: def.slug } });
    if (existing) {
      productIds[def.slug] = existing.id;
      console.log(`⏭  Product (exists): ${def.name}`);
      continue;
    }
    const product = await prisma.product.create({
      data: {
        ...fields,
        categoryId: categories[categorySlug],
        isFeatured,
        isPersonalizable: true,
        isActive: true,
        processingDays: 3,
        variants: { create: variants.map((v, i) => ({ ...v, sortOrder: i })) },
        images: { create: [{ url: imageUrl, isPrimary: true, sortOrder: 0 }] },
      },
    });
    productIds[def.slug] = product.id;
    console.log(`✅ Product: ${product.name}`);
  }

  // ── Collection ↔ Product links ────────────────────────────────────────────
  const collectionLinks: Record<string, string[]> = {
    'valentines-day': ['custom-name-photo-mug', 'custom-photo-pillow', 'personalized-canvas-print'],
    'birthday-gifts': ['custom-name-photo-mug', 'monogram-tumbler', 'custom-birth-stats-print'],
    anniversary: ['personalized-canvas-print', 'family-name-sign', 'pet-portrait-canvas'],
  };

  for (const [collectionSlug, slugs] of Object.entries(collectionLinks)) {
    const collectionId = collections[collectionSlug];
    for (let i = 0; i < slugs.length; i++) {
      const productId = productIds[slugs[i]];
      if (!productId) continue;
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId } },
        update: {},
        create: { collectionId, productId, sortOrder: i },
      });
    }
  }
  console.log('✅ Collection products linked');

  // ── Promotions ───────────────────────────────────────────────────────────
  await prisma.promotion.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'PERCENTAGE',
      value: 10,
      maxUsesPerUser: 1,
      isActive: true,
      description: '10% off your first order',
    },
  });
  console.log('✅ Promotion: WELCOME10');

  await prisma.promotion.upsert({
    where: { code: 'FREESHIP50' },
    update: {},
    create: {
      code: 'FREESHIP50',
      type: 'FREE_SHIPPING',
      value: 0,
      minOrderAmount: 50,
      maxUsesPerUser: 3,
      isActive: true,
      description: 'Free shipping on orders over $50',
    },
  });
  console.log('✅ Promotion: FREESHIP50');

  // ── Shipping Zones ────────────────────────────────────────────────────────
  const usZone = await prisma.shippingZone.findFirst({ where: { name: 'United States' } });
  if (!usZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'United States',
        countries: ['US'],
        methods: {
          create: [
            { name: 'Standard (5-10 days)', carrier: 'USPS', price: 4.99, freeShippingOver: 50, minDays: 5, maxDays: 10 },
            { name: 'Express (2-3 days)', carrier: 'FedEx', price: 14.99, minDays: 2, maxDays: 3 },
            { name: 'Overnight', carrier: 'UPS', price: 29.99, minDays: 1, maxDays: 1 },
          ],
        },
      },
    });
    console.log('✅ Shipping zone: United States');
  } else {
    console.log('⏭  Shipping zone (exists): United States');
  }

  const intlZone = await prisma.shippingZone.findFirst({ where: { name: 'International' } });
  if (!intlZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'International',
        countries: ['CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'SG', 'NZ'],
        methods: {
          create: [
            { name: 'Standard International (14-21 days)', carrier: 'USPS', price: 19.99, minDays: 14, maxDays: 21 },
            { name: 'Express International (7-10 days)', carrier: 'FedEx', price: 39.99, minDays: 7, maxDays: 10 },
          ],
        },
      },
    });
    console.log('✅ Shipping zone: International');
  } else {
    console.log('⏭  Shipping zone (exists): International');
  }

  console.log('\n🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
