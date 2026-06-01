/**
 * Database seed script — PostgreSQL + MongoDB.
 *
 * Order of operations:
 *   1. Super admin user
 *   2. 3-level category tree (L1 nav tabs → L2 groups → L3 leaf items)
 *   3. Collections (occasion-based)
 *   4. Sample products (20 total)
 *   5. Collection ↔ product links
 *   6a. MongoDB mega-menu documents (derived from PG tree)
 *   6b. MongoDB ProductDetail documents
 *   7. Promotions
 *   8. Shipping zones
 *   9. Processing profiles
 *  10. Shipping profiles
 *  11. Shop sections
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import mongoose, { Schema, model, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

// Prisma 7 `prisma db seed` does NOT inject `.env` into the seed child process.
// Load it ourselves — use import.meta.url so the path is always correct regardless of CWD.
if (!process.env['DATABASE_URL']) {
  try {
    // seed.ts lives in prisma/, so .env is one level up
    const seedDir  = dirname(fileURLToPath((import.meta as { url: string }).url));
    const envPath  = resolve(seedDir, '..', '.env');
    const lines    = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (v) process.env[m[1]] = v;
    }
  } catch (e) {
    console.warn('  ⚠  Could not load .env:', (e as Error).message);
  }
}

// Schema has no `url` in datasource — Prisma 7 requires the adapter when no url is configured.
// SSL is needed for Railway/cloud PostgreSQL; omit only when URL explicitly sets sslmode=disable.
const dbUrl = process.env['DATABASE_URL'] ?? '';
if (!dbUrl) throw new Error('DATABASE_URL is not set. Create a .env file at the workspace root.');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── MongoDB CategoryMenu schema ────────────────────────────────────────────────

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
  {
    name: String,
    categoryId: String,
    slug: String,
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const menuGroupSchema = new Schema<IMenuGroup>(
  {
    title: String,
    categoryId: String,
    slug: String,
    items: [menuItemSchema],
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const categoryMenuSchema = new Schema<ICategoryMenu>(
  {
    navLabel: { type: String, required: true, unique: true },
    navSlug: { type: String, required: true, unique: true },
    categoryId: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    iconUrl: String,
    groups: [menuGroupSchema],
  },
  { collection: 'category_menus', timestamps: true },
);

let CategoryMenuModel: Model<ICategoryMenu>;
try {
  CategoryMenuModel = mongoose.model<ICategoryMenu>('CategoryMenu');
} catch {
  CategoryMenuModel = model<ICategoryMenu>('CategoryMenu', categoryMenuSchema);
}

// ── MongoDB ProductDetail schema ───────────────────────────────────────────────

interface IProductDetail {
  productId: string;
  attributes: {
    key: string;
    value: string;
    filterable: boolean;
    unit?: string;
  }[];
  variantOptions: { name: string; values: string[] }[];
  richDescription?: string;
  printSpecs?: {
    minDPI: number;
    maxFileSize: number;
    acceptedFormats: string[];
  };
  /** Bundle/single-item customization config — stored in MongoDB for flexible schema */
  customization?: object;
}

const productDetailSchema = new Schema<IProductDetail>(
  {
    productId: { type: String, required: true, unique: true, index: true },
    attributes: [
      {
        key: String,
        value: String,
        filterable: Boolean,
        unit: String,
        _id: false,
      },
    ],
    variantOptions: [{ name: String, values: [String], _id: false }],
    richDescription: String,
    printSpecs: {
      minDPI: Number,
      maxFileSize: Number,
      acceptedFormats: [String],
    },
    customization: { type: Object, default: undefined },
  },
  { collection: 'product_details', timestamps: true },
);

let ProductDetailModel: Model<IProductDetail>;
try {
  ProductDetailModel = mongoose.model<IProductDetail>('ProductDetail');
} catch {
  ProductDetailModel = model<IProductDetail>(
    'ProductDetail',
    productDetailSchema,
  );
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

type UpsertArgs = {
  name: string;
  s?: string;
  level: number;
  parentId?: string;
  sortOrder?: number;
  description?: string;
};
async function upsertCategory(args: UpsertArgs) {
  const { name, s, level, parentId, sortOrder = 0, description } = args;
  const sl = s ?? slug(name);
  return prisma.category.upsert({
    where: { slug: sl },
    update: { level, ...(parentId ? { parentId } : {}), sortOrder },
    create: {
      name,
      slug: sl,
      level,
      parentId: parentId ?? null,
      sortOrder,
      description,
    },
  });
}

async function seedL3Items(parentId: string, names: string[]) {
  for (let i = 0; i < names.length; i++) {
    await upsertCategory({
      name: names[i],
      level: 3,
      parentId,
      sortOrder: i + 1,
    });
  }
}

// ── STEP 1 — Admin user ───────────────────────────────────────────────────────

async function seedAdmin() {
  const hash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mapleloomhandmade.com' },
    update: {},
    create: {
      email: 'admin@mapleloomhandmade.com',
      passwordHash: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
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
    gifts: await upsertCategory({ name: 'Gifts', level: 1, sortOrder: 1 }),
    homeLiving: await upsertCategory({
      name: 'Home & Living',
      s: 'home-living',
      level: 1,
      sortOrder: 2,
    }),
    drinkBarware: await upsertCategory({
      name: 'Drink & Barware',
      s: 'drink-barware',
      level: 1,
      sortOrder: 3,
    }),
    apparel: await upsertCategory({ name: 'Apparel', level: 1, sortOrder: 4 }),
    accessories: await upsertCategory({
      name: 'Accessories',
      level: 1,
      sortOrder: 5,
    }),
    interests: await upsertCategory({
      name: 'Interests',
      level: 1,
      sortOrder: 6,
    }),
  };

  for (const v of Object.values(L1)) console.log(`  ✅ L1 ${v.name}`);

  // ── L2 Groups ──────────────────────────────────────────────────────────────

  const homeLivingGroups = {
    bedBath: await upsertCategory({
      name: 'Bed & Bath',
      s: 'bed-bath',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 1,
    }),
    christmasOrnaments: await upsertCategory({
      name: 'Christmas Ornaments',
      s: 'christmas-ornaments',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 2,
    }),
    floorRugs: await upsertCategory({
      name: 'Floor & Rugs',
      s: 'floor-rugs',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 3,
    }),
    framesDisplays: await upsertCategory({
      name: 'Frames and Displays',
      s: 'frames-displays',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 4,
    }),
    hangingDecoration: await upsertCategory({
      name: 'Hanging Decoration',
      s: 'hanging-decoration',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 5,
    }),
    jewelryStorage: await upsertCategory({
      name: 'Jewelry Storage',
      s: 'jewelry-storage',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 6,
    }),
    kitchenDining: await upsertCategory({
      name: 'Kitchen & Dining',
      s: 'kitchen-dining',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 7,
    }),
    lighting: await upsertCategory({
      name: 'Lighting',
      s: 'lighting',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 8,
    }),
    outdoorGardening: await upsertCategory({
      name: 'Outdoor & Gardening',
      s: 'outdoor-gardening',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 9,
    }),
    wallDecor: await upsertCategory({
      name: 'Wall Decor',
      s: 'wall-decor',
      level: 2,
      parentId: L1.homeLiving.id,
      sortOrder: 10,
    }),
  };

  const drinkGroups = {
    mugs: await upsertCategory({
      name: 'Mugs',
      s: 'mugs',
      level: 2,
      parentId: L1.drinkBarware.id,
      sortOrder: 1,
    }),
    tumblers: await upsertCategory({
      name: 'Tumblers',
      s: 'tumblers',
      level: 2,
      parentId: L1.drinkBarware.id,
      sortOrder: 2,
    }),
    glasses: await upsertCategory({
      name: 'Glasses',
      s: 'glasses',
      level: 2,
      parentId: L1.drinkBarware.id,
      sortOrder: 3,
    }),
    coastersBar: await upsertCategory({
      name: 'Coasters & Bar',
      s: 'coasters-bar',
      level: 2,
      parentId: L1.drinkBarware.id,
      sortOrder: 4,
    }),
  };

  const apparelGroups = {
    tshirtsTops: await upsertCategory({
      name: 'T-Shirts & Tops',
      s: 't-shirts-tops',
      level: 2,
      parentId: L1.apparel.id,
      sortOrder: 1,
    }),
    outerwear: await upsertCategory({
      name: 'Outerwear',
      s: 'outerwear',
      level: 2,
      parentId: L1.apparel.id,
      sortOrder: 2,
    }),
    kidsBaby: await upsertCategory({
      name: 'Kids & Baby',
      s: 'kids-baby',
      level: 2,
      parentId: L1.apparel.id,
      sortOrder: 3,
    }),
  };

  const accessoriesGroups = {
    bagsTotes: await upsertCategory({
      name: 'Bags & Totes',
      s: 'bags-totes',
      level: 2,
      parentId: L1.accessories.id,
      sortOrder: 1,
    }),
    jewelry: await upsertCategory({
      name: 'Jewelry',
      s: 'jewelry',
      level: 2,
      parentId: L1.accessories.id,
      sortOrder: 2,
    }),
    techAccessories: await upsertCategory({
      name: 'Tech Accessories',
      s: 'tech-accessories',
      level: 2,
      parentId: L1.accessories.id,
      sortOrder: 3,
    }),
  };

  const giftsGroups = {
    forHer: await upsertCategory({
      name: 'For Her',
      s: 'for-her',
      level: 2,
      parentId: L1.gifts.id,
      sortOrder: 1,
    }),
    forHim: await upsertCategory({
      name: 'For Him',
      s: 'for-him',
      level: 2,
      parentId: L1.gifts.id,
      sortOrder: 2,
    }),
    forKids: await upsertCategory({
      name: 'For Kids',
      s: 'for-kids',
      level: 2,
      parentId: L1.gifts.id,
      sortOrder: 3,
    }),
    forPets: await upsertCategory({
      name: 'For Pets',
      s: 'for-pets',
      level: 2,
      parentId: L1.gifts.id,
      sortOrder: 4,
    }),
  };

  console.log('  ✅ L2 groups created');

  // ── L3 Leaf items ──────────────────────────────────────────────────────────

  // Bed & Bath
  await seedL3Items(homeLivingGroups.bedBath.id, [
    'Blankets',
    'Laundry Storage Basket',
    'Pillows',
    'Quilt Sets',
    'Wearable Blanket Hoodies',
  ]);
  // FIX 4: Throw Pillows — required by catSlug 'throw-pillows'
  await upsertCategory({
    name: 'Throw Pillows',
    s: 'throw-pillows',
    level: 3,
    parentId: homeLivingGroups.bedBath.id,
    sortOrder: 6,
  });

  // Christmas Ornaments
  await upsertCategory({
    name: 'Acrylic Ornaments',
    s: 'acrylic-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 1,
  });
  await upsertCategory({
    name: 'Aluminum Ornaments',
    s: 'aluminum-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 2,
  });
  await upsertCategory({
    name: 'Ceramic Ornaments',
    s: 'ceramic-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 3,
  });
  await upsertCategory({
    name: 'Glass Ornaments',
    s: 'glass-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 4,
  });
  await upsertCategory({
    name: 'Suncatcher Ornaments',
    s: 'suncatcher-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 5,
  });
  await upsertCategory({
    name: 'Wooden Ornaments',
    s: 'wooden-ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 6,
  });
  // 'ornaments' legacy slug — Photo Ornaments L3
  await upsertCategory({
    name: 'Photo Ornaments',
    s: 'ornaments',
    level: 3,
    parentId: homeLivingGroups.christmasOrnaments.id,
    sortOrder: 7,
  });

  // Floor & Rugs
  await seedL3Items(homeLivingGroups.floorRugs.id, [
    'Christmas Tree Skirts',
    'Doormats',
    'Runner Rugs',
  ]);

  // Frames and Displays — includes 'acrylic-plaques'
  await seedL3Items(homeLivingGroups.framesDisplays.id, [
    'Acrylic Plaques',
    'Acrylic Desk Clocks',
    'Ceramic Flower Vases',
    'Ceramic Plates',
    'Family Puzzles',
  ]);

  // Hanging Decoration
  await seedL3Items(homeLivingGroups.hangingDecoration.id, [
    'Magnets',
    'Suncatchers',
    'Wine Bottle Wind Chimes',
    'Wood Signs',
  ]);

  // Jewelry Storage
  await seedL3Items(homeLivingGroups.jewelryStorage.id, [
    'Jewelry Dishes',
    'Jewelry Boxes',
    'Leather Valet Trays',
    'Makeup Boxes With LED Mirror',
  ]);

  // Kitchen & Dining — includes 'cutting-boards'
  await seedL3Items(homeLivingGroups.kitchenDining.id, [
    'Cookie Jars',
    'Cutting Boards',
    'Oven Mitts And Pot Holders',
    'Platters',
    'Tea And Biscuit Boards',
  ]);

  // Lighting
  await seedL3Items(homeLivingGroups.lighting.id, [
    'Bottle Lamps',
    'Fabric Lamps',
    'LED Candles',
    'LED Night Light',
    'Mason Jar Lights',
    'Vintage Lantern Night Lights',
  ]);

  // Outdoor & Gardening
  await seedL3Items(homeLivingGroups.outdoorGardening.id, [
    'Ceramic Plant Pots',
    'Door Corner Wood Signs',
    'Garden Stakes',
    'Indoor Watering Cans',
    'Metal Signs',
    'Solar Lights',
    'Wind Chimes',
  ]);

  // Wall Decor — 'canvas' and 'wood-acrylic-art' live here
  await upsertCategory({
    name: 'Posters / Canvas',
    s: 'canvas',
    level: 3,
    parentId: homeLivingGroups.wallDecor.id,
    sortOrder: 1,
  });
  await upsertCategory({
    name: 'Key Holders',
    s: 'key-holders',
    level: 3,
    parentId: homeLivingGroups.wallDecor.id,
    sortOrder: 2,
  });
  await upsertCategory({
    name: 'Wood And Acrylic Wall Art',
    s: 'wood-acrylic-art',
    level: 3,
    parentId: homeLivingGroups.wallDecor.id,
    sortOrder: 3,
  });

  // Drink L3 — 'coffee-mugs', 'stainless-steel-tumblers', 'wine-glasses'
  await seedL3Items(drinkGroups.mugs.id, [
    'Coffee Mugs',
    'Photo Mugs',
    'Travel Mugs',
    'Enamel Mugs',
  ]);
  await seedL3Items(drinkGroups.tumblers.id, [
    'Stainless Steel Tumblers',
    'Glass Tumblers',
    'Sports Bottles',
  ]);
  await seedL3Items(drinkGroups.glasses.id, [
    'Wine Glasses',
    'Beer Glasses',
    'Champagne Flutes',
    'Shot Glasses',
  ]);
  await seedL3Items(drinkGroups.coastersBar.id, [
    'Coaster Sets',
    'Bottle Openers',
    'Wine Racks',
    'Beer Steins',
  ]);

  // Apparel L3 — 'classic-tees', 'hoodies', 'onesies'
  await seedL3Items(apparelGroups.tshirtsTops.id, [
    'Classic Tees',
    'V-Neck Tees',
    'Long Sleeve Shirts',
    'Tank Tops',
  ]);
  await upsertCategory({
    name: 'Hoodies',
    s: 'hoodies',
    level: 3,
    parentId: apparelGroups.outerwear.id,
    sortOrder: 1,
  });
  await upsertCategory({
    name: 'Zip-Up Hoodies',
    s: 'zip-hoodies',
    level: 3,
    parentId: apparelGroups.outerwear.id,
    sortOrder: 2,
  });
  await upsertCategory({
    name: 'Sweatshirts',
    s: 'sweatshirts',
    level: 3,
    parentId: apparelGroups.outerwear.id,
    sortOrder: 3,
  });
  await upsertCategory({
    name: 'Bomber Jackets',
    s: 'bomber-jackets',
    level: 3,
    parentId: apparelGroups.outerwear.id,
    sortOrder: 4,
  });
  await seedL3Items(apparelGroups.kidsBaby.id, [
    'Onesies',
    'Kids T-Shirts',
    'Baby Bibs',
    'Baby Blankets',
  ]);

  // Accessories L3 — 'tote-bags', 'keychains', 'phone-cases'
  await seedL3Items(accessoriesGroups.bagsTotes.id, [
    'Tote Bags',
    'Backpacks',
    'Drawstring Bags',
    'Fanny Packs',
  ]);
  await seedL3Items(accessoriesGroups.jewelry.id, [
    'Necklaces',
    'Bracelets',
    'Keychains',
    'Rings',
  ]);
  await seedL3Items(accessoriesGroups.techAccessories.id, [
    'Phone Cases',
    'Mouse Pads',
    'Laptop Sleeves',
    'AirPod Cases',
  ]);

  // Gifts L3
  await seedL3Items(giftsGroups.forHer.id, [
    'Jewelry And Accessories',
    'Home Decor',
    'Beauty And Wellness',
  ]);
  await seedL3Items(giftsGroups.forHim.id, [
    'Drinkware',
    'Tech Accessories',
    'Outdoor',
  ]);
  await seedL3Items(giftsGroups.forKids.id, [
    'Toys And Games',
    'Clothing',
    'Room Decor',
  ]);
  await seedL3Items(giftsGroups.forPets.id, [
    'Pet Portraits',
    'Pet Tags',
    'Pet Clothing',
  ]);

  console.log('  ✅ L3 leaf items created');

  return {
    L1,
    homeLivingGroups,
    drinkGroups,
    apparelGroups,
    accessoriesGroups,
    giftsGroups,
  };
}

// ── STEP 3 — Occasion-based collections ──────────────────────────────────────

async function seedCollections() {
  console.log('\n🎁 Seeding collections...');
  const defs = [
    {
      name: "Valentine's Day",
      slug: 'valentines-day',
      occasion: 'valentine',
      sortOrder: 1,
    },
    { name: 'Birthday', slug: 'birthday', occasion: 'birthday', sortOrder: 2 },
    {
      name: 'Anniversary',
      slug: 'anniversary',
      occasion: 'anniversary',
      sortOrder: 3,
    },
    {
      name: "Mother's Day",
      slug: 'mothers-day',
      occasion: 'mothers',
      sortOrder: 4,
    },
    {
      name: "Father's Day",
      slug: 'fathers-day',
      occasion: 'fathers',
      sortOrder: 5,
    },
    {
      name: 'Graduation',
      slug: 'graduation',
      occasion: 'graduation',
      sortOrder: 6,
    },
    {
      name: 'Christmas',
      slug: 'christmas',
      occasion: 'christmas',
      sortOrder: 7,
    },
    { name: 'Wedding', slug: 'wedding', occasion: 'wedding', sortOrder: 8 },
    { name: 'New Baby', slug: 'new-baby', occasion: 'baby', sortOrder: 9 },
    {
      name: 'Retirement',
      slug: 'retirement',
      occasion: 'retirement',
      sortOrder: 10,
    },
  ];

  const ids: Record<string, string> = {};
  for (const def of defs) {
    const col = await prisma.collection.upsert({
      where: { slug: def.slug },
      update: { occasion: def.occasion },
      create: { ...def, isActive: true },
    });
    ids[def.slug] = col.id;
    console.log(`  ✅ Collection: ${col.name}`);
  }
  return ids;
}

// ── STEP 4 — Sample products (20 total) ──────────────────────────────────────

async function seedProducts() {
  console.log('\n📦 Seeding products...');

  const slugsNeeded = [
    'coffee-mugs',
    'canvas',
    'stainless-steel-tumblers',
    'throw-pillows',
    'tote-bags',
    'ornaments',
    'hoodies',
    'wood-acrylic-art',
    'cutting-boards',
    'phone-cases',
    'wine-glasses',
    'classic-tees',
    'keychains',
    'onesies',
    'acrylic-plaques',
  ];

  const categoryIds: Record<string, string | null> = {};
  for (const s of slugsNeeded) {
    const cat = await prisma.category.findUnique({ where: { slug: s } });
    categoryIds[s] = cat?.id ?? null;
  }

  // Look up default profiles + sections seeded before products
  const defaultProcessingProfile = await prisma.processingProfile.findFirst({ where: { isDefault: true } });
  const defaultShippingProfile   = await prisma.shippingProfile.findFirst({ where: { isDefault: true } });
  const sections = await prisma.shopSection.findMany();
  const sectionMap = Object.fromEntries(sections.map((s) => [s.name, s.id]));

  type VarDef = { name: string; options: object; price: number; isDefault: boolean };
  type ProdDef = {
    name: string;
    slug: string;
    sku: string;
    description: string;
    shortDescription?: string;
    basePrice: number;
    compareAtPrice?: number;
    catSlug: string;
    isFeatured?: boolean;
    /** false = direct add-to-cart (no digital customizer). Defaults true. */
    isPersonalizable?: boolean;
    imageUrl: string;
    variants: VarDef[];
    // ── New schema fields ──────────────────────────────────────────────────────
    shopSection?: string;             // matches ShopSection.name
    materials?: string[];
    primaryColors?: string[];
    secondaryColors?: string[];
    occasions?: string[];
    holidayTags?: string[];
    recipientTags?: string[];
    styles?: string[];
    sustainability?: string[];
    whoMadeIt?: 'I_DID' | 'SHOP_MEMBER' | 'ANOTHER_COMPANY';
    howItWasMade?: 'MADE_TO_ORDER' | 'HANDMADE' | 'ASSEMBLED' | 'ALTERED' | 'CURATED_SET' | 'NATURAL_MATERIAL';
    returnPolicy?: 'NO_RETURNS' | 'RETURNS_ACCEPTED' | 'EXCHANGES_ONLY';
    toolsUsed?: string[];
  };

  const products: ProdDef[] = [
    // ── 1 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Name & Photo Coffee Mug',
      slug: 'custom-name-photo-mug',
      sku: 'MUG-001',
      description:
        'Personalize this beautiful ceramic mug with your name and favorite photo. Dishwasher safe, microwave safe.',
      shortDescription: 'Custom ceramic mug with photo and name',
      basePrice: 27.99,
      compareAtPrice: 35.99,
      catSlug: 'coffee-mugs',
      isFeatured: true,
      shopSection: 'Mugs & Drinkware',
      materials: ['Ceramic'],
      primaryColors: ['White'],
      occasions: ['Birthday', 'Anniversary', "Mother's Day"],
      recipientTags: ['Her', 'Him', 'Couple'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl:
        'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=800&q=80',
      variants: [
        { name: '11oz White', options: { Size: '11oz', Color: 'White' }, price: 27.99, isDefault: true  },
        { name: '15oz White', options: { Size: '15oz', Color: 'White' }, price: 32.99, isDefault: false },
        { name: '11oz Black', options: { Size: '11oz', Color: 'Black' }, price: 29.99, isDefault: false },
      ],
    },
    // ── 2 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Personalized Family Canvas Print',
      slug: 'personalized-canvas-print',
      sku: 'CAN-001',
      description: 'Create a stunning gallery-wrapped canvas print featuring your family photo. Ready to hang, premium quality.',
      shortDescription: 'Custom family photo canvas print',
      basePrice: 49.99,
      catSlug: 'canvas',
      isFeatured: true,
      shopSection: 'Wall Art & Canvas',
      materials: ['Canvas'],
      occasions: ['Anniversary', 'Housewarming', 'Wedding'],
      recipientTags: ['Couple', 'Her', 'Him'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=800&q=80',
      variants: [
        { name: '12×16"', options: { Size: '12x16' }, price: 49.99, isDefault: true  },
        { name: '16×20"', options: { Size: '16x20' }, price: 69.99, isDefault: false },
        { name: '20×24"', options: { Size: '20x24' }, price: 89.99, isDefault: false },
      ],
    },
    // ── 3 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Monogram Insulated Tumbler',
      slug: 'monogram-tumbler',
      sku: 'TUM-001',
      description: 'Stainless steel insulated tumbler with laser-engraved monogram. Keeps drinks cold 24h, hot 12h.',
      shortDescription: 'Insulated tumbler with monogram',
      basePrice: 29.99,
      catSlug: 'stainless-steel-tumblers',
      isFeatured: true,
      shopSection: 'Mugs & Drinkware',
      materials: ['Stainless Steel'],
      primaryColors: ['Silver'],
      occasions: ['Birthday', 'Graduation'],
      recipientTags: ['Her', 'Him', 'Men', 'Women'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=800&q=80',
      variants: [
        { name: '20oz', options: { Size: '20oz' }, price: 29.99, isDefault: true  },
        { name: '30oz', options: { Size: '30oz' }, price: 34.99, isDefault: false },
      ],
    },
    // ── 4 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Photo Throw Pillow',
      slug: 'custom-photo-pillow',
      sku: 'PIL-001',
      description: 'Super soft throw pillow featuring your favorite photo. Premium sublimation printing, includes insert.',
      shortDescription: 'Custom photo throw pillow',
      basePrice: 34.99,
      compareAtPrice: 44.99,
      catSlug: 'throw-pillows',
      isFeatured: true,
      shopSection: 'Home Decor',
      materials: ['Polyester'],
      primaryColors: ['Multi'],
      occasions: ['Housewarming', 'Birthday'],
      recipientTags: ['Her', 'Couple'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&q=80',
      variants: [
        { name: '16×16"', options: { Size: '16x16' }, price: 34.99, isDefault: true  },
        { name: '18×18"', options: { Size: '18x18' }, price: 39.99, isDefault: false },
        { name: '20×20"', options: { Size: '20x20' }, price: 44.99, isDefault: false },
      ],
    },
    // ── 5 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Personalized Tote Bag',
      slug: 'personalized-tote-bag',
      sku: 'TOT-001',
      description: 'Eco-friendly 12oz canvas tote bag with custom name, quote, or design. Reinforced handles.',
      shortDescription: 'Custom canvas tote bag',
      basePrice: 22.99,
      catSlug: 'tote-bags',
      materials: ['Canvas'],
      primaryColors: ['Beige'],
      occasions: ['Birthday', 'Just Because'],
      recipientTags: ['Her', 'Women', 'Best Friend'],
      sustainability: ['Made from natural materials'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      variants: [
        { name: 'Natural', options: { Color: 'Natural' }, price: 22.99, isDefault: true  },
        { name: 'Black',   options: { Color: 'Black'   }, price: 22.99, isDefault: false },
      ],
    },
    // ── 6 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Photo Ornament',
      slug: 'custom-photo-ornament',
      sku: 'ORN-001',
      description: 'Beautiful ceramic ornament with your photo and personalized text. Perfect holiday keepsake.',
      shortDescription: 'Personalized photo ornament',
      basePrice: 18.99,
      catSlug: 'ornaments',
      materials: ['Ceramic'],
      primaryColors: ['White'],
      occasions: ['Christmas'],
      holidayTags: ['Christmas'],
      recipientTags: ['Grandparents', 'Kids'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1512389098783-66b81f86e199?w=800&q=80',
      variants: [
        { name: 'Round', options: { Shape: 'Round' }, price: 18.99, isDefault: true  },
        { name: 'Heart', options: { Shape: 'Heart' }, price: 18.99, isDefault: false },
        { name: 'Star',  options: { Shape: 'Star'  }, price: 18.99, isDefault: false },
      ],
    },
    // ── 7 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Name Hoodie',
      slug: 'custom-name-hoodie',
      sku: 'HOD-001',
      description: 'Cozy pullover hoodie with your custom name or text. 80/20 cotton-poly blend, true to size.',
      shortDescription: 'Personalized pullover hoodie',
      basePrice: 44.99,
      catSlug: 'hoodies',
      shopSection: 'Apparel',
      materials: ['Cotton', 'Polyester'],
      primaryColors: ['Black'],
      occasions: ['Birthday', 'Celebration'],
      recipientTags: ['Him', 'Her', 'Teen', 'Men', 'Women'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80',
      variants: [
        { name: 'S/Black',  options: { Size: 'S',  Color: 'Black' }, price: 44.99, isDefault: false },
        { name: 'M/Black',  options: { Size: 'M',  Color: 'Black' }, price: 44.99, isDefault: true  },
        { name: 'L/Black',  options: { Size: 'L',  Color: 'Black' }, price: 44.99, isDefault: false },
        { name: 'XL/Black', options: { Size: 'XL', Color: 'Black' }, price: 44.99, isDefault: false },
      ],
    },
    // ── 8 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Family Name Sign',
      slug: 'family-name-sign',
      sku: 'SIG-001',
      description: 'Elegant solid wood sign engraved with your family name and established date. Ready to hang.',
      shortDescription: 'Personalized family name sign',
      basePrice: 39.99,
      catSlug: 'wood-acrylic-art',
      shopSection: 'Home Decor',
      materials: ['Wood'],
      primaryColors: ['Brown'],
      occasions: ['Housewarming', 'Wedding', 'Anniversary'],
      recipientTags: ['Couple', 'Her', 'Him'],
      sustainability: ['Made from natural materials'],
      styles: ['Rustic', 'Farmhouse'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      variants: [
        { name: '12" Natural', options: { Size: '12in', Color: 'Natural' }, price: 39.99, isDefault: true  },
        { name: '18" Natural', options: { Size: '18in', Color: 'Natural' }, price: 54.99, isDefault: false },
      ],
    },
    // ── 9 ─────────────────────────────────────────────────────────────────────
    {
      name: 'Pet Portrait Canvas',
      slug: 'pet-portrait-canvas',
      sku: 'PET-001',
      description: 'Turn your pet photo into a stunning watercolor-style canvas print. Gallery wrapped, ready to hang.',
      shortDescription: 'Custom pet portrait canvas',
      basePrice: 54.99,
      catSlug: 'canvas',
      shopSection: 'Wall Art & Canvas',
      materials: ['Canvas'],
      occasions: ['Birthday', 'Just Because'],
      recipientTags: ['Pet Owners', 'Her', 'Him'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      variants: [
        { name: '8×10" Watercolor',  options: { Size: '8x10',  Style: 'Watercolor' }, price: 54.99, isDefault: true  },
        { name: '12×16" Watercolor', options: { Size: '12x16', Style: 'Watercolor' }, price: 74.99, isDefault: false },
      ],
    },
    // ── 10 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Birth Stats Print',
      slug: 'custom-birth-stats-print',
      sku: 'BRT-001',
      description: "Commemorative print with your baby's birth stats — name, date, weight, and height.",
      shortDescription: 'Personalized baby birth stats print',
      basePrice: 32.99,
      catSlug: 'canvas',
      shopSection: 'Wall Art & Canvas',
      materials: ['Canvas'],
      primaryColors: ['Beige'],
      occasions: ['Baby Shower'],
      recipientTags: ['Baby', 'Kids', 'Her'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
      variants: [
        { name: '8×10"',  options: { Size: '8x10'  }, price: 32.99, isDefault: true  },
        { name: '11×14"', options: { Size: '11x14' }, price: 42.99, isDefault: false },
      ],
    },
    // ── 11 ────────────────────────────────────────────────────────────────────
    {
      name: 'Personalized Cutting Board',
      slug: 'personalized-cutting-board',
      sku: 'CUT-001',
      description: 'Bamboo cutting board laser-engraved with your family name and established year. Food safe finish, juice groove.',
      shortDescription: 'Custom engraved bamboo cutting board',
      basePrice: 44.99,
      compareAtPrice: 54.99,
      catSlug: 'cutting-boards',
      isPersonalizable: false,
      shopSection: 'Home Decor',
      materials: ['Bamboo'],
      primaryColors: ['Brown'],
      occasions: ['Housewarming', 'Wedding', 'Anniversary'],
      recipientTags: ['Couple', 'Her'],
      sustainability: ['Made from natural materials'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
      variants: [
        { name: 'Small 8×6',  options: { Size: 'Small (8×6")'  }, price: 44.99, isDefault: true  },
        { name: 'Large 12×8', options: { Size: 'Large (12×8")' }, price: 64.99, isDefault: false },
      ],
    },
    // ── 12 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Photo Phone Case',
      slug: 'custom-photo-phone-case',
      sku: 'PHN-001',
      description: 'Slim hard shell phone case printed with your photo. Available for iPhone 14/15 and Samsung Galaxy.',
      shortDescription: 'Custom photo phone case',
      basePrice: 19.99,
      catSlug: 'phone-cases',
      materials: ['Acrylic'],
      occasions: ['Birthday', 'Just Because'],
      recipientTags: ['Him', 'Her', 'Teen'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1586953208270-7a3b38c26e33?w=800&q=80',
      variants: [
        { name: 'iPhone 15',     options: { Model: 'iPhone 15'     }, price: 19.99, isDefault: true  },
        { name: 'iPhone 15 Pro', options: { Model: 'iPhone 15 Pro' }, price: 19.99, isDefault: false },
        { name: 'iPhone 14',     options: { Model: 'iPhone 14'     }, price: 19.99, isDefault: false },
        { name: 'Samsung S24',   options: { Model: 'Samsung S24'   }, price: 19.99, isDefault: false },
      ],
    },
    // ── 13 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Anniversary Map Print',
      slug: 'anniversary-map-print',
      sku: 'MAP-001',
      description: 'A beautiful star map or city map from the night of your special date. Gallery-wrap canvas, ready to hang.',
      shortDescription: 'Personalized anniversary map canvas',
      basePrice: 59.99,
      compareAtPrice: 74.99,
      catSlug: 'canvas',
      isFeatured: true,
      shopSection: 'Wall Art & Canvas',
      materials: ['Canvas'],
      occasions: ['Anniversary', 'Wedding', "Valentine's Day"],
      holidayTags: ["Valentine's Day"],
      recipientTags: ['Couple', 'Her', 'Him', 'Wife', 'Husband'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80',
      variants: [
        { name: '12×16" Canvas', options: { Size: '12×16"', Type: 'Canvas' }, price: 59.99, isDefault: true  },
        { name: '12×16" Framed', options: { Size: '12×16"', Type: 'Framed' }, price: 79.99, isDefault: false },
      ],
    },
    // ── 14 ────────────────────────────────────────────────────────────────────
    {
      name: 'Couples Mug Set',
      slug: 'couples-mug-set',
      sku: 'MUG-002',
      description: 'Set of two matching ceramic mugs personalized with your names and a special date. Dishwasher and microwave safe.',
      shortDescription: 'Matching couples mug set',
      basePrice: 49.99,
      compareAtPrice: 59.99,
      catSlug: 'coffee-mugs',
      shopSection: 'Mugs & Drinkware',
      materials: ['Ceramic'],
      primaryColors: ['White'],
      occasions: ['Anniversary', 'Wedding', "Valentine's Day"],
      holidayTags: ["Valentine's Day"],
      recipientTags: ['Couple', 'Wife', 'Husband'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80',
      variants: [
        { name: '2×11oz', options: { Size: '2 × 11oz' }, price: 49.99, isDefault: true  },
        { name: '2×15oz', options: { Size: '2 × 15oz' }, price: 59.99, isDefault: false },
      ],
    },
    // ── 15 ────────────────────────────────────────────────────────────────────
    {
      name: 'Personalized Wine Glass',
      slug: 'personalized-wine-glass',
      sku: 'WIN-001',
      description: 'Elegant stemmed wine glass with custom name or message laser-etched. Perfect wedding or housewarming gift.',
      shortDescription: 'Custom engraved wine glass',
      basePrice: 24.99,
      catSlug: 'wine-glasses',
      isPersonalizable: false,
      shopSection: 'Mugs & Drinkware',
      materials: ['Glass'],
      primaryColors: ['Clear'],
      occasions: ['Wedding', 'Housewarming', 'Anniversary'],
      recipientTags: ['Couple', 'Her', 'Him'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
      variants: [
        { name: '15oz Clear',    options: { Size: '15oz', Color: 'Clear'    }, price: 24.99, isDefault: true  },
        { name: '15oz Stemless', options: { Size: '15oz', Style: 'Stemless' }, price: 22.99, isDefault: false },
      ],
    },
    // ── 16 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Family Reunion T-Shirt',
      slug: 'custom-family-reunion-tshirt',
      sku: 'TEE-001',
      description: 'Soft 100% cotton t-shirt with custom family name and year on the back. Great for family events.',
      shortDescription: 'Custom family reunion tee',
      basePrice: 24.99,
      catSlug: 'classic-tees',
      shopSection: 'Apparel',
      materials: ['Cotton'],
      primaryColors: ['White'],
      occasions: ['Celebration'],
      recipientTags: ['Men', 'Women', 'Kids'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
      variants: [
        { name: 'S/White',  options: { Size: 'S',  Color: 'White' }, price: 24.99, isDefault: false },
        { name: 'M/White',  options: { Size: 'M',  Color: 'White' }, price: 24.99, isDefault: true  },
        { name: 'L/White',  options: { Size: 'L',  Color: 'White' }, price: 24.99, isDefault: false },
        { name: 'XL/White', options: { Size: 'XL', Color: 'White' }, price: 24.99, isDefault: false },
      ],
    },
    // ── 17 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Name Keychain',
      slug: 'custom-name-keychain',
      sku: 'KEY-001',
      description: 'Durable stainless steel keychain laser-engraved with your name, initials, or short message.',
      shortDescription: 'Custom engraved keychain',
      basePrice: 14.99,
      catSlug: 'keychains',
      isPersonalizable: false,
      materials: ['Stainless Steel'],
      primaryColors: ['Silver'],
      occasions: ['Birthday', 'Graduation', 'Just Because'],
      recipientTags: ['Her', 'Him', 'Men', 'Women', 'Best Friend'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1533234427049-9e9bb093186d?w=800&q=80',
      variants: [
        { name: 'Silver',    options: { Color: 'Silver'    }, price: 14.99, isDefault: true  },
        { name: 'Gold',      options: { Color: 'Gold'      }, price: 16.99, isDefault: false },
        { name: 'Rose Gold', options: { Color: 'Rose Gold' }, price: 16.99, isDefault: false },
      ],
    },
    // ── 18 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Baby Onesie',
      slug: 'custom-baby-onesie',
      sku: 'ONS-001',
      description: 'Soft 100% cotton onesie with your custom text or name. Gentle on sensitive baby skin.',
      shortDescription: 'Personalized baby onesie',
      basePrice: 19.99,
      catSlug: 'onesies',
      shopSection: 'Apparel',
      materials: ['Cotton'],
      primaryColors: ['White'],
      occasions: ['Baby Shower'],
      recipientTags: ['Baby', 'Kids'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80',
      variants: [
        { name: '0-3M White',  options: { Size: '0-3M',  Color: 'White' }, price: 19.99, isDefault: true  },
        { name: '3-6M White',  options: { Size: '3-6M',  Color: 'White' }, price: 19.99, isDefault: false },
        { name: '6-12M White', options: { Size: '6-12M', Color: 'White' }, price: 19.99, isDefault: false },
      ],
    },
    // ── 19 ────────────────────────────────────────────────────────────────────
    {
      name: 'Custom Pet Portrait Pillow',
      slug: 'custom-pet-portrait-pillow',
      sku: 'PEP-001',
      description: 'Turn your pet photo into a stunning throw pillow. Vibrant sublimation print, soft polyester cover.',
      shortDescription: 'Custom pet portrait pillow',
      basePrice: 37.99,
      catSlug: 'throw-pillows',
      shopSection: 'Home Decor',
      materials: ['Polyester'],
      occasions: ['Birthday', 'Just Because'],
      recipientTags: ['Pet Owners', 'Her'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      variants: [
        { name: '16×16"', options: { Size: '16×16"' }, price: 37.99, isDefault: true  },
        { name: '18×18"', options: { Size: '18×18"' }, price: 42.99, isDefault: false },
      ],
    },
    // ── 20 ────────────────────────────────────────────────────────────────────
    {
      name: 'Personalized Graduation Frame',
      slug: 'personalized-graduation-frame',
      sku: 'FRM-001',
      description: 'Elegant acrylic desk frame for your graduation photo, personalized with name, degree, and year.',
      shortDescription: 'Custom graduation photo frame',
      basePrice: 34.99,
      catSlug: 'acrylic-plaques',
      materials: ['Acrylic'],
      primaryColors: ['Clear'],
      occasions: ['Graduation'],
      recipientTags: ['Him', 'Her', 'Teen'],
      whoMadeIt: 'ANOTHER_COMPANY',
      howItWasMade: 'ALTERED',
      returnPolicy: 'NO_RETURNS',
      toolsUsed: ['computerized'],
      imageUrl: 'https://images.unsplash.com/photo-1627556704290-2b1f5853ff78?w=800&q=80',
      variants: [
        { name: '5×7" Acrylic',  options: { Size: '5×7"',  Material: 'Acrylic' }, price: 34.99, isDefault: true  },
        { name: '8×10" Acrylic', options: { Size: '8×10"', Material: 'Acrylic' }, price: 44.99, isDefault: false },
      ],
    },
  ];

  const productIds: Record<string, string> = {};

  for (const def of products) {
    const {
      variants, imageUrl, catSlug,
      isFeatured = false, isPersonalizable = true,
      // New attribute fields (destructured to keep `...fields` clean)
      shopSection,
      materials, primaryColors, secondaryColors,
      occasions, holidayTags, recipientTags,
      styles, sustainability,
      whoMadeIt, howItWasMade, returnPolicy, toolsUsed,
      // Everything else goes into `fields` (name, slug, sku, description, basePrice, etc.)
      ...fields
    } = def;

    const categoryId = categoryIds[catSlug] ?? null;
    if (!categoryId) {
      if (process.env['NODE_ENV'] === 'production') {
        console.warn(`  ⚠  Skipping ${def.name} — category '${catSlug}' not found`);
        continue;
      }
      throw new Error(
        `Seed error: category slug '${catSlug}' not found for product '${def.name}'. ` +
        `Did you add it to slugsNeeded and seedCategories()?`,
      );
    }

    const existing = await prisma.product.findUnique({ where: { slug: def.slug } });
    if (existing) {
      productIds[def.slug] = existing.id;
      console.log(`  ⏭  Product (exists): ${def.name}`);
      continue;
    }

    // Resolve FK IDs
    const shopSectionId = shopSection ? (sectionMap[shopSection] ?? null) : null;

    const product = await prisma.product.create({
      data: {
        ...fields,
        categoryId,
        isFeatured,
        isPersonalizable,
        isActive:         true,
        processingDays:   3,
        renewalType:      'AUTOMATIC',
        isAdsEnabled:     false,
        // Attribute arrays
        materials:       materials       ?? [],
        primaryColors:   primaryColors   ?? [],
        secondaryColors: secondaryColors ?? [],
        occasions:       occasions       ?? [],
        holidayTags:     holidayTags     ?? [],
        recipientTags:   recipientTags   ?? [],
        styles:          styles          ?? [],
        sustainability:  sustainability  ?? [],
        toolsUsed:       toolsUsed       ?? [],
        // Enum fields
        whoMadeIt:    whoMadeIt    ?? 'ANOTHER_COMPANY',
        howItWasMade: howItWasMade ?? 'ALTERED',
        returnPolicy: returnPolicy ?? 'NO_RETURNS',
        // FK relations
        shopSectionId,
        processingProfileId: defaultProcessingProfile?.id ?? null,
        shippingProfileId:   defaultShippingProfile?.id   ?? null,
        // Nested creates
        variants:          { create: variants.map((v, i) => ({ ...v, sortOrder: i })) },
        images:            { create: [{ url: imageUrl, isPrimary: true, sortOrder: 0 }] },
        productCategories: { create: [{ categoryId, isPrimary: true }] },
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
  productIds: Record<string, string>,
) {
  // ADD 3: extended with new products
  const links: Record<string, string[]> = {
    'valentines-day': [
      'custom-name-photo-mug',
      'custom-photo-pillow',
      'personalized-canvas-print',
      'couples-mug-set',
      'personalized-wine-glass',
    ],
    birthday: [
      'custom-name-photo-mug',
      'monogram-tumbler',
      'custom-birth-stats-print',
      'custom-name-keychain',
      'custom-photo-phone-case',
    ],
    anniversary: [
      'personalized-canvas-print',
      'family-name-sign',
      'pet-portrait-canvas',
      'anniversary-map-print',
      'couples-mug-set',
    ],
    'mothers-day': [
      'custom-photo-pillow',
      'personalized-canvas-print',
      'personalized-tote-bag',
      'custom-pet-portrait-pillow',
      'personalized-cutting-board',
    ],
    graduation: [
      'custom-name-hoodie',
      'monogram-tumbler',
      'personalized-tote-bag',
      'personalized-graduation-frame',
      'custom-family-reunion-tshirt',
    ],
    christmas: [
      'custom-photo-ornament',
      'family-name-sign',
      'custom-name-photo-mug',
      'custom-baby-onesie',
      'personalized-cutting-board',
    ],
    'new-baby': ['custom-baby-onesie', 'custom-birth-stats-print'],
    wedding: [
      'anniversary-map-print',
      'personalized-wine-glass',
      'personalized-cutting-board',
    ],
    retirement: [
      'personalized-graduation-frame',
      'custom-name-hoodie',
      'monogram-tumbler',
    ],
    'fathers-day': [
      'personalized-cutting-board',
      'custom-name-hoodie',
      'monogram-tumbler',
    ],
  };

  for (const [colSlug, pSlugs] of Object.entries(links)) {
    const collectionId = collectionIds[colSlug];
    if (!collectionId) continue;
    for (let i = 0; i < pSlugs.length; i++) {
      const productId = productIds[pSlugs[i]];
      if (!productId) continue;
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId } },
        update: {},
        create: { collectionId, productId, sortOrder: i },
      });
    }
  }
  console.log('  ✅ Collection ↔ product links');
}

// ── MongoDB connection helper (IMPROVE 2) ─────────────────────────────────────

async function connectMongo(retries = 3, delayMs = 2000): Promise<boolean> {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(
    `\n🍃 Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`,
  );
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(uri, {
        dbName: 'mapleloomhandmade',
        serverSelectionTimeoutMS: 3000,
      });
      console.log('  ✅ MongoDB connected');
      return true;
    } catch (err) {
      console.warn(
        `  ⚠  MongoDB attempt ${i + 1}/${retries} failed: ${(err as Error).message}`,
      );
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

// ── STEP 6a — MongoDB mega-menu documents ─────────────────────────────────────
// Connection is managed by main() — do not connect/disconnect here.

async function seedMongoMenus() {
  // FIX 5: include Interests with isVisible: false
  const navSlugs: { navSlug: string; sortOrder: number; isVisible: boolean }[] =
    [
      { navSlug: 'gifts', sortOrder: 1, isVisible: true },
      { navSlug: 'home-living', sortOrder: 2, isVisible: true },
      { navSlug: 'drink-barware', sortOrder: 3, isVisible: true },
      { navSlug: 'apparel', sortOrder: 4, isVisible: true },
      { navSlug: 'accessories', sortOrder: 5, isVisible: true },
      { navSlug: 'interests', sortOrder: 7, isVisible: false },
    ];

  for (const { navSlug, sortOrder, isVisible } of navSlugs) {
    const l1 = await prisma.category.findUnique({
      where: { slug: navSlug },
      include: {
        children: {
          where: { level: 2 },
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
        navLabel: l1.name,
        navSlug,
        categoryId: l1.id,
        sortOrder,
        isVisible,
        groups: l1.children.map((g, gi) => ({
          title: g.name,
          categoryId: g.id,
          slug: g.slug,
          sortOrder: gi,
          items: g.children.map((item, ii) => ({
            name: item.name,
            categoryId: item.id,
            slug: item.slug,
            sortOrder: ii,
          })),
        })),
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.log(`  ✅ Mega-menu: ${l1.name} (${l1.children.length} groups)`);
  }
}

// ── STEP 6b — MongoDB ProductDetail documents (ADD 4) ─────────────────────────
// Connection is managed by main() — do not connect/disconnect here.

async function seedMongoProductDetails(productIds: Record<string, string>) {
  const detailMap: Record<string, Omit<IProductDetail, 'productId'>> = {
    'custom-name-photo-mug': {
      attributes: [
        { key: 'Material', value: 'Ceramic', filterable: true },
        { key: 'Capacity', value: '11oz / 15oz', filterable: false },
        { key: 'Dishwasher Safe', value: 'Yes', filterable: true },
        { key: 'Microwave Safe', value: 'Yes', filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['11oz', '15oz'] },
        { name: 'Color', values: ['White', 'Black'] },
      ],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 10,
        acceptedFormats: ['jpg', 'png', 'webp', 'heic'],
      },
    },
    'personalized-canvas-print': {
      attributes: [
        { key: 'Print Method', value: 'Giclée UV print', filterable: false },
        { key: 'Frame', value: 'Gallery wrap', filterable: true },
        { key: 'Material', value: 'Poly-cotton canvas', filterable: false },
      ],
      variantOptions: [{ name: 'Size', values: ['12x16', '16x20', '20x24'] }],
      printSpecs: {
        minDPI: 200,
        maxFileSize: 20,
        acceptedFormats: ['jpg', 'png'],
      },
    },
    'monogram-tumbler': {
      attributes: [
        { key: 'Material', value: 'Stainless Steel 18/8', filterable: true },
        { key: 'Insulation', value: 'Double-wall vacuum', filterable: false },
        { key: 'Cold', value: '24 hours', filterable: false },
        { key: 'Hot', value: '12 hours', filterable: false },
        { key: 'BPA Free', value: 'Yes', filterable: true },
      ],
      variantOptions: [{ name: 'Size', values: ['20oz', '30oz'] }],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 10,
        acceptedFormats: ['jpg', 'png', 'webp'],
      },
    },
    'personalized-cutting-board': {
      attributes: [
        { key: 'Material', value: 'Bamboo', filterable: true },
        { key: 'Food Safe', value: 'Yes', filterable: true },
        { key: 'Juice Groove', value: 'Yes', filterable: false },
        { key: 'Engrave Method', value: 'Laser', filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['Small (8×6")', 'Large (12×8")'] },
      ],
      printSpecs: {
        minDPI: 300,
        maxFileSize: 5,
        acceptedFormats: ['jpg', 'png', 'svg'],
      },
    },
    'custom-photo-phone-case': {
      attributes: [
        { key: 'Material', value: 'Hard polycarbonate', filterable: false },
        { key: 'Print', value: 'UV sublimation', filterable: false },
        { key: 'Protection', value: 'Slim shell', filterable: true },
      ],
      variantOptions: [
        {
          name: 'Model',
          values: ['iPhone 15', 'iPhone 15 Pro', 'iPhone 14', 'Samsung S24'],
        },
      ],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 10,
        acceptedFormats: ['jpg', 'png', 'webp', 'heic'],
      },
    },
    'custom-name-hoodie': {
      attributes: [
        {
          key: 'Material',
          value: '80% Cotton 20% Polyester',
          filterable: true,
        },
        { key: 'Fit', value: 'Unisex regular', filterable: false },
        { key: 'Care', value: 'Machine wash cold', filterable: false },
        { key: 'Print', value: 'DTG (Direct-to-Garment)', filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['Black'] },
      ],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 10,
        acceptedFormats: ['jpg', 'png', 'webp'],
      },
    },

    // ── Bundle product: Couples Mug Set ────────────────────────────────────
    'couples-mug-set': {
      attributes: [
        { key: 'Set includes', value: '2 matching ceramic mugs', filterable: false },
        { key: 'Material',     value: 'Ceramic',                 filterable: true  },
        { key: 'Dishwasher Safe', value: 'Yes',                  filterable: true  },
        { key: 'Microwave Safe',  value: 'Yes',                  filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['2 × 11oz', '2 × 15oz'] },
      ],
      customization: {
        templateId:  'tmpl_couples_mug',
        version:     1,
        bundleCount: 2,
        fields: [
          {
            id:        'item_1_name',
            type:      'text',
            label:     'Name on Mug 1',
            required:  true,
            maxLength: 20,
            position:  { x: 120, y: 80 },
          },
          {
            id:        'item_1_message',
            type:      'text',
            label:     'Message on Mug 1',
            required:  false,
            maxLength: 30,
          },
          {
            id:        'item_2_name',
            type:      'text',
            label:     'Name on Mug 2',
            required:  true,
            maxLength: 20,
            position:  { x: 120, y: 80 },
          },
          {
            id:        'item_2_message',
            type:      'text',
            label:     'Message on Mug 2',
            required:  false,
            maxLength: 30,
          },
        ],
        previewLayers: [
          { type: 'base',    url: '/templates/mug-base.png',    zIndex: 0 },
          { type: 'overlay', url: '/templates/mug-overlay.png', zIndex: 2 },
        ],
      },
    },
  };

  let created = 0;
  for (const [productSlug, detail] of Object.entries(detailMap)) {
    const productId = productIds[productSlug];
    if (!productId) continue;
    await ProductDetailModel.findOneAndUpdate(
      { productId },
      { productId, ...detail },
      { upsert: true, returnDocument: 'after' },
    );
    created++;
  }
  console.log(`  ✅ MongoDB ProductDetail: ${created} documents upserted`);
}

// ── STEP 7 — Promotions ───────────────────────────────────────────────────────

async function seedPromotions() {
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
  console.log('✅ Promotions seeded');
}

// ── STEP 8 — Shipping zones ───────────────────────────────────────────────────

async function seedShippingZones() {
  const usZone = await prisma.shippingZone.findFirst({
    where: { name: 'United States' },
  });
  if (!usZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'United States',
        countries: ['US'],
        methods: {
          create: [
            {
              name: 'Standard (5-10 days)',
              carrier: 'USPS',
              price: 4.99,
              freeShippingOver: 50,
              minDays: 5,
              maxDays: 10,
            },
            {
              name: 'Express (2-3 days)',
              carrier: 'FedEx',
              price: 14.99,
              minDays: 2,
              maxDays: 3,
            },
            {
              name: 'Overnight',
              carrier: 'UPS',
              price: 29.99,
              minDays: 1,
              maxDays: 1,
            },
          ],
        },
      },
    });
    console.log('✅ Shipping zone: United States');
  }

  const intlZone = await prisma.shippingZone.findFirst({
    where: { name: 'International' },
  });
  if (!intlZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'International',
        countries: ['CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'SG', 'NZ'],
        methods: {
          create: [
            {
              name: 'Standard International (14-21 days)',
              carrier: 'USPS',
              price: 19.99,
              minDays: 14,
              maxDays: 21,
            },
            {
              name: 'Express International (7-10 days)',
              carrier: 'FedEx',
              price: 39.99,
              minDays: 7,
              maxDays: 10,
            },
          ],
        },
      },
    });
    console.log('✅ Shipping zone: International');
  }
}

// ── Processing profiles ───────────────────────────────────────────────────────

async function seedProcessingProfiles() {
  await prisma.processingProfile.createMany({
    skipDuplicates: true,
    data: [
      {
        name:      'Made to order',
        type:      'MADE_TO_ORDER',
        minDays:   6,
        maxDays:   10,
        isDefault: false,
      },
      {
        name:      'Standard POD',
        type:      'MADE_TO_ORDER',
        minDays:   3,
        maxDays:   7,
        isDefault: true,
      },
      {
        name:      'Ready to ship',
        type:      'READY_TO_SHIP',
        minDays:   1,
        maxDays:   3,
        isDefault: false,
      },
    ],
  });
  console.log('✅ Processing profiles seeded');
}

// ── Shipping profiles ─────────────────────────────────────────────────────────

async function seedShippingProfiles() {
  const [standard, express] = await Promise.all([
    prisma.shippingProfile.upsert({
      where:  { name: 'Standard Shipping' },
      update: {},
      create: { name: 'Standard Shipping', type: 'fixed', isDefault: true },
    }),
    prisma.shippingProfile.upsert({
      where:  { name: 'Express Shipping' },
      update: {},
      create: { name: 'Express Shipping',  type: 'fixed', isDefault: false },
    }),
  ]);

  // Seed default methods for Standard profile if none exist
  const existing = await prisma.shippingProfileMethod.count({
    where: { profileId: standard.id },
  });
  if (!existing) {
    await prisma.shippingProfileMethod.createMany({
      data: [
        {
          profileId:       standard.id,
          destinationType: 'domestic',
          carrier:         'USPS',
          minDays:         5,
          maxDays:         10,
          price:           4.99,
          extraItemPrice:  0.50,
        },
        {
          profileId:       standard.id,
          destinationType: 'everywhere_else',
          carrier:         'USPS',
          minDays:         10,
          maxDays:         21,
          price:           12.99,
          extraItemPrice:  1.50,
        },
        {
          profileId:       express.id,
          destinationType: 'domestic',
          carrier:         'FedEx',
          minDays:         2,
          maxDays:         3,
          price:           14.99,
          extraItemPrice:  2.00,
        },
      ],
    });
  }
  console.log('✅ Shipping profiles seeded');
}

// ── Shop sections ─────────────────────────────────────────────────────────────

async function seedShopSections() {
  await prisma.shopSection.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Mugs & Drinkware',  sortOrder: 0 },
      { name: 'Wall Art & Canvas', sortOrder: 1 },
      { name: 'Apparel',           sortOrder: 2 },
      { name: 'Home Decor',        sortOrder: 3 },
    ],
  });
  console.log('✅ Shop sections seeded');
}

// ── Attribute values ──────────────────────────────────────────────────────────

async function seedAttributeValues() {
  const rows = [
    // Colors
    ...['Red','Blue','Green','Black','White','Yellow','Orange','Purple','Pink',
        'Brown','Gray','Gold','Silver','Beige','Teal','Navy','Khaki','Olive',
        'Turquoise','Lavender','Coral','Cream','Charcoal','Rose Gold',
      ].map((v) => ({ type: 'color', value: v })),

    // Materials
    ...['Cotton','Polyester','Ceramic','Bamboo','Stainless Steel','Canvas',
        'Acrylic','Wood','Leather','Linen','Velvet','Nylon','Wool','Glass',
        'Porcelain','Resin','Felt','Faux Leather','Silk','Stone',
      ].map((v) => ({ type: 'material', value: v })),

    // Occasions
    ...['Birthday','Anniversary','Wedding','Graduation','Christmas',
        "Mother's Day","Father's Day","Valentine's Day",'Baby Shower',
        'Housewarming','Retirement','Get Well','Thank You','Friendship',
        'Easter','Halloween','New Year','Celebration','Just Because',
      ].map((v) => ({ type: 'occasion', value: v })),

    // Holidays
    ...['Christmas','Easter','Halloween','Hanukkah',"Mother's Day",
        "Father's Day",'New Year',"St. Patrick's Day",'Thanksgiving',
        "Valentine's Day",
      ].map((v) => ({ type: 'holiday', value: v })),

    // Recipients
    ...['Her','Him','Kids','Baby','Pet Owners','Teachers','Grandparents',
        'Best Friend','Couple','Dad','Mom','Sister','Brother','Wife','Husband',
        'Teen','Men','Women',
      ].map((v) => ({ type: 'recipient', value: v })),

    // Styles
    ...['Minimalist','Bohemian','Vintage','Modern','Rustic','Farmhouse',
        'Classic','Retro','Scandinavian','Abstract','Kawaii','Gothic',
        'Industrial','Preppy','Coastal',
      ].map((v) => ({ type: 'style', value: v })),

    // Sustainability
    ...['Organic','Recycled','Natural','Eco-friendly','Upcycled',
        'Carbon neutral','Vegan','Responsibly sourced',
      ].map((v) => ({ type: 'sustainability', value: v })),
  ];

  await prisma.attributeValue.createMany({ skipDuplicates: true, data: rows });
  console.log(`✅ Attribute values seeded (${rows.length} entries)`);
}

// ── Seed summary (IMPROVE 3) ──────────────────────────────────────────────────

async function printSeedSummary() {
  const [users, categories, collections, products, promotions, zones] =
    await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.collection.count(),
      prisma.product.count(),
      prisma.promotion.count(),
      prisma.shippingZone.count(),
    ]);

  let mongoDetails: number | string = 'N/A (MongoDB not connected)';
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    mongoDetails = await mongoose.connection.db
      .collection('product_details')
      .countDocuments();
  }

  console.log('\n📊 Seed Summary:');
  console.log(`  Users:          ${users}`);
  console.log(`  Categories:     ${categories} (L1/L2/L3 combined)`);
  console.log(`  Collections:    ${collections}`);
  console.log(`  Products:       ${products}`);
  console.log(`  Promotions:     ${promotions}`);
  console.log(`  Shipping zones: ${zones}`);
  console.log(`  Mongo details:  ${mongoDetails}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  await seedAdmin();
  await seedCategories();
  const collectionIds = await seedCollections();
  // Profiles and sections must exist before products reference them
  await seedProcessingProfiles();
  await seedShippingProfiles();
  await seedShopSections();
  const productIds = await seedProducts();
  await seedCollectionLinks(collectionIds, productIds);
  await seedPromotions();
  await seedShippingZones();
  await seedAttributeValues();

  // MongoDB steps — connect once, run both, disconnect once (IMPROVE 2)
  const mongoConnected = await connectMongo();
  if (mongoConnected) {
    await seedMongoMenus();
    await seedMongoProductDetails(productIds);
    await printSeedSummary(); // call while still connected so Mongo count is accurate
    await mongoose.disconnect();
    console.log('  ✅ MongoDB disconnected');
  } else {
    console.warn(
      '  ⚠  Skipped all MongoDB steps (connection failed after retries)',
    );
    await printSeedSummary();
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
