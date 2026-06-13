/**
 * One-time migration: PostgreSQL products → MongoDB ProductDetail.
 *
 * For each existing PG product:
 *   1. Reads customizationConfig JSON (currently stored in PG)
 *   2. Reads ProductVariant rows from PG
 *   3. Creates / upserts a ProductDetail document in MongoDB
 *
 * Run after `pnpm db:seed` and after installing mongoose:
 *   pnpm migrate:products
 */

import { PrismaClient } from '@prisma/client';
import mongoose, { Schema, model, Model } from 'mongoose';

const prisma = new PrismaClient();

// ── Inline ProductDetail schema (mirrors apps/api schema) ────────────────────

interface IVariant {
  sku: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  isDefault: boolean;
  isAvailable: boolean;
  imageIndex?: number;
}

interface IVariantOption {
  name: string;
  values: string[];
}

interface IPrintSpecs {
  minDPI: number;
  maxFileSize: number;
  acceptedFormats: string[];
  printArea?: { w: number; h: number; unit: string };
}

interface IProductDetail {
  productId: string;
  richDescription?: string;
  sizeGuide?: string;
  shippingNote?: string;
  attributes: Array<{ key: string; value: string; filterable?: boolean; unit?: string }>;
  variantOptions: IVariantOption[];
  variants: IVariant[];
  customization?: unknown;
  metaTitle?: string;
  metaDescription?: string;
  printSpecs?: IPrintSpecs;
}

const productDetailSchema = new Schema<IProductDetail>(
  {
    productId:       { type: String, required: true, unique: true, index: true },
    richDescription: String,
    sizeGuide:       String,
    shippingNote:    String,
    attributes:      [{ key: String, value: String, filterable: Boolean, unit: String }],
    variantOptions:  [{ name: String, values: [String] }],
    variants:        [{
      sku:            String,
      options:        Object,
      price:          Number,
      compareAtPrice: Number,
      isDefault:      Boolean,
      isAvailable:    { type: Boolean, default: true },
      imageIndex:     Number,
    }],
    customization: Object,
    metaTitle:     String,
    metaDescription: String,
    printSpecs:    Object,
  },
  { collection: 'product_details', timestamps: true },
);

let ProductDetailModel: Model<IProductDetail>;
try {
  ProductDetailModel = mongoose.model<IProductDetail>('ProductDetail');
} catch {
  ProductDetailModel = model<IProductDetail>('ProductDetail', productDetailSchema);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractOptionDimensions(
  variants: Array<{ options: unknown }>,
): IVariantOption[] {
  const map = new Map<string, Set<string>>();
  for (const v of variants) {
    const opts = (v.options ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(opts)) {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(value);
    }
  }
  return Array.from(map.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}

function getDefaultPrintSpecs(categorySlug?: string | null): IPrintSpecs | undefined {
  if (!categorySlug) return undefined;

  const s = categorySlug.toLowerCase();

  if (s.includes('mug') || s.includes('tumbler') || s.includes('drink')) {
    return {
      minDPI: 150,
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    };
  }
  if (s.includes('canvas') || s.includes('poster') || s.includes('print') || s.includes('wall')) {
    return {
      minDPI: 200,
      maxFileSize: 20,
      acceptedFormats: ['jpg', 'jpeg', 'png'],
      printArea: { w: 12, h: 16, unit: 'inches' },
    };
  }
  if (s.includes('apparel') || s.includes('shirt') || s.includes('hoodie')) {
    return {
      minDPI: 150,
      maxFileSize: 15,
      acceptedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      printArea: { w: 12, h: 14, unit: 'inches' },
    };
  }
  // Default
  return {
    minDPI: 150,
    maxFileSize: 10,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  };
}

// ── Migration ─────────────────────────────────────────────────────────────────

async function migrateProducts() {
  const uri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  console.log(`🍃 Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);

  await mongoose.connect(uri, { dbName: 'dailydaisy' });
  console.log('✅ Connected\n');

  const products = await prisma.product.findMany({
    include: {
      variants:  { orderBy: { sortOrder: 'asc' } },
      category:  true,
    },
  });

  console.log(`📦 Migrating ${products.length} products...\n`);

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    const mongoVariants: IVariant[] = product.variants.map((v) => ({
      sku:            v.sku ?? `${product.sku}-${v.id.slice(-6)}`,
      options:        (v.options ?? {}) as Record<string, string>,
      price:          Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
      isDefault:      v.isDefault,
      isAvailable:    true,
    }));

    const variantOptions = extractOptionDimensions(product.variants);
    const printSpecs     = getDefaultPrintSpecs(product.category?.slug);
    const customization  = product.customizationConfig ?? null;

    const result = await ProductDetailModel.findOneAndUpdate(
      { productId: product.id },
      {
        $setOnInsert: { productId: product.id },
        $set: {
          variants:       mongoVariants,
          variantOptions,
          customization,
          printSpecs,
          attributes:     [],  // populated manually per product type in admin
        },
      },
      { upsert: true, new: true },
    );

    if (result) {
      const isNew = result.createdAt.getTime() === result.updatedAt?.getTime();
      console.log(`  ${isNew ? '✅ Created' : '♻  Updated'}: ${product.name} (${product.sku})`);
      if (isNew) created++; else skipped++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created:  ${created}`);
  console.log(`   Updated:  ${skipped}`);
  console.log(`   Total:    ${products.length}`);

  // Verify
  const mongoCount = await ProductDetailModel.countDocuments();
  console.log(`\n🔍 MongoDB product_details count: ${mongoCount}`);

  if (mongoCount > 0) {
    const sample = await ProductDetailModel.findOne().lean();
    console.log(`\n🔍 Sample variantOptions:`, JSON.stringify(sample?.variantOptions?.slice(0, 2), null, 2));
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
  console.log('\n🎉 Migration complete!');
}

migrateProducts().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
