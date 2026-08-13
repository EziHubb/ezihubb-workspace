import type { TagDto } from './catalog.types';

export interface ProductImageDto {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVariantDto {
  sku: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  isDefault: boolean;
  isAvailable: boolean;
  // backward compat — components still access the old VariantDto-style fields
  id?: string;
  /** @deprecated use options.Size */
  size?: string;
  /** @deprecated use options.Color */
  color?: string;
  /** @deprecated use options.Material */
  material?: string;
  isActive?: boolean;
  attributes?: Record<string, string>;
  [key: string]: unknown;
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

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice?: number;
  /** Lowest/highest ProductVariant.price, or null/undefined when the product has no
   *  variants. basePrice is seller-entered and never auto-synced to variant prices —
   *  prefer minPrice (falling back to basePrice) so a stale basePrice can't mislead
   *  buyers into thinking the cheapest option costs more (or less) than it does. */
  minPrice?: number | null;
  maxPrice?: number | null;
  isPersonalizable: boolean;
  isFeatured: boolean;
  soldCount: number;
  soldCount24h?: number;
  // Flat fields, matching exactly what the API actually sends (see
  // apps/api/src/modules/products/dto/product-list-item.dto.ts) — this type
  // previously declared a nested `primaryCategory: {name,slug}` and
  // `rating: {avg,count}` shape that NO backend endpoint ever produced, which
  // silently broke every rating star and category label reading it (always
  // undefined). Keep this in sync with the backend DTO, not with wishful shape.
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  images: ProductImageDto[];
  averageRating: number | null;
  reviewCount: number;
  tags: { name: string; slug: string }[];
  // backward compat field used by existing components
  /** @deprecated use images[0].url */
  primaryImage?: string;
  badge?: 'bestseller' | 'new' | 'sale' | 'hot';
  store?: { id: string; name: string; slug: string } | null;
}

export interface DigitalFileDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface ProductDto extends ProductListItemDto {
  sku: string;
  description: string;
  shortDescription?: string;
  processingDays: number;
  viewCount: number;
  variants: ProductVariantDto[];
  variantOptions?: { name: string; values: string[] }[];
  attributes?: ProductAttributeDto[];
  customization?: CustomizationConfigDto | null;
  sizeGuide?: string;
  collections?: { id: string; name: string; slug: string }[];
  videoUrls?: string[];
  productType?: 'PHYSICAL' | 'DIGITAL';
  digitalFiles?: DigitalFileDto[];
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
