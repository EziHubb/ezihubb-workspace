'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacetItem {
  value: string;
  count: number;
}

export interface SearchFacets {
  freeShipping?: number;
  onSale?: number;
  colors?: FacetItem[];
  materials?: FacetItem[];
  styles?: FacetItem[];
  occasion?: FacetItem[];
  holiday?: FacetItem[];
  recipient?: FacetItem[];
}

interface Props {
  filters: Record<string, string | undefined>;
  facets?: SearchFacets;
  onFilterChange: (key: string, value: string | null) => void;
  onClearAll: () => void;
}

// ── Color swatches ────────────────────────────────────────────────────────────

/**
 * Exported so SearchProductCard's swatch strip resolves colour names against
 * exactly the same table the colour filter uses. A second copy would drift:
 * a shopper could filter by a colour whose swatch renders a different shade
 * on the card, or none at all.
 */
export const STANDARD_COLORS = [
  { name: 'Beige',  hex: '#D4B896' }, { name: 'Black',  hex: '#1A1A1A' },
  { name: 'Blue',   hex: '#3B82F6' }, { name: 'Brown',  hex: '#78350F' },
  { name: 'Gold',   hex: '#EAB308' }, { name: 'Gray',   hex: '#9CA3AF' },
  { name: 'Green',  hex: '#16A34A' }, { name: 'Orange', hex: '#EA580C' },
  { name: 'Pink',   hex: '#F9A8D4' }, { name: 'Purple', hex: '#7C3AED' },
  { name: 'Red',    hex: '#DC2626' }, { name: 'White',  hex: '#FFFFFF' },
];

// ── FilterSection (collapsible) ───────────────────────────────────────────────

function FilterSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border py-3">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between text-sm font-medium text-secondary hover:text-primary transition-colors py-0.5"
      >
        {title}
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="mt-3 space-y-0.5">{children}</div>}
    </div>
  );
}

// ── FilterCheckbox (custom styled) ───────────────────────────────────────────

function FilterCheckbox({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <div className="flex items-center gap-2">
        <div
          className={[
            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
            checked
              ? 'bg-secondary border-secondary'
              : 'border-border group-hover:border-secondary',
          ].join(' ')}
        >
          {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </div>
        <span className="text-secondary text-sm group-hover:text-primary transition-colors leading-snug">
          {label}
        </span>
      </div>
      {count != null && (
        <span className="text-xs text-muted tabular-nums ml-2">{count.toLocaleString()}</span>
      )}
    </label>
  );
}

// ── PriceRangeFilter (text inputs + Go) ───────────────────────────────────────

function PriceRangeFilter({
  min,
  max,
  onChange,
}: {
  min: number | undefined;
  max: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const t = useTranslations('search');
  const [localMin, setLocalMin] = useState(min !== undefined ? String(min) : '');
  const [localMax, setLocalMax] = useState(max !== undefined ? String(max) : '');

  useEffect(() => {
    setLocalMin(min !== undefined ? String(min) : '');
    setLocalMax(max !== undefined ? String(max) : '');
  }, [min, max]);

  const handleSubmit = () => {
    onChange(
      localMin !== '' ? Number(localMin) : undefined,
      localMax !== '' ? Number(localMax) : undefined,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">
          $
        </span>
        <input
          type="number"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('minPlaceholder')}
          min={0}
          className="w-full border border-border rounded-lg pl-6 pr-2 py-1.5 text-sm bg-background outline-none focus:border-primary transition-colors"
        />
      </div>
      <span className="text-muted text-xs flex-shrink-0">{t('to')}</span>
      <div className="flex-1 relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">
          $
        </span>
        <input
          type="number"
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('maxPlaceholder')}
          min={0}
          className="w-full border border-border rounded-lg pl-6 pr-2 py-1.5 text-sm bg-background outline-none focus:border-primary transition-colors"
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs hover:bg-primary transition-colors flex-shrink-0"
      >
        {t('go')}
      </button>
    </div>
  );
}

// ── ColorSwatchFilter ─────────────────────────────────────────────────────────

function ColorSwatchFilter({
  selected,
  onChange,
}: {
  selected: string | undefined;
  onChange: (color: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {STANDARD_COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          title={color.name}
          onClick={() => onChange(selected === color.name ? null : color.name)}
          className={[
            'w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
            selected === color.name
              ? 'border-secondary ring-2 ring-secondary/30 scale-110'
              : color.name === 'White'
              ? 'border-border hover:border-muted'
              : 'border-transparent hover:border-border',
          ].join(' ')}
          style={{ backgroundColor: color.hex }}
        />
      ))}
    </div>
  );
}

// ── MoreFiltersSection ────────────────────────────────────────────────────────

const MORE_FILTER_KEYS = ['Occasion', 'Holiday', 'Recipient', 'Hat type'] as const;

function MoreFiltersSection({
  filters,
  facets,
  onFilterChange,
}: {
  filters: Record<string, string | undefined>;
  facets: SearchFacets | undefined;
  onFilterChange: (key: string, value: string | null) => void;
}) {
  const t = useTranslations('search');
  const [isExpanded, setIsExpanded] = useState(false);
  const facetsRecord = facets as Record<string, FacetItem[] | undefined> | undefined;

  const availableFilters = MORE_FILTER_KEYS.filter(
    (name) => (facetsRecord?.[name.toLowerCase()] ?? []).length > 0,
  );

  if (availableFilters.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded((o) => !o)}
        className="w-full text-left py-3 text-sm font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1"
      >
        {isExpanded ? t('fewerFilters') : t('moreFilters')}
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded &&
        availableFilters.map((filterName) => {
          const key = filterName.toLowerCase();
          const opts = facetsRecord?.[key] ?? [];
          return (
            <FilterSection key={filterName} title={filterName} defaultOpen>
              {opts.map((opt) => (
                <FilterCheckbox
                  key={opt.value}
                  label={opt.value}
                  count={opt.count}
                  checked={filters[`attr[${filterName}]`] === opt.value}
                  onChange={(v) =>
                    onFilterChange(`attr[${filterName}]`, v ? opt.value : null)
                  }
                />
              ))}
            </FilterSection>
          );
        })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchFilterSidebar({ filters, facets, onFilterChange, onClearAll }: Props) {
  const t = useTranslations('search');
  const hasActiveFilters = Object.keys(filters).some(
    (k) => !['q', 'page', 'limit', 'sort'].includes(k),
  );

  return (
    <div className="text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-secondary">{t('filters')}</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-primary hover:underline"
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* ── Special offers ── */}
      <FilterSection title={t('specialOffers')} defaultOpen>
        <FilterCheckbox
          label={t('freeShipping')}
          checked={filters.freeShipping === 'true'}
          onChange={(v) => onFilterChange('freeShipping', v ? 'true' : null)}
          count={facets?.freeShipping}
        />
        <FilterCheckbox
          label={t('onSale')}
          checked={filters.onSale === 'true'}
          onChange={(v) => onFilterChange('onSale', v ? 'true' : null)}
          count={facets?.onSale}
        />
      </FilterSection>

      {/* ── Item type ── */}
      <FilterSection title={t('itemType')} defaultOpen>
        {(
          [
            { value: '',              label: t('itemTypeAll')     },
            { value: 'ready_to_ship', label: t('readyToShip')     },
            { value: 'to_order',      label: t('madeToOrder')     },
            { value: 'digital',       label: t('digitalDownload') },
          ] as const
        ).map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-secondary"
          >
            <input
              type="radio"
              name="itemType"
              checked={(filters.itemType ?? '') === opt.value}
              onChange={() => onFilterChange('itemType', opt.value || null)}
              className="accent-primary"
            />
            <span className="text-secondary text-sm">{opt.label}</span>
          </label>
        ))}
      </FilterSection>

      {/* ── Price ── */}
      <FilterSection title={t('price')} defaultOpen>
        <PriceRangeFilter
          min={filters.minPrice ? Number(filters.minPrice) : undefined}
          max={filters.maxPrice ? Number(filters.maxPrice) : undefined}
          onChange={(min, max) => {
            onFilterChange('minPrice', min !== undefined ? String(min) : null);
            onFilterChange('maxPrice', max !== undefined ? String(max) : null);
          }}
        />
      </FilterSection>

      {/* ── Color ── */}
      <FilterSection title={t('color')}>
        <ColorSwatchFilter
          selected={filters.color}
          onChange={(color) => onFilterChange('color', color)}
        />
      </FilterSection>

      {/* ── Star Seller ── */}
      <FilterSection title={t('starSeller')}>
        <FilterCheckbox
          label={t('starSellerShopsOnly')}
          checked={filters.starSeller === 'true'}
          onChange={(v) => onFilterChange('starSeller', v ? 'true' : null)}
        />
      </FilterSection>

      {/* ── Style (from facets) ── */}
      {(facets?.styles?.length ?? 0) > 0 && (
        <FilterSection title={t('style')}>
          {facets!.styles!.map((s) => (
            <FilterCheckbox
              key={s.value}
              label={s.value}
              count={s.count}
              checked={filters['attr[Style]'] === s.value}
              onChange={(v) => onFilterChange('attr[Style]', v ? s.value : null)}
            />
          ))}
        </FilterSection>
      )}

      {/* ── Material (from facets) ── */}
      {(facets?.materials?.length ?? 0) > 0 && (
        <FilterSection title={t('material')}>
          {facets!.materials!.slice(0, 6).map((m) => (
            <FilterCheckbox
              key={m.value}
              label={m.value}
              count={m.count}
              checked={filters['attr[Material]'] === m.value}
              onChange={(v) => onFilterChange('attr[Material]', v ? m.value : null)}
            />
          ))}
        </FilterSection>
      )}

      {/* ── More filters (Occasion, Holiday, Recipient, Hat type) ── */}
      <MoreFiltersSection
        filters={filters}
        facets={facets}
        onFilterChange={onFilterChange}
      />
    </div>
  );
}
