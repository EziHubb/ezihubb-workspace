'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Trash2, Pencil, ChevronLeft, Check,
  ArrowRight, AlignLeft, Palette, LayoutGrid,
} from 'lucide-react';
import { clientFetch } from '../../../lib/api';
import { fetchArr } from '../../../lib/fmt';
import { fmtAmount } from '../../../lib/fmt';
import { InlinePriceInput } from './primitives';
import type { VariationOption, VariationGroup, VariationSettings } from './tabs/ItemOptionsTab';

// ─── Settings helpers ─────────────────────────────────────────────────────────
// Settings are encoded in `variesBy: string[]` to avoid a new migration.
// Encoding: 'price:<groupId>' | 'processing' | 'quantity' | 'sku'

function getPricesGroupId(variesBy: string[]): string | null {
  const entry = variesBy.find((v) => v.startsWith('price:'));
  return entry ? entry.slice(6) : null;
}

function hasSetting(variesBy: string[], key: string): boolean {
  return variesBy.includes(key);
}

function setSetting(variesBy: string[], key: string, on: boolean): string[] {
  const without = variesBy.filter((v) => v !== key && !v.startsWith(`${key}:`));
  return on ? [...without, key] : without;
}

function setPricesGroup(variesBy: string[], groupId: string | null): string[] {
  const without = variesBy.filter((v) => !v.startsWith('price:'));
  return groupId ? [...without, `price:${groupId}`] : without;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayType = 'dropdown' | 'color_swatch' | 'button' | 'image';

interface VariantRow {
  id:             string;
  option1Id?:     string;
  option2Id?:     string;
  price:          number;
  compareAtPrice?: number | null;
  sku?:           string;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#3D3D3D]' : 'bg-[#9CA3AF]'}`}
      style={{ height: 26 }}
    >
      <span
        aria-hidden
        className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

// ─── Tag input (text pills) ───────────────────────────────────────────────────

function TagInput({
  values, onAdd, placeholder,
}: {
  values: string[];
  onAdd:  (v: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const commit = () => {
    const t = input.trim();
    if (t && !values.includes(t)) onAdd(t);
    setInput('');
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={placeholder ?? 'Type a value, press Enter…'}
        className={`${inputCls} flex-1`}
      />
      <button
        type="button"
        onClick={commit}
        disabled={!input.trim()}
        className="px-3 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-button hover:bg-primary/5 disabled:opacity-30 transition-colors"
      >
        Add
      </button>
    </div>
  );
}

// ─── ColorOptionInput ─────────────────────────────────────────────────────────

function ColorOptionInput({
  onAdd,
}: {
  onAdd: (opt: { value: string; colorHex: string }) => void;
}) {
  const [name, setName] = useState('');
  const [hex,  setHex]  = useState('#E85D3F');

  const commit = () => {
    const t = name.trim();
    if (!t) return;
    onAdd({ value: t, colorHex: hex });
    setName('');
  };

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="block text-[11px] text-muted uppercase tracking-wide mb-1">Colour</label>
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="w-10 h-10 cursor-pointer rounded-lg border border-border"
        />
      </div>
      <div className="flex-1">
        <label className="block text-[11px] text-muted uppercase tracking-wide mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          placeholder="e.g. Khaki"
          className={inputCls}
        />
      </div>
      <button
        type="button"
        onClick={commit}
        disabled={!name.trim()}
        className="px-3 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-button hover:bg-primary/5 disabled:opacity-30 transition-colors mb-0.5"
      >
        Add
      </button>
    </div>
  );
}

// ─── VariationGroupCard ───────────────────────────────────────────────────────

function VariationGroupCard({
  group, onEdit, onDelete,
}: {
  group:    VariationGroup;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-secondary">{group.name}</span>
          <span className="text-xs text-muted">
            {group.options.length} {group.options.length === 1 ? 'option' : 'options'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit}
            className="p-1.5 rounded hover:bg-muted/10 text-muted hover:text-secondary transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Option pills / swatches */}
      <div className="flex flex-wrap gap-2">
        {group.options.map((opt) =>
          group.displayType === 'color_swatch' ? (
            <div key={opt.id} className="flex items-center gap-1.5">
              {opt.imageUrl ? (
                <div className="w-6 h-6 rounded-full overflow-hidden border border-border relative">
                  <Image src={opt.imageUrl} alt={opt.value} fill className="object-cover" sizes="24px" />
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded-full border border-border"
                  style={{ backgroundColor: opt.colorHex ?? '#E5E7EB' }}
                />
              )}
              <span className="text-xs text-secondary">{opt.name || opt.value}</span>
            </div>
          ) : (
            <span
              key={opt.id}
              className="px-2.5 py-1 text-xs border border-border rounded-full text-secondary bg-surface"
            >
              {opt.name || opt.value}
            </span>
          ),
        )}
        {group.options.length === 0 && (
          <span className="text-xs text-muted italic">No options yet</span>
        )}
      </div>
    </div>
  );
}

// ─── VariationSettingsToggles ─────────────────────────────────────────────────

function VariationSettingsToggles({
  groups, settings, onChange,
}: {
  groups:   VariationGroup[];
  settings: VariationSettings | undefined;
  onChange: (variesBy: string[]) => void;
}) {
  const variesBy     = settings?.variesBy ?? [];
  const pricesGroupId = getPricesGroupId(variesBy);

  return (
    <div className="space-y-4">
      {/* Prices vary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Toggle
          checked={!!pricesGroupId}
          onChange={(on) => onChange(setPricesGroup(variesBy, on ? (groups[0]?.id ?? null) : null))}
        />
        <span className="text-sm font-medium text-secondary">Prices vary for each</span>
        {pricesGroupId && groups.length > 0 && (
          <select
            value={pricesGroupId}
            onChange={(e) => onChange(setPricesGroup(variesBy, e.target.value))}
            className="text-sm border border-border rounded-button px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>

      {[
        { key: 'processing', label: 'Processing profiles vary' },
        { key: 'quantity',   label: 'Quantities vary'          },
        { key: 'sku',        label: 'SKUs vary'                },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3">
          <Toggle
            checked={hasSetting(variesBy, key)}
            onChange={(on) => onChange(setSetting(variesBy, key, on))}
          />
          <span className="text-sm font-medium text-secondary">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── VariantPriceMatrix ───────────────────────────────────────────────────────

function VariantPriceMatrix({
  productId, groups, settings,
}: {
  productId: string;
  groups:    VariationGroup[];
  settings:  VariationSettings;
}) {
  const pricesGroupId = getPricesGroupId(settings.variesBy);
  const skusVary      = hasSetting(settings.variesBy, 'sku');
  const priceGroup    = groups.find((g) => g.id === pricesGroupId);
  const qc = useQueryClient();

  const { data: variants = [] } = useQuery<VariantRow[]>({
    queryKey: ['variants', productId],
    queryFn:  async () => {
      const res = await clientFetch(`/admin/products/${productId}/variations/variants`);
      return fetchArr<VariantRow>(res);
    },
    staleTime: 30_000,
  });

  const patchVariant = async (variantId: string | undefined, patch: object) => {
    if (!variantId) return;
    await clientFetch(`/admin/products/${productId}/variations/variants/${variantId}`, {
      method: 'PATCH',
      body:   JSON.stringify(patch),
    });
    qc.invalidateQueries({ queryKey: ['variants', productId] });
  };

  if (!priceGroup) return null;

  return (
    <div className="mt-5 border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-background border-b border-border">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">
          Price per {priceGroup.name}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/3">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">
              {priceGroup.name}
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Price</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Compare at</th>
            {skusVary && <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">SKU</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {priceGroup.options.map((opt) => {
            const variant = variants.find(
              (v) => v.option1Id === opt.id || v.option2Id === opt.id,
            );
            return (
              <tr key={opt.id}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {opt.colorHex && (
                      <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: opt.colorHex }} />
                    )}
                    <span className="text-sm font-medium text-secondary">{opt.name || opt.value}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <InlinePriceInput
                    value={variant?.price ?? null}
                    onChange={(v) => patchVariant(variant?.id, { price: v })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <InlinePriceInput
                    value={variant?.compareAtPrice ?? null}
                    onChange={(v) => patchVariant(variant?.id, { compareAtPrice: v })}
                    placeholder="—"
                  />
                </td>
                {skusVary && (
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={variant?.sku ?? ''}
                      onBlur={(e) => patchVariant(variant?.id, { sku: e.target.value || null })}
                      placeholder="e.g. OA26-021216"
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-button bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:font-sans placeholder:text-muted"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── AddVariationGroupSheet ───────────────────────────────────────────────────

const SUGGESTED_NAMES = ['Color', 'Size', 'Style', 'Material', 'Finish', 'Length'];

const DISPLAY_TYPES: { type: DisplayType; label: string; icon: React.ElementType }[] = [
  { type: 'dropdown',     label: 'Dropdown',        icon: AlignLeft   },
  { type: 'color_swatch', label: 'Color swatches',  icon: Palette     },
  { type: 'button',       label: 'Text buttons',    icon: LayoutGrid  },
];

function AddVariationGroupSheet({
  productId,
  existingGroupNames,
  onSaved,
  onClose,
}: {
  productId:          string;
  existingGroupNames: string[];
  onSaved:            () => void;
  onClose:            () => void;
}) {
  const [step,        setStep]        = useState<1 | 2>(1);
  const [groupName,   setGroupName]   = useState('');
  const [displayType, setDisplayType] = useState<DisplayType>('dropdown');
  const [options,     setOptions]     = useState<{ value: string; colorHex?: string }[]>([]);
  const [saving,      setSaving]      = useState(false);

  const available = SUGGESTED_NAMES.filter((n) => !existingGroupNames.includes(n));

  const pickName = (n: string) => {
    setGroupName(n);
    if (n === 'Color') setDisplayType('color_swatch');
  };

  const addOption = (opt: { value: string; colorHex?: string }) => {
    setOptions((prev) => [...prev, opt]);
  };

  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await clientFetch(`/admin/products/${productId}/variations/groups`, {
        method: 'POST',
        body:   JSON.stringify({
          name:        groupName.trim(),
          displayType,
          options:     options.map((o, idx) => ({
            name:        o.value,
            value:       o.value.toLowerCase().replace(/\s+/g, '-'),
            colorHex:    o.colorHex,
            sortOrder:   idx,
            isAvailable: true,
          })),
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h4 className="font-semibold text-secondary">
            {step === 1 ? 'Add a variation' : `Add options for "${groupName}"`}
          </h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* ── Step 1: Name + Display Type ── */}
          {step === 1 && (
            <>
              <p className="text-sm text-muted">What kind of variation does this listing have?</p>

              {/* Suggested names */}
              <div className="flex flex-wrap gap-2">
                {available.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickName(name)}
                    className={[
                      'px-3 py-1.5 text-sm rounded-full border-2 transition-colors',
                      groupName === name
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-border text-muted hover:border-primary/40 hover:text-secondary',
                    ].join(' ')}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {/* Custom name */}
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Or type a custom variation name…"
                className={inputCls}
              />

              {/* Display type — only if not Color */}
              {groupName && groupName !== 'Color' && (
                <div>
                  <p className="text-xs text-muted mb-2">How should options be displayed?</p>
                  <div className="flex gap-2">
                    {DISPLAY_TYPES.map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDisplayType(type)}
                        className={[
                          'flex-1 py-2.5 text-xs border-2 rounded-lg flex flex-col items-center gap-1.5 transition-all',
                          displayType === type
                            ? 'border-primary bg-primary/5 text-primary font-semibold'
                            : 'border-border text-muted hover:border-primary/40',
                        ].join(' ')}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Add options ── */}
          {step === 2 && (
            <>
              <p className="text-sm text-muted">
                Add the {groupName.toLowerCase()} options buyers can choose from.
              </p>

              {/* Current options */}
              {options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {options.map((opt, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 border border-border rounded-full text-sm text-secondary"
                    >
                      {opt.colorHex && (
                        <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: opt.colorHex }} />
                      )}
                      {opt.value}
                      <button type="button" onClick={() => removeOption(i)} className="text-muted hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input */}
              {displayType === 'color_swatch' ? (
                <ColorOptionInput onAdd={(o) => addOption({ value: o.value, colorHex: o.colorHex })} />
              ) : (
                <TagInput
                  values={options.map((o) => o.value)}
                  onAdd={(v) => addOption({ value: v })}
                  placeholder={groupName === 'Size' ? 'e.g. Small, Medium, Large' : 'e.g. Option 1'}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          {step === 2 ? (
            <button type="button" onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm font-medium text-muted hover:text-secondary transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button type="button" onClick={onClose}
              className="text-sm font-medium text-muted hover:text-secondary transition-colors">
              Cancel
            </button>
          )}

          <div className="flex gap-2">
            {step === 2 && (
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
                Cancel
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!groupName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button disabled:opacity-40 transition-colors"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={options.length === 0 || saving}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditVariationGroupSheet ──────────────────────────────────────────────────

function EditVariationGroupSheet({
  groupId, productId, onSaved, onClose,
}: {
  groupId:   string;
  productId: string;
  onSaved:   () => void;
  onClose:   () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Load the single group
  const { data: group } = useQuery<VariationGroup>({
    queryKey: ['variation-group-single', groupId],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${productId}/variations/${groupId}`);
      if (!res.ok) return null as unknown as VariationGroup;
      const body = await res.json();
      return (body.data ?? body) as VariationGroup;
    },
    staleTime: 10_000,
  });

  const addOption = async (opt: { value: string; colorHex?: string }) => {
    setSaving(true);
    try {
      await clientFetch(`/admin/products/${productId}/variations/${groupId}/options`, {
        method: 'POST',
        body:   JSON.stringify({
          name:        opt.value,
          value:       opt.value.toLowerCase().replace(/\s+/g, '-'),
          colorHex:    opt.colorHex,
          isAvailable: true,
        }),
      });
      qc.invalidateQueries({ queryKey: ['variation-group-single', groupId] });
      qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
    } finally {
      setSaving(false);
    }
  };

  const removeOption = async (optionId: string) => {
    await clientFetch(`/admin/products/${productId}/variations/${groupId}/options/${optionId}`, {
      method: 'DELETE',
    });
    qc.invalidateQueries({ queryKey: ['variation-group-single', groupId] });
    qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h4 className="font-semibold text-secondary">Edit "{group?.name}"</h4>
            <p className="text-xs text-muted mt-0.5">
              {group?.options.length ?? 0} option{(group?.options.length ?? 0) !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Existing options */}
          <div className="space-y-2">
            {(group?.options ?? []).map((opt) => (
              <div key={opt.id} className="flex items-center gap-2.5 px-3 py-2.5 border border-border rounded-lg">
                {group?.displayType === 'color_swatch' && (
                  <div
                    className="w-5 h-5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: opt.colorHex ?? '#E5E7EB' }}
                  />
                )}
                <span className="text-sm flex-1 text-secondary">{opt.name || opt.value}</span>
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Add more options</p>
            {group?.displayType === 'color_swatch' ? (
              <ColorOptionInput onAdd={(o) => addOption({ value: o.value, colorHex: o.colorHex })} />
            ) : (
              <TagInput
                values={(group?.options ?? []).map((o) => o.value)}
                onAdd={(v) => addOption({ value: v })}
                placeholder="Type a value, press Enter…"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => { onSaved(); onClose(); }}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ManageVariationsModal ────────────────────────────────────────────────────

interface ManageVariationsModalProps {
  productId: string;
  isOpen:    boolean;
  onClose:   () => void;
  onSaved:   () => void;
}

export function ManageVariationsModal({
  productId, isOpen, onClose, onSaved,
}: ManageVariationsModalProps) {
  const qc = useQueryClient();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingGroup,    setAddingGroup]    = useState(false);
  const [savedMsg,       setSavedMsg]       = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const { data: groups = [], isLoading: groupsLoading } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', productId],
    queryFn:  async () => {
      const res = await clientFetch(`/admin/products/${productId}/variations`);
      return fetchArr<VariationGroup>(res);
    },
    enabled:   isOpen,
    staleTime: 30_000,
  });

  const { data: settings } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', productId],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${productId}/variation-settings`);
      if (!res.ok) return { enableVariations: true, variesBy: [] };
      const body = await res.json();
      return (body.data ?? body) as VariationSettings;
    },
    enabled:   isOpen,
    staleTime: 30_000,
  });

  const deleteGroup = async (groupId: string) => {
    // Remove by re-saving without that group
    const remaining = groups.filter((g) => g.id !== groupId);
    await clientFetch(`/admin/products/${productId}/variations`, {
      method: 'PUT',
      body:   JSON.stringify({ groups: remaining }),
    });
    qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
  };

  const saveSettings = async (variesBy: string[]) => {
    setSettingsSaving(true);
    try {
      await clientFetch(`/admin/products/${productId}/variation-settings`, {
        method: 'PATCH',
        body:   JSON.stringify({ variesBy, enableVariations: true }),
      });
      qc.invalidateQueries({ queryKey: ['variation-settings', productId] });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleApply = () => {
    onSaved();
    onClose();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editingGroupId && !addingGroup) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose, editingGroupId, addingGroup]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        {/* Modal */}
        <div
          className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[540px] max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="font-bold text-secondary">Manage variations</h3>
            <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {groupsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-20 bg-muted/10 rounded-xl" />)}
              </div>
            ) : (
              <>
                {/* Group cards */}
                <div className="space-y-3">
                  {groups.map((group) => (
                    <VariationGroupCard
                      key={group.id}
                      group={group}
                      onEdit={() => setEditingGroupId(group.id)}
                      onDelete={() => {
                        if (confirm(`Delete "${group.name}" group and all its options?`)) {
                          deleteGroup(group.id);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Add variation button (max 2 groups) */}
                {groups.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setAddingGroup(true)}
                    className="w-full py-3 text-sm font-semibold text-primary border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/60 hover:bg-primary/3 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add a variation
                  </button>
                )}

                {/* Divider */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Variation settings</p>

                  <VariationSettingsToggles
                    groups={groups}
                    settings={settings}
                    onChange={saveSettings}
                  />
                </div>

                {/* Price matrix */}
                {settings && getPricesGroupId(settings.variesBy) && (
                  <VariantPriceMatrix
                    productId={productId}
                    groups={groups}
                    settings={settings}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleApply}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors">
              {savedMsg ? <><Check className="w-4 h-4" /> Applied</> : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-sheet: Add variation group */}
      {addingGroup && (
        <AddVariationGroupSheet
          productId={productId}
          existingGroupNames={groups.map((g) => g.name)}
          onSaved={() => {
            setAddingGroup(false);
            qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
          }}
          onClose={() => setAddingGroup(false)}
        />
      )}

      {/* Sub-sheet: Edit variation group */}
      {editingGroupId && (
        <EditVariationGroupSheet
          groupId={editingGroupId}
          productId={productId}
          onSaved={() => {
            setEditingGroupId(null);
            qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
          }}
          onClose={() => setEditingGroupId(null)}
        />
      )}
    </>
  );
}
