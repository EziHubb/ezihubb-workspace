// ── Enum mirrors (keep in sync with Prisma schema enums) ─────────────────────

export type WhoMadeIt     = 'I_DID' | 'SHOP_MEMBER' | 'ANOTHER_COMPANY';
export type HowItWasMade  = 'MADE_TO_ORDER' | 'HANDMADE' | 'ASSEMBLED' | 'ALTERED' | 'CURATED_SET' | 'NATURAL_MATERIAL';
export type ReturnPolicy  = 'NO_RETURNS' | 'RETURNS_ACCEPTED' | 'EXCHANGES_ONLY';
export type RenewalType   = 'AUTOMATIC' | 'MANUAL';
export type ProductType   = 'PHYSICAL' | 'DIGITAL';
export type DimensionUnit = 'CM' | 'IN' | 'MM' | 'M';

// ── GPSR manufacturer / responsible-person info ───────────────────────────────

export interface GpsrInfo {
  manufacturerName?:    string;
  manufacturerAddress?: string;
  manufacturerEmail?:   string;
  safetyWarnings?:      string[];
  countryOfOrigin?:     string;
}

// ── Shared form shape (all 7 tabs) ────────────────────────────────────────────

export interface ProductEditFormValues {
  // Photo & Video tab
  imageIds:          string[];
  videoUrls:         string[];
  thumbnailCropData: Record<string, number> | null;
  imageAltTexts:     Record<string, string>;
  pendingImageUrls:  string[];   // URLs uploaded via presign in create mode (not yet in DB)

  // Item Details tab
  name:              string;
  description:       string;
  primaryCategoryId: string;
  productType:       ProductType;

  // Item Options tab
  tags:            string[];
  materials:       string[];
  primaryColors:   string[];
  secondaryColors: string[];
  occasions:       string[];
  holidayTags:     string[];
  recipientTags:   string[];
  styles:          string[];
  sustainability:  string[];
  width:           number | null;
  height:          number | null;
  dimensionUnit:   DimensionUnit | null;
  customOptions:   unknown[];

  // Pricing & Shipping tab
  basePrice:             number;
  compareAtPrice:        number | null;
  sku:                   string;
  quantity:              number | null;
  trackInventory:        boolean;
  lowStockThreshold:     number | null;
  domesticGlobalPricing: boolean;
  processingProfileId:   string | null;
  shippingProfileId:     string | null;
  returnPolicy:          ReturnPolicy;

  // How It's Made tab
  whoMadeIt:             WhoMadeIt;
  howItWasMade:          HowItWasMade;
  toolsUsed:             string[];
  productionPartnerIds:  string[];
  hsCode:                string;
  gpsrInfo:              GpsrInfo | null;

  // Settings tab
  shopSectionId: string | null;
  isFeatured:    boolean;
  isAdsEnabled:  boolean;
  renewalType:   RenewalType;
}

// ── Variation types (shared with ManageVariationsModal, VariantImagePicker) ───

export interface VariationOption {
  id:          string;
  groupId:     string;
  name:        string;
  value:       string;
  colorHex?:   string;
  imageUrl?:   string;
  /** Which product photo (ProductImage.id) represents this variant */
  imageId?:    string | null;
  priceDelta?: number | null;
  sortOrder:   number;
  isAvailable: boolean;
}

export interface VariationSettings {
  enableVariations: boolean;
  /** Encoded flags: 'price:<groupId>' | 'processing' | 'quantity' | 'sku' */
  variesBy:         string[];
  skuPrefix?:       string;
}

export interface VariationGroup {
  id:          string;
  productId:   string;
  name:        string;
  displayType: string; // 'dropdown' | 'color_swatch' | 'button' | 'image'
  sortOrder:   number;
  options:     VariationOption[];
}

// ── Combo price grid (ManageVariationsModal's VariantComboGrid) ──────────────

/** A real, materialised ProductVariant row — the purchasable, priced SKU. */
export interface ProductVariantRow {
  id:          string;
  productId:   string;
  name:        string;
  options:     Record<string, string>;
  price:       number | null;
  quantity:    number | null;
  sku:         string | null;
  isAvailable: boolean;
  isDefault:   boolean;
  sortOrder:   number;
}

/** A pending per-combo edit, keyed by options (not id) — a brand-new
 *  combination the seller priced before hitting Apply has no
 *  ProductVariant.id yet; the backend resolves it once it creates the row. */
export interface VariantEditPatch {
  options:      Record<string, string>;
  price?:       number | null;
  quantity?:    number | null;
  sku?:         string | null;
  isAvailable?: boolean;
}

/** Body for POST /admin/products/:id/variations/apply — the single commit
 *  for everything changed inside the "Manage variations" modal. */
export interface ApplyVariationsPayload {
  groups: {
    id?:          string;
    name:         string;
    displayType?: string;
    sortOrder:    number;
    options: {
      id?:          string;
      name:         string;
      value?:       string;
      colorHex?:    string;
      // Preserved through the round-trip so VariantImagePicker's photo
      // assignment (a separate, immediate-commit PATCH) doesn't get wiped
      // out the next time the seller hits Apply — applyVariations() replaces
      // the whole group/option tree, so any field missing here is silently
      // dropped even if it was never touched in this session.
      imageUrl?:    string | null;
      imageId?:     string | null;
      isAvailable?: boolean;
      sortOrder?:   number;
    }[];
  }[];
  variesBy:      string[];
  variantEdits?: VariantEditPatch[];
}

// ── API shapes (what we receive from the server) ──────────────────────────────

export type PrintSide = 'FRONT' | 'BACK' | 'SLEEVE' | 'HOOD';

export interface ProductImage {
  id:        string;
  url:       string;
  altText?:  string;
  isPrimary: boolean;
  sortOrder: number;
  type:      'MOCKUP' | 'PRINT_FILE';
  printSide: PrintSide | null;
}

export interface ProductTag {
  tag: { id: string; name: string; slug: string };
}

export interface DigitalFile {
  id:        string;
  filename:  string;
  mimeType:  string;
  sizeBytes: number;
  sortOrder: number;
  variantId: string | null;
}

export interface AdminProductDto {
  id:                   string;
  storeId?:             string | null;
  name:                 string;
  slug:                 string;
  sku:                  string;
  description:          string;
  shortDescription?:    string;
  basePrice:            string | number;
  compareAtPrice?:      string | number | null;
  isPersonalizable:     boolean;
  isActive:             boolean;
  status?:              'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  productType?:         ProductType;
  isFeatured:           boolean;
  isAdsEnabled?:        boolean;
  viewCount:            number;
  soldCount:            number;
  processingDays?:      number;
  categoryId:           string;
  primaryCategoryId?:   string;
  publishedAt?:         string;
  createdAt:            string;
  images:               ProductImage[];
  digitalFiles?:        DigitalFile[];
  productTags?:         ProductTag[];
  videoUrls?:           string[];
  thumbnailCropData?:   Record<string, number> | null;
  primaryColors?:       string[];
  secondaryColors?:     string[];
  materials?:           string[];
  occasions?:           string[];
  holidayTags?:         string[];
  recipientTags?:       string[];
  styles?:              string[];
  sustainability?:      string[];
  width?:               number | null;
  height?:              number | null;
  dimensionUnit?:       DimensionUnit | null;
  quantity?:            number | null;
  trackInventory?:      boolean;
  lowStockThreshold?:   number | null;
  domesticGlobalPricing?: boolean;
  processingProfileId?: string | null;
  shippingProfileId?:   string | null;
  returnPolicy?:        ReturnPolicy;
  whoMadeIt?:           WhoMadeIt;
  howItWasMade?:        HowItWasMade;
  toolsUsed?:           string[];
  productionPartnerIds?: string[];
  hsCode?:              string;
  shopSectionId?:       string | null;
  renewalType?:         RenewalType;
  featuredRelatedIds?:  string[];
}

export interface AdminProductDetailDto {
  productId:        string;
  richDescription?: string;
  sizeGuide?:       string;
  shippingNote?:    string;
  attributes?:      unknown[];
  imageAltTexts?:   Record<string, string>;
  gpsrInfo?:        GpsrInfo | null;
  customOptions?:   unknown[];
  metaTitle?:       string;
  metaDescription?: string;
  printSpecs?:      unknown;
}
