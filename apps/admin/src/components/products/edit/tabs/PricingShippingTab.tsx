'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight, X, ExternalLink, Lightbulb, Truck,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductEditFormValues, AdminProductDto, ReturnPolicy } from '../types';
import { EstimatedEarningsRow }    from '../EstimatedEarningsRow';
import { ProcessingProfileCard }   from '../ProcessingProfileCard';
import { ShippingCostPreview }     from '../ShippingCostPreview';
import { ReturnPolicyCard }        from '../ReturnPolicyCard';
import { Toggle as PrimitiveToggle } from '../primitives/Toggle';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingProfileMethod {
  id:              string;
  destinationType: string;
  carrier?:        string;
  minDays:         number;
  maxDays:         number;
  price:           number;
}

interface ShippingProfile {
  id:             string;
  name:           string;
  type:           string;
  activeListings: number;
  isDefault:      boolean;
  methods?:       ShippingProfileMethod[];
}

interface VariationSettings {
  enableVariations: boolean;
  variesBy:         string[];
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function TabSection({ title, description, link, children }: {
  title:       string;
  description?: string;
  link?:       { label: string; href: string };
  children:    React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-secondary">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5 max-w-xl">{description}</p>}
        </div>
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-sm text-primary hover:underline">
            {link.label} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, required, hint, children }: {
  label:    string;
  required?: boolean;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-1">
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0 mt-0.5">
        <PrimitiveToggle checked={checked} onChange={onChange} ariaLabel={label} />
      </div>
    </label>
  );
}

// ─── Profile picker modal ─────────────────────────────────────────────────────

function ProfilePickerModal<T extends { id: string }>({
  title, items, selectedId, renderItem, onSelect, onClose,
}: {
  title:      string;
  items:      T[];
  selectedId: string | null;
  renderItem: (item: T) => React.ReactNode;
  onSelect:   (id: string) => void;
  onClose:    () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h4 className="font-semibold text-secondary">{title}</h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3 space-y-2 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => { onSelect(item.id); onClose(); }}
              className={[
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all',
                selectedId === item.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40',
              ].join(' ')}>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selectedId === item.id ? 'border-primary' : 'border-muted'}`}>
                {selectedId === item.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1 min-w-0">{renderItem(item)}</div>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border">
          <button type="button" onClick={onClose}
            className="text-sm font-medium text-muted hover:text-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PriceInput (dual: base + compare-at) ────────────────────────────────────

function PriceInput() {
  const { register } = useFormContext<ProductEditFormValues>();

  return (
    <div className="flex items-start gap-4">
      {/* Base price */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
          Price <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            {...register('basePrice', {
              required:    'Price is required',
              min:         { value: 0.01, message: 'Must be > $0' },
              valueAsNumber: true,
            })}
            className="pl-7 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-32 tabular-nums"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Compare-at */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
          Compare-at price
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            {...register('compareAtPrice', {
              valueAsNumber: true,
              setValueAs: (v) => v === '' || isNaN(Number(v)) ? null : Number(v),
            })}
            className="pl-7 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-32 placeholder:text-muted tabular-nums"
            placeholder="Optional"
          />
        </div>
        <p className="text-xs text-muted/60 mt-1">Shows as strikethrough</p>
      </div>
    </div>
  );
}

// ─── ShippingProfileCard (Image 11-12) ───────────────────────────────────────

function ShippingProfileCard({
  profileId, onChange,
}: {
  profileId: string | null;
  onChange:  (id: string | null) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const { data: profiles = [] } = useQuery<ShippingProfile[]>({
    queryKey: ['shipping-profiles'],
    queryFn:  () => api.get<ShippingProfile[]>(API_ROUTES.ADMIN.SHIPPING_PROFILES),
    staleTime: 10 * 60_000,
  });

  const selected = profiles.find((p) => p.id === profileId)
    ?? profiles.find((p) => p.isDefault)
    ?? profiles[0];

  const lowestPrice = selected?.methods?.length
    ? Math.min(...selected.methods.map((m) => Number(m.price)))
    : null;

  return (
    <>
      <div className={[
        'flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 transition-colors',
        selected ? 'border-border bg-background' : 'border-dashed border-border bg-background',
      ].join(' ')}>
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-secondary">{selected.name}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted/10 text-muted">
                  {selected.type}
                </span>
                {lowestPrice !== null && (
                  <span className="text-xs text-muted">from ${lowestPrice.toFixed(2)}</span>
                )}
              </div>
              {selected.activeListings > 0 && (
                <p className="text-xs text-muted mt-0.5">
                  {selected.activeListings} active listing{selected.activeListings !== 1 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No shipping profile selected</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/shipping" target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-muted border border-border rounded-button px-2.5 py-1.5 hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            Edit
          </a>
          <button type="button" onClick={() => setShowModal(true)}
            className="text-sm font-semibold text-primary hover:underline">
            Change
          </button>
        </div>
      </div>

      {/* Shipping cost preview */}
      <ShippingCostPreview profileId={selected?.id ?? null} />

      {showModal && (
        <ProfilePickerModal
          title="Select shipping profile"
          items={profiles}
          selectedId={profileId}
          renderItem={(p) => {
            const lowest = p.methods?.length
              ? Math.min(...p.methods.map((m) => Number(m.price)))
              : null;
            return (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-secondary">{p.name}</p>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted/10 text-muted">{p.type}</span>
                  {lowest !== null && <span className="text-xs text-muted">from ${lowest.toFixed(2)}</span>}
                </div>
                {p.activeListings > 0 && (
                  <p className="text-xs text-muted mt-0.5">{p.activeListings} active listing{p.activeListings !== 1 ? 's' : ''}</p>
                )}
                {p.isDefault && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Default</span>
                )}
              </>
            );
          }}
          onSelect={onChange}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Variation-aware price notice ─────────────────────────────────────────────

function VariationPriceNotice({
  productId,
  onSwitchToVariations,
}: {
  productId:            string;
  onSwitchToVariations: () => void;
}) {
  const { data: settings } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', productId],
    queryFn:  async () => {
      try {
        return await api.get<VariationSettings>(`/admin/products/${productId}/variation-settings`);
      } catch {
        return { enableVariations: false, variesBy: [] };
      }
    },
    enabled:  !!productId,
    staleTime: 30_000,
  });

  if (!settings?.variesBy?.some((v) => v.includes(':price'))) return null;

  return (
    <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-amber-800">Prices vary for each variation option.</p>
        <button
          type="button"
          onClick={onSwitchToVariations}
          className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
        >
          Edit in the Variations tab <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

// Must stay in sync with ProductEditShell TABS ids
type AnyTabId = 'photo-video' | 'item-details' | 'item-options' | 'pricing-shipping' | 'how-its-made' | 'settings';

interface PricingShippingTabProps {
  product:      AdminProductDto;
  onSwitchTab?: (tab: AnyTabId) => void;
  isDigital?:   boolean;
}

export function PricingShippingTab({ product, onSwitchTab, isDigital }: PricingShippingTabProps) {
  const { register, watch, setValue } = useFormContext<ProductEditFormValues>();

  const basePrice        = watch('basePrice');
  const compareAt        = watch('compareAtPrice');
  const profileId        = watch('processingProfileId') ?? null;
  const shippingId       = watch('shippingProfileId')   ?? null;
  const returnPolicy     = watch('returnPolicy')         ?? 'NO_RETURNS';
  const domGlobal        = watch('domesticGlobalPricing');
  const sku              = watch('sku') ?? '';
  const trackInventory   = watch('trackInventory') ?? false;

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden divide-y divide-border">

        {/* ── Price & Inventory (Image 10) ─────────────────────────────── */}
        <TabSection
          title="Price and inventory"
          description="Set your item price, and how many are available for sale."
        >
          {/* Domestic & global pricing toggle */}
          <div className="mb-6 pb-6 border-b border-border">
            <Toggle
              checked={domGlobal}
              onChange={(v) => setValue('domesticGlobalPricing', v, { shouldDirty: true })}
              label="Domestic and global pricing"
              sub="Set prices for buyers in different locations."
            />
          </div>

          {/* Price inputs */}
          <div className="mb-4">
            <VariationPriceNotice
              productId={product.id}
              onSwitchToVariations={() => onSwitchTab?.('item-options' as AnyTabId)}
            />
            <div className="mt-3">
              <PriceInput />
            </div>
            <EstimatedEarningsRow basePrice={Number(basePrice)} compareAtPrice={compareAt} />
          </div>

          {/* Quantity + SKU row */}
          <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-border">
            <FormField label="Quantity" hint="Leave empty for unlimited (print-on-demand)">
              <input
                type="number"
                min={0}
                {...register('quantity', {
                  valueAsNumber: true,
                  setValueAs: (v) => v === '' || isNaN(Number(v)) ? null : Number(v),
                })}
                className="w-32 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted tabular-nums"
                placeholder="∞ unlimited"
              />
            </FormField>

            <FormField label="SKU (stock keeping unit)">
              <input
                {...register('sku', { maxLength: 32 })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="MLH-XXXX"
                maxLength={32}
              />
              <p className="text-xs text-muted mt-1 tabular-nums">{sku.length}/32</p>
            </FormField>
          </div>

          {/* Inventory tracking */}
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            <Toggle
              checked={trackInventory}
              onChange={(v) => setValue('trackInventory', v, { shouldDirty: true })}
              label="Track inventory"
              sub="Automatically decrement stock when orders are confirmed and send low-stock alerts."
            />
            {trackInventory && (
              <FormField
                label="Low-stock alert threshold"
                hint="Send an admin email when quantity drops to or below this number. Leave empty to only alert when out of stock."
              >
                <input
                  type="number"
                  min={0}
                  {...register('lowStockThreshold', {
                    valueAsNumber: true,
                    setValueAs: (v) => v === '' || isNaN(Number(v)) ? null : Number(v),
                  })}
                  className="w-32 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted tabular-nums"
                  placeholder="e.g. 5"
                />
              </FormField>
            )}
          </div>
        </TabSection>

        {/* ── Shipping, Processing & Returns (Images 11-12) ────────────── */}
        {/* Digital downloads have no physical shipping/fulfillment — this
            entire section only applies to physical products. */}
        {!isDigital && (
          <TabSection
            title="Shipping, processing, and returns"
            description="Give clear expectations about delivery time and cost."
            link={{ label: 'Shipping settings', href: '/shipping' }}
          >
            <div className="space-y-7">
              {/* Processing profile */}
              <FormField label="Processing profile" required hint="How long does it take to make and pack your item?">
                <ProcessingProfileCard
                  profileId={profileId}
                  onChange={(id) => setValue('processingProfileId', id, { shouldDirty: true })}
                />
              </FormField>

              {/* Shipping option */}
              <FormField label="Shipping option" required hint="Which shipping profile should apply to this listing?">
                <ShippingProfileCard
                  profileId={shippingId}
                  onChange={(id) => setValue('shippingProfileId', id, { shouldDirty: true })}
                />
              </FormField>

              {/* Returns */}
              <FormField label="Returns and exchanges" required>
                <ReturnPolicyCard
                  policy={returnPolicy as ReturnPolicy}
                  onChange={(p) => setValue('returnPolicy', p, { shouldDirty: true })}
                />
              </FormField>
            </div>
          </TabSection>
        )}
      </div>
    </div>
  );
}
