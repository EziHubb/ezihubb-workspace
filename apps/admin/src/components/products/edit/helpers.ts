import type { AdminProductDto, AdminProductDetailDto, ProductEditFormValues } from './types';

// ── Empty defaults (create mode) ─────────────────────────────────────────────

const EMPTY_DEFAULTS: ProductEditFormValues = {
  imageIds:             [],
  videoUrls:            [],
  thumbnailCropData:    null,
  imageAltTexts:        {},
  pendingImageUrls:     [],
  name:                 '',
  description:          '',
  primaryCategoryId:    '',
  tags:                 [],
  materials:            [],
  primaryColors:        [],
  secondaryColors:      [],
  occasions:            [],
  holidayTags:          [],
  recipientTags:        [],
  styles:               [],
  sustainability:       [],
  customOptions:        [],
  basePrice:            0,
  compareAtPrice:       null,
  sku:                  '',
  quantity:             null,
  trackInventory:       false,
  lowStockThreshold:    null,
  domesticGlobalPricing: false,
  processingProfileId:  null,
  shippingProfileId:    null,
  returnPolicy:         'NO_RETURNS',
  whoMadeIt:            'I_DID',
  howItWasMade:         'MADE_TO_ORDER',
  toolsUsed:            [],
  productionPartnerIds: [],
  hsCode:               '',
  gpsrInfo:             null,
  shopSectionId:        null,
  isFeatured:           false,
  isAdsEnabled:         false,
  renewalType:          'AUTOMATIC',
};

// ── Build React Hook Form default values ──────────────────────────────────────
// Both product and detail are optional — null = create mode.

export function buildDefaultValues(
  product: AdminProductDto | null | undefined,
  detail:  AdminProductDetailDto | null | undefined,
): ProductEditFormValues {
  if (!product) return { ...EMPTY_DEFAULTS };

  return {
    // Photo & Video
    imageIds:          (product.images ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id),
    videoUrls:         product.videoUrls         ?? [],
    thumbnailCropData: product.thumbnailCropData ?? null,
    imageAltTexts:     detail?.imageAltTexts     ?? {},
    pendingImageUrls:  [],

    // Item Details
    name:              product.name,
    description:       detail?.richDescription   ?? product.description ?? '',
    primaryCategoryId: product.primaryCategoryId ?? product.categoryId  ?? '',

    // Item Options
    tags:            (product.productTags ?? []).map((pt) => pt.tag.name),
    materials:       product.materials       ?? [],
    primaryColors:   product.primaryColors   ?? [],
    secondaryColors: product.secondaryColors ?? [],
    occasions:       product.occasions       ?? [],
    holidayTags:     product.holidayTags     ?? [],
    recipientTags:   product.recipientTags   ?? [],
    styles:          product.styles          ?? [],
    sustainability:  product.sustainability  ?? [],
    customOptions:   (detail?.customOptions  ?? []) as unknown[],

    // Pricing & Shipping
    basePrice:             Number(product.basePrice),
    compareAtPrice:        product.compareAtPrice ? Number(product.compareAtPrice) : null,
    sku:                   product.sku                    ?? '',
    quantity:              product.quantity               ?? null,
    trackInventory:        product.trackInventory         ?? false,
    lowStockThreshold:     product.lowStockThreshold      ?? null,
    domesticGlobalPricing: product.domesticGlobalPricing ?? false,
    processingProfileId:   product.processingProfileId   ?? null,
    shippingProfileId:     product.shippingProfileId     ?? null,
    returnPolicy:          product.returnPolicy          ?? 'NO_RETURNS',

    // How It's Made
    whoMadeIt:            product.whoMadeIt            ?? 'I_DID',
    howItWasMade:         product.howItWasMade         ?? 'MADE_TO_ORDER',
    toolsUsed:            product.toolsUsed            ?? [],
    productionPartnerIds: product.productionPartnerIds ?? [],
    hsCode:               product.hsCode               ?? '',
    gpsrInfo:             detail?.gpsrInfo             ?? null,

    // Settings
    shopSectionId: product.shopSectionId ?? null,
    isFeatured:    product.isFeatured    ?? false,
    isAdsEnabled:  product.isAdsEnabled  ?? false,
    renewalType:   product.renewalType   ?? 'AUTOMATIC',
  };
}

// ── Split form data by destination ───────────────────────────────────────────

/** Fields that go to PATCH /admin/products/:id (PostgreSQL) */
export function extractPrismaFields(data: ProductEditFormValues) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { description, customOptions, gpsrInfo, imageAltTexts, imageIds, pendingImageUrls, primaryCategoryId, ...prismaData } = data;
  return { ...prismaData, categoryId: primaryCategoryId };
}

/** Fields that go to PUT /admin/products/:id/detail (MongoDB) */
export function extractMongoFields(data: ProductEditFormValues) {
  return {
    richDescription: data.description,
    gpsrInfo:        data.gpsrInfo,
    imageAltTexts:   data.imageAltTexts,
  };
}

/**
 * Auto-generate a SKU for new listings.
 * Format: MLH-XXXXXXXX (8 alphanumeric chars from timestamp)
 */
export function generateSku(): string {
  return `MLH-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

// ── Build pre-filled values for Copy Product flow ─────────────────────────────
//
// Copies all form-editable data from a source product.
// Intentionally resets:
//   - imageIds → [] (ProductImage rows belong to the source — can't be reused)
//   - sku → '' (auto-generated on save to avoid unique constraint collision)
//   - name → "Copy of {source.name}"
// Starts as inactive so the admin can review before publishing.

export function buildCopyDefaultValues(
  source:       AdminProductDto,
  sourceDetail: AdminProductDetailDto | null | undefined,
): ProductEditFormValues {
  const base = buildDefaultValues(source, sourceDetail);
  return {
    ...base,
    name:     `Copy of ${source.name}`,
    sku:      '',   // generateSku() will run on save
    imageIds: [],   // images belong to the source product record; admin re-uploads
  };
}
