'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, Package } from 'lucide-react';
import { Modal, Button } from '@ezihubb/ui';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { toast } from '../../lib/store/toast.store';
import type { PickedProduct } from './ListingPicker';

export interface BundleFormData {
  discountPercent: number;
  productIds:      string[];
}

export interface BundleOffer {
  id:              string;
  discountPercent: number;
  isActive:        boolean;
  products:        { id: string; name: string; price: number; images: string[] }[];
}

const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30];
const MAX_LISTINGS = 3;

/** An existing bundle (created before this preset dropdown shipped, when the
 *  field was a free 1-75 number input) can carry a discount outside the
 *  preset list — without this, `<select value={discountPercent}>` would
 *  silently show no option selected instead of the real stored percentage. */
function discountOptionsFor(currentValue: number): number[] {
  if (DISCOUNT_PRESETS.includes(currentValue)) return DISCOUNT_PRESETS;
  return [...DISCOUNT_PRESETS, currentValue].sort((a, b) => a - b);
}

function thumbOf(p: PickedProduct): string | undefined {
  return p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
}

interface BuyTogetherModalProps {
  bundle?: BundleOffer | null;
  onClose: () => void;
  onSave:  (data: BundleFormData, id?: string) => Promise<void>;
}

type Screen = 'main' | 'pick' | 'success';

// ── Screen 2: grid listing picker ───────────────────────────────────────────
// Etsy's "Choose up to three of your listings" — a thumbnail grid with
// checkboxes, distinct from the compact search-dropdown ListingPicker used
// by "Set up a sale" (which Etsy itself shows as a simpler dropdown there).
// Section-based filtering and the "already in a sale" conflict warning seen
// in the reference screenshots need data this component doesn't have easy
// access to yet — search-only for now, noted as a known simplification.

function BundleListingPickerScreen({
  picked, onChange, onCancel, onContinue,
}: {
  picked:     PickedProduct[];
  onChange:   (products: PickedProduct[]) => void;
  onCancel:   () => void;
  onContinue: () => void;
}) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '24' });
        if (query.trim()) params.set('q', query.trim());
        const res = await api.get<{ data: PickedProduct[] }>(`${API_ROUTES.ADMIN.PRODUCTS}?${params}`);
        setResults(res.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const pickedIds = new Set(picked.map((p) => p.id));

  const toggle = (p: PickedProduct) => {
    if (pickedIds.has(p.id)) { onChange(picked.filter((x) => x.id !== p.id)); return; }
    if (picked.length >= MAX_LISTINGS) return;
    onChange([...picked, p]);
  };

  return (
    <Modal isOpen onClose={onCancel} size="xl">
      <div className="px-6 pt-6 pb-2 shrink-0">
        <h2 className="font-display text-xl font-bold text-secondary">Choose up to {MAX_LISTINGS} of your listings</h2>
        <p className="text-sm text-muted mt-1">To attract buyers, we recommend picking items that go together but aren&apos;t the same.</p>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings…"
            className="w-full max-w-sm pl-8 pr-3 py-2 text-sm border border-border rounded-full bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="overflow-y-auto px-6 py-4 flex-1">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-card bg-muted/10 animate-pulse" />)}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Package className="w-8 h-8 text-muted/30" />
            <p className="text-sm text-muted">No listings found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {results.map((p) => {
              const isPicked = pickedIds.has(p.id);
              const disabled = !isPicked && picked.length >= MAX_LISTINGS;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(p)}
                  className={[
                    'relative text-left rounded-card border-2 overflow-hidden transition-colors',
                    isPicked ? 'border-secondary' : 'border-transparent hover:border-border',
                    disabled ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center',
                      isPicked ? 'bg-secondary border-secondary text-white' : 'bg-surface/90 border-border',
                    ].join(' ')}
                  >
                    {isPicked && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </span>
                  <div className="aspect-square bg-muted/10">
                    {thumbOf(p) && <img src={thumbOf(p)} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-secondary line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-xs text-muted mt-0.5">US${Number(p.basePrice).toFixed(2)}+</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onContinue} disabled={picked.length === 0}>Continue</Button>
      </div>
    </Modal>
  );
}

// ── Screen 1 + 3: split-panel main form + success confirmation ─────────────

/** Etsy "Buy them together" bundle offer — 2-3 listings at a combined % discount, applied only when bought together. */
export function BuyTogetherModal({ bundle, onClose, onSave }: BuyTogetherModalProps) {
  const isEdit = !!bundle?.id;

  const [screen, setScreen] = useState<Screen>('main');
  const [discountPercent, setDiscountPercent] = useState(bundle?.discountPercent ?? 5);
  const [picked, setPicked] = useState<PickedProduct[]>(() =>
    (bundle?.products ?? []).map((p) => ({ id: p.id, name: p.name, basePrice: p.price, images: p.images.map((url) => ({ url, isPrimary: true })) })),
  );
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  const originalValue = useMemo(() => picked.reduce((s, p) => s + Number(p.basePrice), 0), [picked]);
  const newTotal = useMemo(() => Math.round(originalValue * (1 - discountPercent / 100) * 100) / 100, [originalValue, discountPercent]);

  const handleCreate = async () => {
    if (picked.length < 2) { setError('Select at least 2 listings'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ discountPercent, productIds: picked.map((p) => p.id) }, bundle?.id);
      if (isEdit) {
        toast.success('Bundle updated', { description: 'Your changes are live.' });
        onClose();
      } else {
        setScreen('success');
      }
    } catch {
      toast.error('Something went wrong', { description: "Your offer wasn't saved — please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'pick') {
    return (
      <BundleListingPickerScreen
        picked={picked}
        onChange={setPicked}
        onCancel={() => setScreen('main')}
        onContinue={() => setScreen('main')}
      />
    );
  }

  if (screen === 'success') {
    return (
      <Modal isOpen onClose={onClose} size="md">
        <div className="px-6 pt-8 pb-6 text-center">
          <h2 className="font-display text-2xl font-bold text-secondary">Success! Your offer is live.</h2>
          <p className="text-sm text-muted mt-2">Buyers will get {discountPercent}% off these items when they buy them together!</p>
          <div className="flex items-center justify-center gap-3 mt-5">
            {picked.map((p) => (
              <div key={p.id} className="w-24 h-24 rounded-card overflow-hidden bg-muted/10 shrink-0">
                {thumbOf(p) && <img src={thumbOf(p)} alt={p.name} className="w-full h-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-xs text-muted text-center">
            Go to <span className="underline font-semibold text-secondary">Details &amp; Stats</span> to manage or track your offer&apos;s success.
          </p>
          <Button variant="primary" onClick={onClose} className="w-full">Done</Button>
        </div>
      </Modal>
    );
  }

  const slots: (PickedProduct | null)[] = [
    ...picked,
    ...Array(Math.max(0, MAX_LISTINGS - picked.length)).fill(null),
  ].slice(0, MAX_LISTINGS);
  const previewSlots: (PickedProduct | null)[] = (picked.length > 0 ? picked : [null, null]).slice(0, 2);

  return (
    <Modal isOpen onClose={onClose} size="xl">
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left: live widget preview — mirrors what buyers will actually see on the listing page */}
        <div className="md:w-[300px] shrink-0 bg-hero-periwinkle px-6 py-8 flex flex-col overflow-y-auto">
          <h2 className="font-display text-xl font-bold text-secondary leading-snug">
            {isEdit ? 'Edit your bundle offer' : 'Create an irresistible offer for items that belong together!'}
          </h2>
          <div className="mt-6 bg-surface rounded-card shadow-card p-4">
            <p className="text-sm font-bold text-secondary mb-3">Buy them together for {discountPercent}% off</p>
            <div className="space-y-2">
              {previewSlots.map((p, i) => (
                <div key={p?.id ?? i} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded bg-muted/15 shrink-0 overflow-hidden">
                    {p && thumbOf(p) && <img src={thumbOf(p)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    {p ? (
                      <>
                        <p className="text-xs text-secondary truncate">{p.name}</p>
                        <p className="text-xs text-muted">${Number(p.basePrice).toFixed(2)}</p>
                      </>
                    ) : (
                      <>
                        <div className="h-2 bg-muted/15 rounded w-4/5" />
                        <div className="h-2 bg-muted/15 rounded w-1/3 mt-1.5" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" disabled className="w-full mt-4 py-2 rounded-full border border-secondary/30 text-xs font-semibold text-secondary/60">
              Add all to basket
            </button>
          </div>
        </div>

        {/* Right: choose listings + set discount */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-end px-4 pt-4 shrink-0">
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-sm text-muted hover:text-secondary hover:bg-background transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-6 pb-6 pt-2 overflow-y-auto flex-1">
            <h3 className="text-base font-bold text-secondary">Choose listings and set a discount</h3>

            <div className="mt-5">
              <p className="text-sm font-semibold text-secondary">Add up to {MAX_LISTINGS} listings to offer together</p>
              <p className="text-xs text-muted mt-0.5">Keep in mind all variations will be eligible for the discount.</p>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {slots.map((p, i) =>
                  p ? (
                    <div key={p.id} className="relative border border-border rounded-card p-2">
                      <button
                        type="button"
                        onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))}
                        className="absolute top-1.5 right-1.5 p-1 bg-surface/90 rounded-full text-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="aspect-square rounded bg-muted/10 overflow-hidden">
                        {thumbOf(p) && <img src={thumbOf(p)} alt={p.name} className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-xs text-secondary mt-1.5 line-clamp-2">{p.name}</p>
                      <p className="text-xs text-muted">${Number(p.basePrice).toFixed(2)}</p>
                    </div>
                  ) : (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      onClick={() => setScreen('pick')}
                      className="aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-card text-muted hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-semibold">Add listing</span>
                    </button>
                  ),
                )}
              </div>
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-secondary">Set a discount amount</p>
              <p className="text-xs text-muted mt-0.5">Discount with confidence! This will only apply to the listings you choose, when purchased together.</p>
              <select
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="mt-2 w-40 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {discountOptionsFor(discountPercent).map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>

            {picked.length >= 2 && (
              <div className="mt-5 text-sm space-y-0.5">
                <p className="text-muted">Original value: <span className="text-secondary">${originalValue.toFixed(2)}</span></p>
                <p className="font-semibold text-secondary">New total: ${newTotal.toFixed(2)}</p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving} disabled={picked.length < 2}>
              {isEdit ? 'Save bundle' : 'Create offer'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
