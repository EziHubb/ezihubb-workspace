/**
 * Mongoose models the seed needs — which is now only the mega-menu.
 *
 * A ProductDetail model used to live here too, for the demo product seed. It
 * was never the real one: the API owns
 * apps/api/src/modules/catalog/schemas/product-detail.schema.ts, and a second
 * definition of the same collection is a schema that can drift from the one
 * actually serving traffic. It went with the seed that used it.
 */

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
