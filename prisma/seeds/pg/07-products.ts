import { PrismaClient } from '@prisma/client';

type VarDef = { name: string; options: object; price: number; isDefault: boolean };
type ProdDef = {
  name: string; slug: string; sku: string; description: string; shortDescription?: string;
  basePrice: number; compareAtPrice?: number; catSlug: string;
  isFeatured?: boolean; isPersonalizable?: boolean; imageUrl: string; variants: VarDef[];
  shopSection?: string; materials?: string[]; primaryColors?: string[]; secondaryColors?: string[];
  occasions?: string[]; holidayTags?: string[]; recipientTags?: string[]; styles?: string[];
  sustainability?: string[]; whoMadeIt?: string; howItWasMade?: string; returnPolicy?: string; toolsUsed?: string[];
};

const PRODUCTS: ProdDef[] = [
  {
    name: 'Custom Name & Photo Coffee Mug', slug: 'custom-name-photo-mug', sku: 'MUG-001',
    description: 'Personalize this beautiful ceramic mug with your name and favorite photo. Dishwasher safe, microwave safe.',
    shortDescription: 'Custom ceramic mug with photo and name', basePrice: 27.99, compareAtPrice: 35.99,
    catSlug: 'coffee-mugs', isFeatured: true, shopSection: 'Mugs & Drinkware',
    materials: ['Ceramic'], primaryColors: ['White'], occasions: ['Birthday', 'Anniversary', "Mother's Day"],
    recipientTags: ['Her', 'Him', 'Couple'], whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=800&q=80',
    variants: [
      { name: '11oz White', options: { Size: '11oz', Color: 'White' }, price: 27.99, isDefault: true  },
      { name: '15oz White', options: { Size: '15oz', Color: 'White' }, price: 32.99, isDefault: false },
      { name: '11oz Black', options: { Size: '11oz', Color: 'Black' }, price: 29.99, isDefault: false },
    ],
  },
  {
    name: 'Personalized Family Canvas Print', slug: 'personalized-canvas-print', sku: 'CAN-001',
    description: 'Create a stunning gallery-wrapped canvas print featuring your family photo. Ready to hang, premium quality.',
    shortDescription: 'Custom family photo canvas print', basePrice: 49.99,
    catSlug: 'canvas', isFeatured: true, shopSection: 'Wall Art & Canvas',
    materials: ['Canvas'], occasions: ['Anniversary', 'Housewarming', 'Wedding'], recipientTags: ['Couple', 'Her', 'Him'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=800&q=80',
    variants: [
      { name: '12×16"', options: { Size: '12x16' }, price: 49.99, isDefault: true  },
      { name: '16×20"', options: { Size: '16x20' }, price: 69.99, isDefault: false },
      { name: '20×24"', options: { Size: '20x24' }, price: 89.99, isDefault: false },
    ],
  },
  {
    name: 'Monogram Insulated Tumbler', slug: 'monogram-tumbler', sku: 'TUM-001',
    description: 'Stainless steel insulated tumbler with laser-engraved monogram. Keeps drinks cold 24h, hot 12h.',
    shortDescription: 'Insulated tumbler with monogram', basePrice: 29.99,
    catSlug: 'stainless-steel-tumblers', isFeatured: true, shopSection: 'Mugs & Drinkware',
    materials: ['Stainless Steel'], primaryColors: ['Silver'], occasions: ['Birthday', 'Graduation'],
    recipientTags: ['Her', 'Him', 'Men', 'Women'], whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=800&q=80',
    variants: [
      { name: '20oz', options: { Size: '20oz' }, price: 29.99, isDefault: true  },
      { name: '30oz', options: { Size: '30oz' }, price: 34.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Photo Throw Pillow', slug: 'custom-photo-pillow', sku: 'PIL-001',
    description: 'Super soft throw pillow featuring your favorite photo. Premium sublimation printing, includes insert.',
    shortDescription: 'Custom photo throw pillow', basePrice: 34.99, compareAtPrice: 44.99,
    catSlug: 'throw-pillows', isFeatured: true, shopSection: 'Home Decor',
    materials: ['Polyester'], primaryColors: ['Multi'], occasions: ['Housewarming', 'Birthday'], recipientTags: ['Her', 'Couple'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&q=80',
    variants: [
      { name: '16×16"', options: { Size: '16x16' }, price: 34.99, isDefault: true  },
      { name: '18×18"', options: { Size: '18x18' }, price: 39.99, isDefault: false },
      { name: '20×20"', options: { Size: '20x20' }, price: 44.99, isDefault: false },
    ],
  },
  {
    name: 'Personalized Tote Bag', slug: 'personalized-tote-bag', sku: 'TOT-001',
    description: 'Eco-friendly 12oz canvas tote bag with custom name, quote, or design. Reinforced handles.',
    shortDescription: 'Custom canvas tote bag', basePrice: 22.99,
    catSlug: 'tote-bags', materials: ['Canvas'], primaryColors: ['Beige'],
    occasions: ['Birthday', 'Just Because'], recipientTags: ['Her', 'Women', 'Best Friend'],
    sustainability: ['Made from natural materials'], whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
    variants: [
      { name: 'Natural', options: { Color: 'Natural' }, price: 22.99, isDefault: true  },
      { name: 'Black',   options: { Color: 'Black'   }, price: 22.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Photo Ornament', slug: 'custom-photo-ornament', sku: 'ORN-001',
    description: 'Beautiful ceramic ornament with your photo and personalized text. Perfect holiday keepsake.',
    shortDescription: 'Personalized photo ornament', basePrice: 18.99,
    catSlug: 'ornaments', materials: ['Ceramic'], primaryColors: ['White'],
    occasions: ['Christmas'], holidayTags: ['Christmas'], recipientTags: ['Grandparents', 'Kids'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1512389098783-66b81f86e199?w=800&q=80',
    variants: [
      { name: 'Round', options: { Shape: 'Round' }, price: 18.99, isDefault: true  },
      { name: 'Heart', options: { Shape: 'Heart' }, price: 18.99, isDefault: false },
      { name: 'Star',  options: { Shape: 'Star'  }, price: 18.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Name Hoodie', slug: 'custom-name-hoodie', sku: 'HOD-001',
    description: 'Cozy pullover hoodie with your custom name or text. 80/20 cotton-poly blend, true to size.',
    shortDescription: 'Personalized pullover hoodie', basePrice: 44.99,
    catSlug: 'hoodies', shopSection: 'Apparel', materials: ['Cotton', 'Polyester'], primaryColors: ['Black'],
    occasions: ['Birthday', 'Celebration'], recipientTags: ['Him', 'Her', 'Teen', 'Men', 'Women'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80',
    variants: [
      { name: 'S/Black',  options: { Size: 'S',  Color: 'Black' }, price: 44.99, isDefault: false },
      { name: 'M/Black',  options: { Size: 'M',  Color: 'Black' }, price: 44.99, isDefault: true  },
      { name: 'L/Black',  options: { Size: 'L',  Color: 'Black' }, price: 44.99, isDefault: false },
      { name: 'XL/Black', options: { Size: 'XL', Color: 'Black' }, price: 44.99, isDefault: false },
    ],
  },
  {
    name: 'Family Name Sign', slug: 'family-name-sign', sku: 'SIG-001',
    description: 'Elegant solid wood sign engraved with your family name and established date. Ready to hang.',
    shortDescription: 'Personalized family name sign', basePrice: 39.99,
    catSlug: 'wood-acrylic-art', shopSection: 'Home Decor', materials: ['Wood'], primaryColors: ['Brown'],
    occasions: ['Housewarming', 'Wedding', 'Anniversary'], recipientTags: ['Couple', 'Her', 'Him'],
    sustainability: ['Made from natural materials'], styles: ['Rustic', 'Farmhouse'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    variants: [
      { name: '12" Natural', options: { Size: '12in', Color: 'Natural' }, price: 39.99, isDefault: true  },
      { name: '18" Natural', options: { Size: '18in', Color: 'Natural' }, price: 54.99, isDefault: false },
    ],
  },
  {
    name: 'Pet Portrait Canvas', slug: 'pet-portrait-canvas', sku: 'PET-001',
    description: 'Turn your pet photo into a stunning watercolor-style canvas print. Gallery wrapped, ready to hang.',
    shortDescription: 'Custom pet portrait canvas', basePrice: 54.99,
    catSlug: 'canvas', shopSection: 'Wall Art & Canvas', materials: ['Canvas'],
    occasions: ['Birthday', 'Just Because'], recipientTags: ['Pet Owners', 'Her', 'Him'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
    variants: [
      { name: '8×10" Watercolor',  options: { Size: '8x10',  Style: 'Watercolor' }, price: 54.99, isDefault: true  },
      { name: '12×16" Watercolor', options: { Size: '12x16', Style: 'Watercolor' }, price: 74.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Birth Stats Print', slug: 'custom-birth-stats-print', sku: 'BRT-001',
    description: "Commemorative print with your baby's birth stats — name, date, weight, and height.",
    shortDescription: 'Personalized baby birth stats print', basePrice: 32.99,
    catSlug: 'canvas', shopSection: 'Wall Art & Canvas', materials: ['Canvas'], primaryColors: ['Beige'],
    occasions: ['Baby Shower'], recipientTags: ['Baby', 'Kids', 'Her'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
    variants: [
      { name: '8×10"',  options: { Size: '8x10'  }, price: 32.99, isDefault: true  },
      { name: '11×14"', options: { Size: '11x14' }, price: 42.99, isDefault: false },
    ],
  },
  {
    name: 'Personalized Cutting Board', slug: 'personalized-cutting-board', sku: 'CUT-001',
    description: 'Bamboo cutting board laser-engraved with your family name and established year. Food safe finish, juice groove.',
    shortDescription: 'Custom engraved bamboo cutting board', basePrice: 44.99, compareAtPrice: 54.99,
    catSlug: 'cutting-boards', isPersonalizable: false, shopSection: 'Home Decor', materials: ['Bamboo'], primaryColors: ['Brown'],
    occasions: ['Housewarming', 'Wedding', 'Anniversary'], recipientTags: ['Couple', 'Her'],
    sustainability: ['Made from natural materials'], whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    variants: [
      { name: 'Small 8×6',  options: { Size: 'Small (8×6")'  }, price: 44.99, isDefault: true  },
      { name: 'Large 12×8', options: { Size: 'Large (12×8")' }, price: 64.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Photo Phone Case', slug: 'custom-photo-phone-case', sku: 'PHN-001',
    description: 'Slim hard shell phone case printed with your photo. Available for iPhone 14/15 and Samsung Galaxy.',
    shortDescription: 'Custom photo phone case', basePrice: 19.99,
    catSlug: 'phone-cases', materials: ['Acrylic'], occasions: ['Birthday', 'Just Because'], recipientTags: ['Him', 'Her', 'Teen'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1586953208270-7a3b38c26e33?w=800&q=80',
    variants: [
      { name: 'iPhone 15',     options: { Model: 'iPhone 15'     }, price: 19.99, isDefault: true  },
      { name: 'iPhone 15 Pro', options: { Model: 'iPhone 15 Pro' }, price: 19.99, isDefault: false },
      { name: 'iPhone 14',     options: { Model: 'iPhone 14'     }, price: 19.99, isDefault: false },
      { name: 'Samsung S24',   options: { Model: 'Samsung S24'   }, price: 19.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Anniversary Map Print', slug: 'anniversary-map-print', sku: 'MAP-001',
    description: 'A beautiful star map or city map from the night of your special date. Gallery-wrap canvas, ready to hang.',
    shortDescription: 'Personalized anniversary map canvas', basePrice: 59.99, compareAtPrice: 74.99,
    catSlug: 'canvas', isFeatured: true, shopSection: 'Wall Art & Canvas', materials: ['Canvas'],
    occasions: ['Anniversary', 'Wedding', "Valentine's Day"], holidayTags: ["Valentine's Day"],
    recipientTags: ['Couple', 'Her', 'Him', 'Wife', 'Husband'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80',
    variants: [
      { name: '12×16" Canvas', options: { Size: '12×16"', Type: 'Canvas' }, price: 59.99, isDefault: true  },
      { name: '12×16" Framed', options: { Size: '12×16"', Type: 'Framed' }, price: 79.99, isDefault: false },
    ],
  },
  {
    name: 'Couples Mug Set', slug: 'couples-mug-set', sku: 'MUG-002',
    description: 'Set of two matching ceramic mugs personalized with your names and a special date. Dishwasher and microwave safe.',
    shortDescription: 'Matching couples mug set', basePrice: 49.99, compareAtPrice: 59.99,
    catSlug: 'coffee-mugs', shopSection: 'Mugs & Drinkware', materials: ['Ceramic'], primaryColors: ['White'],
    occasions: ['Anniversary', 'Wedding', "Valentine's Day"], holidayTags: ["Valentine's Day"],
    recipientTags: ['Couple', 'Wife', 'Husband'], whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80',
    variants: [
      { name: '2×11oz', options: { Size: '2 × 11oz' }, price: 49.99, isDefault: true  },
      { name: '2×15oz', options: { Size: '2 × 15oz' }, price: 59.99, isDefault: false },
    ],
  },
  {
    name: 'Personalized Wine Glass', slug: 'personalized-wine-glass', sku: 'WIN-001',
    description: 'Elegant stemmed wine glass with custom name or message laser-etched. Perfect wedding or housewarming gift.',
    shortDescription: 'Custom engraved wine glass', basePrice: 24.99,
    catSlug: 'wine-glasses', isPersonalizable: false, shopSection: 'Mugs & Drinkware', materials: ['Glass'], primaryColors: ['Clear'],
    occasions: ['Wedding', 'Housewarming', 'Anniversary'], recipientTags: ['Couple', 'Her', 'Him'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
    variants: [
      { name: '15oz Clear',    options: { Size: '15oz', Color: 'Clear'    }, price: 24.99, isDefault: true  },
      { name: '15oz Stemless', options: { Size: '15oz', Style: 'Stemless' }, price: 22.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Family Reunion T-Shirt', slug: 'custom-family-reunion-tshirt', sku: 'TEE-001',
    description: 'Soft 100% cotton t-shirt with custom family name and year on the back. Great for family events.',
    shortDescription: 'Custom family reunion tee', basePrice: 24.99,
    catSlug: 'classic-tees', shopSection: 'Apparel', materials: ['Cotton'], primaryColors: ['White'],
    occasions: ['Celebration'], recipientTags: ['Men', 'Women', 'Kids'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
    variants: [
      { name: 'S/White',  options: { Size: 'S',  Color: 'White' }, price: 24.99, isDefault: false },
      { name: 'M/White',  options: { Size: 'M',  Color: 'White' }, price: 24.99, isDefault: true  },
      { name: 'L/White',  options: { Size: 'L',  Color: 'White' }, price: 24.99, isDefault: false },
      { name: 'XL/White', options: { Size: 'XL', Color: 'White' }, price: 24.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Name Keychain', slug: 'custom-name-keychain', sku: 'KEY-001',
    description: 'Durable stainless steel keychain laser-engraved with your name, initials, or short message.',
    shortDescription: 'Custom engraved keychain', basePrice: 14.99,
    catSlug: 'keychains', isPersonalizable: false, materials: ['Stainless Steel'], primaryColors: ['Silver'],
    occasions: ['Birthday', 'Graduation', 'Just Because'], recipientTags: ['Her', 'Him', 'Men', 'Women', 'Best Friend'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1533234427049-9e9bb093186d?w=800&q=80',
    variants: [
      { name: 'Silver',    options: { Color: 'Silver'    }, price: 14.99, isDefault: true  },
      { name: 'Gold',      options: { Color: 'Gold'      }, price: 16.99, isDefault: false },
      { name: 'Rose Gold', options: { Color: 'Rose Gold' }, price: 16.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Baby Onesie', slug: 'custom-baby-onesie', sku: 'ONS-001',
    description: 'Soft 100% cotton onesie with your custom text or name. Gentle on sensitive baby skin.',
    shortDescription: 'Personalized baby onesie', basePrice: 19.99,
    catSlug: 'onesies', shopSection: 'Apparel', materials: ['Cotton'], primaryColors: ['White'],
    occasions: ['Baby Shower'], recipientTags: ['Baby', 'Kids'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80',
    variants: [
      { name: '0-3M White',  options: { Size: '0-3M',  Color: 'White' }, price: 19.99, isDefault: true  },
      { name: '3-6M White',  options: { Size: '3-6M',  Color: 'White' }, price: 19.99, isDefault: false },
      { name: '6-12M White', options: { Size: '6-12M', Color: 'White' }, price: 19.99, isDefault: false },
    ],
  },
  {
    name: 'Custom Pet Portrait Pillow', slug: 'custom-pet-portrait-pillow', sku: 'PEP-001',
    description: 'Turn your pet photo into a stunning throw pillow. Vibrant sublimation print, soft polyester cover.',
    shortDescription: 'Custom pet portrait pillow', basePrice: 37.99,
    catSlug: 'throw-pillows', shopSection: 'Home Decor', materials: ['Polyester'],
    occasions: ['Birthday', 'Just Because'], recipientTags: ['Pet Owners', 'Her'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
    variants: [
      { name: '16×16"', options: { Size: '16×16"' }, price: 37.99, isDefault: true  },
      { name: '18×18"', options: { Size: '18×18"' }, price: 42.99, isDefault: false },
    ],
  },
  {
    name: 'Personalized Graduation Frame', slug: 'personalized-graduation-frame', sku: 'FRM-001',
    description: 'Elegant acrylic desk frame for your graduation photo, personalized with name, degree, and year.',
    shortDescription: 'Custom graduation photo frame', basePrice: 34.99,
    catSlug: 'acrylic-plaques', materials: ['Acrylic'], primaryColors: ['Clear'],
    occasions: ['Graduation'], recipientTags: ['Him', 'Her', 'Teen'],
    whoMadeIt: 'ANOTHER_COMPANY', howItWasMade: 'ALTERED', returnPolicy: 'NO_RETURNS', toolsUsed: ['computerized'],
    imageUrl: 'https://images.unsplash.com/photo-1627556704290-2b1f5853ff78?w=800&q=80',
    variants: [
      { name: '5×7" Acrylic',  options: { Size: '5×7"',  Material: 'Acrylic' }, price: 34.99, isDefault: true  },
      { name: '8×10" Acrylic', options: { Size: '8×10"', Material: 'Acrylic' }, price: 44.99, isDefault: false },
    ],
  },
];

export async function seedProducts(prisma: PrismaClient, defaultStoreId?: string): Promise<Record<string, string>> {
  console.log('  📦 Seeding products...');

  const slugsNeeded = [
    'coffee-mugs','canvas','stainless-steel-tumblers','throw-pillows','tote-bags',
    'ornaments','hoodies','wood-acrylic-art','cutting-boards','phone-cases',
    'wine-glasses','classic-tees','keychains','onesies','acrylic-plaques',
  ];

  const categoryIds: Record<string, string | null> = {};
  for (const s of slugsNeeded) {
    const cat = await prisma.category.findUnique({ where: { slug: s } });
    categoryIds[s] = cat?.id ?? null;
  }

  const defaultProcessingProfile = await prisma.processingProfile.findFirst({ where: { isDefault: true } });
  const defaultShippingProfile   = await prisma.shippingProfile.findFirst({ where: { isDefault: true } });
  const sections = await prisma.shopSection.findMany();
  const sectionMap = Object.fromEntries(sections.map(s => [s.name, s.id]));

  const productIds: Record<string, string> = {};

  for (const def of PRODUCTS) {
    const {
      variants, imageUrl, catSlug,
      isFeatured = false, isPersonalizable = true,
      shopSection, materials, primaryColors, secondaryColors,
      occasions, holidayTags, recipientTags,
      styles, sustainability,
      whoMadeIt, howItWasMade, returnPolicy, toolsUsed,
      ...fields
    } = def;

    const categoryId = categoryIds[catSlug] ?? null;
    if (!categoryId) {
      if (process.env['NODE_ENV'] === 'production') {
        console.warn(`    ⚠  Skipping ${def.name} — category '${catSlug}' not found`);
        continue;
      }
      throw new Error(`Seed error: category slug '${catSlug}' not found for product '${def.name}'.`);
    }

    const existing = await prisma.product.findFirst({ where: { slug: def.slug } });
    if (existing) {
      productIds[def.slug] = existing.id;
      // Backfill storeId if missing
      if (defaultStoreId && !existing.storeId) {
        await prisma.product.update({ where: { id: existing.id }, data: { storeId: defaultStoreId } });
      }
      console.log(`    ⏭  Product (exists): ${def.name}`);
      continue;
    }

    const shopSectionId = shopSection ? (sectionMap[shopSection] ?? null) : null;

    const product = await prisma.product.create({
      data: {
        ...fields,
        storeId: defaultStoreId ?? null,
        categoryId,
        isFeatured,
        isPersonalizable,
        isActive:           true,
        processingDays:     3,
        renewalType:        'AUTOMATIC',
        isAdsEnabled:       false,
        materials:          materials       ?? [],
        primaryColors:      primaryColors   ?? [],
        secondaryColors:    secondaryColors ?? [],
        occasions:          occasions       ?? [],
        holidayTags:        holidayTags     ?? [],
        recipientTags:      recipientTags   ?? [],
        styles:             styles          ?? [],
        sustainability:     sustainability  ?? [],
        toolsUsed:          toolsUsed       ?? [],
        whoMadeIt:          (whoMadeIt    ?? 'ANOTHER_COMPANY') as any,
        howItWasMade:       (howItWasMade ?? 'ALTERED')         as any,
        returnPolicy:       (returnPolicy ?? 'NO_RETURNS')      as any,
        shopSectionId,
        processingProfileId: defaultProcessingProfile?.id ?? null,
        shippingProfileId:   defaultShippingProfile?.id   ?? null,
        variants:          { create: variants.map((v, i) => ({ ...v, sortOrder: i })) },
        images:            { create: [{ url: imageUrl, isPrimary: true, sortOrder: 0 }] },
        productCategories: { create: [{ categoryId, isPrimary: true }] },
      },
    });
    productIds[def.slug] = product.id;
    console.log(`    ✓ Product: ${product.name}`);
  }

  return productIds;
}
