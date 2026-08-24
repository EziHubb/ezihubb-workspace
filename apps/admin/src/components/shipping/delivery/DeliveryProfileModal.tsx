'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Select } from '@ezihubb/ui';
import { api } from '../../../lib/api-client';
import { API_ROUTES, CARRIER_SERVICES } from '@ezihubb/constants';
import { COUNTRIES } from './countries';
import type { ShippingProfile, ShippingProfileMethodRow } from './types';
import { DOMESTIC, EVERYWHERE_ELSE } from './types';

function newRow(destinationType: string): ShippingProfileMethodRow {
  return {
    destinationType,
    carrierService: 'OTHER',
    carrierName:    '',
    chargeType:     'FIXED',
    minDays:        2,
    maxDays:        8,
    price:          0,
    extraItemPrice: 0,
  };
}

function rowKey(row: ShippingProfileMethodRow, i: number): string {
  return row.id ?? `${row.destinationType}-${i}`;
}

// Real Etsy presents delivery time as two Select dropdowns rather than free-
// entry number inputs — a bounded day range is exactly the kind of input a
// dropdown suits better than a spinner, so this mirrors that choice.
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i),
  label: `${i} day${i === 1 ? '' : 's'}`,
}));

/** Existing rows created before this dropdown shipped (or via the API
 *  directly) can carry a day count outside the 0-30 preset list — without
 *  this, `<Select value={String(row.minDays)}>` would silently fall back to
 *  showing the first option ("0 days") for e.g. a genuine 45-day made-to-
 *  order profile, misrepresenting real data rather than just being unable
 *  to set a new one that high. */
function dayOptionsFor(currentValue: number): { value: string; label: string }[] {
  if (currentValue >= 0 && currentValue <= 30) return DAY_OPTIONS;
  return [...DAY_OPTIONS, { value: String(currentValue), label: `${currentValue} days` }]
    .sort((a, b) => Number(a.value) - Number(b.value));
}

function destinationLabel(destinationType: string, originCountry: string): string {
  if (destinationType === DOMESTIC) return COUNTRIES.find((c) => c.code === originCountry)?.name ?? originCountry;
  if (destinationType === EVERYWHERE_ELSE) return 'Everywhere else';
  return COUNTRIES.find((c) => c.code === destinationType)?.name ?? destinationType;
}

// ── One destination row ───────────────────────────────────────────────────────

function DestinationRow({
  row, originCountry, canDelete, onChange, onDelete,
}: {
  row:           ShippingProfileMethodRow;
  originCountry: string;
  canDelete:     boolean;
  onChange:      (patch: Partial<ShippingProfileMethodRow>) => void;
  onDelete:      () => void;
}) {
  const isFree = row.chargeType === 'FREE';

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-secondary">{destinationLabel(row.destinationType, originCountry)}</p>
        {canDelete && (
          <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Delivery service</label>
          <Select
            size="sm"
            value={row.carrierService}
            onChange={(e) => onChange({ carrierService: e.target.value })}
            options={CARRIER_SERVICES.map((c) => ({ value: c.value, label: c.label }))}
          />
          {row.carrierService === 'OTHER' && (
            <input
              value={row.carrierName ?? ''}
              onChange={(e) => onChange({ carrierName: e.target.value })}
              placeholder="Carrier name"
              className="w-full h-9 mt-2 px-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Delivery time (business days)</label>
          <div className="flex items-center gap-2">
            <Select
              size="sm"
              value={String(row.minDays)}
              onChange={(e) => onChange({ minDays: Number(e.target.value) })}
              options={dayOptionsFor(row.minDays)}
            />
            <span className="text-muted shrink-0">–</span>
            <Select
              size="sm"
              value={String(row.maxDays)}
              onChange={(e) => onChange({ maxDays: Number(e.target.value) })}
              options={dayOptionsFor(row.maxDays)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">What you'll charge</label>
          <Select
            size="sm"
            value={row.chargeType}
            onChange={(e) => onChange({ chargeType: e.target.value as 'FIXED' | 'FREE' })}
            options={[
              { value: 'FREE',  label: 'Free delivery' },
              { value: 'FIXED', label: 'Fixed price' },
            ]}
          />
        </div>

        {!isFree && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">One item</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">US$</span>
                <input
                  type="number" min={0} step={0.01}
                  value={row.price ?? 0}
                  onChange={(e) => onChange({ price: Number(e.target.value) })}
                  className="w-full h-9 pl-11 pr-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Additional item</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">US$</span>
                <input
                  type="number" min={0} step={0.01}
                  value={row.extraItemPrice ?? 0}
                  onChange={(e) => onChange({ extraItemPrice: Number(e.target.value) })}
                  className="w-full h-9 pl-11 pr-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add-location picker ───────────────────────────────────────────────────────

function AddLocationPicker({ existing, onPick, onClose }: {
  existing: string[];
  onPick:   (code: string) => void;
  onClose:  () => void;
}) {
  const [query, setQuery] = useState('');
  const options = COUNTRIES.filter(
    (c) => !existing.includes(c.code) && c.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h4 className="font-semibold text-secondary text-sm">Add a location</h4>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          autoFocus
          className="mx-4 mt-3 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {options.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onPick(c.code); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/5 text-secondary text-left"
            >
              <span>{c.flag}</span> {c.name}
            </button>
          ))}
          {options.length === 0 && <p className="text-sm text-muted text-center py-4">No matches</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface Props {
  profile?:     ShippingProfile | null;
  /** Button label — "Apply" when this create/edit also assigns the profile to a listing (product editor context), "Save profile" for the standalone Delivery settings page. */
  submitLabel?: string;
  /** "Delivery option" in the product editor context vs "Delivery profile" on the standalone Delivery settings page — same underlying object, different framing. */
  entityLabel?: string;
  onClose:      () => void;
  onSaved:      (profile: ShippingProfile) => void;
}

export function DeliveryProfileModal({ profile, submitLabel, entityLabel = 'delivery profile', onClose, onSaved }: Props) {
  const isEdit = !!profile;
  const [name,             setName]             = useState(profile?.name ?? '');
  const [originCountry,    setOriginCountry]    = useState(profile?.originCountry ?? 'VN');
  const [originPostalCode, setOriginPostalCode] = useState(profile?.originPostalCode ?? '');
  const [rows, setRows] = useState<ShippingProfileMethodRow[]>(
    profile?.methods.length ? profile.methods : [newRow(DOMESTIC), newRow(EVERYWHERE_ELSE)],
  );
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const patchRow = (i: number, patch: Partial<ShippingProfileMethodRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const deleteRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addLocation = (code: string) => setRows((prev) => [...prev, newRow(code)]);

  const existingDestinations = rows.map((r) => r.destinationType);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Give this profile a name.'); return; }
    if (!originPostalCode.trim()) { setError('Enter your origin postal code.'); return; }
    for (const row of rows) {
      if (row.chargeType === 'FIXED' && (row.price === undefined || row.price === null)) {
        setError(`Enter a price for "${destinationLabel(row.destinationType, originCountry)}", or switch it to Free delivery.`);
        return;
      }
    }

    setSaving(true);
    const dto = {
      name:             name.trim(),
      originCountry,
      originPostalCode: originPostalCode.trim(),
      methods: rows.map((r) => ({
        destinationType: r.destinationType,
        carrierService:  r.carrierService,
        carrierName:     r.carrierService === 'OTHER' ? (r.carrierName || 'Other') : undefined,
        chargeType:      r.chargeType,
        minDays:         r.minDays,
        maxDays:          r.maxDays,
        price:           r.chargeType === 'FREE' ? undefined : r.price,
        extraItemPrice:  r.chargeType === 'FREE' ? undefined : r.extraItemPrice,
      })),
    };
    try {
      const saved = isEdit
        ? await api.patch<ShippingProfile>(API_ROUTES.ADMIN.SHIPPING_PROFILE(profile!.id), dto)
        : await api.post<ShippingProfile>(API_ROUTES.ADMIN.SHIPPING_PROFILES, dto);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save this delivery profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        {isEdit ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
      </ModalHeader>

      <ModalBody>
          <p className="text-xs text-muted -mt-2">
            We use these settings to calculate postage costs and estimated delivery dates for buyers.
          </p>

          {/*
            A delivery profile belongs to the shop, not to whichever listing
            happens to be open — so saving here takes effect at once, and it
            takes effect for every listing already using it.

            That is the right behaviour (a shop-wide object cannot sensibly
            wait on one listing's "Publish changes", and Discard would then
            silently drop it) but it is not what the surrounding page implies,
            since everything else in the product editor waits for Publish.
            Said out loud, with the number, rather than left to be discovered.
          */}
          {isEdit && (profile?.activeListings ?? 0) > 0 && (
            <p className="rounded-card border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-secondary">
              Saved straight away, and applied to the{' '}
              <strong>{profile!.activeListings} listing{profile!.activeListings === 1 ? '' : 's'}</strong>{' '}
              already using this {entityLabel} — not only the one you are editing.
            </p>
          )}

          {/* Origin */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">
                Country items are dispatched from <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted mb-1.5">The country you're dispatching from</p>
              <Select
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">
                Origin postal code <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted mb-1.5">Where your orders dispatch from</p>
              <input
                value={originPostalCode}
                onChange={(e) => setOriginPostalCode(e.target.value)}
                placeholder="e.g. 700000"
                className="w-full h-11 px-3.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
              />
            </div>
          </div>

          {/* Destination rows */}
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">
              Standard delivery <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted mb-3">Where will you dispatch to? We'll show your listings to shoppers in the countries you add here.</p>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <DestinationRow
                  key={rowKey(row, i)}
                  row={row}
                  originCountry={originCountry}
                  canDelete={rows.length > 1}
                  onChange={(patch) => patchRow(i, patch)}
                  onDelete={() => deleteRow(i)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddLocation(true)}
              className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Plus className="w-4 h-4" /> Add another location
            </button>
          </div>

          {/* Profile name */}
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">
              Profile name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Shipping"
              className="w-full h-11 px-3.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {submitLabel ?? 'Save profile'}
        </Button>
      </ModalFooter>

      {showAddLocation && (
        <AddLocationPicker
          existing={existingDestinations}
          onPick={addLocation}
          onClose={() => setShowAddLocation(false)}
        />
      )}
    </Modal>
  );
}
