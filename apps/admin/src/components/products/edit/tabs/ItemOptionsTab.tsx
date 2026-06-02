'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Settings,
} from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import { fetchArr } from '../../../../lib/fmt';
import type {
  ProductEditFormValues, AdminProductDto, ProductImage,
  VariationOption, VariationGroup, VariationSettings,
} from '../types';
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

function AttributeTagInput({
  label, name, maxTags, placeholder, description,
}: {
  label:       string;
  name:        keyof ProductEditFormValues;
  maxTags:     number;
  placeholder?: string;
  description?: string;
}) {
  const { setValue, watch } = useFormContext<ProductEditFormValues>();
  const values = (watch(name) ?? []) as string[];
  const [input, setInput] = useState('');

  const add = () => {
    const t = input.trim().replace(/,+$/, '');
    if (!t || values.includes(t) || values.length >= maxTags) return;
    setValue(name, [...values, t] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
    setInput('');
  };

  const remove = (v: string) => {
    setValue(name, (values.filter((x) => x !== v)) as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            }}
            placeholder={placeholder ?? 'Add a tag…'}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-button transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-background border border-border rounded-full text-sm text-secondary">
            {v}
            <button type="button" onClick={() => remove(v)} className="p-0.5 rounded-full hover:bg-muted/10 text-muted hover:text-secondary transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {values.length > 0 && (
          <span className="text-xs text-muted self-center ml-1">{values.length}/{maxTags}</span>
        )}
      </div>
    </div>
  );
}

// ─── Variations summary table ─────────────────────────────────────────────────

function VariationOptionRow({
  option,
  group,
  priceVaries,
  productImages,
  productId,
  onToggle,
  onPriceChange,
}: {
  option:        VariationOption;
  group:         VariationGroup;
  priceVaries:   boolean;
  productImages: ProductImage[];
  productId:     string;
  onToggle:      (available: boolean) => void;
  onPriceChange: (price: number) => void;
}) {
  // Show photo column for color swatches, image cards, or any group with images
  const showPhoto =
    group.displayType === 'color_swatch' ||
    group.displayType === 'image'         ||
    productImages.length > 0;             // always show if product has photos

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

      {/* Price delta (only when group has price variation) */}
      {priceVaries && (
        <td className="py-2.5 pr-3 w-28">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">+$</span>
            <input
              type="number"
              step="0.01"
              value={option.priceDelta ?? 0}
              onChange={(e) => onPriceChange(Number(e.target.value))}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
            />
          </div>
        </td>
      )}

      {/* Visible toggle */}
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={() => onToggle(!option.isAvailable)}
          className={`relative w-10 h-5 rounded-full transition-colors ${option.isAvailable ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${option.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
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
    queryFn:  async () => {
      const res = await clientFetch(`/admin/products/${product.id}/variations`);
      return fetchArr<VariationGroup>(res);
    },
    staleTime: 30_000,
  });

  const { data: settings } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', product.id],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${product.id}/variation-settings`);
      if (!res.ok) return { enableVariations: false, variesBy: [] };
      const body = await res.json();
      return (body.data ?? body) as VariationSettings;
    },
    staleTime: 30_000,
  });

  const updateOption = async (groupId: string, optionId: string, patch: Partial<VariationOption>) => {
    await clientFetch(`/admin/products/${product.id}/variations/${groupId}/options/${optionId}`, {
      method: 'PATCH',
      body:   JSON.stringify(patch),
    });
    qc.invalidateQueries({ queryKey: ['variation-groups', product.id] });
  };

  if (isLoading) {
    return <div className="h-24 bg-muted/5 rounded-lg animate-pulse" />;
  }

  if (!groups.length || !settings?.enableVariations) {
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

  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const priceVaries = settings.variesBy?.includes(group.id + ':price') ?? false;
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
                    <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide w-12">Photo</th>
                    <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide">{group.name}</th>
                    {priceVaries && <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide w-28">Price</th>}
                    <th className="text-right pb-2 text-xs font-semibold text-muted uppercase tracking-wide">Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {group.options.map((opt) => (
                    <VariationOptionRow
                      key={opt.id}
                      option={opt}
                      group={group}
                      priceVaries={priceVaries}
                      productImages={product.images ?? []}
                      productId={product.id}
                      onToggle={(available) => updateOption(group.id, opt.id, { isAvailable: available })}
                      onPriceChange={(price) => updateOption(group.id, opt.id, { priceDelta: price })}
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
    <div className="max-w-[760px] mx-auto">
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
              label="Primary color"
              name="primaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

            {/* Secondary colour */}
            <AttributeSearchSelect
              label="Secondary color"
              name="secondaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

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
