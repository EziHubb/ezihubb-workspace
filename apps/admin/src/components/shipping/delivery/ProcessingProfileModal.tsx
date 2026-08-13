'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProcessingProfile, ProcessingProfileType } from './types';

// ── Preset processing-time ranges (Etsy's "How much processing time do you
// need?" dropdown) — a fixed list keeps sellers from entering nonsensical
// ranges (e.g. max < min) while still covering everything from same-day
// print-on-demand to multi-week handmade production. ─────────────────────────

const PRESETS: { label: string; minDays: number; maxDays: number }[] = [
  { label: '1-3 business days',  minDays: 1,  maxDays: 3  },
  { label: '3-5 business days',  minDays: 3,  maxDays: 5  },
  { label: '5-7 business days',  minDays: 5,  maxDays: 7  },
  { label: '6-10 business days', minDays: 6,  maxDays: 10 },
  { label: '1-2 weeks',          minDays: 7,  maxDays: 14 },
  { label: '2-3 weeks',          minDays: 14, maxDays: 21 },
  { label: '3-4 weeks',          minDays: 21, maxDays: 28 },
  { label: '4-6 weeks',          minDays: 28, maxDays: 42 },
  { label: '6-8 weeks',          minDays: 42, maxDays: 56 },
];

/** -1 when the profile's stored range doesn't match any preset (e.g. an
 *  older custom value) — callers must handle that case explicitly rather
 *  than silently falling back to preset 0, which would overwrite the real
 *  range with "1-3 business days" the moment the seller hits Save without
 *  touching the dropdown. */
function presetIndexFor(minDays: number, maxDays: number): number {
  return PRESETS.findIndex((p) => p.minDays === minDays && p.maxDays === maxDays);
}

const TYPE_NAME: Record<ProcessingProfileType, string> = {
  MADE_TO_ORDER: 'Made to order',
  READY_TO_SHIP: 'Ready to dispatch',
};

interface Props {
  profile?:      ProcessingProfile | null;
  /** Button label — "Apply" when this create/edit also assigns the profile to a listing (product editor context), "Create"/"Save" for the standalone Delivery settings page. */
  submitLabel?:  string;
  onClose:       () => void;
  onSaved:       (profile: ProcessingProfile) => void;
}

export function ProcessingProfileModal({ profile, submitLabel, onClose, onSaved }: Props) {
  const isEdit = !!profile;
  const [type, setType] = useState<ProcessingProfileType>(profile?.type ?? 'MADE_TO_ORDER');

  // The profile being edited may carry a min/max range that doesn't match any
  // preset (an older custom value, or one entered outside this UI) — prepend
  // it as its own selectable option instead of silently snapping to preset 0
  // ("1-3 business days") the moment the seller hits Save without touching
  // the dropdown, which would quietly overwrite their real processing time.
  const matchedIndex = profile ? presetIndexFor(profile.minDays, profile.maxDays) : 0;
  const options = profile && matchedIndex === -1
    ? [{ label: `Custom (${profile.minDays}-${profile.maxDays} days)`, minDays: profile.minDays, maxDays: profile.maxDays }, ...PRESETS]
    : PRESETS;
  const [presetIndex, setPresetIndex] = useState(matchedIndex === -1 ? 0 : matchedIndex);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const preset = options[presetIndex];
    const dto = {
      name:    TYPE_NAME[type],
      type,
      minDays: preset.minDays,
      maxDays: preset.maxDays,
    };
    try {
      const saved = isEdit
        ? await api.patch<ProcessingProfile>(API_ROUTES.ADMIN.SHIPPING_PROCESSING_PROFILE(profile!.id), dto)
        : await api.post<ProcessingProfile>(API_ROUTES.ADMIN.SHIPPING_PROCESSING_PROFILES, dto);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save this processing profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-secondary text-lg">
            {isEdit ? 'Edit processing profile' : 'Create processing profile'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-secondary mb-1">
              Are your items made to order, or ready to dispatch? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-muted mb-3">These details help us know how you prepare items when receiving an order.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('MADE_TO_ORDER')}
                className={[
                  'text-left p-3.5 rounded-lg border-2 transition-colors',
                  type === 'MADE_TO_ORDER' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <p className="text-sm font-semibold text-secondary">Made to order</p>
                <p className="text-xs text-muted mt-0.5">Item is created or personalised once the order is placed</p>
              </button>
              <button
                type="button"
                onClick={() => setType('READY_TO_SHIP')}
                className={[
                  'text-left p-3.5 rounded-lg border-2 transition-colors',
                  type === 'READY_TO_SHIP' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                ].join(' ')}
              >
                <p className="text-sm font-semibold text-secondary">Ready to dispatch</p>
                <p className="text-xs text-muted mt-0.5">Item is already made</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">
              How much processing time do you need? <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted mb-2">We use an item's processing time to calculate your dispatch-by dates.</p>
            <select
              value={presetIndex}
              onChange={(e) => setPresetIndex(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {options.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-muted hover:text-secondary transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : (submitLabel ?? (isEdit ? 'Save' : 'Create'))}
          </button>
        </div>
      </div>
    </div>
  );
}
