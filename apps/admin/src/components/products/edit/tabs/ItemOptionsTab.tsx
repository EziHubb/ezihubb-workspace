'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Settings,
} from 'lucide-react';
import { Select } from '@ezihubb/ui';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  ProductEditFormValues, AdminProductDto, ProductImage,
  VariationOption, VariationGroup, VariationSettings, DimensionUnit,
} from '../types';
import { pricedGroupIds } from '../helpers';
import { Toggle } from '../primitives/Toggle';
import { VariantImagePicker } from '../VariantImagePicker';
import { ManageVariationsModal } from '../ManageVariationsModal';
import { CustomOptionsEditor } from '../CustomOptionsEditor';
import { AttributeSearchSelect } from '../AttributeSearchSelect';
import { ShowMoreAttributes } from '../ShowMoreAttributes';

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

function VariationOptionRow({
  option,
  showPhoto,
  productImages,
  productId,
  onToggle,
}: {
  option:        VariationOption;
  showPhoto:     boolean;
  productImages: ProductImage[];
  productId:     string;
  onToggle:      (available: boolean) => void;
}) {
  return (
    <tr className={`border-b border-border last:border-0 group transition-opacity ${!option.isAvailable ? 'opacity-40' : ''}`}>
      {/* Photo thumbnail — opens VariantImagePicker modal */}
      {showPhoto && (
        <td className="py-2.5 pr-3 w-12">
          <VariantImagePicker
            option={option}
            productId={productId}
            productImages={productImages}
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

function VariationsSummaryTable({
  product,
  onManage,
}: {
  product:  AdminProductDto;
  onManage: () => void;
}) {
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', product.id],
    queryFn:  () => api.get<VariationGroup[]>(`/admin/products/${product.id}/variations`),
    enabled:  !!product.id,
    staleTime: 30_000,
  });

  const { data: settings } = useQuery<VariationSettings>({
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

  const updateOption = async (groupId: string, optionId: string, patch: Partial<VariationOption>) => {
    await api.patch(API_ROUTES.ADMIN.PRODUCT_VARIATION_OPTION(product.id, groupId, optionId), patch);
    qc.invalidateQueries({ queryKey: ['variation-groups', product.id] });
  };

  if (isLoading) {
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
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-2 rounded-button transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add variations
        </button>
      </div>
    );
  }

  const priceVaries = pricedGroupIds(settings?.variesBy ?? [], groups.map((g) => g.id)).length > 0;

  return (
    <div className="space-y-7">
      {priceVaries && (
        <p className="text-xs text-muted -mt-1">
          Prices vary per option combination — set them in <span className="font-medium text-secondary">Manage variations</span>.
        </p>
      )}
      {groups.map((group) => {
        const showPhoto =
          group.displayType === 'color_swatch' ||
          group.displayType === 'image' ||
          (product.images ?? []).length > 0;
        return (
          <div key={group.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-secondary">{group.name}</span>
              <span className="text-xs text-muted">{group.options.length} option{group.options.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="relative overflow-visible">
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
                      showPhoto={showPhoto}
                      productImages={product.images ?? []}
                      productId={product.id}
                      onToggle={(available) => updateOption(group.id, opt.id, { isAvailable: available })}
                    />
                  ))}
                </tbody>
              </table>
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
  const [variationsModalOpen, setVariationsModalOpen] = useState(false);

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
            <button
              type="button"
              onClick={() => setVariationsModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold border border-border rounded-button px-3 py-2 text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage variations
            </button>
          }
        >
          <VariationsSummaryTable product={product} onManage={() => setVariationsModalOpen(true)} />
        </TabSection>

        {/* ── Custom options ────────────────────────────────────────────── */}
        <TabSection
          title="Custom options"
          description="Create up to 5 input fields to collect details from buyers like text, images, or names. These won't affect your available inventory."
        >
          <CustomOptionsEditor productId={product.id} />
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
        productId={product.id}
        isOpen={variationsModalOpen}
        onClose={() => setVariationsModalOpen(false)}
        onSaved={() => {
          // VariationsSummaryTable will refetch via queryKey invalidation inside the modal
        }}
      />
    </div>
  );
}
