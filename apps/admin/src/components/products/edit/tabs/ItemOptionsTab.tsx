'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { useFormContext, useController } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, ChevronDown, ChevronUp, HelpCircle,
  GripVertical, Trash2, Pencil, Check, Settings,
} from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import { fetchArr, safeArr } from '../../../../lib/fmt';
import type { ProductEditFormValues, AdminProductDto, ProductImage } from '../types';
import { VariantImagePicker } from '../VariantImagePicker';
import { ManageVariationsModal } from '../ManageVariationsModal';
import { CustomOptionsEditor } from '../CustomOptionsEditor';
import { AttributeSearchSelect } from '../AttributeSearchSelect';
import { ShowMoreAttributes } from '../ShowMoreAttributes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariationOption {
  id:           string;
  groupId:      string;
  name:         string;
  value:        string;
  colorHex?:    string;
  imageUrl?:    string;
  /** Which product photo (ProductImage.id) represents this variant */
  imageId?:     string | null;
  priceDelta?:  number | null;
  sortOrder:    number;
  isAvailable:  boolean;
}

export interface VariationSettings {
  enableVariations:    boolean;
  /** Encoded flags: 'price:<groupId>' | 'processing' | 'quantity' | 'sku' */
  variesBy:            string[];
  skuPrefix?:          string;
}

export interface VariationGroup {
  id:          string;
  productId:   string;
  name:        string;
  displayType: string; // 'dropdown' | 'color_swatch' | 'button' | 'image'
  sortOrder:   number;
  options:     VariationOption[];
}

interface CustomOptionField {
  id:        string;
  type:      'text' | 'textarea' | 'dropdown' | 'checkbox';
  label:     string;
  required:  boolean;
  maxLength?: number;
  options?:  string[];
}

// ─── Static attribute dictionaries ───────────────────────────────────────────

const ATTR_DATA: Record<string, string[]> = {
  materials: [
    'Acrylic','Bamboo','Canvas','Cardboard','Ceramic','Cotton','Denim',
    'Fabric','Faux Leather','Felt','Glass','Gold','Leather','Linen','Metal',
    'Nylon','Paper','Plastic','Polyester','Porcelain','Resin','Rubber',
    'Silver','Silk','Stone','Suede','Synthetic','Velvet','Wood','Wool',
  ],
  colors: [
    'Beige','Black','Blue','Bronze','Brown','Clear','Copper','Gold','Green',
    'Grey','Ivory','Magenta','Multi','Orange','Pink','Purple','Red',
    'Rose Gold','Silver','Teal','Turquoise','White','Yellow',
  ],
  sustainability: [
    'Estimated to last 2+ years','Made from natural materials',
    'Made from recycled materials','Made locally or handmade',
    'Organic materials','Responsibly sourced materials',
    'Vegan and cruelty-free',
  ],
  styles: [
    'Abstract','Art Deco','Bohemian','Boho','Classic','Contemporary',
    'Cottage Core','Farmhouse','Funky','Geek','Glamorous','Gothic',
    'Hippie','Hipster','Industrial','Kawaii','Minimalist','Modern',
    'Nautical','Preppy','Retro','Rustic','Scandinavian',
    'Traditional','Tribal','Vintage',
  ],
  occasions: [
    'Anniversary','Baby Shower','Back to School','Birthday','Celebration',
    'Christmas','Easter','Engagement','Fathers Day','Friendship',
    'Get Well','Graduation','Halloween','Hanukkah','House Warming',
    'Just Because','Mothers Day','Moving','New Baby','New Year',
    'Retirement','Thank You','Valentines','Wedding',
  ],
  holidays: [
    'Christmas','Easter','Halloween','Hanukkah','Mothers Day',
    'Fathers Day','New Year','St. Patricks Day','Thanksgiving',
    'Valentines Day',
  ],
  recipients: [
    'Aunt','Best Friend','Boss','Brother','Child','Colleague','Couple',
    'Dad','Daughter','Friend','Grandparent','Husband','Kids','Men','Mom',
    'Nephew','Niece','Partner','Pet Lover','Sister','Son','Teacher',
    'Teen','Wife','Women',
  ],
};

// ─── Shared layout primitives ─────────────────────────────────────────────────

function TabSection({
  title, description, action, children,
}: {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  children:     React.ReactNode;
}) {
  return (
    <div className="px-6 py-7 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-semibold text-secondary">{title}</h3>
          {description && <p className="text-sm text-muted mt-0.5 max-w-xl">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1 align-middle">
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-muted hover:text-secondary transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 px-3 py-2 bg-secondary text-white text-xs rounded-lg shadow-lg z-20 whitespace-normal leading-snug">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-secondary" />
        </span>
      )}
    </span>
  );
}

// ─── AttributeTagInput ────────────────────────────────────────────────────────

function AttributeTagInput({
  label, name, maxTags, placeholder, description,
}: {
  label:       string;
  name:        keyof ProductEditFormValues;
  maxTags:     number;
  placeholder?: string;
  description?: string;
}) {
  const { control, setValue, watch } = useFormContext<ProductEditFormValues>();
  const values = (watch(name) ?? []) as string[];
  const [input, setInput] = useState('');

  const add = () => {
    const t = input.trim().replace(/,+$/, '');
    if (!t || values.includes(t) || values.length >= maxTags) return;
    setValue(name, [...values, t] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
    setInput('');
  };

  const remove = (v: string) => {
    setValue(name, (values.filter((x) => x !== v)) as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-sm font-semibold text-secondary">{label}</label>
        <span className="text-xs text-muted">Add up to {maxTags} tags</span>
      </div>
      {description && <p className="text-xs text-muted mb-2">{description}</p>}

      {/* Input row */}
      {values.length < maxTags && (
        <div className="flex gap-2 mb-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            }}
            placeholder={placeholder ?? 'Add a tag…'}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-button transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-background border border-border rounded-full text-sm text-secondary">
            {v}
            <button type="button" onClick={() => remove(v)} className="p-0.5 rounded-full hover:bg-muted/10 text-muted hover:text-secondary transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {values.length > 0 && (
          <span className="text-xs text-muted self-center ml-1">{values.length}/{maxTags}</span>
        )}
      </div>
    </div>
  );
}

// ─── AttributeSearchSelect (legacy — replaced by ../AttributeSearchSelect.tsx) ─

function _AttributeSearchSelect_REMOVED({
  label, name, maxSelections, tooltip, description, dataKey,
}: {
  label:         string;
  name:          keyof ProductEditFormValues;
  maxSelections: number;
  tooltip?:      string;
  description?:  string;
  dataKey:       string;
}) {
  const { setValue, watch } = useFormContext<ProductEditFormValues>();
  const values  = (watch(name) ?? []) as string[];
  const [query, setQuery]   = useState('');
  const [open,  setOpen]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options  = ATTR_DATA[dataKey] ?? [];
  const filtered = query.length > 0
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()) && !values.includes(o))
    : options.filter((o) => !values.includes(o));

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const add = (val: string) => {
    if (values.includes(val) || values.length >= maxSelections) return;
    setValue(name, [...values, val] as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
    setQuery('');
    if (values.length + 1 >= maxSelections) setOpen(false);
  };

  const remove = (val: string) => {
    setValue(name, (values.filter((v) => v !== val)) as unknown as ProductEditFormValues[typeof name], { shouldDirty: true });
  };

  const reached = values.length >= maxSelections;

  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <label className="text-sm font-semibold text-secondary">{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
        {maxSelections > 1 && <span className="text-xs text-muted">Select up to {maxSelections}</span>}
      </div>
      {description && <p className="text-xs text-muted mb-2">{description}</p>}

      {/* Selected chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-primary/8 border border-primary/20 rounded-full text-sm text-primary font-medium">
              {v}
              <button type="button" onClick={() => remove(v)} className="p-0.5 rounded-full hover:bg-primary/10 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown input */}
      <div ref={ref} className="relative">
        <div
          className={[
            'flex items-center gap-2 px-3 py-2 text-sm border rounded-button bg-background transition-colors cursor-text',
            reached ? 'opacity-50 pointer-events-none' : 'border-border focus-within:ring-2 focus-within:ring-primary/20',
          ].join(' ')}
          onClick={() => !reached && setOpen(true)}
        >
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            disabled={reached}
            placeholder={reached ? `Maximum ${maxSelections} selected` : 'Type to search…'}
            className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-muted text-sm"
          />
          <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>

        {open && !reached && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-border rounded-card shadow-lg max-h-52 overflow-y-auto">
            {filtered.slice(0, 20).map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); add(opt); }}
                className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-muted/5 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {open && !reached && filtered.length === 0 && query.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-border rounded-card shadow-lg px-3 py-3">
            <p className="text-sm text-muted">No results for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ShowMoreAttributes (now imported from ../ShowMoreAttributes.tsx) ──────────
// Keeping a no-op stub so nothing breaks if there are stray references.
function _ShowMoreAttributes_REMOVED({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ─── Custom options editor (legacy — replaced by ../CustomOptionsEditor.tsx) ──
// These functions are kept to avoid cascading type errors from removed usages.

const MAX_CUSTOM_OPTS = 5; // kept for any remaining references

const OPTION_TYPES: { value: CustomOptionField['type']; label: string; icon: string }[] = [
  { value: 'text',     label: 'Short text',     icon: 'T'  },
  { value: 'textarea', label: 'Long text',       icon: '¶'  },
  { value: 'dropdown', label: 'Dropdown',        icon: '▾'  },
  { value: 'checkbox', label: 'Yes / No',        icon: '☑'  },
];

function CustomOptionRow({
  opt,
  onChange,
  onDelete,
}: {
  opt:      CustomOptionField;
  onChange: (updated: CustomOptionField) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(!opt.label);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background">
        <GripVertical className="w-4 h-4 text-muted/40 shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary truncate">{opt.label || 'Untitled option'}</p>
          <p className="text-xs text-muted">{OPTION_TYPES.find((t) => t.value === opt.type)?.label ?? opt.type}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${opt.required ? 'bg-amber-100 text-amber-700' : 'bg-muted/10 text-muted'}`}>
            {opt.required ? 'Required' : 'Optional'}
          </span>
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 py-4 border-t border-border space-y-3 bg-surface">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {OPTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onChange({ ...opt, type: t.value })}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-button border-2 transition-colors',
                    opt.type === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40',
                  ].join(' ')}
                >
                  <span className="font-mono">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Label / Question *
            </label>
            <input
              value={opt.label}
              onChange={(e) => onChange({ ...opt, label: e.target.value })}
              placeholder='e.g. "What name should we personalise this with?"'
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
            />
          </div>

          {/* Max length for text/textarea */}
          {(opt.type === 'text' || opt.type === 'textarea') && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Max length</label>
              <input
                type="number"
                min={1}
                max={opt.type === 'text' ? 140 : 1000}
                value={opt.maxLength ?? ''}
                onChange={(e) => onChange({ ...opt, maxLength: e.target.value ? Number(e.target.value) : undefined })}
                className="w-24 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="140"
              />
            </div>
          )}

          {/* Dropdown options */}
          {opt.type === 'dropdown' && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Dropdown options</label>
              <div className="space-y-1.5">
                {(opt.options ?? []).map((o, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={o}
                      onChange={(e) => {
                        const updated = [...(opt.options ?? [])];
                        updated[idx] = e.target.value;
                        onChange({ ...opt, options: updated });
                      }}
                      className="flex-1 px-2.5 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none"
                    />
                    <button type="button"
                      onClick={() => onChange({ ...opt, options: (opt.options ?? []).filter((_, i) => i !== idx) })}
                      className="text-muted hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChange({ ...opt, options: [...(opt.options ?? []), ''] })}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
              </div>
            </div>
          )}

          {/* Required toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button type="button"
              onClick={() => onChange({ ...opt, required: !opt.required })}
              className={`relative w-9 h-5 rounded-full transition-colors ${opt.required ? 'bg-primary' : 'bg-border'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${opt.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-secondary">Required field</span>
          </label>
        </div>
      )}
    </div>
  );
}

function _CustomOptionsEditor_REMOVED({ productId }: { productId: string }) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();
  const rawOpts  = (watch('customOptions') ?? []) as CustomOptionField[];
  const opts     = rawOpts.filter(Boolean);

  const setOpts  = (updated: CustomOptionField[]) => {
    setValue('customOptions', updated as unknown[], { shouldDirty: true });
  };

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const addOpt = (type: CustomOptionField['type'] = 'text') => {
    if (opts.length >= MAX_CUSTOM_OPTS) return;
    setOpts([...opts, { id: Date.now().toString(), type, label: '', required: false }]);
    setAddMenuOpen(false);
  };

  const updateOpt = (idx: number, updated: CustomOptionField) => {
    const copy = [...opts];
    copy[idx] = updated;
    setOpts(copy);
  };

  const deleteOpt = (idx: number) => setOpts(opts.filter((_, i) => i !== idx));

  const ADD_FIELD_OPTIONS: { type: CustomOptionField['type']; label: string; icon: string }[] = [
    { type: 'text',     label: 'Short text',       icon: 'T'  },
    { type: 'textarea', label: 'Long text',         icon: '¶'  },
    { type: 'dropdown', label: 'List of options',   icon: '▾'  },
    { type: 'checkbox', label: 'Yes / No',          icon: '☑'  },
  ];

  return (
    <div className="space-y-3">
      {opts.map((opt, idx) => (
        <CustomOptionRow
          key={opt.id}
          opt={opt}
          onChange={(u) => updateOpt(idx, u)}
          onDelete={() => deleteOpt(idx)}
        />
      ))}

      <div className="flex items-center justify-between">
        {opts.length < MAX_CUSTOM_OPTS ? (
          <div ref={addMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-primary border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/3 rounded-button px-4 py-2.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add field
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {addMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 w-52 bg-surface border border-border rounded-card shadow-lg overflow-hidden">
                {ADD_FIELD_OPTIONS.map((o) => (
                  <button
                    key={o.type}
                    type="button"
                    onClick={() => addOpt(o.type)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:bg-muted/5 transition-colors text-left"
                  >
                    <span className="w-5 text-center font-mono text-muted">{o.icon}</span>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted italic">Maximum {MAX_CUSTOM_OPTS} custom options reached.</p>
        )}
        {opts.length > 0 && (
          <span className="text-xs text-muted">Using {opts.length} of {MAX_CUSTOM_OPTS} fields</span>
        )}
      </div>
    </div>
  );
}

// ─── Variations summary table ─────────────────────────────────────────────────

function VariationOptionRow({
  option,
  group,
  priceVaries,
  productImages,
  productId,
  onToggle,
  onPriceChange,
}: {
  option:        VariationOption;
  group:         VariationGroup;
  priceVaries:   boolean;
  productImages: ProductImage[];
  productId:     string;
  onToggle:      (available: boolean) => void;
  onPriceChange: (price: number) => void;
}) {
  // Show photo column for color swatches, image cards, or any group with images
  const showPhoto =
    group.displayType === 'color_swatch' ||
    group.displayType === 'image'         ||
    productImages.length > 0;             // always show if product has photos

  return (
    <tr className={`border-b border-border last:border-0 group transition-opacity ${!option.isAvailable ? 'opacity-40' : ''}`}>
      {/* Photo thumbnail — opens VariantImagePicker modal */}
      {showPhoto && (
        <td className="py-2.5 pr-3 w-12">
          <VariantImagePicker
            option={option}
            productId={productId}
            productImages={productImages}
          />
        </td>
      )}

      {/* Value + optional color swatch */}
      <td className="py-2.5 text-sm text-secondary font-medium">
        <div className="flex items-center gap-2">
          {option.name || option.value}
          {option.colorHex && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-border shrink-0"
              style={{ backgroundColor: option.colorHex }}
            />
          )}
        </div>
      </td>

      {/* Price delta (only when group has price variation) */}
      {priceVaries && (
        <td className="py-2.5 pr-3 w-28">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">+$</span>
            <input
              type="number"
              step="0.01"
              value={option.priceDelta ?? 0}
              onChange={(e) => onPriceChange(Number(e.target.value))}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
            />
          </div>
        </td>
      )}

      {/* Visible toggle */}
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={() => onToggle(!option.isAvailable)}
          className={`relative w-10 h-5 rounded-full transition-colors ${option.isAvailable ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${option.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </td>
    </tr>
  );
}

function VariationsSummaryTable({
  product,
  onManage,
}: {
  product:  AdminProductDto;
  onManage: () => void;
}) {
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', product.id],
    queryFn:  async () => {
      const res = await clientFetch(`/admin/products/${product.id}/variations`);
      return fetchArr<VariationGroup>(res);
    },
    staleTime: 30_000,
  });

  const { data: settings } = useQuery<VariationSettings>({
    queryKey: ['variation-settings', product.id],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${product.id}/variation-settings`);
      if (!res.ok) return { enableVariations: false, variesBy: [] };
      const body = await res.json();
      return (body.data ?? body) as VariationSettings;
    },
    staleTime: 30_000,
  });

  const updateOption = async (groupId: string, optionId: string, patch: Partial<VariationOption>) => {
    await clientFetch(`/admin/products/${product.id}/variations/${groupId}/options/${optionId}`, {
      method: 'PATCH',
      body:   JSON.stringify(patch),
    });
    qc.invalidateQueries({ queryKey: ['variation-groups', product.id] });
  };

  if (isLoading) {
    return <div className="h-24 bg-muted/5 rounded-lg animate-pulse" />;
  }

  if (!groups.length || !settings?.enableVariations) {
    return (
      <div className="flex items-center gap-4 py-4">
        <div className="w-12 h-12 rounded-lg bg-muted/10 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-muted" />
        </div>
        <div>
          <p className="text-sm text-secondary font-medium">No variations set up</p>
          <p className="text-sm text-muted mt-0.5">Add options like colour, size, or material.</p>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-2 rounded-button transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add variations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const priceVaries = settings.variesBy?.includes(group.id + ':price') ?? false;
        return (
          <div key={group.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-secondary">{group.name}</span>
              <span className="text-xs text-muted">{group.options.length} option{group.options.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="relative overflow-visible">
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide w-12">Photo</th>
                    <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide">{group.name}</th>
                    {priceVaries && <th className="text-left pb-2 text-xs font-semibold text-muted uppercase tracking-wide w-28">Price</th>}
                    <th className="text-right pb-2 text-xs font-semibold text-muted uppercase tracking-wide">Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {group.options.map((opt) => (
                    <VariationOptionRow
                      key={opt.id}
                      option={opt}
                      group={group}
                      priceVaries={priceVaries}
                      productImages={product.images ?? []}
                      productId={product.id}
                      onToggle={(available) => updateOption(group.id, opt.id, { isAvailable: available })}
                      onPriceChange={(price) => updateOption(group.id, opt.id, { priceDelta: price })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function _VariationsModal_REMOVED({
  product,
  onClose,
}: {
  product: AdminProductDto;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: groups = [] } = useQuery<VariationGroup[]>({
    queryKey: ['variation-groups', product.id],
    queryFn:  async () => {
      const res = await clientFetch(`/admin/products/${product.id}/variations`);
      return fetchArr<VariationGroup>(res);
    },
    staleTime: 30_000,
  });

  const [localGroups, setLocalGroups] = useState<VariationGroup[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync from server on open
  useEffect(() => { setLocalGroups(groups); }, [groups]);

  const addGroup = () => {
    setLocalGroups((prev) => [
      ...prev,
      {
        id:          'new-' + Date.now(),
        productId:   product.id,
        name:        '',
        displayType: 'dropdown',
        sortOrder:   prev.length,
        options:     [],
      },
    ]);
  };

  const updateGroup = (idx: number, patch: Partial<VariationGroup>) => {
    setLocalGroups((prev) => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));
  };

  const addOption = (groupIdx: number) => {
    setLocalGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: [...g.options, { id: 'new-' + Date.now(), groupId: g.id, name: '', value: '', sortOrder: g.options.length, isAvailable: true }] }
          : g,
      ),
    );
  };

  const updateOption = (groupIdx: number, optIdx: number, patch: Partial<VariationOption>) => {
    setLocalGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: g.options.map((o, j) => j === optIdx ? { ...o, ...patch } : o) }
          : g,
      ),
    );
  };

  const removeOption = (groupIdx: number, optIdx: number) => {
    setLocalGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, options: g.options.filter((_, j) => j !== optIdx) } : g,
      ),
    );
  };

  const removeGroup = (idx: number) => {
    setLocalGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await clientFetch(`/admin/products/${product.id}/variations`, {
        method: 'PUT',
        body:   JSON.stringify({ groups: localGroups }),
      });
      qc.invalidateQueries({ queryKey: ['variation-groups', product.id] });
      qc.invalidateQueries({ queryKey: ['variation-settings', product.id] });
      onClose();
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[620px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-secondary">Manage variations</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {localGroups.map((group, gi) => (
            <div key={group.id} className="border border-border rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-background border-b border-border">
                <input
                  value={group.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder="Variation name (e.g. Color, Size)"
                  className="flex-1 px-2.5 py-1.5 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                />
                <select
                  value={group.displayType}
                  onChange={(e) => updateGroup(gi, { displayType: e.target.value })}
                  className="px-2 py-1.5 text-xs border border-border rounded-button bg-surface focus:outline-none"
                >
                  <option value="dropdown">Dropdown</option>
                  <option value="color_swatch">Color swatches</option>
                  <option value="button">Buttons</option>
                </select>
                <button type="button" onClick={() => removeGroup(gi)}
                  className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options list */}
              <div className="px-4 py-3 space-y-2">
                {group.options.map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    {group.displayType === 'color_swatch' && (
                      <input
                        type="color"
                        value={opt.colorHex ?? '#000000'}
                        onChange={(e) => updateOption(gi, oi, { colorHex: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                        title="Pick colour"
                      />
                    )}
                    <input
                      value={opt.name}
                      onChange={(e) => updateOption(gi, oi, { name: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="Option name (e.g. Red, Large)"
                      className="flex-1 px-2.5 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none"
                    />
                    <button type="button" onClick={() => removeOption(gi, oi)}
                      className="p-1.5 text-muted hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(gi)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/3 rounded-lg py-3 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add variation type
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save variations'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// (VariationsModal is now ManageVariationsModal in ../ManageVariationsModal.tsx)

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface ItemOptionsTabProps { product: AdminProductDto }

export function ItemOptionsTab({ product }: ItemOptionsTabProps) {
  const [variationsModalOpen, setVariationsModalOpen] = useState(false);

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden divide-y divide-border">

        {/* ── Variations ───────────────────────────────────────────────── */}
        <TabSection
          title="Variations"
          description="Add options like colour, size, or material that may affect your available inventory quantities."
          action={
            <button
              type="button"
              onClick={() => setVariationsModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold border border-border rounded-button px-3 py-2 text-secondary hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage variations
            </button>
          }
        >
          <VariationsSummaryTable product={product} onManage={() => setVariationsModalOpen(true)} />
        </TabSection>

        {/* ── Custom options ────────────────────────────────────────────── */}
        <TabSection
          title="Custom options"
          description="Create up to 5 input fields to collect details from buyers like text, images, or names. These won't affect your available inventory."
        >
          <CustomOptionsEditor productId={product.id} />
        </TabSection>

        {/* ── Attributes ───────────────────────────────────────────────── */}
        <TabSection
          title="Attributes"
          description="These details help buyers find your item in search as they get specific about what they're looking for."
        >
          <div className="space-y-6">
            {/* Tags */}
            <AttributeTagInput
              label="Tags"
              name="tags"
              maxTags={13}
              description="Add up to 13 tags to help people search for your listings."
              placeholder="Shape, colour, style, function, etc."
            />

            {/* Materials */}
            <AttributeSearchSelect
              label="Materials"
              name="materials"
              maxSelections={5}
              searchEndpoint="/admin/attributes/material"
              description="Select up to 5"
            />

            {/* Primary colour */}
            <AttributeSearchSelect
              label="Primary color"
              name="primaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

            {/* Secondary colour */}
            <AttributeSearchSelect
              label="Secondary color"
              name="secondaryColors"
              maxSelections={1}
              searchEndpoint="/admin/attributes/color"
            />

            {/* Sustainability */}
            <AttributeSearchSelect
              label="Sustainability"
              name="sustainability"
              maxSelections={3}
              searchEndpoint="/admin/attributes/sustainability"
              tooltip="Let buyers know if your item is made using eco-conscious materials or methods."
              description="Select up to 3"
            />

            {/* Expandable section */}
            <ShowMoreAttributes>
              <AttributeSearchSelect
                label="Style"
                name="styles"
                maxSelections={2}
                searchEndpoint="/admin/attributes/style"
              />
              <AttributeSearchSelect
                label="Occasion"
                name="occasions"
                maxSelections={5}
                searchEndpoint="/admin/attributes/occasion"
              />
              <AttributeSearchSelect
                label="Holiday"
                name="holidayTags"
                maxSelections={3}
                searchEndpoint="/admin/attributes/holiday"
              />
              <AttributeSearchSelect
                label="Recipient"
                name="recipientTags"
                maxSelections={4}
                searchEndpoint="/admin/attributes/recipient"
                description="Select up to 4"
              />
            </ShowMoreAttributes>
          </div>
        </TabSection>
      </div>

      {/* Variations modal — ManageVariationsModal */}
      <ManageVariationsModal
        productId={product.id}
        isOpen={variationsModalOpen}
        onClose={() => setVariationsModalOpen(false)}
        onSaved={() => {
          // VariationsSummaryTable will refetch via queryKey invalidation inside the modal
        }}
      />
    </div>
  );
}
