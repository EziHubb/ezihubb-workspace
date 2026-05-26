export interface CartItemDto {
  id:            string;
  cartId:        string;
  productId:     string;
  variantId?:    string;
  quantity:      number;
  unitPrice:     number;
  totalPrice:    number;
  customization?: Record<string, unknown>;
  product?: {
    name:      string;
    slug:      string;
    imageUrl?: string;
    isActive:  boolean;
  };
  variant?: {
    sku:       string;
    size?:     string;
    color?:    string;
    material?: string;
  };
}

export interface CartDto {
  id:        string;
  userId?:   string;
  sessionId?: string;
  items:     CartItemDto[];
  subtotal:  number;
  itemCount: number;
  updatedAt: string;
}
