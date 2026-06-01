export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  level: 1 | 2 | 3;
  parentId?: string;
  sortOrder: number;
  isVisible: boolean;
  children?: CategoryDto[];
  _count?: { products: number };
  /** @deprecated use _count.products */
  productCount?: number;
}

export interface CollectionDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  occasion?: string;
  isActive: boolean;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
  _count?: { products: number };
  // backward compat — some components still use these flat fields
  /** @deprecated use bannerUrl */
  imageUrl?: string;
  /** @deprecated use _count.products */
  productCount?: number;
  isFeatured?: boolean;
}

export interface TagDto {
  id: string;
  name: string;
  slug: string;
}

// ── MongoDB mega-menu types ────────────────────────────────────────────────────

export interface MenuItemDto {
  name: string;
  categoryId: string;
  slug: string;
  sortOrder: number;
}

export interface MenuGroupDto {
  title: string;
  categoryId: string;
  slug: string;
  items: MenuItemDto[];
  sortOrder: number;
}

export interface MegaMenuDto {
  navLabel: string;
  navSlug: string;
  categoryId: string;
  sortOrder: number;
  isVisible: boolean;
  iconUrl?: string;
  groups: MenuGroupDto[];
}
