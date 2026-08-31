import type {
  AdminProductDto,
  AdminProductDetailDto,
  ApplyVariationsPayload,
  ProductEditFormValues,
  ProductVariantRow,
  VariationGroup,
  VariationSettings,
} from './types';
import { safeArr, safeStr } from '../../../lib/fmt';

// ── Empty defaults (create mode) ─────────────────────────────────────────────

const EMPTY_DEFAULTS: ProductEditFormValues = {
  imageIds:             [],
  imageOrder:           [],
  videoUrls:            [],
  thumbnailCropData:    null,
  imageAltTexts:        {},
  pendingImageUrls:     [],
  name:                 '',
  description:          '',
  primaryCategoryId:    '',
  productType:          'PHYSICAL',
  tags:                 [],
  materials:            [],
  primaryColors:        [],
  secondaryColors:      [],
  occasions:            [],
  holidayTags:          [],
  recipientTags:        [],
  styles:               [],
  sustainability:       [],
  width:                null,
  height:               null,
    // Defaults to 'CM' (not null) to match what the unit <Select> in
  // DimensionFields visually shows by default (`watch('dimensionUnit') ??
  // 'CM'`) — otherwise a seller who only fills in width/height without ever
  // touching the dropdown would save width:12.5, dimensionUnit:null, an
  // ambiguous unit-less measurement despite the UI appearing to say "cm".
  dimensionUnit:        'CM',
  customOptions:        [],
  variationDraft:       null,
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
  // Left unset: an unanswered provenance question stays unanswered rather
  // than defaulting into a claim the seller never made.
  whenMade:             null,
  giftWrappingAvailable: false,
  toolsUsed:            [],
  productionPartnerIds: [],
  hsCode:               '',
  gpsrInfo:             null,
  shopSectionId:        null,
  isFeatured:           false,
  isAdsEnabled:         false,
  renewalType:          'AUTOMATIC',
  relatedProductIds:    [],
};

// ── Build React Hook Form default values ──────────────────────────────────────
// Both product and detail are optional — null = create mode.

// ── Variation price-flag helpers ───────────────────────────────────────────
// Settings are encoded in VariationSettings.variesBy: string[] as
// 'price:<groupId>' (a specific group's options carry their own price) or
// bare legacy 'price' (all groups vary — from before per-group pricing
// existed). Single source of truth so readers (ItemOptionsTab,
// PricingShippingTab) and the writer (ManageVariationsModal) never drift
// apart on the encoding again.

export function pricedGroupIds(variesBy: string[], allGroupIds: string[]): string[] {
  if (variesBy.includes('price')) return allGroupIds;
  return allGroupIds.filter((id) => variesBy.includes(`price:${id}`));
}

// ── Combo price grid helpers ─────────────────────────────────────────────────
// Mirrors ProductsService.syncVariantsFromGroups()'s cartesian-product logic
// exactly (same comboKey shape) so the grid can preview all N combinations —
// and let the seller price them — before Apply, without a server round trip.

export function comboKey(options: Record<string, string>): string {
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}

export interface ComboPreview {
  key:     string;
  name:    string;
  options: Record<string, string>;
}

/** Cartesian product of each group's available (isAvailable !== false) options.
 *  Empty when there are no groups, or any group currently has zero available
 *  options (mid-edit — nothing to preview yet). */
export function computeCombos(groups: VariationGroup[]): ComboPreview[] {
  const availableGroups = groups.map((g) => ({
    ...g,
    options: g.options.filter((o) => o.isAvailable !== false),
  }));
  if (availableGroups.length === 0) return [];
  if (availableGroups.some((g) => g.options.length === 0)) return [];

  let combos: { name: string; options: Record<string, string> }[] = [{ name: '', options: {} }];
  for (const group of availableGroups) {
    const next: typeof combos = [];
    for (const combo of combos) {
      for (const opt of group.options) {
        next.push({
          name:    combo.name ? `${combo.name} / ${opt.name}` : opt.name,
          options: { ...combo.options, [group.name]: opt.name },
        });
      }
    }
    combos = next;
  }
  return combos.map((c) => ({ ...c, key: comboKey(c.options) }));
}

export function buildDefaultValues(
  product: AdminProductDto | null | undefined,
  detail:  AdminProductDetailDto | null | undefined,
): ProductEditFormValues {
  if (!product) return { ...EMPTY_DEFAULTS };

  return {
    // Photo & Video
    // Print files travel with the product but are never part of the shopper
    // gallery — only MOCKUP rows belong in imageIds.
    imageIds:          safeArr(product.images).filter((i) => i.type !== 'PRINT_FILE').sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id),
    imageOrder:        safeArr(product.images).filter((i) => i.type !== 'PRINT_FILE').sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id),
    videoUrls:         safeArr(product.videoUrls),
    thumbnailCropData: product.thumbnailCropData ?? null,
    imageAltTexts:     detail?.imageAltTexts     ?? {},
    pendingImageUrls:  [],

    // Item Details
    name:              product.name,
    description:       safeStr(detail?.richDescription ?? product.description),
    primaryCategoryId: safeStr(product.primaryCategoryId ?? product.categoryId),
    productType:       product.productType ?? 'PHYSICAL',

    // Item Options
    tags:            safeArr(product.productTags).map((pt) => pt.tag.name),
    materials:       safeArr(product.materials),
    primaryColors:   safeArr(product.primaryColors),
    secondaryColors: safeArr(product.secondaryColors),
    occasions:       safeArr(product.occasions),
    holidayTags:     safeArr(product.holidayTags),
    recipientTags:   safeArr(product.recipientTags),
    styles:          safeArr(product.styles),
    sustainability:  safeArr(product.sustainability),
    width:           product.width         ?? null,
    height:          product.height        ?? null,
    dimensionUnit:   product.dimensionUnit ?? 'CM',
    customOptions:   safeArr(detail?.customOptions) as unknown[],
    variationDraft:  null,

    // Pricing & Shipping
    basePrice:             Number(product.basePrice),
    compareAtPrice:        product.compareAtPrice ? Number(product.compareAtPrice) : null,
    sku:                   safeStr(product.sku),
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
    whenMade:             product.whenMade             ?? null,
    giftWrappingAvailable: product.giftWrappingAvailable ?? false,
    toolsUsed:            safeArr(product.toolsUsed),
    productionPartnerIds: safeArr(product.productionPartnerIds),
    hsCode:               safeStr(product.hsCode),
    gpsrInfo:             detail?.gpsrInfo             ?? null,

    // Settings
    shopSectionId: product.shopSectionId ?? null,
    isFeatured:    product.isFeatured    ?? false,
    isAdsEnabled:  product.isAdsEnabled  ?? false,
    renewalType:   product.renewalType   ?? 'AUTOMATIC',
    relatedProductIds: safeArr(product.featuredRelatedIds),
  };
}

// ── Split form data by destination ───────────────────────────────────────────

/** Fields that go to PATCH /admin/products/:id (PostgreSQL) */
export function extractPrismaFields(data: ProductEditFormValues) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { description, customOptions, variationDraft, relatedProductIds, gpsrInfo, imageAltTexts, imageIds, imageOrder, pendingImageUrls, videoUrls, primaryCategoryId, ...prismaData } = data;
  return { ...prismaData, categoryId: primaryCategoryId };
}

/** Fields that go to PUT /admin/products/:id/detail (MongoDB) */
export function extractMongoFields(data: ProductEditFormValues) {
  return {
    richDescription: data.description,
    gpsrInfo:        data.gpsrInfo,
    imageAltTexts:   data.imageAltTexts,
    customOptions:   data.customOptions,
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
//   - imageIds → [] (ProductImage ids belong to the source product)
//   - sku → '' (auto-generated on save to avoid unique constraint collision)
//   - name → "Copy of {source.name}"
// Shopper-facing image URLs are staged as pending uploads. Publishing the copy
// creates NEW ProductImage rows for the draft, so the copied listing opens with
// the same gallery without ever reusing the source product's database ids.
// Starts as inactive so the admin can review before publishing.

export function buildCopyDefaultValues(
  source:       AdminProductDto,
  sourceDetail: AdminProductDetailDto | null | undefined,
  variationDraft?: ApplyVariationsPayload | null,
): ProductEditFormValues {
  const base = buildDefaultValues(source, sourceDetail);
  const copyImages = source.images
    .filter((image) => image.type === 'MOCKUP')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const pendingImageUrls = copyImages.map((image) => image.url);
  return {
    ...base,
    name:             `Copy of ${source.name}`,
    sku:              '',   // generateSku() will run on save
    imageIds:         [],   // ids belong to the source product record
    imageOrder:       pendingImageUrls.map(toPendingImageRef),
    pendingImageUrls,
    imageAltTexts: Object.fromEntries(copyImages.flatMap((image) => {
      const altText = sourceDetail?.imageAltTexts?.[image.id] ?? image.altText;
      return altText ? [[toPendingImageRef(image.url), altText]] : [];
    })),
    variationDraft: variationDraft ?? null,
  };
}

export const PENDING_IMAGE_REF_PREFIX = 'pending:';

export function toPendingImageRef(url: string): string {
  return `${PENDING_IMAGE_REF_PREFIX}${url}`;
}

export function fromPendingImageRef(ref: string): string | null {
  return ref.startsWith(PENDING_IMAGE_REF_PREFIX)
    ? ref.slice(PENDING_IMAGE_REF_PREFIX.length)
    : null;
}

/** Clone variation data without reusing globally unique source row ids. */
export function buildCopyVariationDraft(
  groups: VariationGroup[],
  settings: VariationSettings | null | undefined,
  variants: ProductVariantRow[],
  sourceImages: AdminProductDto['images'],
): ApplyVariationsPayload | null {
  if (!groups.length) return null;

  const groupIdMap = new Map(groups.map((group, index) => [group.id, `new-copy-${index}`]));
  const imageUrlById = new Map(sourceImages.map((image) => [image.id, image.url]));
  const mappedGroups = groups.map((group, groupIndex) => {
    const groupId = groupIdMap.get(group.id) ?? `new-copy-${groupIndex}`;
    return {
      id: groupId,
      name: group.name,
      displayType: group.displayType,
      sortOrder: group.sortOrder,
      options: group.options.map((option, optionIndex) => {
        const linkedUrl = option.imageId ? imageUrlById.get(option.imageId) : option.imageUrl;
        return {
          id: `new-copy-${groupIndex}-${optionIndex}`,
          name: option.name,
          value: option.value,
          colorHex: option.colorHex,
          imageUrl: linkedUrl ?? null,
          imageId: linkedUrl ? toPendingImageRef(linkedUrl) : null,
          isAvailable: option.isAvailable,
          sortOrder: option.sortOrder,
        };
      }),
    };
  });

  const variesBy = (settings?.variesBy ?? []).map((flag) => {
    if (!flag.startsWith('price:')) return flag;
    const mapped = groupIdMap.get(flag.slice('price:'.length));
    return mapped ? `price:${mapped}` : flag;
  });

  return {
    groups: mappedGroups,
    variesBy,
    photoGroupId: settings?.photoGroupId
      ? groupIdMap.get(settings.photoGroupId) ?? null
      : null,
    variantEdits: variants.map((variant) => ({
      options: variant.options,
      price: variant.price === null ? null : Number(variant.price),
      quantity: variant.quantity,
      sku: null,
      isAvailable: variant.isAvailable,
    })),
  };
}
