import mongoose, { Schema, model, Model } from 'mongoose';

// ── CategoryMenu ──────────────────────────────────────────────────────────────

export interface IMenuItem {
  name: string;
  categoryId: string;
  slug: string;
  sortOrder: number;
}

export interface IMenuGroup {
  title: string;
  categoryId: string;
  slug: string;
  items: IMenuItem[];
  sortOrder: number;
}

export interface ICategoryMenu {
  navLabel: string;
  navSlug: string;
  categoryId: string;
  sortOrder: number;
  isVisible: boolean;
  iconUrl?: string;
  groups: IMenuGroup[];
}

const menuItemSchema = new Schema<IMenuItem>(
  { name: String, categoryId: String, slug: String, sortOrder: { type: Number, default: 0 } },
  { _id: false },
);

const menuGroupSchema = new Schema<IMenuGroup>(
  { title: String, categoryId: String, slug: String, items: [menuItemSchema], sortOrder: { type: Number, default: 0 } },
  { _id: false },
);

const categoryMenuSchema = new Schema<ICategoryMenu>(
  {
    navLabel:   { type: String, required: true, unique: true },
    navSlug:    { type: String, required: true, unique: true },
    categoryId: { type: String, required: true },
    sortOrder:  { type: Number, default: 0 },
    isVisible:  { type: Boolean, default: true },
    iconUrl:    String,
    groups:     [menuGroupSchema],
  },
  { collection: 'category_menus', timestamps: true },
);

export let CategoryMenuModel: Model<ICategoryMenu>;
try {
  CategoryMenuModel = mongoose.model<ICategoryMenu>('CategoryMenu');
} catch {
  CategoryMenuModel = model<ICategoryMenu>('CategoryMenu', categoryMenuSchema);
}

// ── ProductDetail ─────────────────────────────────────────────────────────────

export interface IProductDetail {
  productId: string;
  attributes:     { key: string; value: string; filterable: boolean; unit?: string }[];
  variantOptions: { name: string; values: string[] }[];
  richDescription?: string;
  printSpecs?: { minDPI: number; maxFileSize: number; acceptedFormats: string[] };
  customization?: object;
}

const productDetailSchema = new Schema<IProductDetail>(
  {
    productId:      { type: String, required: true, unique: true },
    attributes:     [{ key: String, value: String, filterable: Boolean, unit: String, _id: false }],
    variantOptions: [{ name: String, values: [String], _id: false }],
    richDescription: String,
    printSpecs:     { minDPI: Number, maxFileSize: Number, acceptedFormats: [String] },
    customization:  { type: Object, default: undefined },
  },
  { collection: 'product_details', timestamps: true },
);

export let ProductDetailModel: Model<IProductDetail>;
try {
  ProductDetailModel = mongoose.model<IProductDetail>('ProductDetail');
} catch {
  ProductDetailModel = model<IProductDetail>('ProductDetail', productDetailSchema);
}
