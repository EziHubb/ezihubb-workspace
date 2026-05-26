export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserDto {
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  displayName?:  string;
  avatarUrl?:    string;
  role:          UserRole;
  isActive:      boolean;
  emailVerified: boolean;
  phone?:        string;
  createdAt:     string;
  updatedAt:     string;
}

export interface AddressDto {
  id:           string;
  userId:       string;
  label:        string;
  firstName:    string;
  lastName:     string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  state:        string;
  postalCode:   string;
  country:      string;
  phone:        string;
  isDefault:    boolean;
}

export interface WishlistItemDto {
  id:        string;
  productId: string;
  addedAt:   string;
  product: {
    id:        string;
    name:      string;
    slug:      string;
    basePrice: number;
    imageUrl?: string;
    isActive:  boolean;
  };
}
