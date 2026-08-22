import type { TagDto } from './catalog.types';

// ── Product images ───────────────────────────────────────────────────────────
// Two distinct shapes, not one — the LIST endpoint sends a thumbnail-only
// shape, DETAIL sends the full row. A single ProductImageDto pretending to
// cover both is exactly the kind of "type says yes, runtime says no" bug this
// file used to have for category (see git history): LIST images never had
// `id`/`sortOrder`, only `ProductDetailDto` below actually does.

/** Full image row — DETAIL only (apps/api .../dto/product-response.dto.ts ProductImageResponseDto). */
export interface ProductImageDto {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

/** Thumbnail-only shape the LIST endpoint actually sends (product-list-item.dto.ts). */
export interface ProductListImageDto {
  url: string;
  isPrimary?: boolean;
}

// ── Variants ──────────────────────────────────────────────────────────────────
// Matches apps/api/.../dto/product-response.dto.ts VariantResponseDto exactly.
// There is no per-variant compareAtPrice in the Prisma schema (ProductVariant
// has no such column) — a client-declared `compareAtPrice?: number` here for
// years never had real data behind it.

export interface ProductVariantDto {
  id:       string;
  name:     string;
  options:  Record<string, string>;
  price:    number;
  sku:      string | null;
  isDefault: boolean;
  sortOrder: number;
}

export interface ProductAttributeDto {
  key: string;
  value: string;
  filterable?: boolean;
  unit?: string;
}

export interface CustomizationConfigDto {
  templateId: string;
  version: number;
  /** Number of items in a bundle set (1 = single item, 2+ = bundle like Couples Mug Set) */
  bundleCount?: number;
  fields: {
    id: string;
    type: 'text' | 'textarea' | 'image' | 'select' | 'color';
    label: string;
    required: boolean;
    maxLength?: number;
    options?: string[];
    position?: { x: number; y: number };
    size?: { w: number; h: number };
    allowBgRemoval?: boolean;
  }[];
  previewLayers: {
    type: 'base' | 'overlay';
    url: string;
    zIndex: number;
  }[];
}

// ── LIST (GET /products, /search, /stores/{slug}/…) ───────────────────────────
// Keep in sync with apps/api/src/modules/products/dto/product-list-item.dto.ts,
// not with wishful shape — this type previously declared a nested
// `primaryCategory: {name,slug}` / `rating: {avg,count}` shape no endpoint
// ever produced (always undefined), and separately a `soldCount24h` the API
// has only ever sent as `inDemandCount`.

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  basePrice: number;
  compareAtPrice: number | null;
  /** Lowest/highest ProductVariant.price, or null when the product has no variants.
   *  basePrice is seller-entered and never auto-synced to variant prices —
   *  prefer minPrice (falling back to basePrice) so a stale basePrice can't mislead
   *  buyers into thinking the cheapest option costs more (or less) than it does. */
  minPrice: number | null;
  maxPrice: number | null;
  primaryImageUrl: string | null;
  /** @deprecated use images[0].url */
  primaryImage: string | null;
  images: ProductListImageDto[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  /** Colour tags for the swatch strip on a listing card. */
  primaryColors: string[];
  productType: 'PHYSICAL' | 'DIGITAL';
  /**
   * Videos on this listing. Usually EMPTY — most listings have none, so the
   * empty case is normal, not a loading state. Cards fall back to the still
   * image rather than reserving space for a player that never arrives.
   */
  videos?: ProductVideoDto[];
  isPersonalizable: boolean;
  isFeatured: boolean;
  isActive: boolean;
  status: string;
  quantity: number | null;
  viewCount: number;
  soldCount: number;
  averageRating: number | null;
  reviewCount: number;
  /**
   * Rolling 24h demand signal (Redis counter, apps/api IN_DEMAND_KEY) — powers
   * the "In-demand"/"bought recently" badges. Was declared as `soldCount24h`,
   * a name the API has never sent; the real field is `inDemandCount`.
   */
  inDemandCount: number;
  createdAt: string;
  storeId?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
  store?: { id: string; name: string; slug: string } | null;
}

export interface DigitalFileDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface ProductBundlePartnerDto {
  id: string;
  name: string;
  price: number;
  images: string[];
}

export interface ProductBundleOfferDto {
  id: string;
  discountPercent: number;
  products: ProductBundlePartnerDto[];
}

// ── DETAIL (GET /products/{slug}) ──────────────────────────────────────────────
// Deliberately NOT `extends ProductListItemDto`. The two endpoints share a
// handful of field NAMES but not shapes (category/images most visibly) —
// three ad-hoc local `ProductDetailDto extends ProductDto` definitions had
// drifted out of sync with each other and with reality before this type
// existed; this is the one canonical version, matching
// apps/api/src/modules/products/dto/product-response.dto.ts ProductResponseDto,
// plus the fields apps/api merges in from MongoDB only when a Mongo detail
// document exists for the product (richDescription..printSpecs below).
/**
 * One product video plus what was derived from it at upload.
 *
 * `thumbnailUrls` holds STORED poster files, not transform URLs, so it can
 * legitimately be empty — clips uploaded before poster extraction existed,
 * and clips whose opening frames would not decode, have none. Read it
 * defensively and fall back to the product image; do not index [0] blind.
 *
 * `duration` is ISO 8601 (`PT10S`) so it can go straight into
 * schema.org/VideoObject markup. Null when it was never measured.
 */
export interface ProductVideoDto {
  id: string;
  url: string;
  thumbnailUrls: string[];
  duration: string | null;
  uploadedAt: string;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  /** Etsy "Set up a sale" — the active auto-apply discount's own terms, applied
   *  client-side to whichever price (base or variant) is currently selected.
   *  Null when no sale is active. Checkout always recomputes this itself. */
  salePromo?: { type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null;
  /** Active "Buy them together" bundle this listing belongs to, if any. */
  bundleOffer?: ProductBundleOfferDto | null;
  isPersonalizable: boolean;
  isActive: boolean;
  productType: 'PHYSICAL' | 'DIGITAL';
  isFeatured: boolean;
  viewCount: number;
  soldCount: number;
  processingDays: number;
  category: { id: string; name: string; slug: string };
  store: { id: string; name: string; slug: string } | null;
  variants: ProductVariantDto[];
  variantOptions: { name: string; values: string[] }[];
  /**
   * The one variation whose options are tied to listing photos, when the seller
   * set one up — picking such an option brings its photo forward in the
   * gallery. Null (or absent) whenever nothing is linked.
   *
   * `groupName` matches a `variantOptions[].name` and `imageIdByValue` is keyed
   * by option name, so a selection resolves without any extra identifier. Only
   * options with a photo that still exists are listed, so a missing key means
   * "leave the gallery where it is".
   */
  variationPhotos?: {
    groupName: string;
    imageIdByValue: Record<string, string>;
  } | null;
  images: ProductImageDto[];
  digitalFiles?: DigitalFileDto[];
  videos?: ProductVideoDto[];
  /** @deprecated Superseded by `videos`, which carries poster frames and duration. */
  videoUrls?: string[];
  tags: TagDto[];
  averageRating: number | null;
  reviewCount: number;
  inDemandCount: number;
  createdAt: string;
  updatedAt: string;

  // ── Merged in from MongoDB only when a detail document exists for the
  // product — genuinely absent (not just null) otherwise. ────────────────────
  richDescription?: string;
  sizeGuide?: string;
  shippingNote?: string;
  attributes?: ProductAttributeDto[];
  customization?: CustomizationConfigDto | null;
}

// ── Backward-compat legacy types ───────────────────────────────────────────────

/** @deprecated Use ProductVariantDto */
export interface VariantDto {
  id: string;
  productId: string;
  sku: string;
  size?: string;
  color?: string;
  material?: string;
  price?: number;
  stock: number;
  isActive: boolean;
  attributes?: Record<string, string>;
}

// Re-export TagDto so files that import TagDto from product.types still compile
export type { TagDto };
