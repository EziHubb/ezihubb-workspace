export interface CategoryDto {
  id:          string;
  name:        string;
  slug:        string;
  description?: string;
  imageUrl?:   string;
  parentId?:   string;
  parent?:     Pick<CategoryDto, 'id' | 'name' | 'slug'>;
  children?:   Pick<CategoryDto, 'id' | 'name' | 'slug'>[];
  productCount?: number;
  isActive:    boolean;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
}

export interface CollectionDto {
  id:          string;
  name:        string;
  slug:        string;
  description?: string;
  imageUrl?:   string;
  isActive:    boolean;
  isFeatured:  boolean;
  productCount?: number;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
}

export interface TagDto {
  id:   string;
  name: string;
  slug: string;
}
