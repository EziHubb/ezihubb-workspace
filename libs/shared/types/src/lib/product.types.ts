import type { CategoryDto, TagDto } from './catalog.types';

export interface VariantDto {
  id:        string;
  productId: string;
  sku:       string;
  size?:     string;
  color?:    string;
  material?: string;
  price?:    number;
  stock:     number;
  isActive:  boolean;
  attributes?: Record<string, string>;
}

export interface ProductImageDto {
  id:        string;
  productId: string;
  url:       string;
  altText?:  string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductDto {
  id:                string;
  name:              string;
  slug:              string;
  description:       string;
  shortDescription?: string;
  basePrice:         number;
  compareAtPrice?:   number;
  sku?:              string;
  isPersonalizable:  boolean;
  isActive:          boolean;
  soldCount:         number;
  categoryId:        string;
  category?:         CategoryDto;
  variants?:         VariantDto[];
  images?:           ProductImageDto[];
  tags?:             TagDto[];
  rating?:           number;
  reviewCount?:      number;
  createdAt:         string;
  updatedAt:         string;
}

export interface ProductListItemDto {
  id:               string;
  name:             string;
  slug:             string;
  basePrice:        number;
  compareAtPrice?:  number;
  isPersonalizable: boolean;
  soldCount:        number;
  rating?:          number;
  reviewCount?:     number;
  primaryImage?:    string;
  badge?:           'bestseller' | 'new' | 'sale' | 'hot';
  categorySlug?:    string;
}
