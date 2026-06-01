'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronUp, ChevronRight, Check,
  X, ArrowRight, ExternalLink, AlertCircle, Lightbulb,
  Globe, Package, Truck, RotateCcw,
} from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import { fetchArr, fmtFixed, fmtAmount } from '../../../../lib/fmt';
import type { ProductEditFormValues, AdminProductDto, ReturnPolicy } from '../types';
import { EstimatedEarningsRow } from '../EstimatedEarningsRow';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingProfile {
  id:       string;
  name:     string;
  type:     'MADE_TO_ORDER' | 'READY_TO_SHIP';
  minDays:  number;
  maxDays:  number;
  isDefault: boolean;
}

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

// ─── Fee constants ────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT   = 0.065;  // 6.5%
const PAYMENT_FEE_PCT    = 0.03;   // 3%
const PAYMENT_FEE_FIXED  = 0.25;   // $0.25

function calcEarnings(price: number): number {
  if (!price || price <= 0) return 0;
  return price * (1 - PLATFORM_FEE_PCT - PAYMENT_FEE_PCT) - PAYMENT_FEE_FIXED;
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
  checked:  boolean;
  onChange: (v: boolean) => void;
  label:    string;
  sub?:     string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-1">
      <div>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${checked ? 'bg-primary' : 'bg-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
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

// ─── EstimatedEarningsRow (replaced by ../EstimatedEarningsRow.tsx) ──────────

function _EstimatedEarningsRow_REMOVED({
  basePrice, compareAtPrice,
}: {
  basePrice:      number;
  compareAtPrice: number | null;
}) {
  const [open, setOpen] = useState(false);

  const price   = Number(basePrice)      || 0;
  const compare = Number(compareAtPrice) || 0;
  const earnings = calcEarnings(price);
  const earningsHigh = compare > price ? calcEarnings(compare) : null;

  if (price <= 0) return null;

  const earningsLabel = earningsHigh
    ? `${fmtAmount(earnings)} to ${fmtAmount(earningsHigh)}`
    : fmtAmount(earnings);

  const FEE_ROWS = [
    { label: 'Transaction fee',    value: -(price * PLATFORM_FEE_PCT),                  pct: `${fmtFixed(PLATFORM_FEE_PCT * 100, 1)}%` },
    { label: 'Payment processing', value: -(price * PAYMENT_FEE_PCT + PAYMENT_FEE_FIXED), pct: `${fmtFixed(PAYMENT_FEE_PCT * 100, 1)}% + ${fmtAmount(PAYMENT_FEE_FIXED)}` },
  ];

  return (
    <div className="mt-3 border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left">
        <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-sm font-medium text-blue-800 flex-1">
          Estimated earnings: <span className="font-bold">{earningsLabel}</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
      </button>

      {open && (
        <div className="px-4 py-3 bg-blue-50/50 border-t border-blue-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-secondary">Listing price</span>
            <span className="font-medium tabular-nums">${price.toFixed(2)}</span>
          </div>
          {FEE_ROWS.map((r) => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-muted">{r.label} <span className="text-muted/60 text-xs">({r.pct})</span></span>
              <span className="text-red-600 tabular-nums">{r.value.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
            <span className="font-semibold text-secondary">Estimated earnings</span>
            <span className="font-bold text-green-700 tabular-nums">${earnings.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-muted/60">
            Estimate only. Does not include shipping, taxes, or currency conversion fees.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── PriceInput (dual: base + compare-at) ────────────────────────────────────

function PriceInput() {
  const { register, formState: { errors } } = useFormContext<ProductEditFormValues>();

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
            className={[
              'pl-7 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 w-32 tabular-nums',
              errors.basePrice ? 'border-red-400 focus:ring-red-200' : 'border-border focus:ring-primary/20',
            ].join(' ')}
            placeholder="0.00"
          />
        </div>
        {errors.basePrice && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.basePrice.message as string}
          </p>
        )}
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

// ─── ProcessingProfileCard (Image 11) ────────────────────────────────────────

function ProcessingProfileCard({
  profileId, onChange,
}: {
  profileId: string | null;
  onChange:  (id: string | null) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const { data: profiles = [] } = useQuery<ProcessingProfile[]>({
    queryKey: ['processing-profiles'],
    queryFn:  async () => {
      const res = await clientFetch('/admin/shipping/processing-profiles');
      return fetchArr<ProcessingProfile>(res);
    },
    staleTime: 10 * 60_000,
  });

  const selected = profiles.find((p) => p.id === profileId)
    ?? profiles.find((p) => p.isDefault)
    ?? profiles[0];

  return (
    <>
      <div className={[
        'flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 transition-colors',
        selected ? 'border-border bg-background' : 'border-dashed border-border bg-background',
      ].join(' ')}>
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-sm font-semibold text-secondary">
                {selected.name}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {selected.minDays}–{selected.maxDays} business days
                · {selected.type === 'READY_TO_SHIP' ? 'Ready to ship' : 'Made to order'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No processing profile selected</p>
          )}
        </div>
        <button type="button" onClick={() => setShowModal(true)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Change profile
        </button>
      </div>

      {showModal && (
        <ProfilePickerModal
          title="Select processing profile"
          items={profiles}
          selectedId={profileId}
          renderItem={(p) => (
            <>
              <p className="text-sm font-semibold text-secondary">{p.name}</p>
              <p className="text-xs text-muted mt-0.5">
                {p.minDays}–{p.maxDays} days · {p.type === 'READY_TO_SHIP' ? 'Ready to ship' : 'Made to order'}
                {p.isDefault && <span className="ml-2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Default</span>}
              </p>
            </>
          )}
          onSelect={onChange}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── ShippingCostPreview (Image 12) ──────────────────────────────────────────

function ShippingCostPreview({ profile }: { profile: ShippingProfile | undefined }) {
  const [open, setOpen] = useState(false);

  if (!profile?.methods?.length) return null;

  const domestic = profile.methods.find((m) => m.destinationType === 'domestic');
  const intl     = profile.methods.find((m) => m.destinationType === 'everywhere_else');

  return (
    <div className="mt-2 border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-background hover:bg-muted/5 transition-colors text-left">
        <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-sm text-secondary flex-1">Preview shipping cost</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-border space-y-2 bg-background/50">
          {domestic && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary flex items-center gap-2">
                <span className="text-base">🇺🇸</span> United States
                <span className="text-xs text-muted">{domestic.minDays}–{domestic.maxDays} days</span>
              </span>
              <span className="font-semibold tabular-nums">${Number(domestic.price).toFixed(2)}</span>
            </div>
          )}
          {intl && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted" /> Everywhere else
                <span className="text-xs text-muted">{intl.minDays}–{intl.maxDays} days</span>
              </span>
              <span className="font-semibold tabular-nums">${Number(intl.price).toFixed(2)}</span>
            </div>
          )}
          {profile.methods.filter((m) => m.destinationType !== 'domestic' && m.destinationType !== 'everywhere_else').map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-secondary flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-muted">{m.destinationType}</span>
                {m.carrier && <span className="text-xs text-muted">({m.carrier})</span>}
              </span>
              <span className="font-semibold tabular-nums">${Number(m.price).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
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
    queryFn:  async () => {
      const res = await clientFetch('/admin/shipping/profiles');
      return fetchArr<ShippingProfile>(res);
    },
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
      <ShippingCostPreview profile={selected} />

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

// ─── ReturnPolicyCard (Image 12) ─────────────────────────────────────────────

const RETURN_POLICIES: { value: ReturnPolicy; label: string; description: string; icon: React.ElementType }[] = [
  {
    value:       'NO_RETURNS',
    label:       'No returns or exchanges',
    description: 'Buyers cannot return or exchange items.',
    icon:        X,
  },
  {
    value:       'RETURNS_ACCEPTED',
    label:       'Returns accepted',
    description: 'Buyers can return items within 30 days of delivery.',
    icon:        RotateCcw,
  },
  {
    value:       'EXCHANGES_ONLY',
    label:       'Exchanges only',
    description: 'Buyers can exchange items but not get a refund.',
    icon:        ArrowRight,
  },
];

function ReturnPolicyCard({
  policy, onChange,
}: {
  policy:   ReturnPolicy;
  onChange: (p: ReturnPolicy) => void;
}) {
  const current = RETURN_POLICIES.find((p) => p.value === policy) ?? RETURN_POLICIES[0];
  const [expanded, setExpanded] = useState(false);
  const Icon = current.icon;

  return (
    <div className="space-y-2">
      {/* Current policy display */}
      <div className="flex items-start gap-4 px-4 py-3.5 rounded-lg border-2 border-border bg-background">
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-secondary">{current.label}</p>
          <p className="text-xs text-muted mt-0.5">{current.description}</p>
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Change policy
        </button>
      </div>

      {/* Inline policy selector */}
      {expanded && (
        <div className="space-y-2 pl-2">
          {RETURN_POLICIES.map((p) => {
            const BtnIcon = p.icon;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setExpanded(false); }}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all',
                  policy === p.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${policy === p.value ? 'border-primary' : 'border-muted'}`}>
                  {policy === p.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${policy === p.value ? 'text-primary' : 'text-secondary'}`}>
                    {p.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{p.description}</p>
                </div>
                {policy === p.value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
          <button type="button" onClick={() => setExpanded(false)}
            className="text-sm text-muted hover:text-secondary transition-colors px-4">
            Cancel
          </button>
        </div>
      )}
    </div>
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
      const res  = await clientFetch(`/admin/products/${productId}/variation-settings`);
      if (!res.ok) return { enableVariations: false, variesBy: [] };
      const body = await res.json();
      return (body.data ?? body) as VariationSettings;
    },
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
type AnyTabId = 'performance' | 'photo-video' | 'item-details' | 'item-options' | 'pricing-shipping' | 'how-its-made' | 'settings';

interface PricingShippingTabProps {
  product:      AdminProductDto;
  onSwitchTab?: (tab: AnyTabId) => void;
}

export function PricingShippingTab({ product, onSwitchTab }: PricingShippingTabProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<ProductEditFormValues>();

  const basePrice    = watch('basePrice');
  const compareAt    = watch('compareAtPrice');
  const profileId    = watch('processingProfileId') ?? null;
  const shippingId   = watch('shippingProfileId')   ?? null;
  const returnPolicy = watch('returnPolicy')         ?? 'NO_RETURNS';
  const domGlobal    = watch('domesticGlobalPricing');
  const sku          = watch('sku') ?? '';

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
        </TabSection>

        {/* ── Shipping, Processing & Returns (Images 11-12) ────────────── */}
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
      </div>
    </div>
  );
}
