/**
 * Database seed script — PostgreSQL + MongoDB.
 *
 * Order of operations:
 *   1. Super admin user
 *   2. 3-level category tree (L1 nav tabs → L2 groups → L3 leaf items)
 *   3. Collections (occasion-based)
 *   4. Sample products
 *   5. Collection ↔ product links
 *   6. MongoDB mega-menu documents (derived from PG tree)
 *   7. Promotions
 *   8. Shipping zones
 */

import { PrismaClient } from '@prisma/client';
import mongoose, { Schema, model, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── MongoDB CategoryMenu schema (inline for the seed — avoids NestJS context) ──

interface IMenuItem {
  name: string;
  categoryId: string;
  slug: string;
  sortOrder: number;
}

interface IMenuGroup {
  title: string;
  categoryId: string;
  slug: string;
  items: IMenuItem[];
  sortOrder: number;
}

interface ICategoryMenu {
  navLabel: string;
  navSlug: string;
  categoryId: string;
  sortOrder: number;
  isVisible: boolean;
  iconUrl?: string;
  groups: IMenuGroup[];
}

const menuItemSchema = new Schema<IMenuItem>(
  { name: String, categoryId: String, slug: String, sortOrder: { type: Number, default: 0 } },
  { _id: false },
);

const menuGroupSchema = new Schema<IMenuGroup>(
  {
    title:      String,
    categoryId: String,
    slug:       String,
    items:      [menuItemSchema],
    sortOrder:  { type: Number, default: 0 },
  },
  { _id: false },
);

const categoryMenuSchema = new Schema<ICategoryMenu>(
  {
    navLabel:   { type: String, required: true, unique: true },
    navSlug:    { type: String, required: true, unique: true },
    categoryId: { type: String, required: true },
    sortOrder:  { type: Number, default: 0 },
    isVisible:  { type: Boolean, default: true },
    iconUrl:    String,
    groups:     [menuGroupSchema],
  },
  { collection: 'category_menus', timestamps: true },
);

// Avoid model re-registration on hot-reload
let CategoryMenuModel: Model<ICategoryMenu>;
try {
  CategoryMenuModel = mongoose.model<ICategoryMenu>('CategoryMenu');
} catch {
  CategoryMenuModel = model<ICategoryMenu>('CategoryMenu', categoryMenuSchema);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

type UpsertArgs = { name: string; s?: string; level: number; parentId?: string; sortOrder?: number; description?: string };
async function upsertCategory(args: UpsertArgs) {
  const { name, s, level, parentId, sortOrder = 0, description } = args;
  const sl = s ?? slug(name);
  return prisma.category.upsert({
    where: { slug: sl },
    update: { level, ...(parentId ? { parentId } : {}), sortOrder },
    create: { name, slug: sl, level, parentId: parentId ?? null, sortOrder, description },
  });
}

// ── STEP 1 — Admin user ───────────────────────────────────────────────────────

async function seedAdmin() {
  const hash  = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@mapleloomhandmade.com' },
    update: {},
    create: {
      email:           'admin@mapleloomhandmade.com',
      passwordHash:    hash,
      firstName:       'Super',
      lastName:        'Admin',
      role:            'SUPER_ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);
}

// ── STEP 2 — 3-Level category tree ────────────────────────────────────────────

async function seedCategories() {
  console.log('\n📂 Seeding category tree...');

  // ── L1 Nav tabs ────────────────────────────────────────────────────────────
  const L1 = {
    gifts:         await upsertCategory({ name: 'Gifts',          level: 1, sortOrder: 1 }),
    homeLiving:    await upsertCategory({ name: 'Home & Living',  s: 'home-living',   level: 1, sortOrder: 2 }),
    drinkBarware:  await upsertCategory({ name: 'Drink & Barware', s: 'drink-barware', level: 1, sortOrder: 3 }),
    apparel:       await upsertCategory({ name: 'Apparel',        level: 1, sortOrder: 4 }),
    accessories:   await upsertCategory({ name: 'Accessories',    level: 1, sortOrder: 5 }),
    interests:     await upsertCategory({ name: 'Interests',      level: 1, sortOrder: 6 }),
  };

  for (const [k, v] of Object.entries(L1)) console.log(`  ✅ L1 ${v.name}`);

  // ── L2 Groups ──────────────────────────────────────────────────────────────

  // ── Home & Living groups ───────────────────────────
  const homeLivingGroups = {
    bedBath:          await upsertCategory({ name: 'Bed & Bath',           s: 'bed-bath',           level: 2, parentId: L1.homeLiving.id, sortOrder: 1 }),
    christmasOrnaments: await upsertCategory({ name: 'Christmas Ornaments', s: 'christmas-ornaments', level: 2, parentId: L1.homeLiving.id, sortOrder: 2 }),
    floorRugs:        await upsertCategory({ name: 'Floor & Rugs',         s: 'floor-rugs',         level: 2, parentId: L1.homeLiving.id, sortOrder: 3 }),
    framesDisplays:   await upsertCategory({ name: 'Frames and Displays',  s: 'frames-displays',    level: 2, parentId: L1.homeLiving.id, sortOrder: 4 }),
    hangingDecoration: await upsertCategory({ name: 'Hanging Decoration',  s: 'hanging-decoration', level: 2, parentId: L1.homeLiving.id, sortOrder: 5 }),
    jewelryStorage:   await upsertCategory({ name: 'Jewelry Storage',      s: 'jewelry-storage',    level: 2, parentId: L1.homeLiving.id, sortOrder: 6 }),
    kitchenDining:    await upsertCategory({ name: 'Kitchen & Dining',     s: 'kitchen-dining',     level: 2, parentId: L1.homeLiving.id, sortOrder: 7 }),
    lighting:         await upsertCategory({ name: 'Lighting',             s: 'lighting',           level: 2, parentId: L1.homeLiving.id, sortOrder: 8 }),
    outdoorGardening: await upsertCategory({ name: 'Outdoor & Gardening',  s: 'outdoor-gardening',  level: 2, parentId: L1.homeLiving.id, sortOrder: 9 }),
    wallDecor:        await upsertCategory({ name: 'Wall Decor',           s: 'wall-decor',         level: 2, parentId: L1.homeLiving.id, sortOrder: 10 }),
  };

  // ── Drink & Barware groups ─────────────────────────
  const drinkGroups = {
    mugs:       await upsertCategory({ name: 'Mugs',           s: 'mugs',         level: 2, parentId: L1.drinkBarware.id, sortOrder: 1 }),
    tumblers:   await upsertCategory({ name: 'Tumblers',       s: 'tumblers',     level: 2, parentId: L1.drinkBarware.id, sortOrder: 2 }),
    glasses:    await upsertCategory({ name: 'Glasses',        s: 'glasses',      level: 2, parentId: L1.drinkBarware.id, sortOrder: 3 }),
    coastersBar: await upsertCategory({ name: 'Coasters & Bar', s: 'coasters-bar', level: 2, parentId: L1.drinkBarware.id, sortOrder: 4 }),
  };

  // ── Apparel groups ─────────────────────────────────
  const apparelGroups = {
    tshirtsTops: await upsertCategory({ name: 'T-Shirts & Tops', s: 't-shirts-tops', level: 2, parentId: L1.apparel.id, sortOrder: 1 }),
    outerwear:   await upsertCategory({ name: 'Outerwear',       s: 'outerwear',     level: 2, parentId: L1.apparel.id, sortOrder: 2 }),
    kidsBaby:    await upsertCategory({ name: 'Kids & Baby',     s: 'kids-baby',     level: 2, parentId: L1.apparel.id, sortOrder: 3 }),
  };

  // ── Accessories groups ─────────────────────────────
  const accessoriesGroups = {
    bagsTotes:      await upsertCategory({ name: 'Bags & Totes',     s: 'bags-totes',     level: 2, parentId: L1.accessories.id, sortOrder: 1 }),
    jewelry:        await upsertCategory({ name: 'Jewelry',          s: 'jewelry',        level: 2, parentId: L1.accessories.id, sortOrder: 2 }),
    techAccessories: await upsertCategory({ name: 'Tech Accessories', s: 'tech-accessories', level: 2, parentId: L1.accessories.id, sortOrder: 3 }),
  };

  // ── Gifts groups ───────────────────────────────────
  const giftsGroups = {
    forHer:  await upsertCategory({ name: 'For Her',  s: 'for-her',  level: 2, parentId: L1.gifts.id, sortOrder: 1 }),
    forHim:  await upsertCategory({ name: 'For Him',  s: 'for-him',  level: 2, parentId: L1.gifts.id, sortOrder: 2 }),
    forKids: await upsertCategory({ name: 'For Kids', s: 'for-kids', level: 2, parentId: L1.gifts.id, sortOrder: 3 }),
    forPets: await upsertCategory({ name: 'For Pets', s: 'for-pets', level: 2, parentId: L1.gifts.id, sortOrder: 4 }),
  };

  console.log('  ✅ L2 groups created');

  // ── L3 Leaf items ──────────────────────────────────────────────────────────

  // Bed & Bath
  await seedL3Items(homeLivingGroups.bedBath.id, [
    'Blankets','Laundry Storage Basket','Pillows','Quilt Sets','Wearable Blanket Hoodies',
  ]);
  // Christmas Ornaments — note: existing 'ornaments' slug maps to this group
  await upsertCategory({ name: 'Acrylic Ornaments',    s: 'acrylic-ornaments',    level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 1 });
  await upsertCategory({ name: 'Aluminum Ornaments',   s: 'aluminum-ornaments',   level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 2 });
  await upsertCategory({ name: 'Ceramic Ornaments',    s: 'ceramic-ornaments',    level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 3 });
  await upsertCategory({ name: 'Glass Ornaments',      s: 'glass-ornaments',      level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 4 });
  await upsertCategory({ name: 'Suncatcher Ornaments', s: 'suncatcher-ornaments', level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 5 });
  await upsertCategory({ name: 'Wooden Ornaments',     s: 'wooden-ornaments',     level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 6 });
  // Floor & Rugs
  await seedL3Items(homeLivingGroups.floorRugs.id,     ['Christmas Tree Skirts','Doormats','Runner Rugs']);
  // Frames and Displays
  await seedL3Items(homeLivingGroups.framesDisplays.id,
    ['Acrylic Plaques','Acrylic Desk Clocks','Ceramic Flower Vases','Ceramic Plates','Family Puzzles']);
  // Hanging Decoration
  await seedL3Items(homeLivingGroups.hangingDecoration.id,
    ['Magnets','Suncatchers','Wine Bottle Wind Chimes','Wood Signs']);
  // Jewelry Storage
  await seedL3Items(homeLivingGroups.jewelryStorage.id,
    ['Jewelry Dishes','Jewelry Boxes','Leather Valet Trays','Makeup Boxes With LED Mirror']);
  // Kitchen & Dining
  await seedL3Items(homeLivingGroups.kitchenDining.id,
    ['Cookie Jars','Cutting Boards','Oven Mitts And Pot Holders','Platters','Tea & Biscuit Boards']);
  // Lighting
  await seedL3Items(homeLivingGroups.lighting.id,
    ['Bottle Lamps','Fabric Lamps','LED Candles','LED Night Light','Mason Jar Lights','Vintage Lantern Night Lights']);
  // Outdoor & Gardening
  await seedL3Items(homeLivingGroups.outdoorGardening.id,
    ['Ceramic Plant Pots','Door Corner Wood Signs','Garden Stakes','Indoor Watering Cans','Metal Signs','Solar Lights','Wind Chimes']);
  // Wall Decor — 'canvas' legacy slug maps here
  await upsertCategory({ name: 'Posters / Canvas',          s: 'canvas',           level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 1 });
  await upsertCategory({ name: 'Key Holders',               s: 'key-holders',      level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 2 });
  await upsertCategory({ name: 'Wood And Acrylic Wall Art', s: 'wood-acrylic-art', level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 3 });

  // Mugs — legacy 'mugs' slug is now L2 group; L3 items below
  await seedL3Items(drinkGroups.mugs.id,       ['Coffee Mugs','Photo Mugs','Travel Mugs','Enamel Mugs']);
  await seedL3Items(drinkGroups.tumblers.id,   ['Stainless Steel Tumblers','Glass Tumblers','Sports Bottles']);
  await seedL3Items(drinkGroups.glasses.id,    ['Wine Glasses','Beer Glasses','Champagne Flutes','Shot Glasses']);
  await seedL3Items(drinkGroups.coastersBar.id,['Coaster Sets','Bottle Openers','Wine Racks','Beer Steins']);

  // Apparel L3
  await seedL3Items(apparelGroups.tshirtsTops.id,['Classic Tees','V-Neck Tees','Long Sleeve Shirts','Tank Tops']);
  await upsertCategory({ name: 'Hoodies',       s: 'hoodies',      level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 1 });
  await upsertCategory({ name: 'Zip-Up Hoodies',s: 'zip-hoodies',  level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 2 });
  await upsertCategory({ name: 'Sweatshirts',   s: 'sweatshirts',  level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 3 });
  await upsertCategory({ name: 'Bomber Jackets',s: 'bomber-jackets',level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 4 });
  await seedL3Items(apparelGroups.kidsBaby.id,   ['Onesies','Kids T-Shirts','Baby Bibs','Baby Blankets']);

  // Accessories L3
  await seedL3Items(accessoriesGroups.bagsTotes.id,     ['Tote Bags','Backpacks','Drawstring Bags','Fanny Packs']);
  await seedL3Items(accessoriesGroups.jewelry.id,       ['Necklaces','Bracelets','Keychains','Rings']);
  await seedL3Items(accessoriesGroups.techAccessories.id,['Phone Cases','Mouse Pads','Laptop Sleeves','AirPod Cases']);

  // Gifts L3
  await seedL3Items(giftsGroups.forHer.id,  ['Jewelry & Accessories','Home Decor','Beauty & Wellness']);
  await seedL3Items(giftsGroups.forHim.id,  ['Drinkware','Tech Accessories','Outdoor']);
  await seedL3Items(giftsGroups.forKids.id, ['Toys & Games','Clothing','Room Decor']);
  await seedL3Items(giftsGroups.forPets.id, ['Pet Portraits','Pet Tags','Pet Clothing']);

  // Update legacy 'ornaments' to be L3 under Christmas Ornaments group
  await upsertCategory({ name: 'Photo Ornaments', s: 'ornaments', level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 7 });

  console.log('  ✅ L3 leaf items created');

  return { L1, homeLivingGroups, drinkGroups, apparelGroups, accessoriesGroups, giftsGroups };
}

async function seedL3Items(parentId: string, names: string[]) {
  for (let i = 0; i < names.length; i++) {
    await upsertCategory({ name: names[i], level: 3, parentId, sortOrder: i + 1 });
  }
}

// ── STEP 3 — Occasion-based collections ──────────────────────────────────────

async function seedCollections() {
  console.log('\n🎁 Seeding collections...');
  const defs = [
    { name: "Valentine's Day",  slug: 'valentines-day',  occasion: 'valentine',   sortOrder: 1 },
    { name: 'Birthday',         slug: 'birthday',        occasion: 'birthday',    sortOrder: 2 },
    { name: 'Anniversary',      slug: 'anniversary',     occasion: 'anniversary', sortOrder: 3 },
    { name: "Mother's Day",     slug: 'mothers-day',     occasion: 'mothers',     sortOrder: 4 },
    { name: "Father's Day",     slug: 'fathers-day',     occasion: 'fathers',     sortOrder: 5 },
    { name: 'Graduation',       slug: 'graduation',      occasion: 'graduation',  sortOrder: 6 },
    { name: 'Christmas',        slug: 'christmas',       occasion: 'christmas',   sortOrder: 7 },
    { name: 'Wedding',          slug: 'wedding',         occasion: 'wedding',     sortOrder: 8 },
    { name: 'New Baby',         slug: 'new-baby',        occasion: 'baby',        sortOrder: 9 },
    { name: 'Retirement',       slug: 'retirement',      occasion: 'retirement',  sortOrder: 10 },
  ];

  const ids: Record<string, string> = {};
  for (const def of defs) {
    const col = await prisma.collection.upsert({
      where:  { slug: def.slug },
      update: { occasion: def.occasion },
      create: { ...def, isActive: true },
    });
    ids[def.slug] = col.id;
    console.log(`  ✅ Collection: ${col.name}`);
  }
  return ids;
}

// ── STEP 4 — Sample products ──────────────────────────────────────────────────

async function seedProducts() {
  console.log('\n📦 Seeding products...');

  // Resolve category IDs by slug (legacy slugs still work as L2/L3 nodes)
  const categoryIds: Record<string, string | null> = {};
  const slugsNeeded = ['mugs', 'canvas', 'apparel', 'ornaments', 'accessories'];
  for (const s of slugsNeeded) {
    const cat = await prisma.category.findUnique({ where: { slug: s } });
    categoryIds[s] = cat?.id ?? null;
  }

  // Use first available category as fallback
  const fallback = Object.values(categoryIds).find(Boolean) ?? '';

  type VarDef  = { name: string; options: object; price: number; isDefault: boolean };
  type ProdDef = {
    name: string; slug: string; sku: string; description: string; shortDescription?: string;
    basePrice: number; compareAtPrice?: number; catSlug: string;
    isFeatured?: boolean; imageUrl: string; variants: VarDef[];
  };

  const products: ProdDef[] = [
    {
      name: 'Custom Name & Photo Coffee Mug', slug: 'custom-name-photo-mug', sku: 'MUG-001',
      description: 'Personalize this beautiful ceramic mug with your name and favorite photo. Dishwasher safe, microwave safe.',
      shortDescription: 'Custom ceramic mug with photo and name',
      basePrice: 27.99, compareAtPrice: 35.99, catSlug: 'mugs', isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=800&q=80',
      variants: [
        { name: '11oz White', options: { Size: '11oz', Color: 'White' }, price: 27.99, isDefault: true },
        { name: '15oz White', options: { Size: '15oz', Color: 'White' }, price: 32.99, isDefault: false },
        { name: '11oz Black', options: { Size: '11oz', Color: 'Black' }, price: 29.99, isDefault: false },
      ],
    },
    {
      name: 'Personalized Family Canvas Print', slug: 'personalized-canvas-print', sku: 'CAN-001',
      description: 'Create a stunning gallery-wrapped canvas print featuring your family photo. Ready to hang, premium quality.',
      shortDescription: 'Custom family photo canvas print',
      basePrice: 49.99, catSlug: 'canvas', isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=800&q=80',
      variants: [
        { name: '12×16"', options: { Size: '12x16' }, price: 49.99, isDefault: true },
        { name: '16×20"', options: { Size: '16x20' }, price: 69.99, isDefault: false },
        { name: '20×24"', options: { Size: '20x24' }, price: 89.99, isDefault: false },
      ],
    },
    {
      name: 'Monogram Insulated Tumbler', slug: 'monogram-tumbler', sku: 'TUM-001',
      description: 'Stainless steel insulated tumbler with laser-engraved monogram. Keeps drinks cold 24h, hot 12h.',
      shortDescription: 'Insulated tumbler with monogram',
      basePrice: 29.99, catSlug: 'mugs', isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=800&q=80',
      variants: [
        { name: '20oz', options: { Size: '20oz' }, price: 29.99, isDefault: true },
        { name: '30oz', options: { Size: '30oz' }, price: 34.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Photo Throw Pillow', slug: 'custom-photo-pillow', sku: 'PIL-001',
      description: 'Super soft throw pillow featuring your favorite photo. Premium sublimation printing, includes insert.',
      shortDescription: 'Custom photo throw pillow',
      basePrice: 34.99, compareAtPrice: 44.99, catSlug: 'accessories', isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&q=80',
      variants: [
        { name: '16×16"', options: { Size: '16x16' }, price: 34.99, isDefault: true },
        { name: '18×18"', options: { Size: '18x18' }, price: 39.99, isDefault: false },
        { name: '20×20"', options: { Size: '20x20' }, price: 44.99, isDefault: false },
      ],
    },
    {
      name: 'Personalized Tote Bag', slug: 'personalized-tote-bag', sku: 'TOT-001',
      description: 'Eco-friendly 12oz canvas tote bag with custom name, quote, or design. Reinforced handles.',
      shortDescription: 'Custom canvas tote bag',
      basePrice: 22.99, catSlug: 'accessories',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      variants: [
        { name: 'Natural', options: { Color: 'Natural' }, price: 22.99, isDefault: true },
        { name: 'Black',   options: { Color: 'Black'   }, price: 22.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Photo Ornament', slug: 'custom-photo-ornament', sku: 'ORN-001',
      description: 'Beautiful ceramic ornament with your photo and personalized text. Perfect holiday keepsake.',
      shortDescription: 'Personalized photo ornament',
      basePrice: 18.99, catSlug: 'ornaments',
      imageUrl: 'https://images.unsplash.com/photo-1512389098783-66b81f86e199?w=800&q=80',
      variants: [
        { name: 'Round', options: { Shape: 'Round' }, price: 18.99, isDefault: true },
        { name: 'Heart', options: { Shape: 'Heart' }, price: 18.99, isDefault: false },
        { name: 'Star',  options: { Shape: 'Star'  }, price: 18.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Name Hoodie', slug: 'custom-name-hoodie', sku: 'HOD-001',
      description: 'Cozy pullover hoodie with your custom name or text. 80/20 cotton-poly blend, true to size.',
      shortDescription: 'Personalized pullover hoodie',
      basePrice: 44.99, catSlug: 'apparel',
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
      shortDescription: 'Personalized family name sign',
      basePrice: 39.99, catSlug: 'accessories',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      variants: [
        { name: '12" Natural', options: { Size: '12in', Color: 'Natural' }, price: 39.99, isDefault: true  },
        { name: '18" Natural', options: { Size: '18in', Color: 'Natural' }, price: 54.99, isDefault: false },
      ],
    },
    {
      name: 'Pet Portrait Canvas', slug: 'pet-portrait-canvas', sku: 'PET-001',
      description: 'Turn your pet photo into a stunning watercolor-style canvas print. Gallery wrapped, ready to hang.',
      shortDescription: 'Custom pet portrait canvas',
      basePrice: 54.99, catSlug: 'canvas',
      imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      variants: [
        { name: '8×10" Watercolor',  options: { Size: '8x10',  Style: 'Watercolor' }, price: 54.99, isDefault: true  },
        { name: '12×16" Watercolor', options: { Size: '12x16', Style: 'Watercolor' }, price: 74.99, isDefault: false },
      ],
    },
    {
      name: 'Custom Birth Stats Print', slug: 'custom-birth-stats-print', sku: 'BRT-001',
      description: "Commemorative print with your baby's birth stats — name, date, weight, and height.",
      shortDescription: 'Personalized baby birth stats print',
      basePrice: 32.99, catSlug: 'canvas',
      imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
      variants: [
        { name: '8×10"',  options: { Size: '8x10'  }, price: 32.99, isDefault: true  },
        { name: '11×14"', options: { Size: '11x14' }, price: 42.99, isDefault: false },
      ],
    },
  ];

  const productIds: Record<string, string> = {};

  for (const def of products) {
    const { variants, imageUrl, catSlug, isFeatured = false, ...fields } = def;
    const categoryId = categoryIds[catSlug] ?? fallback;
    if (!categoryId) {
      console.warn(`  ⚠  Skipping ${def.name} — category '${catSlug}' not found`);
      continue;
    }

    const existing = await prisma.product.findUnique({ where: { slug: def.slug } });
    if (existing) {
      productIds[def.slug] = existing.id;
      console.log(`  ⏭  Product (exists): ${def.name}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        ...fields,
        categoryId,
        isFeatured,
        isPersonalizable: true,
        isActive:         true,
        processingDays:   3,
        variants: { create: variants.map((v, i) => ({ ...v, sortOrder: i })) },
        images:   { create: [{ url: imageUrl, isPrimary: true, sortOrder: 0 }] },
      },
    });
    productIds[def.slug] = product.id;
    console.log(`  ✅ Product: ${product.name}`);
  }

  return productIds;
}

// ── STEP 5 — Collection ↔ product links ───────────────────────────────────────

async function seedCollectionLinks(
  collectionIds: Record<string, string>,
  productIds:    Record<string, string>,
) {
  const links: Record<string, string[]> = {
    'valentines-day':  ['custom-name-photo-mug', 'custom-photo-pillow', 'personalized-canvas-print'],
    'birthday':        ['custom-name-photo-mug', 'monogram-tumbler', 'custom-birth-stats-print'],
    'anniversary':     ['personalized-canvas-print', 'family-name-sign', 'pet-portrait-canvas'],
    'mothers-day':     ['custom-photo-pillow', 'personalized-canvas-print', 'personalized-tote-bag'],
    'graduation':      ['custom-name-hoodie', 'monogram-tumbler', 'personalized-tote-bag'],
    'christmas':       ['custom-photo-ornament', 'family-name-sign', 'custom-name-photo-mug'],
  };

  for (const [colSlug, pSlugs] of Object.entries(links)) {
    const collectionId = collectionIds[colSlug];
    if (!collectionId) continue;
    for (let i = 0; i < pSlugs.length; i++) {
      const productId = productIds[pSlugs[i]];
      if (!productId) continue;
      await prisma.collectionProduct.upsert({
        where:  { collectionId_productId: { collectionId, productId } },
        update: {},
        create: { collectionId, productId, sortOrder: i },
      });
    }
  }
  console.log('  ✅ Collection ↔ product links');
}

// ── STEP 6 — MongoDB mega-menu documents ──────────────────────────────────────

async function seedMongoMenus() {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(`\n🍃 Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);

  try {
    await mongoose.connect(uri, { dbName: 'mapleloomhandmade' });
    console.log('  ✅ MongoDB connected');
  } catch (err) {
    console.warn(`  ⚠  MongoDB unavailable — skipping mega-menu seed (${(err as Error).message})`);
    return;
  }

  // Build mega-menu docs by querying the freshly-seeded PG category tree
  const navSlugs = [
    { navSlug: 'home-living', sortOrder: 2 },
    { navSlug: 'drink-barware', sortOrder: 3 },
    { navSlug: 'apparel', sortOrder: 4 },
    { navSlug: 'accessories', sortOrder: 5 },
    { navSlug: 'gifts', sortOrder: 1 },
  ];

  for (const { navSlug, sortOrder } of navSlugs) {
    const l1 = await prisma.category.findUnique({
      where:   { slug: navSlug },
      include: {
        children: {
          where:   { level: 2 },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: { where: { level: 3 }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!l1) {
      console.warn(`  ⚠  Category '${navSlug}' not found — skipping`);
      continue;
    }

    await CategoryMenuModel.findOneAndUpdate(
      { navSlug },
      {
        navLabel:   l1.name,
        navSlug,
        categoryId: l1.id,
        sortOrder,
        isVisible:  true,
        groups: l1.children.map((g, gi) => ({
          title:      g.name,
          categoryId: g.id,
          slug:       g.slug,
          sortOrder:  gi,
          items:      g.children.map((item, ii) => ({
            name:       item.name,
            categoryId: item.id,
            slug:       item.slug,
            sortOrder:  ii,
          })),
        })),
      },
      { upsert: true, new: true },
    );

    console.log(`  ✅ Mega-menu: ${l1.name} (${l1.children.length} groups)`);
  }

  await mongoose.disconnect();
  console.log('  ✅ MongoDB disconnected');
}

// ── STEP 7 — Promotions ───────────────────────────────────────────────────────

async function seedPromotions() {
  await prisma.promotion.upsert({
    where:  { code: 'WELCOME10' },
    update: {},
    create: { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, maxUsesPerUser: 1, isActive: true, description: '10% off your first order' },
  });
  await prisma.promotion.upsert({
    where:  { code: 'FREESHIP50' },
    update: {},
    create: { code: 'FREESHIP50', type: 'FREE_SHIPPING', value: 0, minOrderAmount: 50, maxUsesPerUser: 3, isActive: true, description: 'Free shipping on orders over $50' },
  });
  console.log('✅ Promotions seeded');
}

// ── STEP 8 — Shipping zones ───────────────────────────────────────────────────

async function seedShippingZones() {
  const usZone = await prisma.shippingZone.findFirst({ where: { name: 'United States' } });
  if (!usZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'United States', countries: ['US'],
        methods: { create: [
          { name: 'Standard (5-10 days)',  carrier: 'USPS',  price: 4.99,  freeShippingOver: 50, minDays: 5, maxDays: 10 },
          { name: 'Express (2-3 days)',    carrier: 'FedEx', price: 14.99, minDays: 2, maxDays: 3 },
          { name: 'Overnight',             carrier: 'UPS',   price: 29.99, minDays: 1, maxDays: 1 },
        ]},
      },
    });
    console.log('✅ Shipping zone: United States');
  }

  const intlZone = await prisma.shippingZone.findFirst({ where: { name: 'International' } });
  if (!intlZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'International', countries: ['CA','GB','AU','DE','FR','JP','SG','NZ'],
        methods: { create: [
          { name: 'Standard International (14-21 days)', carrier: 'USPS',  price: 19.99, minDays: 14, maxDays: 21 },
          { name: 'Express International (7-10 days)',   carrier: 'FedEx', price: 39.99, minDays: 7,  maxDays: 10 },
        ]},
      },
    });
    console.log('✅ Shipping zone: International');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  await seedAdmin();
  await seedCategories();
  const collectionIds = await seedCollections();
  const productIds    = await seedProducts();
  await seedCollectionLinks(collectionIds, productIds);
  await seedMongoMenus();
  await seedPromotions();
  await seedShippingZones();

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
