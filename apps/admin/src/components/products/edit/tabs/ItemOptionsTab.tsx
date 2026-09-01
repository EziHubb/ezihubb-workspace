'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  X, Plus, Settings, Lock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  ProductEditFormValues, AdminProductDto, ProductImage,
  VariationOption, VariationGroup, VariationSettings, ProductVariantRow, DimensionUnit,
  ApplyVariationsPayload, VariantEditPatch,
} from '../types';
import { comboKey, computeCombos, pricedGroupIds } from '../helpers';
import { Toggle } from '../primitives/Toggle';
import { ManageVariationsModal } from '../ManageVariationsModal';
import { CustomOptionsEditor } from '../CustomOptionsEditor';
import { AttributeSearchSelect } from '../AttributeSearchSelect';
import { ShowMoreAttributes } from '../ShowMoreAttributes';
import { useListingImages } from '../ListingImagesContext';

// ─── Types ────────────────────────────────────────────────────────────────────
// VariationOption, VariationGroup, VariationSettings are re-exported from types.ts
export type { VariationOption, VariationGroup, VariationSettings } from '../types';

// ─── Shared layout primitives ─────────────────────────────────────────────────

function TabSection({
  title, description, action, children,
}: {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  children:     React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-semibold text-secondary">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5 max-w-xl">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── AttributeTagInput ────────────────────────────────────────────────────────

const TAG_MAX_LEN = 16;

function AttributeTagInput({
  label, name, maxTags, placeholder, description,
}: {
  label:        string;
  name:         keyof ProductEditFormValues;
  maxTags:      number;
  placeholder?: string;
  description?: string;
}) {
  const { setValue, watch } = useFormContext<ProductEditFormValues>();
  const values = (watch(name) ?? []) as string[];
  const [input,     setInput]     = useState('');
  const [errMsg,    setErrMsg]    = useState('');

  const commitInput = (raw: string) => {
    setErrMsg('');
    // Split on commas, trim whitespace, filter empty
    const candidates = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (candidates.length === 0) return;

    const tooLong  = candidates.filter((c) => c.length > TAG_MAX_LEN);
    const valid    = candidates.filter((c) => c.length <= TAG_MAX_LEN && !values.includes(c));
    const toAdd    = valid.slice(0, maxTags - values.length);

    if (toAdd.length > 0) {
      setValue(name, [...values, ...toAdd] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
    }
    if (tooLong.length > 0) {
      setErrMsg(`Tag${tooLong.length > 1 ? 's' : ''} too long (max ${TAG_MAX_LEN} chars): ${tooLong.join(', ')}`);
    }
    setInput('');
  };

  const remove = (v: string) => {
    setErrMsg('');
    setValue(name, (values.filter((x) => x !== v)) as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
  };

  const clearAll = () => {
    setErrMsg('');
    setValue(name, [] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-sm font-semibold text-secondary">{label}</label>
        <span className="text-xs text-muted">Add up to {maxTags} tags</span>
      </div>
      {description && <p className="text-xs text-muted mb-2">{description}</p>}

      {/* Input row */}
      {values.length < maxTags && (
        <div className="flex gap-2 mb-3">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setErrMsg(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitInput(input); }
            }}
            onBlur={() => { if (input.includes(',')) commitInput(input); }}
            placeholder={placeholder ?? `tag1, tag2, tag3… (max ${TAG_MAX_LEN} chars each)`}
            className={[
              'flex-1 px-3 py-2 text-sm border rounded-button bg-background focus:outline-none focus:ring-2 placeholder:text-muted',
              errMsg
                ? 'border-red-400 focus:ring-red-300/20'
                : 'border-border focus:ring-primary/20',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={() => commitInput(input)}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-button transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {errMsg && (
        <p className="text-xs text-red-500 -mt-2 mb-2">{errMsg}</p>
      )}

      {/* Chips + count + Clear all */}
      <div className="flex flex-wrap gap-2 items-center">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-background border border-border rounded-full text-sm text-secondary">
            {v}
            <button type="button" onClick={() => remove(v)} className="p-0.5 rounded-full hover:bg-muted/10 text-muted hover:text-secondary transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {values.length > 0 && (
          <>
            <span className="text-xs text-muted">{values.length}/{maxTags}</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DimensionFields (Width / Height) ─────────────────────────────────────────

const DIMENSION_UNITS: { value: DimensionUnit; label: string }[] = [
  { value: 'CM', label: 'cm' },
  { value: 'IN', label: 'in' },
  { value: 'MM', label: 'mm' },
  { value: 'M',  label: 'm'  },
];

function DimensionFields() {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();
  const width  = watch('width');
  const height = watch('height');
  const unit   = watch('dimensionUnit') ?? 'CM';

  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  return (
    <div>
      <label className="text-sm font-semibold text-secondary mb-1.5 block">Dimensions</label>
      <p className="text-xs text-muted mb-2">The physical size of the item — shown to buyers, separate from shipping.</p>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Width</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={width ?? ''}
            onChange={(e) => setValue('width', numOrNull(e.target.value), { shouldDirty: true })}
            placeholder="0"
            className="w-28 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Height</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={height ?? ''}
            onChange={(e) => setValue('height', numOrNull(e.target.value), { shouldDirty: true })}
            placeholder="0"
            className="w-28 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
          />
        </div>
        <div className="w-28 shrink-0">
          <Select
            value={unit}
            onChange={(e) => setValue('dimensionUnit', e.target.value as DimensionUnit, { shouldDirty: true })}
            options={DIMENSION_UNITS}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Variations summary table ─────────────────────────────────────────────────

const COLLAPSED_COMBINATION_COUNT = 5;

function VariationOptionRow({
  option,
  showPhoto,
  productImages,
  variationName,
  onToggle,
}: {
  option:        VariationOption;
  showPhoto:     boolean;
  productImages: ProductImage[];
  variationName: string;
  onToggle:      (available: boolean) => void;
}) {
  return (
    <tr className={`border-b border-border last:border-0 group transition-opacity ${!option.isAvailable ? 'opacity-40' : ''}`}>
      {/* Photo thumbnail — opens VariantImagePicker modal */}
      {showPhoto && (
        <td className="py-2.5 pr-3 w-12">
          <div
            className="w-9 h-9 rounded-md border border-border bg-muted/10 bg-cover bg-center"
            style={{ backgroundImage: option.imageId
              ? `url(${productImages.find((image) => image.id === option.imageId)?.url ?? ''})`
              : undefined }}
            title={`${variationName}: ${option.name || option.value}`}
          />
        </td>
      )}

      {/* Value + optional color swatch */}
      <td className="py-2.5 text-sm text-secondary font-medium">
        <div className="flex items-center gap-2">
          {option.name || option.value}
          {option.colorHex && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-border shrink-0"
              style={{ backgroundColor: option.colorHex }}
            />
          )}
        </div>
      </td>

      {/* Visible toggle */}
      <td className="py-2.5 text-right">
        <Toggle
          checked={option.isAvailable}
          onChange={onToggle}
          ariaLabel={`Toggle visibility of ${option.name || option.value}`}
        />
      </td>
    </tr>
  );
}

/**
 * The listing photos a shopper can actually be shown.
 *
 * PRINT_FILE rows are production artwork and are filtered out of the public
 * product response entirely, so offering one here would let a seller link a
 * photo that resolves to nothing on the storefront — with no error anywhere to
 * explain why that option shows no picture.
 */
function shopperVisibleImages(images: ProductImage[]): ProductImage[] {
  return images.filter((img) => img.type === 'MOCKUP');
}

/**
 * Variations need photos and a category before they mean anything: options are
 * linked to photos, and the category decides which variation types are offered
 * and which of them shoppers can filter on. Letting someone build variations
 * first only produces work they have to redo.
 */
function useVariationReadiness() {
  const images = shopperVisibleImages(useListingImages());
  const { watch } = useFormContext<ProductEditFormValues>();
  const categoryId = watch('primaryCategoryId');
  const pendingImages = watch('pendingImageUrls') ?? [];

  const missing: string[] = [];
  if (images.length === 0 && pendingImages.length === 0) missing.push('at least one photo');
  if (!categoryId)         missing.push('a category');

  return { images, ready: missing.length === 0, missing };
}

// Shared by the section header and the summary table below it: the header has
// to know whether any variations exist before it can decide which button to
// offer, and that answer must be the same one the table is rendering from.
// Same query key, so react-query serves both from one request.
function useVariationGroups(productId: string) {
  return useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', productId],
    queryFn:  () => api.get<VariationGroup[]>(`/admin/products/${productId}/variations`),
    enabled:  !!productId,
    staleTime: 30_000,
  });
}

function groupsFromDraft(draft: ApplyVariationsPayload | null | undefined, productId: string): VariationGroup[] {
  return (draft?.groups ?? []).map((group, groupIndex) => ({
    id: group.id ?? `new-${groupIndex}`,
    productId,
    name: group.name,
    displayType: group.displayType ?? 'dropdown',
    sortOrder: group.sortOrder,
    options: group.options.map((option, optionIndex) => ({
      id: option.id ?? `new-${groupIndex}-${optionIndex}`,
      groupId: group.id ?? `new-${groupIndex}`,
      name: option.name,
      value: option.value ?? option.name,
      colorHex: option.colorHex,
      imageUrl: option.imageUrl ?? undefined,
      imageId: option.imageId ?? null,
      isAvailable: option.isAvailable ?? true,
      sortOrder: option.sortOrder ?? optionIndex,
    })),
  }));
}

function payloadFromState(
  groups: VariationGroup[],
  settings: VariationSettings,
  variantEdits: VariantEditPatch[],
): ApplyVariationsPayload {
  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      displayType: group.displayType,
      sortOrder: group.sortOrder,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        value: option.value,
        colorHex: option.colorHex,
        imageUrl: option.imageUrl,
        imageId: option.imageId,
        isAvailable: option.isAvailable,
        sortOrder: option.sortOrder,
      })),
    })),
    variesBy: settings.variesBy,
    photoGroupId: settings.photoGroupId ?? null,
    variantEdits,
  };
}

function VariationsSummaryTable({
  product,
  ready,
  onManage,
  draft,
  onDraftChange,
}: {
  product:  AdminProductDto;
  /** False while the listing still lacks photos or a category. */
  ready:    boolean;
  onManage: () => void;
  draft: ApplyVariationsPayload | null;
  onDraftChange: (draft: ApplyVariationsPayload) => void;
}) {
  const [showAllCombinations, setShowAllCombinations] = useState(false);

  // Resolved from the form, not from `product.images` — the latter is a server
  // snapshot that never sees photos uploaded during this session.
  const listingImages = shopperVisibleImages(useListingImages());

  const { data: serverGroups = [], isLoading } = useVariationGroups(product.id);
  const groups = draft ? groupsFromDraft(draft, product.id) : serverGroups;

  const { data: serverSettings, isLoading: settingsLoading } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', product.id],
    queryFn:  async () => {
      try {
        return await api.get<VariationSettings>(`/admin/products/${product.id}/variation-settings`);
      } catch {
        return { enableVariations: false, variesBy: [] };
      }
    },
    enabled:  !!product.id,
    staleTime: 30_000,
  });
  const settings: VariationSettings = draft
    ? { enableVariations: draft.groups.length > 0, variesBy: draft.variesBy, photoGroupId: draft.photoGroupId }
    : (serverSettings ?? { enableVariations: false, variesBy: [] });

  const { data: variants = [], isLoading: variantsLoading } = useQuery<ProductVariantRow[]>({
    queryKey: ['product-variant-list', product.id],
    queryFn:  () => api.get<ProductVariantRow[]>(API_ROUTES.ADMIN.PRODUCT_VARIATION_VARIANTS(product.id)),
    enabled:  !!product.id,
    staleTime: 30_000,
  });

  const stageVariant = (patch: VariantEditPatch) => {
    const edits = [...(draft?.variantEdits ?? [])];
    const key = comboKey(patch.options);
    const index = edits.findIndex((edit) => comboKey(edit.options) === key);
    if (index >= 0) edits[index] = { ...edits[index], ...patch };
    else edits.push(patch);
    onDraftChange(payloadFromState(groups, settings, edits));
  };

  const updateOption = (groupId: string, optionId: string, patch: Partial<VariationOption>) => {
    const nextGroups = groups.map((group) => group.id === groupId
      ? { ...group, options: group.options.map((option) => option.id === optionId ? { ...option, ...patch } : option) }
      : group);
    onDraftChange(payloadFromState(nextGroups, settings, draft?.variantEdits ?? []));
  };

  // Waits on the settings too, not just the groups: whether there is a photo
  // column at all comes from settings, so rendering on groups alone drew the
  // table without it and then shifted every row sideways a moment later.
  if (!draft && !!product.id && (isLoading || settingsLoading || variantsLoading)) {
    return <div className="h-24 bg-muted/5 rounded-lg animate-pulse" />;
  }

  if (!groups.length) {
    return (
      <div className="flex items-center gap-4 py-4">
        <div className="w-12 h-12 rounded-lg bg-muted/10 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-muted" />
        </div>
        <div>
          <p className="text-sm text-secondary font-medium">No variations set up</p>
          <p className="text-sm text-muted mt-0.5">Add options like colour, size, or material.</p>
        </div>
        <button
          type="button"
          onClick={onManage}
          disabled={!ready}
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-2 rounded-button transition-colors shrink-0 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add variations
        </button>
      </div>
    );
  }

  const priceVaries = pricedGroupIds(settings?.variesBy ?? [], groups.map((g) => g.id)).length > 0;
  const validComboKeys = new Set(computeCombos(groups).map((combo) => combo.key));
  const editMap = new Map((draft?.variantEdits ?? []).map((edit) => [comboKey(edit.options), edit]));
  const serverVariantMap = new Map(variants.map((variant) => [comboKey(variant.options), variant]));
  const currentVariants = draft
    ? computeCombos(groups).map((combo, index) => {
        const server = serverVariantMap.get(combo.key);
        const edit = editMap.get(combo.key);
        return {
          id: server?.id ?? combo.key,
          productId: product.id,
          name: combo.name,
          options: combo.options,
          price: edit?.price ?? server?.price ?? null,
          quantity: edit?.quantity ?? server?.quantity ?? null,
          sku: edit?.sku ?? server?.sku ?? null,
          isAvailable: edit?.isAvailable ?? server?.isAvailable ?? true,
          isDefault: server?.isDefault ?? index === 0,
          sortOrder: server?.sortOrder ?? index,
        } satisfies ProductVariantRow;
      })
    : variants.filter((variant) => validComboKeys.has(comboKey(variant.options)));
  const hasMoreCombinations = currentVariants.length > COLLAPSED_COMBINATION_COUNT;
  const visibleVariants = showAllCombinations
    ? currentVariants
    : currentVariants.slice(0, COLLAPSED_COMBINATION_COUNT);

  return (
    <div className="space-y-7">
      {priceVaries ? (
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-sm font-semibold text-secondary">Variation prices</span>
            <span className="text-xs text-muted">{currentVariants.length} combination{currentVariants.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/5">
                  {groups.map((group) => (
                    <th key={group.id} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                      {group.name}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Visible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleVariants.map((variant) => (
                  <tr key={variant.id} className={variant.isAvailable ? '' : 'opacity-50'}>
                    {groups.map((group) => (
                      <td key={group.id} className="px-4 py-3 text-secondary font-medium">
                        {variant.options[group.name] ?? '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        aria-label={`Price for ${variant.name}`}
                        min={0}
                        step="0.01"
                        defaultValue={variant.price == null ? '' : Number(variant.price)}
                        placeholder="0.00"
                        onBlur={(event) => stageVariant({
                          options: variant.options,
                          price: event.target.value === '' ? null : Number(event.target.value),
                        })}
                        className="w-32 px-3 py-2 border border-border rounded-button bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Toggle
                        checked={variant.isAvailable}
                        onChange={(isAvailable) => stageVariant({ options: variant.options, isAvailable })}
                        ariaLabel={`Toggle visibility of ${variant.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            {hasMoreCombinations && !showAllCombinations && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent pb-3">
                <button
                  type="button"
                  aria-expanded="false"
                  onClick={() => setShowAllCombinations(true)}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Show all {currentVariants.length} variations
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {hasMoreCombinations && showAllCombinations && (
              <div className="flex justify-center border-t border-border bg-muted/5 px-4 py-3">
                <button
                  type="button"
                  aria-expanded="true"
                  onClick={() => setShowAllCombinations(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Show less
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : groups.map((group) => {
        // Only the group the seller actually linked photos to. This used to be
        // "any group, as long as the listing has photos at all", which put a
        // photo column on every variation whether or not photos meant anything
        // for it — and gave the seller no way to say they didn't.
        const showPhoto = settings?.photoGroupId === group.id;
        return (
          <div key={group.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-secondary">{group.name}</span>
              <span className="text-xs text-muted">{group.options.length} option{group.options.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="relative overflow-visible">
              <div className="overflow-x-auto">
                {/* Scrolls itself rather than the page: a table cannot shrink
                    below the width of its columns. */}
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="border-b border-border">
                    {showPhoto && <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide w-12">Photo</th>}
                    <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide">{group.name}</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted uppercase tracking-wide">Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {group.options.map((opt) => (
                    <VariationOptionRow
                      key={opt.id}
                      option={opt}
                      variationName={group.name}
                      showPhoto={showPhoto}
                      productImages={listingImages}
                      onToggle={(available) => updateOption(group.id, opt.id, { isAvailable: available })}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface ItemOptionsTabProps { product: AdminProductDto }

export function ItemOptionsTab({ product }: ItemOptionsTabProps) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();
  const [variationsModalOpen, setVariationsModalOpen] = useState(false);
  const variationDraft = watch('variationDraft');

  // "Manage variations" and "Add variations" open the same modal, so showing
  // both at once gave the same action two names and two places to click. The
  // header keeps Manage only once there is something to manage; until then the
  // empty state's Add is the only way in.
  //
  // isSuccess, not `groups.length > 0`: while the request is in flight the data
  // is [] and Manage would be wrong to show, but so would committing to the
  // empty state — the table renders a skeleton for that moment and the header
  // stays bare rather than flashing a button that is about to be replaced.
  const { data: variationGroups = [], isSuccess: variationsLoaded } = useVariationGroups(product.id);
  const hasVariations = variationDraft
    ? variationDraft.groups.length > 0
    : variationsLoaded && variationGroups.length > 0;

  const { ready, missing, images: listingImages } = useVariationReadiness();

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Item options</h2>
        <p className="text-sm text-muted mt-1">Let buyers know what choices are available for this item.</p>
      </div>
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden divide-y divide-border">

        {/* ── Variations ───────────────────────────────────────────────── */}
        <TabSection
          title="Variations"
          description="Add options like colour, size, or material that may affect your available inventory quantities."
          action={
            hasVariations && ready ? (
              <button
                type="button"
                onClick={() => setVariationsModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold border border-border rounded-button px-3 py-2 text-secondary hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Settings className="w-4 h-4" />
                Manage variations
              </button>
            ) : undefined
          }
        >
          {/* Blocked rather than merely disabled: a greyed-out button that never
              says why is the thing that sends people to support. Existing
              variations still render below so nothing looks lost. */}
          {!ready && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-lg border border-border bg-muted/5">
              <Lock className="w-4 h-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-secondary">
                  Add {missing.join(' and ')} first
                </p>
                <p className="text-sm text-muted mt-0.5">
                  Variations are tied to your photos, and the category decides which
                  variation types buyers can filter on.
                </p>
              </div>
            </div>
          )}
          <VariationsSummaryTable
            product={product}
            ready={ready}
            onManage={() => setVariationsModalOpen(true)}
            draft={variationDraft}
            onDraftChange={(draft) => setValue('variationDraft', draft, { shouldDirty: true })}
          />
        </TabSection>

        {/* ── Custom options ────────────────────────────────────────────── */}
        <TabSection
          title="Custom options"
          description="Create up to 5 input fields to collect details from buyers like text, images, or names. These won't affect your available inventory."
        >
          <CustomOptionsEditor />
        </TabSection>

        {/* ── Attributes ───────────────────────────────────────────────── */}
        <TabSection
          title="Attributes"
          description="These details help buyers find your item in search as they get specific about what they're looking for."
        >
          <div className="space-y-6">
            {/* Tags */}
            <AttributeTagInput
              label="Tags"
              name="tags"
              maxTags={13}
              description="Add up to 13 tags to help people search for your listings."
              placeholder="Shape, colour, style, function, etc."
            />

            {/* Materials */}
            <AttributeSearchSelect
              label="Materials"
              name="materials"
              maxSelections={5}
              searchEndpoint="/admin/attributes/material"
              description="Select up to 5"
            />

            {/* Primary colour */}
            <AttributeSearchSelect
              label="Primary colour"
              name="primaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

            {/* Secondary colour */}
            <AttributeSearchSelect
              label="Secondary colour"
              name="secondaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

            {/* Dimensions (width / height) */}
            <DimensionFields />

            {/* Sustainability */}
            <AttributeSearchSelect
              label="Sustainability"
              name="sustainability"
              maxSelections={3}
              searchEndpoint="/admin/attributes/sustainability"
              tooltip="Let buyers know if your item is made using eco-conscious materials or methods."
              description="Select up to 3"
            />

            {/* Expandable section */}
            <ShowMoreAttributes>
              <AttributeSearchSelect
                label="Style"
                name="styles"
                maxSelections={2}
                searchEndpoint="/admin/attributes/style"
              />
              <AttributeSearchSelect
                label="Occasion"
                name="occasions"
                maxSelections={5}
                searchEndpoint="/admin/attributes/occasion"
              />
              <AttributeSearchSelect
                label="Holiday"
                name="holidayTags"
                maxSelections={3}
                searchEndpoint="/admin/attributes/holiday"
              />
              <AttributeSearchSelect
                label="Recipient"
                name="recipientTags"
                maxSelections={4}
                searchEndpoint="/admin/attributes/recipient"
                description="Select up to 4"
              />
            </ShowMoreAttributes>
          </div>
        </TabSection>
      </div>

      {/* Variations modal — ManageVariationsModal */}
      <ManageVariationsModal
        productImages={listingImages}
        productId={product.id}
        isOpen={variationsModalOpen}
        onClose={() => setVariationsModalOpen(false)}
        initialDraft={variationDraft}
        onDraftChange={(draft) => setValue('variationDraft', draft, { shouldDirty: true })}
        onSaved={() => {
          // The consolidated payload is part of the listing form and is
          // committed only by ProductEditShell's Publish/Save draft action.
        }}
      />
    </div>
  );
}
