'use client';

import { useState, useEffect, useRef } from 'react';
import { useDialog } from '../../../contexts/DialogContext';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Trash2, Pencil, ChevronLeft,
  ArrowRight, AlignLeft, Palette, LayoutGrid, Layers, ImageIcon,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Toggle } from './primitives/Toggle';
import { FilterSelect } from '../../ui/FilterSelect';
import { VariantComboGrid } from './VariantComboGrid';
import { VariantImagePickerModal } from './VariantImagePicker';
import type {
  VariationGroup, VariationSettings, ProductVariantRow,
  VariantEditPatch, ApplyVariationsPayload, ProductImage, VariationOption,
} from './types';
import { pricedGroupIds } from './helpers';

// ─── Settings helpers ─────────────────────────────────────────────────────────
// Settings are encoded in `variesBy: string[]` to avoid a new migration.
// Encoding: 'price:<groupId>' | 'processing' | 'quantity' | 'sku'
// Bare legacy 'price' (no groupId, from before per-group pricing existed) means
// "all groups" — matches Etsy's own "Prices vary for each: Shape and Option"
// vs "Shape" vs "Option" distinction.
// pricedGroupIds() lives in helpers.ts — shared with ItemOptionsTab and
// PricingShippingTab so all readers stay in sync with this writer's encoding.

function setPricedGroups(variesBy: string[], groupIds: string[]): string[] {
  const without = variesBy.filter((v) => v !== 'price' && !v.startsWith('price:'));
  return [...without, ...groupIds.map((id) => `price:${id}`)];
}

function hasSetting(variesBy: string[], key: string): boolean {
  return variesBy.includes(key);
}

function setSetting(variesBy: string[], key: string, on: boolean): string[] {
  const without = variesBy.filter((v) => v !== key && !v.startsWith(`${key}:`));
  return on ? [...without, key] : without;
}

function newLocalId(): string {
  return `new-${(globalThis.crypto ?? window.crypto).randomUUID()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayType = 'dropdown' | 'color_swatch' | 'button' | 'image';

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

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

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyVariationsState() {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="flex items-center gap-1 mb-4 text-secondary/70">
        <svg width="44" height="56" viewBox="0 0 44 56" fill="none" className="rotate-[-8deg]">
          <rect x="1" y="1" width="30" height="54" rx="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="18" r="5" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="34" x2="24" y2="34" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="41" x2="20" y2="41" stroke="currentColor" strokeWidth="2" />
        </svg>
        <svg width="44" height="56" viewBox="0 0 44 56" fill="none" className="rotate-[8deg] -ml-3">
          <rect x="1" y="1" width="30" height="54" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M16 10 L24 22 L8 22 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <line x1="8" y1="34" x2="24" y2="34" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="41" x2="20" y2="41" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <h4 className="font-semibold text-secondary">You don&apos;t have any variations</h4>
      <p className="text-sm text-muted mt-1 max-w-[320px]">
        Use variations if your item is offered in different colours, sizes, materials, etc.
      </p>
    </div>
  );
}

// ─── VariationSettingsToggles ─────────────────────────────────────────────────

function VariationSettingsToggles({
  settings, groups, onChange,
}: {
  settings: VariationSettings | undefined;
  groups:   VariationGroup[];
  onChange: (variesBy: string[]) => void;
}) {
  const variesBy  = settings?.variesBy ?? [];
  const allIds    = groups.map((g) => g.id);
  const pricedIds = pricedGroupIds(variesBy, allIds);
  const pricingOn = pricedIds.length > 0;

  // Etsy-style: when there are two variation groups, a seller picks exactly
  // which one(s) actually change the price — "Shape and Option" (both),
  // "Shape" only, or "Option" only — instead of an all-or-nothing toggle.
  const showGroupPicker = pricingOn && groups.length === 2;
  const bothValue = 'both';
  const pickerValue = pricedIds.length === groups.length ? bothValue : (pricedIds[0] ?? bothValue);
  const pickerOptions = groups.length === 2
    ? [
        { value: bothValue,     label: `${groups[0].name} and ${groups[1].name}` },
        { value: groups[0].id,  label: groups[0].name },
        { value: groups[1].id,  label: groups[1].name },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Prices vary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Toggle
          checked={pricingOn}
          onChange={(on) => onChange(setPricedGroups(variesBy, on ? allIds : []))}
        />
        <span className="text-sm font-medium text-secondary">Prices vary for each</span>
        {showGroupPicker && (
          <FilterSelect
            value={pickerValue}
            onChange={(v) => onChange(setPricedGroups(variesBy, v === bothValue ? allIds : [v]))}
            options={pickerOptions}
            size="md"
          />
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

// ─── AddVariationGroupSheet ───────────────────────────────────────────────────
// Etsy's real suggested variation types (not the earlier "Color/Size/Style/
// Material/Finish/Length" placeholder guess) — see "What type of variation
// is it?" step.

const SUGGESTED_NAMES = ['Primary colour', 'Width', 'Height', 'Depth', 'Secondary colour'];

const DISPLAY_TYPES: { type: DisplayType; label: string; icon: React.ElementType }[] = [
  { type: 'dropdown',     label: 'Dropdown',        icon: AlignLeft   },
  { type: 'color_swatch', label: 'Color swatches',  icon: Palette     },
  { type: 'button',       label: 'Text buttons',    icon: LayoutGrid  },
];

function AddVariationGroupSheet({
  existingGroupNames,
  nextSortOrder,
  onAdd,
  onClose,
}: {
  existingGroupNames: string[];
  nextSortOrder:      number;
  onAdd:               (group: VariationGroup) => void;
  onClose:             () => void;
}) {
  const [step,             setStep]             = useState<1 | 2>(1);
  const [groupName,        setGroupName]        = useState('');
  const [showCustomInput,  setShowCustomInput]  = useState(false);
  const [displayType,      setDisplayType]      = useState<DisplayType>('dropdown');
  const [options,          setOptions]          = useState<{ value: string; colorHex?: string }[]>([]);

  const available = SUGGESTED_NAMES.filter((n) => !existingGroupNames.includes(n));

  const pickName = (n: string) => {
    setGroupName(n);
    setDisplayType(n.toLowerCase().includes('colour') || n.toLowerCase().includes('color') ? 'color_swatch' : 'dropdown');
  };

  const addOption = (opt: { value: string; colorHex?: string }) => {
    setOptions((prev) => [...prev, opt]);
  };

  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleCreate = () => {
    onAdd({
      id:          newLocalId(),
      productId:   '',
      name:        groupName.trim(),
      displayType,
      sortOrder:   nextSortOrder,
      options: options.map((o, i) => ({
        id:          newLocalId(),
        groupId:     '',
        name:        o.value,
        value:       o.value.toLowerCase().replace(/\s+/g, '-'),
        colorHex:    o.colorHex,
        sortOrder:   i,
        isAvailable: true,
      })),
    });
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
            {step === 1 ? 'What type of variation is it?' : `Add options for "${groupName}"`}
          </h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* ── Step 1: Name + Display Type ── */}
          {step === 1 && (
            <>
              <p className="text-sm text-muted leading-relaxed">
                You can add up to 2 variations. Use the variation types listed here for peak
                discoverability. You can add a custom variation, but buyers won&apos;t see the
                option in filters.
              </p>

              {/* Suggested names */}
              <div className="flex flex-wrap gap-2">
                {available.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { pickName(name); setShowCustomInput(false); }}
                    className={[
                      'px-3 py-1.5 text-sm rounded-full border-2 transition-colors',
                      groupName === name && !showCustomInput
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-border text-muted hover:border-primary/40 hover:text-secondary',
                    ].join(' ')}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {/* Create your own */}
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => { setShowCustomInput(true); setGroupName(''); }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <Plus className="w-4 h-4" /> Create your own
                </button>
              ) : (
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Name your own variation…"
                  autoFocus
                  className={inputCls}
                />
              )}

              {/* Display type — only if not a colour variation */}
              {groupName && !groupName.toLowerCase().includes('colour') && !groupName.toLowerCase().includes('color') && (
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
                disabled={options.length === 0}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditVariationGroupSheet ──────────────────────────────────────────────────
// Operates on the draft group passed down from the modal's local state —
// no server fetch, no per-action API call. Every add/remove just reports the
// updated group back up via onChange().

// One row of the options list. Splitting it out keeps the photo cell — which
// owns a modal of its own — from re-rendering every sibling row.
function OptionRow({
  option, showPhoto, productImages, onPick, onRemove,
}: {
  option:        VariationOption;
  showPhoto:     boolean;
  productImages: ProductImage[];
  onPick:        (imageId: string | null) => void;
  onRemove:      () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const assigned = productImages.find((img) => img.id === option.imageId);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border border-border rounded-lg">
      {/* Reordering is not wired up yet — see the sheet's note. Rendering a
          grab handle that does nothing would be worse than rendering none. */}
      {option.colorHex && !showPhoto && (
        <div
          className="w-5 h-5 rounded-full border border-border shrink-0"
          style={{ backgroundColor: option.colorHex }}
        />
      )}

      {showPhoto && (
        <div className="w-9 h-9 rounded-md overflow-hidden border border-border bg-background relative shrink-0">
          {assigned ? (
            <Image src={assigned.url} alt={option.name || option.value} fill className="object-cover" sizes="36px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted/40" />
            </div>
          )}
        </div>
      )}

      <span className="text-sm flex-1 text-secondary truncate">{option.name || option.value}</span>

      {showPhoto && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-secondary border border-border rounded-button hover:border-primary/40 hover:text-primary transition-colors shrink-0"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Select photo
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {pickerOpen && (
        <VariantImagePickerModal
          option={option}
          productImages={productImages}
          onSelect={async (imageId) => { onPick(imageId); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function EditVariationGroupSheet({
  group, productImages, photoLinked, onTogglePhotos, onChange, onDelete, onClose,
}: {
  group:          VariationGroup;
  productImages:  ProductImage[];
  photoLinked:    boolean;
  /** Reports intent only — the parent owns the confirm dialogs and the pointer. */
  onTogglePhotos: (on: boolean) => void;
  onChange:       (group: VariationGroup) => void;
  onDelete:       () => void;
  onClose:        () => void;
}) {
  const setOptionImage = (optionId: string, imageId: string | null) => {
    const img = productImages.find((i) => i.id === imageId);
    onChange({
      ...group,
      options: group.options.map((o) =>
        o.id === optionId
          // imageUrl is denormalised alongside imageId so the storefront can
          // render the thumbnail without joining back to the photo list.
          // undefined rather than null to match VariationOption; Apply creates
          // the row fresh, so an absent value lands as NULL either way.
          ? { ...o, imageId, imageUrl: img?.url ?? undefined }
          : o,
      ),
    });
  };

  const addOption = (opt: { value: string; colorHex?: string }) => {
    onChange({
      ...group,
      options: [
        ...group.options,
        {
          id:          newLocalId(),
          groupId:     group.id,
          name:        opt.value,
          value:       opt.value.toLowerCase().replace(/\s+/g, '-'),
          colorHex:    opt.colorHex,
          sortOrder:   group.options.length,
          isAvailable: true,
        },
      ],
    });
  };

  const removeOption = (optionId: string) => {
    onChange({ ...group, options: group.options.filter((o) => o.id !== optionId) });
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
            <h4 className="font-semibold text-secondary">Edit &quot;{group.name}&quot;</h4>
            <p className="text-xs text-muted mt-0.5">
              {group.options.length} option{group.options.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Photo linking */}
          <div className="flex items-center gap-3">
            <Toggle checked={photoLinked} onChange={onTogglePhotos} />
            <span className="text-sm font-medium text-secondary">Link photos to this variation</span>
          </div>

          <div className="border-t border-border" />

          {/* Existing options */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-secondary">Options</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-white text-[11px] font-semibold">
                {group.options.length}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-3">
              Shoppers pick from these. Options taken from the suggested list show up in
              filters; custom ones won&apos;t.
            </p>

            <div className="space-y-2">
              {group.options.map((opt) => (
                <OptionRow
                  key={opt.id}
                  option={opt}
                  showPhoto={photoLinked}
                  productImages={productImages}
                  onPick={(imageId) => setOptionImage(opt.id, imageId)}
                  onRemove={() => removeOption(opt.id)}
                />
              ))}
            </div>
          </div>

          {/* Add more */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Add more options</p>
            {group.displayType === 'color_swatch' ? (
              <ColorOptionInput onAdd={(o) => addOption({ value: o.value, colorHex: o.colorHex })} />
            ) : (
              <TagInput
                values={group.options.map((o) => o.value)}
                onAdd={(v) => addOption({ value: v })}
                placeholder="Type a value, press Enter…"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          <button type="button" onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 rounded-button hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete variation
          </button>
          <button type="button" onClick={onClose}
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
  /** The listing's photos, for linking one to each option. */
  productImages: ProductImage[];
  isOpen:    boolean;
  onClose:   () => void;
  onSaved:   () => void;
}

export function ManageVariationsModal({
  productId, productImages, isOpen, onClose, onSaved,
}: ManageVariationsModalProps) {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingGroup,    setAddingGroup]    = useState(false);
  const [applying,       setApplying]       = useState(false);
  const [applyError,     setApplyError]     = useState<string | null>(null);

  // ── Server state — fetched once per open, used only to seed the draft ──────
  // Gated on `isSuccess`, and specifically not on `isLoading`: in TanStack
  // Query v5 `isLoading = isPending && isFetching`, and on the first render
  // after `isOpen` flips true (queries going enabled:false → enabled:true) the
  // fetch has not been kicked off as a state update yet — `isPending` is true
  // but `isFetching` is still false, so `isLoading` reads `false` while `data`
  // is still undefined. Seeding there would lock the draft to empty arrays via
  // `seededRef` before the real data ever arrived.
  //
  // `isSuccess` rather than `isFetched` for a second reason: a fetch that
  // finished by failing counts as fetched, and an empty draft is not a
  // harmless placeholder here — Apply replaces the whole tree, so committing
  // one deletes every group and setting the seller had.
  const { data: serverGroups = [], isSuccess: groupsLoaded } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', productId],
    queryFn:  () => api.get<VariationGroup[]>(API_ROUTES.ADMIN.PRODUCT_VARIATIONS(productId)),
    enabled:   isOpen,
    staleTime: 30_000,
  });

  // No try/catch swallowing the failure here any more. The endpoint already
  // answers 200 with defaults when a product has no settings row, so the only
  // thing a catch could hide is a real failure — and pretending "no settings"
  // after one is destructive: Apply replaces the stored values wholesale, so a
  // blank draft would wipe the seller's price-varies flags and photo link.
  const { data: serverSettings, isSuccess: settingsLoaded } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', productId],
    queryFn:  () => api.get<VariationSettings>(API_ROUTES.ADMIN.PRODUCT_VARIATION_SETTINGS(productId)),
    enabled:   isOpen,
    staleTime: 30_000,
  });

  const { data: serverVariants = [], isSuccess: variantsLoaded } = useQuery<ProductVariantRow[]>({
    queryKey: ['product-variant-list', productId],
    queryFn:  () => api.get<ProductVariantRow[]>(API_ROUTES.ADMIN.PRODUCT_VARIATION_VARIANTS(productId)),
    enabled:   isOpen,
    staleTime: 30_000,
  });

  // ── Local draft state — every edit in this modal lands here, never on the
  // server, until "Apply" sends one consolidated commit. ─────────────────────
  const [draftGroups,   setDraftGroups]   = useState<VariationGroup[]>([]);
  const [draftVariesBy, setDraftVariesBy] = useState<string[]>([]);
  const [variantEdits,  setVariantEdits]  = useState<Record<string, VariantEditPatch>>({});
  // At most one group at a time, which is why this is one id rather than a flag
  // per group: two groups linked at once would mean two different photos
  // competing to be shown for a single selection.
  const [draftPhotoGroupId, setDraftPhotoGroupId] = useState<string | null>(null);
  const seededRef = useRef(false);

  // `isSuccess`, not `isFetched`: a fetch that finished by failing is still
  // "fetched", and seeding from that would hand Apply an empty draft — which,
  // because Apply replaces the whole tree, deletes every group the seller has.
  useEffect(() => {
    if (!isOpen) { seededRef.current = false; return; }
    if (seededRef.current) return;
    if (!groupsLoaded || !settingsLoaded || !variantsLoaded) return;
    setDraftGroups(serverGroups);
    setDraftVariesBy(serverSettings?.variesBy ?? []);
    setDraftPhotoGroupId(serverSettings?.photoGroupId ?? null);
    setVariantEdits({});
    setApplyError(null);
    seededRef.current = true;
  }, [isOpen, groupsLoaded, settingsLoaded, variantsLoaded, serverGroups, serverSettings]);

  const deleteGroup = async (groupId: string) => {
    setDraftGroups((gs) => gs.filter((g) => g.id !== groupId));
    // The pointer must not outlive the group it names.
    setDraftPhotoGroupId((cur) => (cur === groupId ? null : cur));
  };

  // Both directions of this toggle destroy something the seller can see, so
  // both ask first. Neither actually erases an assignment: switching off, or
  // moving the link to another group, only moves the pointer — every
  // option.imageId stays put, so turning it back on brings the photos back.
  const togglePhotoLinking = async (group: VariationGroup, on: boolean) => {
    if (!on) {
      const ok = await confirm(
        `This will unlink your photos for ${group.name} options.`,
        { title: 'Turn off photo linking?', confirmLabel: 'Continue' },
      );
      if (ok) setDraftPhotoGroupId(null);
      return;
    }

    const current = draftGroups.find((g) => g.id === draftPhotoGroupId);
    if (current && current.id !== group.id) {
      const ok = await confirm(
        `Photos are linked to ${current.name} right now. They'll be unlinked, and you'll need to pick photos for ${group.name}.`,
        { title: `Link photos to ${group.name}?`, confirmLabel: 'Continue' },
      );
      if (!ok) return;
    }
    setDraftPhotoGroupId(group.id);
  };

  const editingGroup = draftGroups.find((g) => g.id === editingGroupId) ?? null;

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const payload: ApplyVariationsPayload = {
        groups: draftGroups.map((g) => ({
          id:          g.id,
          name:        g.name,
          displayType: g.displayType,
          sortOrder:   g.sortOrder,
          options: g.options.map((o) => ({
            id:          o.id,
            name:        o.name,
            value:       o.value,
            colorHex:    o.colorHex,
            // Never edited in this modal — set separately via
            // VariantImagePicker's own immediate PATCH — but must be
            // round-tripped or Apply's replace-the-whole-tree wipes it.
            imageUrl:    o.imageUrl,
            imageId:     o.imageId,
            isAvailable: o.isAvailable,
            sortOrder:   o.sortOrder,
          })),
        })),
        variesBy:     draftVariesBy,
        variantEdits: Object.values(variantEdits),
        // Always sent, null included — the server reads a missing field as
        // "leave it alone", so omitting it could never switch linking off.
        photoGroupId: draftPhotoGroupId,
      };
      await api.post(API_ROUTES.ADMIN.PRODUCT_VARIATIONS_APPLY(productId), payload);

      qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
      qc.invalidateQueries({ queryKey: ['variation-settings', productId] });
      qc.invalidateQueries({ queryKey: ['product-variant-list', productId] });

      onSaved();
      onClose();
    } catch (err) {
      setApplyError((err as Error).message || 'Could not apply variation changes.');
    } finally {
      setApplying(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editingGroupId && !addingGroup) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose, editingGroupId, addingGroup]);

  if (!isOpen) return null;

  // Tied directly to the same condition the seeding effect gates on, rather
  // than re-deriving it from the raw query flags — this is "has the draft
  // actually been populated yet", which is what the UI below cares about.
  const isLoading = !seededRef.current;

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
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-20 bg-muted/10 rounded-xl" />)}
              </div>
            ) : draftGroups.length === 0 ? (
              <>
                <EmptyVariationsState />
                <button
                  type="button"
                  onClick={() => setAddingGroup(true)}
                  className="w-full py-3 text-sm font-semibold text-primary border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/60 hover:bg-primary/3 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add a variation
                </button>
              </>
            ) : (
              <>
                {/* Group cards */}
                <div className="space-y-3">
                  {draftGroups.map((group) => (
                    <VariationGroupCard
                      key={group.id}
                      group={group}
                      onEdit={() => setEditingGroupId(group.id)}
                      onDelete={async () => {
                        if (await confirm(`Delete "${group.name}" group and all its options?`, { confirmLabel: 'Delete', destructive: true })) {
                          deleteGroup(group.id);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Add variation button (max 2 groups) */}
                {draftGroups.length < 2 && (
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
                    settings={{ enableVariations: true, variesBy: draftVariesBy }}
                    groups={draftGroups}
                    onChange={setDraftVariesBy}
                  />
                </div>

                {/* Combo price/quantity/SKU/visibility grid — mirrors Etsy's
                    per-combination table exactly (not a per-option delta). */}
                <VariantComboGrid
                  groups={draftGroups}
                  variesBy={draftVariesBy}
                  variants={serverVariants}
                  edits={variantEdits}
                  onEditsChange={setVariantEdits}
                />
              </>
            )}

            {applyError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2 flex items-start gap-2">
                <Layers className="w-4 h-4 shrink-0 mt-0.5" />
                {applyError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleApply} disabled={applying || isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50">
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-sheet: Add variation group */}
      {addingGroup && (
        <AddVariationGroupSheet
          existingGroupNames={draftGroups.map((g) => g.name)}
          nextSortOrder={draftGroups.length}
          onAdd={(group) => {
            setDraftGroups((gs) => [...gs, group]);
            setAddingGroup(false);
          }}
          onClose={() => setAddingGroup(false)}
        />
      )}

      {/* Sub-sheet: Edit variation group */}
      {editingGroup && (
        <EditVariationGroupSheet
          group={editingGroup}
          productImages={productImages}
          photoLinked={draftPhotoGroupId === editingGroup.id}
          onTogglePhotos={(on) => togglePhotoLinking(editingGroup, on)}
          onChange={(updated) => setDraftGroups((gs) => gs.map((g) => (g.id === updated.id ? updated : g)))}
          onDelete={async () => {
            if (await confirm(`Delete "${editingGroup.name}" and all its options?`, { confirmLabel: 'Delete', destructive: true })) {
              deleteGroup(editingGroup.id);
              setEditingGroupId(null);
            }
          }}
          onClose={() => setEditingGroupId(null)}
        />
      )}
    </>
  );
}
