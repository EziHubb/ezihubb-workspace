import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

@Schema({ _id: false })
class MenuItem {
  @Prop({ required: true }) name: string;
  /** PostgreSQL Category.id (L3) */
  @Prop({ required: true }) categoryId: string;
  @Prop({ required: true }) slug: string;
  @Prop({ default: 0 }) sortOrder: number;
}

@Schema({ _id: false })
class MenuGroup {
  /** Column header in the mega-menu dropdown */
  @Prop({ required: true }) title: string;
  /** PostgreSQL Category.id (L2) */
  @Prop({ required: true }) categoryId: string;
  @Prop({ required: true }) slug: string;
  @Prop({ type: [MenuItem], default: [] }) items: MenuItem[];
  @Prop({ default: 0 }) sortOrder: number;
}

// ── Root document ─────────────────────────────────────────────────────────────

@Schema({ collection: 'category_menus', timestamps: true })
export class CategoryMenu extends Document {
  /**
   * The top-level nav tab label shown in the header.
   * e.g. "Home & Living", "Apparel", "Accessories"
   */
  @Prop({ required: true }) navLabel: string;
  @Prop({ required: true }) navSlug: string;

  /** Points to PostgreSQL Category.id (L1 parent) */
  @Prop({ required: true }) categoryId: string;

  @Prop({ default: 0 }) sortOrder: number;
  @Prop({ default: true }) isVisible: boolean;
  @Prop() iconUrl?: string;

  /**
   * Subcategory groups — each group becomes one column in the mega-menu.
   * Cached in Redis (TTL 10 min) on the API layer.
   */
  @Prop({ type: [MenuGroup], default: [] })
  groups: MenuGroup[];
}

export const CategoryMenuSchema = SchemaFactory.createForClass(CategoryMenu);
CategoryMenuSchema.index({ navLabel: 1 }, { unique: true });
CategoryMenuSchema.index({ navSlug: 1 }, { unique: true });
CategoryMenuSchema.index({ isVisible: 1, sortOrder: 1 });
