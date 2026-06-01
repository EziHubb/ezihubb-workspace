/**
 * Standalone MongoDB seed script.
 *
 * Seeds:
 *   1. category_menus   — mega-menu docs derived from the PostgreSQL category tree
 *   2. product_details  — attribute + variant-option docs for key products
 *
 * Run: pnpm db:seed:mongo
 *
 * Works independently of the main seed.ts.  Safe to re-run (upserts).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as https from 'https';
import mongoose, { Schema, model, Model } from 'mongoose';

// ── Load .env ─────────────────────────────────────────────────────────────────
// Prisma CLI and ts-node do NOT inject .env into child-process env.
// We load it ourselves using import.meta.url so the path is always correct.

const seedDir = dirname(fileURLToPath((import.meta as { url: string }).url));
try {
  const envPath = resolve(seedDir, '..', '.env');
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
} catch (e) {
  console.warn('⚠  Could not load .env:', (e as Error).message);
}

// ── PostgreSQL (Prisma) ───────────────────────────────────────────────────────

const dbUrl = process.env['DATABASE_URL'] ?? '';
if (!dbUrl)
  throw new Error(
    'DATABASE_URL is not set. Create a .env file at the workspace root.',
  );

const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pgPool) });

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

// ── DNS over HTTPS fallback (bypasses UDP port-53 blocks) ────────────────────
// System DNS and even custom DNS resolvers (8.8.8.8) can be blocked by firewalls.
// DoH uses port 443/HTTPS which is almost never blocked.

function dohFetch(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { accept: 'application/dns-json' } },
        (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (c: Buffer) => (data += c.toString()));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on('error', reject);
  });
}

async function resolveSrvUri(originalUri: string): Promise<string> {
  if (!originalUri.startsWith('mongodb+srv://')) return originalUri;

  try {
    const url = new URL(originalUri.replace('mongodb+srv://', 'https://'));
    const host = url.hostname;

    // Resolve SRV via Google DoH (port 443, never blocked)
    const srvResp = await dohFetch(
      `https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`,
    );
    const srvAnswers =
      (srvResp['Answer'] as { type: number; data: string }[] | undefined) ?? [];
    const srvRecords = srvAnswers.filter((r) => r.type === 33); // 33 = SRV
    if (!srvRecords.length) return originalUri;

    const hosts = srvRecords
      .map((r) => {
        const parts = r.data.trim().split(/\s+/);
        return `${parts[3].replace(/\.$/, '')}:${parts[2]}`;
      })
      .join(',');

    // Resolve TXT options (replicaSet, authSource) via DoH
    let txtOptions = 'authSource=admin';
    try {
      const txtResp = await dohFetch(
        `https://dns.google/resolve?name=${host}&type=TXT`,
      );
      const txtAnswers =
        (txtResp['Answer'] as { type: number; data: string }[] | undefined) ??
        [];
      const txt = txtAnswers
        .filter((r) => r.type === 16) // 16 = TXT
        .map((r) => r.data.replace(/^"|"$/g, '').replace(/"\s*"/g, ''))
        .join('&');
      if (txt) txtOptions = txt;
    } catch {
      /* use default */
    }

    const creds = `${url.username}:${encodeURIComponent(decodeURIComponent(url.password))}`;
    const extraQs = url.search ? url.search.slice(1) : '';
    const qs = [txtOptions, 'tls=true', extraQs].filter(Boolean).join('&');
    const directUri = `mongodb://${creds}@${hosts}/?${qs}`;
    console.log('  ℹ  SRV resolved via DoH → using direct connection');
    return directUri;
  } catch (e) {
    console.warn(
      '  ⚠  DoH SRV resolution failed:',
      (e as Error).message,
      '— trying original URI',
    );
    return originalUri;
  }
}

// ── MongoDB connection (with retry + SRV fallback) ────────────────────────────

async function connectMongo(retries = 3, delayMs = 2000): Promise<boolean> {
  const originalUri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(' process.env[MONGODB_URI]', process.env['MONGODB_URI']);
  console.log(
    `\n🍃 Connecting to MongoDB at ${originalUri.replace(/\/\/.*@/, '//<credentials>@')}...`,
  );

  // Resolve SRV using public DNS first (fixes ECONNREFUSED on Windows)
  const uri = await resolveSrvUri(originalUri);

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(uri, {
        dbName: 'mapleloomhandmade',
        serverSelectionTimeoutMS: 8000,
        family: 4, // prefer IPv4
      });
      console.log('  ✅ MongoDB connected');
      return true;
    } catch (err) {
      console.warn(
        `  ⚠  Attempt ${i + 1}/${retries} failed: ${(err as Error).message}`,
      );
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

// ── STEP 1 — Mega-menu documents ──────────────────────────────────────────────

async function seedMongoMenus() {
  console.log('\n📋 Seeding category_menus...');

  const navSlugs: { navSlug: string; sortOrder: number; isVisible: boolean }[] =
    [
      { navSlug: 'gifts', sortOrder: 1, isVisible: true },
      { navSlug: 'home-living', sortOrder: 2, isVisible: true },
      { navSlug: 'drink-barware', sortOrder: 3, isVisible: true },
      { navSlug: 'apparel', sortOrder: 4, isVisible: true },
      { navSlug: 'accessories', sortOrder: 5, isVisible: true },
      { navSlug: 'interests', sortOrder: 7, isVisible: false },
    ];

  let upserted = 0;
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
    console.log(`  ✅ ${l1.name} (${l1.children.length} groups)`);
    upserted++;
  }
  console.log(`  → ${upserted} menu docs upserted`);
}

// ── STEP 2 — ProductDetail documents ──────────────────────────────────────────

async function seedMongoProductDetails() {
  console.log('\n📄 Seeding product_details...');

  // Fetch product IDs from PostgreSQL by slug
  const slugs = [
    'custom-name-photo-mug',
    'personalized-canvas-print',
    'monogram-tumbler',
    'personalized-cutting-board',
    'custom-photo-phone-case',
    'custom-name-hoodie',
    'anniversary-map-print',
    'couples-mug-set',
    'personalized-wine-glass',
    'custom-photo-pillow',
  ];

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const productIds: Record<string, string> = {};
  for (const p of products) productIds[p.slug] = p.id;

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
    'anniversary-map-print': {
      attributes: [
        { key: 'Print Method', value: 'Giclée UV print', filterable: false },
        { key: 'Frame', value: 'Gallery wrap / Framed', filterable: true },
        { key: 'Material', value: 'Poly-cotton canvas', filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['12×16"'] },
        { name: 'Type', values: ['Canvas', 'Framed'] },
      ],
      printSpecs: {
        minDPI: 200,
        maxFileSize: 20,
        acceptedFormats: ['jpg', 'png'],
      },
    },
    'couples-mug-set': {
      attributes: [
        { key: 'Material', value: 'Ceramic', filterable: true },
        { key: 'Set', value: '2 mugs', filterable: false },
        { key: 'Dishwasher Safe', value: 'Yes', filterable: true },
        { key: 'Microwave Safe', value: 'Yes', filterable: false },
      ],
      variantOptions: [{ name: 'Size', values: ['2 × 11oz', '2 × 15oz'] }],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 10,
        acceptedFormats: ['jpg', 'png', 'webp'],
      },
    },
    'personalized-wine-glass': {
      attributes: [
        { key: 'Material', value: 'Glass', filterable: true },
        { key: 'Engrave', value: 'Laser etched', filterable: false },
        { key: 'Care', value: 'Hand wash', filterable: false },
      ],
      variantOptions: [
        { name: 'Size', values: ['15oz'] },
        { name: 'Style', values: ['Stemmed', 'Stemless'] },
      ],
      printSpecs: {
        minDPI: 300,
        maxFileSize: 5,
        acceptedFormats: ['jpg', 'png', 'svg'],
      },
    },
    'custom-photo-pillow': {
      attributes: [
        { key: 'Material', value: 'Polyester cover', filterable: false },
        { key: 'Print', value: 'Sublimation', filterable: false },
        { key: 'Includes', value: 'Pillow insert', filterable: true },
      ],
      variantOptions: [
        { name: 'Size', values: ['16×16"', '18×18"', '20×20"'] },
      ],
      printSpecs: {
        minDPI: 150,
        maxFileSize: 15,
        acceptedFormats: ['jpg', 'png', 'webp', 'heic'],
      },
    },
  };

  let upserted = 0;
  for (const [slug, detail] of Object.entries(detailMap)) {
    const productId = productIds[slug];
    if (!productId) {
      console.warn(`  ⚠  Product '${slug}' not found in DB — skipping`);
      continue;
    }
    await ProductDetailModel.findOneAndUpdate(
      { productId },
      { productId, ...detail },
      { upsert: true, returnDocument: 'after' },
    );
    upserted++;
  }
  console.log(`  → ${upserted} product_detail docs upserted`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

async function printSummary() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return;
  const db = mongoose.connection.db;
  const [menus, details] = await Promise.all([
    db.collection('category_menus').countDocuments(),
    db.collection('product_details').countDocuments(),
  ]);
  console.log('\n📊 MongoDB Summary:');
  console.log(`  category_menus:   ${menus}`);
  console.log(`  product_details:  ${details}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🍃 MongoDB seed starting...\n');

  const connected = await connectMongo();
  if (!connected) {
    console.error(
      '\n❌ Could not connect to MongoDB. Check MONGODB_URI in .env.',
    );
    process.exit(1);
  }

  await seedMongoMenus();
  await seedMongoProductDetails();
  await printSummary();

  await mongoose.disconnect();
  console.log('\n✅ MongoDB disconnected');
  console.log('🎉 MongoDB seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pgPool.end();
  });
