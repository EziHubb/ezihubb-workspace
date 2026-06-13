import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ── Sub-schemas (not separate collections) ───────────────────────────────────

@Schema({ _id: false })
class Attribute {
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) value!: string;
  @Prop({ default: false }) filterable!: boolean;
  @Prop() unit?: string;
}

@Schema({ _id: false })
class VariantOption {
  @Prop({ required: true }) name!: string;
  @Prop({ type: [String], required: true }) values!: string[];
}

@Schema({ _id: false })
class Variant {
  @Prop({ required: true }) sku!: string;
  @Prop({ type: Object, required: true }) options!: Record<string, string>;
  @Prop({ required: true }) price!: number;
  @Prop() compareAtPrice?: number;
  @Prop({ default: true }) isAvailable!: boolean;
  @Prop({ default: false }) isDefault!: boolean;
  @Prop() imageIndex?: number;
}

@Schema({ _id: false })
class CustomizerField {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true, enum: ['text', 'textarea', 'image', 'select', 'color'] }) type!: string;
  @Prop({ required: true }) label!: string;
  @Prop({ default: false }) required!: boolean;
  @Prop() maxLength?: number;
  @Prop({ type: [String] }) options?: string[];
  @Prop({ type: Object }) position?: { x: number; y: number };
  @Prop({ type: Object }) size?: { w: number; h: number };
  @Prop({ default: false }) allowBgRemoval?: boolean;
}

@Schema({ _id: false })
class PreviewLayer {
  @Prop({ required: true, enum: ['base', 'overlay', 'text', 'image'] }) type!: string;
  @Prop({ required: true }) url!: string;
  @Prop({ required: true }) zIndex!: number;
}

@Schema({ _id: false })
class CustomizationTemplate {
  @Prop({ required: true }) templateId!: string;
  @Prop({ required: true }) version!: number;
  @Prop({ type: [CustomizerField], default: [] }) fields!: CustomizerField[];
  @Prop({ type: [PreviewLayer], default: [] }) previewLayers!: PreviewLayer[];
}

// ── Root document ─────────────────────────────────────────────────────────────

@Schema({ collection: 'product_details', timestamps: true })
export class ProductDetail extends Document {
  /** Foreign key → PostgreSQL Product.id */
  @Prop({ required: true, unique: true, index: true })
  productId!: string;

  /** Rich description (HTML allowed) */
  @Prop() richDescription?: string;

  /** Size guide (markdown or HTML) */
  @Prop() sizeGuide?: string;

  /** Shipping & returns notes — overrides global defaults when set */
  @Prop() shippingNote?: string;

  /**
   * Flexible product attributes.
   * Mug examples:   Material, Capacity, Dimensions, Weight, Dishwasher Safe
   * Apparel examples: Material, Fit, Care Instructions, Country of Origin
   * Canvas examples:  Print Method, Frame Options, Material
   */
  @Prop({ type: [Attribute], default: [] })
  attributes!: Attribute[];

  /** Variant option dimensions (e.g. Size, Color) */
  @Prop({ type: [VariantOption], default: [] })
  variantOptions!: VariantOption[];

  /** Concrete variant SKUs */
  @Prop({ type: [Variant], default: [] })
  variants!: Variant[];

  /** Customization template — null when product is not personalizable */
  @Prop({ type: CustomizationTemplate, default: null })
  customization?: CustomizationTemplate;

  /** SEO overrides */
  @Prop() metaTitle?: string;
  @Prop() metaDescription?: string;

  /** Print-on-demand technical specs (for quality gating in the customizer) */
  @Prop({ type: Object })
  printSpecs?: {
    minDPI: number;
    maxFileSize: number;   // MB
    acceptedFormats: string[];
    printArea?: { w: number; h: number; unit: string };
  };

  /**
   * Per-image accessibility alt texts keyed by ProductImage.id (PostgreSQL).
   * Allows admin to store rich, context-aware alt text separately from the
   * PostgreSQL ProductImage.altText field which is limited to short strings.
   */
  @Prop({ type: Object, default: {} })
  imageAltTexts!: Record<string, string>;

  /**
   * EU General Product Safety Regulation (GPSR) manufacturer / responsible
   * person information.  Required for products sold to EU customers from 2024.
   */
  @Prop({ type: Object, default: null })
  gpsrInfo?: {
    manufacturerName?:    string;
    manufacturerAddress?: string;
    manufacturerEmail?:   string;
    safetyWarnings?:      string[];
    countryOfOrigin?:     string;
  };
}

export const ProductDetailSchema = SchemaFactory.createForClass(ProductDetail);
