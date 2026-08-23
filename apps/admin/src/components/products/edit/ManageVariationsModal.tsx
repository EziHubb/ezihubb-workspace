'use client';

import { useState, useEffect, useRef } from 'react';
import { useDialog } from '../../../contexts/DialogContext';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, Trash2, Pencil,
  Layers, ImageIcon, GripVertical, ChevronDown, Check,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Toggle } from './primitives/Toggle';
import { FilterSelect } from '../../ui/FilterSelect';
import { VariantImagePickerModal } from './VariantImagePicker';
import type {
  VariationGroup, VariationSettings, ProductVariantRow,
  VariantEditPatch, ApplyVariationsPayload, ProductImage,
} from './types';
import { pricedGroupIds } from './helpers';
import { ModalPortal } from './ModalPortal';

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

// ─── OptionCombobox ───────────────────────────────────────────────────────────
// Type a value, or pick one from the suggestions for this variation type.
//
// The suggestions are the point: an option taken from this list is one buyers
// can filter by, and a typed-in one is not. Offering both from a single control
// keeps that from being a decision the seller has to understand up front.
const COLOUR_NAMES = ['Black', 'White', 'Grey', 'Beige', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Gold', 'Silver'];

const OPTION_SUGGESTIONS: Record<string, string[]> = {
  'Primary colour':   COLOUR_NAMES,
  'Secondary colour': COLOUR_NAMES,
};

// ─── Dimension variations ─────────────────────────────────────────────────────
// Width / Height / Depth are measurements, so "3" alone says nothing. The
// seller picks a unit once and every option carries it.
//
// The unit is baked into the option name ("1 Centimetres") rather than stored
// in its own column, which is what the reference displays and what avoids a
// migration for a field only these three variation types would ever use. The
// cost is that reopening the editor has to read the unit back off the options
// — see unitOf() — so a group whose options were named by hand may not resolve
// to a unit. That degrades to "no unit chosen", never to a wrong one.
const MEASUREMENT_UNITS = ['Centimetres', 'Feet', 'Inches', 'Metres', 'Millimetres', 'Yards'];
const DIMENSION_TYPES   = ['Width', 'Height', 'Depth'];

function isDimensionType(name: string): boolean {
  return DIMENSION_TYPES.includes(name);
}

/** The unit every option shares, or '' when they disagree or have none. */
function unitOf(optionNames: string[]): string {
  if (optionNames.length === 0) return '';
  const units = optionNames.map(
    (n) => MEASUREMENT_UNITS.find((u) => n.endsWith(` ${u}`)) ?? '',
  );
  return units.every((u) => u && u === units[0]) ? units[0] : '';
}

/**
 * Swatch colour for a colour option, derived from its name.
 *
 * The seller is never asked to pick a hex: colour variations use the same
 * "Enter an option…" box as every other type, so a recognised name is the only
 * signal available — and the one they already gave. An unrecognised name simply
 * gets no swatch rather than a wrong one.
 */
const COLOUR_HEX: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', grey: '#9CA3AF', beige: '#E8DCC8',
  brown: '#8B5E3C', red: '#DC2626', orange: '#EA580C', yellow: '#EAB308',
  green: '#16A34A', blue: '#2563EB', purple: '#7C3AED', pink: '#EC4899',
  gold: '#D4AF37', silver: '#C0C0C0',
};

function OptionCombobox({
  taken, suggestions, unit, onAdd,
}: {
  taken:       string[];
  suggestions: string[];
  /** Appended to whatever is typed, and shown inside the box as a hint. */
  unit?:       string;
  onAdd:       (v: string) => void;
}) {
  const [input, setInput] = useState('');
  const [open,  setOpen]  = useState(false);

  // Case-insensitive: "black" and "Black" are the same option to a shopper, and
  // letting both in produces two variant combinations that mean one thing.
  const takenLower = taken.map((t) => t.toLowerCase());

  const commit = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    // The unit is part of the stored name, so uniqueness has to be judged on
    // the finished label — otherwise "1" and "1 Centimetres" look different.
    const full = unit ? `${t} ${unit}` : t;
    if (takenLower.includes(full.toLowerCase())) return;
    onAdd(full);
    setInput('');
    setOpen(false);
  };

  const remaining = suggestions.filter(
    (s) => !takenLower.includes(s.toLowerCase()) && s.toLowerCase().includes(input.trim().toLowerCase()),
  );

  return (
    <div className="flex items-start gap-3">
      <div className="relative flex-1">
        {/* The unit is a sibling of the input inside one box that looks like a
            field, rather than text positioned over it — the font is not
            monospace, so any attempt to compute where the typed text ends
            would drift. */}
        <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-button bg-background focus-within:ring-2 focus-within:ring-primary/20">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            // A click on a suggestion fires after blur, so closing is deferred.
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(input); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Enter an option…"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {unit && <span className="text-sm text-muted shrink-0">{unit}</span>}
        </div>

        {suggestions.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-secondary transition-colors"
            aria-label="Show suggested options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {open && remaining.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
            {remaining.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); commit(s); }}
                  className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-muted/10 transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => commit(input)}
        disabled={!input.trim()}
        className="px-3 py-2 text-sm font-semibold text-secondary hover:text-primary disabled:text-muted/50 disabled:cursor-not-allowed transition-colors"
      >
        Add
      </button>
    </div>
  );
}

// ─── VariationGroupCard ───────────────────────────────────────────────────────

function VariationGroupCard({
  group, productImages, onEdit, onDelete,
}: {
  group:         VariationGroup;
  /** For resolving an option's linked photo from its imageId. */
  productImages: ProductImage[];
  onEdit:        () => void;
  onDelete:      () => void;
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

      {/* Option pills — with the linked photo when there is one.
          This used to render a thumbnail only for colour variations, so a
          seller who linked photos to "Width" saw plain pills here and had no
          way to tell from the outside that the work had landed.
          The photo is resolved from imageId, not imageUrl: the summary-table
          picker writes only imageId, so imageUrl is empty for anything
          assigned there and the swatch won by default. */}
      <div className="flex flex-wrap gap-2">
        {group.options.map((opt) => {
          const photo = opt.imageId
            ? productImages.find((img) => img.id === opt.imageId)?.url ?? opt.imageUrl
            : opt.imageUrl;
          const label = opt.name || opt.value;

          if (photo) {
            return (
              <span key={opt.id} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 border border-border rounded-full bg-surface">
                <span className="w-5 h-5 rounded-full overflow-hidden border border-border relative shrink-0">
                  <Image src={photo} alt={label} fill className="object-cover" sizes="20px" />
                </span>
                <span className="text-xs text-secondary">{label}</span>
              </span>
            );
          }

          if (opt.colorHex) {
            return (
              <span key={opt.id} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 border border-border rounded-full bg-surface">
                <span
                  className="w-5 h-5 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: opt.colorHex }}
                />
                <span className="text-xs text-secondary">{label}</span>
              </span>
            );
          }

          return (
            <span
              key={opt.id}
              className="px-2.5 py-1 text-xs border border-border rounded-full text-secondary bg-surface"
            >
              {label}
            </span>
          );
        })}
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
        {/* The subject is bold, "vary" is not — it reads as a list of things
            that can vary rather than four unrelated sentences. */}
        <span className="text-sm text-secondary"><span className="font-semibold">Prices</span> vary</span>
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
        { key: 'processing', subject: 'Processing profiles' },
        { key: 'quantity',   subject: 'Quantities'          },
        { key: 'sku',        subject: 'SKUs'                },
      ].map(({ key, subject }) => (
        <div key={key} className="flex items-center gap-3">
          <Toggle
            checked={hasSetting(variesBy, key)}
            onChange={(on) => onChange(setSetting(variesBy, key, on))}
          />
          <span className="text-sm text-secondary"><span className="font-semibold">{subject}</span> vary</span>
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

// The display type is no longer asked for: it follows from the variation type,
// which is a rendering detail the seller has no basis to decide before they
// have even named their options.

/**
 * Picking a variation type, then describing it.
 *
 * Picking a type is not a decision worth its own confirm step: choosing a chip
 * goes straight to the editor, and "Custom variation" goes to the same editor
 * with a name field on top. The previous "select, then press Next, then a
 * differently-shaped Add options screen" made two screens out of what is one
 * decision — and the second of them had no photo linking at all.
 */
function AddVariationGroupSheet({
  existingGroupNames,
  nextSortOrder,
  productImages,
  linkPhotos,
  onToggleLinkPhotos,
  onAdd,
  onClose,
}: {
  existingGroupNames: string[];
  nextSortOrder:      number;
  productImages:      ProductImage[];
  /** Owned by the parent, which also owns the "only one variation" warning. */
  linkPhotos:         boolean;
  onToggleLinkPhotos: (on: boolean) => void;
  onAdd:               (group: VariationGroup) => void;
  onClose:             () => void;
}) {
  // null = still on the type picker. '' = custom, name not typed yet.
  const [groupName, setGroupName] = useState<string | null>(null);
  const [isCustom,  setIsCustom]  = useState(false);
  // Each pending option carries its own id rather than being addressed by array
  // position: OptionRow holds state of its own (an open photo picker, a drag
  // highlight), so keying rows by index makes React hand that state to whatever
  // option shifts into the slot when one above it is removed.
  const [options,   setOptions]   = useState<{ id: string; value: string; colorHex?: string; imageId?: string | null }[]>([]);
  const [unit,      setUnitState] = useState('');

  // Changing the unit rewrites the options that already carry the old one, so
  // a seller who picks Inches after typing three Centimetres values gets the
  // measurements they entered rather than a list they have to retype.
  const setUnit = (next: string) => {
    setUnitState(next);
    setOptions((prev) => prev.map((o) => {
      const bare = MEASUREMENT_UNITS.reduce(
        (acc, u) => (acc.endsWith(` ${u}`) ? acc.slice(0, -(u.length + 1)) : acc),
        o.value,
      );
      return { ...o, value: next ? `${bare} ${next}` : bare };
    }));
  };

  // Types already in use stay on the list, ticked and disabled, rather than
  // disappearing: a list that silently loses entries makes the seller wonder
  // whether the option ever existed. Showing it as done answers that.

  // Colour variations get swatches; everything else is a plain dropdown. The
  // seller used to be asked this outright, which is a rendering detail they
  // have no way to have an opinion about yet.
  const displayType: DisplayType =
    !isCustom && (groupName ?? '').toLowerCase().includes('colour') ? 'color_swatch' : 'dropdown';

  const addOption = (opt: { value: string; colorHex?: string }) => {
    setOptions((prev) =>
      prev.some((o) => o.value.toLowerCase() === opt.value.toLowerCase())
        ? prev
        : [...prev, { id: newLocalId(), ...opt }],
    );
  };
  const removeOption   = (id: string) => setOptions((prev) => prev.filter((o) => o.id !== id));
  const setOptionImage = (id: string, imageId: string | null) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, imageId } : o)));
  const reorder = (fromId: string, toId: string) =>
    setOptions((prev) => {
      const from = prev.findIndex((o) => o.id === fromId);
      const to   = prev.findIndex((o) => o.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const trimmedName = (groupName ?? '').trim();
  const canSave     = trimmedName.length > 0 && options.length > 0;

  const handleCreate = () => {
    if (!canSave) return;
    onAdd({
      id:          newLocalId(),
      productId:   '',
      name:        trimmedName,
      displayType,
      sortOrder:   nextSortOrder,
      options: options.map((o, i) => ({
        id:          newLocalId(),
        groupId:     '',
        name:        o.value,
        value:       o.value.toLowerCase().replace(/\s+/g, '-'),
        colorHex:    o.colorHex,
        // Only carried when linking is on, so turning it off before saving
        // cannot smuggle an assignment into an unlinked variation.
        imageId:     linkPhotos ? o.imageId ?? null : null,
        imageUrl:    linkPhotos ? productImages.find((img) => img.id === o.imageId)?.url : undefined,
        sortOrder:   i,
        isAvailable: true,
      })),
    });
  };

  // ── Step 1: which type ──────────────────────────────────────────────────────
  if (groupName === null) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[640px]" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-2">
            <h4 className="text-lg font-bold text-secondary">What type of variation is it?</h4>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              You can add up to 2 variations. Pick one of these types so buyers can filter by
              it — a custom variation works too, but it won&apos;t appear in filters.
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="flex flex-wrap gap-2.5">
              {SUGGESTED_NAMES.map((name) => {
                const used = existingGroupNames.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={used}
                    onClick={() => { setIsCustom(false); setGroupName(name); }}
                    className={[
                      'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-full transition-colors',
                      used
                        ? 'text-muted/60 bg-muted/5 cursor-not-allowed'
                        : 'text-secondary bg-muted/10 hover:bg-muted/20',
                    ].join(' ')}
                  >
                    {used && <Check className="w-3.5 h-3.5" />}
                    {name}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => { setIsCustom(true); setGroupName(''); }}
              className="flex items-center gap-2 mt-5 text-sm font-semibold text-secondary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" /> Create your own
            </button>
          </div>

          <div className="px-6 py-4 border-t border-border">
            <button type="button" onClick={onClose}
              className="text-sm font-semibold text-secondary hover:text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: the same editor the Edit sheet uses ─────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      {/* No overflow on the card and none on the body: the option combobox
          drops a suggestion list below itself, and any scrolling ancestor
          clips it. Only the options list scrolls, and it caps its own height —
          see VariationOptionsEditor. */}
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[640px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-1 shrink-0">
          {isCustom ? (
            <h4 className="text-lg font-bold text-secondary">Custom variation</h4>
          ) : (
            <>
              <h4 className="text-lg font-bold text-secondary">{trimmedName}</h4>
              <p className="text-xs text-muted mt-0.5">Variation</p>
            </>
          )}
        </div>

        <div className="px-6 pb-2">
          {isCustom && (
            <div className="pt-4">
              <label className="block text-sm font-semibold text-secondary mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                className={inputCls}
              />
            </div>
          )}

          <div className="pt-4">
            <VariationOptionsEditor
              displayType={displayType}
              options={options.map((o) => ({
                key:      o.id,
                label:    o.value,
                colorHex: o.colorHex,
                imageId:  o.imageId ?? null,
              }))}
              linkPhotos={linkPhotos}
              productImages={productImages}
              variationName={trimmedName || 'this variation'}
              suggestOptions={!isCustom}
              needsUnit={!isCustom && isDimensionType(trimmedName)}
              unit={unit}
              onUnitChange={setUnit}
              onToggleLinkPhotos={onToggleLinkPhotos}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onPickImage={setOptionImage}
              onReorder={reorder}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0">
          <button type="button" onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-muted rounded-full hover:bg-muted/10 transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {!canSave && (
              <span className="text-sm text-muted">
                {trimmedName.length === 0 ? 'Name this variation' : 'Add at least 1 option'}
              </span>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSave}
              className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-full disabled:bg-muted/40 disabled:cursor-not-allowed transition-colors"
            >
              Done
            </button>
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
  label, colorHex, imageId, showPhoto, productImages, variationName,
  index, onDropAt, onPick, onRemove,
}: {
  label:         string;
  colorHex?:     string;
  imageId:       string | null;
  showPhoto:     boolean;
  productImages: ProductImage[];
  variationName: string;
  index:         number;
  onDropAt:      (fromIndex: number) => void;
  onPick:        (imageId: string | null) => void;
  onRemove:      () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const assigned = productImages.find((img) => img.id === imageId);

  return (
    <div
      // Native HTML5 drag rather than a library: the list is short, the rows
      // are plain, and dnd-kit would be a second reordering system in this app
      // for no gain here.
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from) && from !== index) onDropAt(from);
      }}
      className={[
        'flex items-center gap-2.5 px-3 py-2.5 border rounded-lg bg-surface transition-colors',
        dragOver ? 'border-primary' : 'border-border',
      ].join(' ')}
    >
      <GripVertical className="w-4 h-4 text-muted/60 shrink-0 cursor-grab active:cursor-grabbing" />

      {colorHex && !showPhoto && (
        <div
          className="w-5 h-5 rounded-full border border-border shrink-0"
          style={{ backgroundColor: colorHex }}
        />
      )}

      {showPhoto && (
        <div className="w-9 h-9 rounded-md overflow-hidden border border-border bg-background relative shrink-0">
          {assigned ? (
            <Image src={assigned.url} alt={label} fill className="object-cover" sizes="36px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted/40" />
            </div>
          )}
        </div>
      )}

      <span className="text-sm flex-1 text-secondary truncate">{label}</span>

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
          // A stand-in: the picker only reads name/value/imageId, and an option
          // being added has no id yet. Passing a made-up id would be worse.
          option={{ id: '', groupId: '', name: label, value: label, imageId, sortOrder: 0, isAvailable: true }}
          productImages={productImages}
          variationName={variationName}
          onSelect={async (picked) => { onPick(picked); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * The one options editor, shared by adding a variation and editing one.
 *
 * They used to be two different screens: the Add flow ended in a pill list with
 * no photo linking at all, so a seller had to save, reopen a differently-shaped
 * Edit modal, and only then could link photos. Same job, two looks, one of them
 * missing half the controls. Callers still own their own header and footer —
 * Add needs Back/Save, Edit needs Delete/Done — but everything between them is
 * this.
 */
function VariationOptionsEditor({
  displayType, options, linkPhotos, productImages, variationName, suggestOptions,
  needsUnit, unit, onUnitChange,
  onToggleLinkPhotos, onAddOption, onRemoveOption, onPickImage, onReorder,
}: {
  displayType:        DisplayType;
  /** `key` is a VariationOption.id when editing, an index while adding. */
  options:            { key: string; label: string; colorHex?: string; imageId: string | null }[];
  linkPhotos:         boolean;
  productImages:      ProductImage[];
  /** Shown in the photo picker so the seller knows what they are choosing for. */
  variationName:      string;
  /** Suggested values exist for the named types; a custom variation has none. */
  suggestOptions:     boolean;
  /** Set for Width/Height/Depth, where every option needs a measurement unit. */
  needsUnit:          boolean;
  unit:               string;
  onUnitChange:       (unit: string) => void;
  onToggleLinkPhotos: (on: boolean) => void;
  onAddOption:        (opt: { value: string; colorHex?: string }) => void;
  onRemoveOption:     (key: string) => void;
  onPickImage:        (key: string, imageId: string | null) => void;
  onReorder:          (fromKey: string, toKey: string) => void;
}) {
  // No padding of its own — the Add sheet already sits inside a padded body,
  // and nesting one inside the other doubled the inset.
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Toggle checked={linkPhotos} onChange={onToggleLinkPhotos} />
        <span className="text-sm font-medium text-secondary">Link photos to this variation</span>
      </div>

      <div className="border-t border-border" />

      {/* A measurement variation has nothing to offer until its unit is known:
          "3" is not an option a shopper can read. So the whole Options block
          waits, rather than collecting values that would have to be rewritten
          the moment a unit is picked. */}
      {needsUnit && !unit ? null : (
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-secondary">Options</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-white text-[11px] font-semibold">
            {options.length}
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-3">
          {needsUnit
            ? 'Buyers can choose from the following options.'
            : 'Shoppers pick from these. Options taken from the suggested list show up in filters; custom ones won’t.'}
        </p>

        {/* One input for every variation type, colours included — the reference
            has no separate colour picker, and a swatch colour can be derived
            from a recognised colour name without asking. Input above the list,
            so a long list never pushes it off-screen. */}
        <div className="mb-3">
          <OptionCombobox
            taken={options.map((o) => o.label)}
            suggestions={suggestOptions ? (OPTION_SUGGESTIONS[variationName] ?? []) : []}
            unit={needsUnit ? unit : undefined}
            onAdd={(v) => onAddOption({
              value:    v,
              colorHex: displayType === 'color_swatch' ? COLOUR_HEX[v.trim().toLowerCase()] : undefined,
            })}
          />
        </div>

        {/* The only scrolling region in the modal. Keeping it here rather than
            on the whole body is what lets the combobox's suggestion list hang
            below the input without being clipped — and it keeps the input and
            the footer in place no matter how many options there are.
            min-h reserves room so an empty variation does not open as a
            cramped sliver; the list is where a seller is about to work. */}
        {/* 40vh, not more: the card is deliberately uncapped so the suggestion
            list can hang past its edge, which means the list's ceiling is the
            only thing keeping the footer on screen. Fixed chrome runs ~340px,
            so 40vh keeps Done reachable down to a ~600px viewport. */}
        <div className="space-y-2 min-h-[7rem] max-h-[40vh] overflow-y-auto">
          {options.map((opt, i) => (
            <OptionRow
              key={opt.key}
              label={opt.label}
              colorHex={opt.colorHex}
              imageId={opt.imageId}
              showPhoto={linkPhotos}
              productImages={productImages}
              variationName={variationName}
              index={i}
              // The index arrives from the drag payload, so it is only as
              // trustworthy as the DOM was when the drag started — a row
              // removed mid-drag would index past the end and throw.
              onDropAt={(fromIndex) => {
                const from = options[fromIndex];
                if (from) onReorder(from.key, opt.key);
              }}
              onPick={(imageId) => onPickImage(opt.key, imageId)}
              onRemove={() => onRemoveOption(opt.key)}
            />
          ))}
        </div>
      </div>
      )}

      {/* Unit sits below the options, not above: it is set once and then left
          alone, while the list above it is where the work happens. */}
      {needsUnit && (
        <>
          {options.length > 0 && <div className="border-t border-border" />}
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">Unit</label>
            <select
              value={unit}
              onChange={(e) => onUnitChange(e.target.value)}
              className={inputCls}
            >
              <option value="">Select a unit</option>
              {MEASUREMENT_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </>
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

  // Same rewrite as the Add sheet: switching unit re-labels the measurements
  // already entered instead of stranding them under the old one.
  const changeUnit = (next: string) => {
    onChange({
      ...group,
      options: group.options.map((o) => {
        const current = o.name || o.value;
        const bare = MEASUREMENT_UNITS.reduce(
          (acc, u) => (acc.endsWith(` ${u}`) ? acc.slice(0, -(u.length + 1)) : acc),
          current,
        );
        const name = next ? `${bare} ${next}` : bare;
        return { ...o, name, value: name.toLowerCase().replace(/\s+/g, '-') };
      }),
    });
  };

  // sortOrder is rewritten from the array position, so the order the seller
  // sees is the order that gets saved.
  const reorderOptions = (fromId: string, toId: string) => {
    const from = group.options.findIndex((o) => o.id === fromId);
    const to   = group.options.findIndex((o) => o.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...group.options];
    next.splice(to, 0, ...next.splice(from, 1));
    onChange({ ...group, options: next.map((o, i) => ({ ...o, sortOrder: i })) });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      {/* Same width as the Add sheet — it is the same editor, and two sizes for
          one screen reads as two screens. */}
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[640px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-1">
          <h4 className="text-lg font-bold text-secondary">{group.name}</h4>
          <p className="text-xs text-muted mt-0.5">Variation</p>
        </div>

        <div className="px-6 pt-4 pb-2">
        <VariationOptionsEditor
          displayType={group.displayType as DisplayType}
          options={group.options.map((o) => ({
            key:      o.id,
            label:    o.name || o.value,
            colorHex: o.colorHex,
            imageId:  o.imageId ?? null,
          }))}
          linkPhotos={photoLinked}
          productImages={productImages}
          variationName={group.name}
          suggestOptions={SUGGESTED_NAMES.includes(group.name)}
          needsUnit={isDimensionType(group.name)}
          unit={unitOf(group.options.map((o) => o.name || o.value))}
          onUnitChange={changeUnit}
          onToggleLinkPhotos={onTogglePhotos}
          onAddOption={addOption}
          onRemoveOption={removeOption}
          onPickImage={setOptionImage}
          onReorder={reorderOptions}
        />
        </div>

        {/* Footer — matches the Add sheet: pill buttons, no divider rule. */}
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <button type="button" onClick={onDelete}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-600 rounded-full hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete variation
          </button>
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-full transition-colors">
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

  // Fetched but not read: the per-combination grid that displayed these rows
  // has been taken out of this modal, and only the settled/failed signal is
  // still wanted — a draft must not seed while any of its sources is in
  // flight or errored. Dropping the query would also drop that guarantee.
  const { isSuccess: variantsLoaded } = useQuery<ProductVariantRow[]>({
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
  // The Add sheet can turn linking on before the group it applies to exists,
  // so the intent is held here until onAdd hands over a real id.
  const [pendingLinkPhotos, setPendingLinkPhotos] = useState(false);

  const togglePendingLinkPhotos = async (on: boolean) => {
    if (!on) { setPendingLinkPhotos(false); return; }

    // Same one-variation rule as the Edit sheet, asked before the seller
    // spends time picking photos rather than after.
    const current = draftGroups.find((g) => g.id === draftPhotoGroupId);
    if (current) {
      const ok = await confirm(
        `Photos are linked to ${current.name} right now. They'll be unlinked, and you'll need to pick photos for this variation instead.`,
        { title: 'Move photo linking here?', confirmLabel: 'Continue' },
      );
      if (!ok) return;
    }
    setPendingLinkPhotos(true);
  };

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
    <ModalPortal>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        {/* Modal */}
        <div
          className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[640px] max-h-[85vh] flex flex-col"
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
                      productImages={productImages}
                      onEdit={() => setEditingGroupId(group.id)}
                      onDelete={async () => {
                        if (await confirm(`Delete "${group.name}" group and all its options?`, { confirmLabel: 'Delete', destructive: true })) {
                          deleteGroup(group.id);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Add variation (max 2 groups) — a pill sized to its label,
                    not a full-width dashed placeholder. The dashed box read as
                    an empty drop target sitting under real content. */}
                {draftGroups.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setAddingGroup(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-secondary border border-secondary/40 rounded-full hover:border-secondary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add a variation
                  </button>
                )}

                {/* The toggles need no heading — each one names its own
                    subject, and a "VARIATION SETTINGS" label above them just
                    repeated the modal's title in smaller type. */}
                <div className="border-t border-border pt-5">
                  <VariationSettingsToggles
                    settings={{ enableVariations: true, variesBy: draftVariesBy }}
                    groups={draftGroups}
                    onChange={setDraftVariesBy}
                  />
                </div>

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
          productImages={productImages}
          linkPhotos={pendingLinkPhotos}
          onToggleLinkPhotos={togglePendingLinkPhotos}
          onAdd={(group) => {
            setDraftGroups((gs) => [...gs, group]);
            // The group only gets its id here, so the pointer can only be
            // aimed once it exists. Toggling during the add flow records the
            // intent; this is where it becomes the actual link.
            if (pendingLinkPhotos) setDraftPhotoGroupId(group.id);
            setPendingLinkPhotos(false);
            setAddingGroup(false);
          }}
          onClose={() => { setPendingLinkPhotos(false); setAddingGroup(false); }}
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
    </ModalPortal>
  );
}
