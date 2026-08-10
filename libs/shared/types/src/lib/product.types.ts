import type { CategoryDto, TagDto } from './catalog.types';

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
  isPersonalizable: boolean;
  isFeatured: boolean;
  soldCount: number;
  soldCount24h?: number;
  primaryCategory: { name: string; slug: string };
  images: ProductImageDto[];
  /** { avg, count } — pass avg to ProductCard.rating, count to ProductCard.reviewCount */
  rating?: { avg: number; count: number };
  tags: { name: string; slug: string }[];
  // backward compat fields used by existing components
  /** @deprecated use images[0].url */
  primaryImage?: string;
  /** @deprecated use a separate count endpoint */
  reviewCount?: number;
  /** @deprecated use primaryCategory */
  category?: CategoryDto;
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
