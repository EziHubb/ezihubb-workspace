'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Percent } from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';
import { ListingPicker, type PickedProduct } from './ListingPicker';

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

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

interface BuyTogetherModalProps {
  bundle?:    BundleOffer | null;
  onClose:    () => void;
  onSave:     (data: BundleFormData, id?: string) => Promise<void>;
}

/** Etsy "Buy them together" bundle offer — 2–3 listings at a combined % discount, applied only when bought together. */
export function BuyTogetherModal({ bundle, onClose, onSave }: BuyTogetherModalProps) {
  const isEdit = !!bundle?.id;

  const [discountPercent, setDiscountPercent] = useState(bundle?.discountPercent ?? 10);
  const [picked, setPicked] = useState<PickedProduct[]>(() =>
    (bundle?.products ?? []).map((p) => ({ id: p.id, name: p.name, basePrice: p.price, images: p.images.map((url) => ({ url, isPrimary: true })) })),
  );
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const originalValue = useMemo(() => picked.reduce((s, p) => s + Number(p.basePrice), 0), [picked]);
  const newTotal = useMemo(() => Math.round(originalValue * (1 - discountPercent / 100) * 100) / 100, [originalValue, discountPercent]);

  const handleSave = async () => {
    if (picked.length < 2) { setError('Select at least 2 listings'); return; }
    if (picked.length > 3) { setError('A bundle can include at most 3 listings'); return; }
    if (discountPercent <= 0 || discountPercent > 75) { setError('Discount must be between 1 and 75%'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ discountPercent, productIds: picked.map((p) => p.id) }, bundle?.id);
    } catch { /* handled by parent */ } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeroHeader
        icon={<Users className="w-7 h-7" />}
        title={isEdit ? 'Edit bundle offer' : 'Create an irresistible offer for items that belong together!'}
        subtitle="Add up to 3 listings to offer together — all variations will be eligible for the discount."
        band="periwinkle"
        onClose={onClose}
      />
      <div className="overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Listings <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-muted/70 mb-2">Add 2–3 listings buyers can purchase together at a discount</p>
            <ListingPicker selected={picked} onChange={setPicked} max={3} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Discount</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="number" min={1} max={75}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className={`${inputCls} pl-8`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">% off combined price</span>
            </div>
          </div>

          {picked.length >= 2 && (
            <div className="bg-background border border-border rounded-card p-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-muted">Original value</p>
                <p className="font-semibold text-secondary line-through decoration-red-400">${originalValue.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted">New total</p>
                <p className="font-bold text-primary text-base">${newTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={picked.length < 2}>
          {isEdit ? 'Save bundle' : 'Create offer'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
