'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, X, ExternalLink, Lightbulb, Truck, Plus, CheckCircle2, Pencil,
  Shield, ChevronUp,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductEditFormValues, AdminProductDto, ReturnPolicy, VariationGroup } from '../types';
import { EstimatedEarningsRow }    from '../EstimatedEarningsRow';
import { ProcessingProfileCard }   from '../ProcessingProfileCard';
import { ShippingCostPreview }     from '../ShippingCostPreview';
import { ReturnPolicyCard }        from '../ReturnPolicyCard';
import { Toggle as PrimitiveToggle } from '../primitives/Toggle';
import { pricedGroupIds } from '../helpers';
import { DeliveryProfileModal } from '../../../shipping/delivery/DeliveryProfileModal';
import type { ShippingProfile } from '../../../shipping/delivery/types';
import { GPSRModal } from '../GPSRModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariationSettings {
  enableVariations: boolean;
  variesBy:         string[];
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function TabSection({ title, description, link, children }: {
  title:       string;
  description?: React.ReactNode;
  link?:       { label: string; href: string };
  children:    React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-secondary">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5 max-w-2xl">{description}</p>}
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

// ─── HS Code section (inline expand) ─────────────────────────────────────────
// Moved here from HowItsMadeTab.tsx — real Etsy places Customs information
// (and GPSR, below) inside "Delivery, processing, and returns", not "How
// it's made". Same `hsCode` form field, only the tab it renders in changed.

function HsCodeSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(!!value);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h4 className="font-semibold text-secondary">Customs information</h4>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            This info is used to prefill a customs form when you purchase an international Shipping Label.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {value ? 'Edit tariff number' : '+ Add tariff number'}
        </button>
      </div>

      {value && !expanded && (
        <p className="text-sm text-secondary mt-3">
          HS Code: <code className="font-mono bg-background border border-border rounded px-2 py-0.5 text-xs">{value}</code>
          <button type="button" onClick={() => onChange('')} className="ml-2 text-muted hover:text-red-500 transition-colors">
            <X className="w-3 h-3 inline" />
          </button>
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. 6912.00"
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono placeholder:font-sans placeholder:text-muted"
            />
            {value && (
              <button type="button" onClick={() => setExpanded(false)}
                className="px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                Done
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Look up your code at{' '}
            <a href="https://www.trade-tariff.service.gov.uk/find_commodity" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5">
              trade-tariff.service.gov.uk <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>
      )}
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
  title, subtitle, items, selectedId, renderItem, onSelect, onCreateNew, onEdit, canEdit, onClose,
}: {
  title:       string;
  subtitle?:   string;
  items:       T[];
  selectedId:  string | null;
  renderItem:  (item: T) => React.ReactNode;
  onSelect:    (id: string) => void;
  /** Opens the create-new-profile flow — omit to hide the "+ Create new" row entirely. */
  onCreateNew?: () => void;
  /** Opens the edit-in-place flow for one row's pencil icon — omit to hide edit icons entirely. */
  onEdit?:     (item: T) => void;
  /** Per-row gate for the pencil icon (e.g. hide it for read-only platform-default rows the backend would reject saving) — omitted means every row is editable. */
  canEdit?:    (item: T) => boolean;
  onClose:     () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h4 className="font-semibold text-secondary">{title}</h4>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3 space-y-2 max-h-80 overflow-y-auto">
          {onCreateNew && (
            <button type="button" onClick={onCreateNew}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/40 text-primary transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-semibold">Create new</span>
            </button>
          )}
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div key={item.id}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all',
                  isSelected ? 'border-secondary bg-muted/3' : 'border-border hover:border-primary/40',
                ].join(' ')}>
                <button type="button" onClick={() => { onSelect(item.id); onClose(); }}
                  className="flex-1 min-w-0 text-left">
                  {renderItem(item)}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                      <CheckCircle2 className="w-4 h-4" /> Applied
                    </span>
                  )}
                  {onEdit && (!canEdit || canEdit(item)) && (
                    <button type="button" onClick={() => onEdit(item)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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

/** "Fixed" when every row charges a fixed price, "Free" when every row is free delivery, "Mixed" otherwise. */
function profileChargeBadge(profile: ShippingProfile): string {
  const types = new Set((profile.methods ?? []).map((m) => m.chargeType));
  if (types.size === 0) return 'Fixed';
  if (types.size > 1) return 'Mixed';
  return types.has('FREE') ? 'Free' : 'Fixed';
}

function ShippingProfileCard({
  profileId, onChange,
}: {
  profileId: string | null;
  onChange:  (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const [showPicker, setShowPicker]   = useState(false);
  const [editing,    setEditing]      = useState<ShippingProfile | 'new' | null>(null);

  const { data: profiles = [] } = useQuery<ShippingProfile[]>({
    queryKey: ['shipping-profiles'],
    queryFn:  () => api.get<ShippingProfile[]>(API_ROUTES.ADMIN.SHIPPING_PROFILES),
    staleTime: 10 * 60_000,
  });

  const selected = profiles.find((p) => p.id === profileId)
    ?? profiles.find((p) => p.isDefault)
    ?? profiles[0];

  const handleProfileSaved = (saved: ShippingProfile) => {
    qc.invalidateQueries({ queryKey: ['shipping-profiles'] });
    // A brand-new profile always gets applied to this listing (that's the
    // point of "+ Create new" here). Editing an EXISTING profile that isn't
    // the one currently applied to this listing should only update its own
    // rates in place — it must not silently reassign this listing to it.
    if (editing === 'new' || saved.id === profileId) {
      onChange(saved.id);
    }
    setEditing(null);
    setShowPicker(false);
  };

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
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-muted">
                  {profileChargeBadge(selected)}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                From {selected.originPostalCode || selected.originCountry}
                {selected.activeListings > 0 && (
                  <> · {selected.activeListings} active listing{selected.activeListings !== 1 ? 's' : ''}</>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No delivery option selected</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {selected && (
            <button type="button" onClick={() => setShowPicker(true)}
              className="text-sm font-semibold text-primary hover:underline">
              Change
            </button>
          )}
          {/* Platform-default profiles (storeId: null) are read-only for
              sellers — the backend rejects edits on them regardless, so this
              only appears for an owned profile or when nothing is selected
              yet (where it starts the create flow instead). */}
          {(!selected || selected.storeId !== null) && (
            <button
              type="button"
              onClick={() => (selected ? setEditing(selected) : setEditing('new'))}
              className="flex items-center gap-1.5 text-xs font-semibold text-secondary bg-muted/10 hover:bg-muted/15 rounded-full px-3 py-2 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {selected ? 'Edit' : 'Select delivery option'}
            </button>
          )}
        </div>
      </div>

      {/* Shipping cost preview */}
      <ShippingCostPreview originCountry={selected?.originCountry ?? null} methods={selected?.methods} />

      {showPicker && (
        <ProfilePickerModal
          title="Delivery options"
          subtitle="Select a delivery profile or create a new one."
          items={profiles}
          selectedId={profileId}
          canEdit={(p) => p.storeId !== null}
          renderItem={(p) => (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-secondary">{p.name}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-muted">
                  {profileChargeBadge(p)}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                From {p.originPostalCode || p.originCountry}
                {p.activeListings > 0 && <> · {p.activeListings} active listing{p.activeListings !== 1 ? 's' : ''}</>}
              </p>
            </>
          )}
          onSelect={onChange}
          onCreateNew={() => { setShowPicker(false); setEditing('new'); }}
          onEdit={(p) => { setShowPicker(false); setEditing(p); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {editing !== null && (
        <DeliveryProfileModal
          profile={editing === 'new' ? null : editing}
          submitLabel="Apply"
          entityLabel="delivery option"
          onClose={() => setEditing(null)}
          onSaved={handleProfileSaved}
        />
      )}
    </>
  );
}

// ─── Variant-priced summary (replaces the editable Price input entirely — ──
// matches Etsy: once any variation group carries its own price, the
// top-level Price field is dropped in favour of "Prices may vary per
// Option" + a link into the variations editor, so there's never two
// disagreeing sources of truth for what the item actually costs. ──────────

function VariantPricedSummary({
  variantCount,
  onEdit,
}: {
  variantCount: number;
  onEdit:       () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
        Price <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-background">
        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm text-secondary">Prices may vary per Option</span>
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto shrink-0 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Edit {variantCount} variation{variantCount !== 1 ? 's' : ''} <ChevronRight className="w-3.5 h-3.5" />
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
  const hsCode           = watch('hsCode') ?? '';
  const gpsrInfo         = watch('gpsrInfo');
  const [showGpsrModal, setShowGpsrModal] = useState(false);
  const hasGpsr = !!(
    gpsrInfo &&
    (gpsrInfo.manufacturerName || gpsrInfo.manufacturerAddress || gpsrInfo.manufacturerEmail)
  );

  // ── Variant pricing — does any variation group carry its own price? ────────
  // Same queryKeys as ItemOptionsTab's VariationsSummaryTable, so these share
  // the React Query cache instead of double-fetching (both tabs are mounted
  // simultaneously — ProductEditShell scroll-spies, it doesn't unmount tabs).
  const { data: variationGroups = [] } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', product.id],
    queryFn:  () => api.get<VariationGroup[]>(API_ROUTES.ADMIN.PRODUCT_VARIATIONS(product.id)),
    enabled:  !!product.id,
    staleTime: 30_000,
  });
  const { data: variationSettings } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', product.id],
    queryFn:  async () => {
      try {
        return await api.get<VariationSettings>(API_ROUTES.ADMIN.PRODUCT_VARIATION_SETTINGS(product.id));
      } catch {
        return { enableVariations: false, variesBy: [] };
      }
    },
    enabled:  !!product.id,
    staleTime: 30_000,
  });
  const { data: variants = [] } = useQuery<{ id: string; price: string | number }[]>({
    queryKey: ['product-variant-list', product.id],
    queryFn:  () => api.get<{ id: string; price: string | number }[]>(API_ROUTES.ADMIN.PRODUCT_VARIATION_VARIANTS(product.id)),
    enabled:  !!product.id,
    staleTime: 30_000,
  });

  const priceVaries = pricedGroupIds(
    variationSettings?.variesBy ?? [],
    variationGroups.map((g) => g.id),
  ).length > 0 && variants.length > 0;

  const variantPrices    = variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n));
  const minVariantPrice  = variantPrices.length ? Math.min(...variantPrices) : undefined;
  const maxVariantPrice  = variantPrices.length ? Math.max(...variantPrices) : undefined;

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-8">
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

          {/* Price inputs — replaced entirely by a "prices vary" summary once
              any variation group has its own per-option pricing, matching
              Etsy: editing basePrice here would be misleading when the
              variations tab is the actual source of truth for what buyers pay. */}
          <div className="mb-4">
            {priceVaries ? (
              <VariantPricedSummary
                variantCount={variants.length}
                onEdit={() => onSwitchTab?.('item-options' as AnyTabId)}
              />
            ) : (
              <PriceInput />
            )}
            <EstimatedEarningsRow
              basePrice={Number(basePrice)}
              compareAtPrice={compareAt}
              hasVariations={priceVaries}
              minVariantPrice={minVariantPrice}
              maxVariantPrice={maxVariantPrice}
            />
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

            <FormField label="SKU (stock keeping unit)" hint="Auto-generated if left blank">
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

        {/* ── Delivery, Processing & Returns (Images 11-12) ────────────── */}
        {/* Digital downloads have no physical shipping/fulfillment — this
            entire section only applies to physical products. */}
        {!isDigital && (
          <TabSection
            title="Delivery, processing, and returns"
            description={
              <>
                Give clear expectations about delivery time and cost by making sure your delivery info is
                accurate — including the delivery profile and your order processing schedule. You can make
                updates any time in{' '}
                <a href="/settings/delivery" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  Delivery settings
                </a>.
              </>
            }
          >
            <div className="space-y-7">
              {/* Processing profile */}
              <FormField label="Processing profile" required>
                <ProcessingProfileCard
                  profileId={profileId}
                  onChange={(id) => setValue('processingProfileId', id, { shouldDirty: true })}
                />
              </FormField>

              {/* Delivery option */}
              <FormField label="Delivery option" required>
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

              {/* GPSR manufacturer and safety information */}
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h4 className="font-semibold text-secondary">GPSR manufacturer and safety information</h4>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    If you&apos;re a{' '}
                    <a href="#" className="text-primary underline-offset-2 hover:underline">trader</a>{' '}
                    selling to{' '}
                    <a href="#" className="text-primary underline-offset-2 hover:underline">EEA states</a>{' '}
                    or Northern Ireland (NI), you may need to include manufacturer and safety info to comply
                    with the{' '}
                    <a href="#" className="text-primary underline-offset-2 hover:underline">
                      General Product Safety Regulation
                    </a>{' '}
                    (GPSR).
                  </p>

                  {hasGpsr && (
                    <div className="mt-2 text-xs text-secondary bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-0.5">
                      {gpsrInfo?.manufacturerName    && <p><strong>Name:</strong> {gpsrInfo.manufacturerName}</p>}
                      {gpsrInfo?.manufacturerEmail   && <p><strong>Email:</strong> {gpsrInfo.manufacturerEmail}</p>}
                      {gpsrInfo?.countryOfOrigin     && <p><strong>Country:</strong> {gpsrInfo.countryOfOrigin}</p>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowGpsrModal(true)}
                  className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-secondary border border-border rounded-lg px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  {hasGpsr ? 'Edit info' : '+ Add info'}
                </button>
              </div>

              {/* Customs information / HS Code */}
              <HsCodeSection
                value={hsCode}
                onChange={(v) => setValue('hsCode', v, { shouldDirty: true })}
              />
            </div>
          </TabSection>
        )}
      </div>

      {/* GPSR modal — API-saving (edit mode only; create mode has no productId yet) */}
      {product.id && (
        <GPSRModal
          productId={product.id}
          isOpen={showGpsrModal}
          onClose={() => setShowGpsrModal(false)}
        />
      )}
    </div>
  );
}
