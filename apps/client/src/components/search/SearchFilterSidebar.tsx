'use client';

import { Fragment, useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';
import type { CategoryDto } from '@ezihubb/types';

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
  /** ISO 3166-1 alpha-2 codes, counted across the current result set. */
  countries?: FacetItem[];
}

/**
 * Country code -> display name, resolved by the browser so we do not ship a
 * country table in three languages. Falls back to the raw code if the runtime
 * has no data for it, which is still better than a blank row.
 */
function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

interface Props {
  filters: Record<string, string | undefined>;
  facets?: SearchFacets;
  /** Full category tree, fetched once by the page. Empty until it arrives. */
  categories: CategoryDto[];
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

// ── Category tree ─────────────────────────────────────────────────────────────

/**
 * Total listings in a category *including* its descendants.
 *
 * productCount from the API counts only listings filed directly against that
 * node, and 101 of the 130 categories are leaves — so almost every parent
 * reports 0 on its own. Rolling the children up makes a parent's number match
 * what clicking it actually returns, now that the API filters by branch
 * rather than by one exact id.
 */
function rollUpCount(cat: CategoryDto): number {
  return (cat.productCount ?? 0) + (cat.children ?? []).reduce((n, c) => n + rollUpCount(c), 0);
}

/**
 * Path from a root category down to `slug`, or null if it is not in this
 * subtree. Used to rebuild the open branch from the URL alone: the URL
 * carries only the selected slug — the API parameter that already exists —
 * and the path is derived here from the tree that is already loaded, rather
 * than being duplicated into the address bar.
 */
function findPath(cats: CategoryDto[], slug: string): CategoryDto[] | null {
  for (const cat of cats) {
    if (cat.slug === slug) return [cat];
    const sub = findPath(cat.children ?? [], slug);
    if (sub) return [cat, ...sub];
  }
  return null;
}

function CategoryTreeFilter({
  categories,
  selectedSlug,
  onSelect,
}: {
  categories:   CategoryDto[];
  selectedSlug: string | undefined;
  onSelect:     (slug: string | null) => void;
}) {
  const t = useTranslations('search');
  const path = selectedSlug ? findPath(categories, selectedSlug) : null;

  // Children of whatever is selected — the next level down to drill into.
  // With nothing selected we are at the roots.
  const level = path?.length ? (path[path.length - 1].children ?? []) : categories;

  return (
    <div className="space-y-0.5">
      {/* The ancestor rows ARE the way back up: clicking one collapses to that
          level. A separate "back" control would duplicate what the path
          already shows, in a 220px column that has no room to spare — which
          is also why this is an indented list rather than a horizontal
          breadcrumb. */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`block text-left w-full py-1 hover:text-primary transition-colors ${
          !selectedSlug ? 'font-semibold text-secondary' : 'text-primary'
        }`}
      >
        {t('allCategories')}
      </button>

      {(path ?? []).map((cat, i) => {
        const isCurrent = i === (path?.length ?? 0) - 1;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.slug)}
            style={{ paddingLeft: `${(i + 1) * 12}px` }}
            className={`block text-left w-full py-1 hover:text-primary transition-colors ${
              isCurrent ? 'font-semibold text-secondary' : 'text-primary'
            }`}
          >
            {cat.name}
          </button>
        );
      })}

      {/* Nothing is hidden for having a zero count: with roll-up a genuinely
          empty branch reads 0 honestly, and hiding branches would make the
          taxonomy change shape as stock moves. */}
      {level.map((cat) => {
        const count = rollUpCount(cat);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.slug)}
            style={{ paddingLeft: `${((path?.length ?? 0) + 1) * 12}px` }}
            className="flex items-center justify-between gap-2 text-left w-full py-1 text-primary hover:text-primary-dark transition-colors"
          >
            <span className="truncate">{cat.name}</span>
            {count > 0 && (
              <span className="text-xs text-muted tabular-nums shrink-0">{count.toLocaleString()}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── ShowMoreList ──────────────────────────────────────────────────────────────

/**
 * Caps a long option list and reveals the rest on demand.
 *
 * Long facet groups used to be truncated with `.slice(0, 6)` and no control,
 * so options past the sixth were unreachable — a shopper filtering by a
 * material outside the top six simply could not. The reference caps its lists
 * the same way but always pairs the cap with a toggle.
 */
function ShowMoreList({ items, initial = 6 }: { items: React.ReactNode[]; initial?: number }) {
  const t = useTranslations('search');
  const [expanded, setExpanded] = useState(false);
  const overflow = items.length - initial;

  return (
    <>
      {(expanded ? items : items.slice(0, initial)).map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary underline underline-offset-2 hover:text-primary-dark transition-colors mt-1"
        >
          {expanded ? t('showLess') : t('showMore', { count: overflow })}
        </button>
      )}
    </>
  );
}

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
      {/* Height animated with the grid-rows 0fr -> 1fr trick: pure CSS, no
          measuring the content in JS, and it works for a panel whose height
          is not known ahead of time (a facet list changes length with the
          result set).
          Content stays mounted — collapsing a group must not discard how far
          its Show-more list was expanded. `invisible` keeps the collapsed
          panel out of the tab order and away from screen readers while the
          animation still has something to animate. */}
      <div
        className={[
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 invisible',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5">{children}</div>
        </div>
      </div>
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

/**
 * One row per colour: checkbox, swatch, name — as in the reference, and
 * capped with a "show more" toggle like the other long groups.
 *
 * Was a 6-across grid of unlabelled circles. Two problems with that: a colour
 * has to be guessed from a dot, which is guesswork for anyone who cannot
 * distinguish those hues, and a grid of swatches gives no hint that more than
 * one can be picked.
 *
 * Multi-select, which the checkbox shape now implies. The API has always
 * accepted it — `colors` is documented as comma-separated — so this is the
 * control finally matching what the endpoint could already do.
 */
function ColorSwatchFilter({
  selected,
  onChange,
}: {
  /** Comma-separated, straight from the URL. */
  selected: string | undefined;
  onChange: (colors: string | null) => void;
}) {
  const active = (selected ?? '').split(',').filter(Boolean);

  const toggle = (name: string) => {
    const next = active.includes(name)
      ? active.filter((c) => c !== name)
      : [...active, name];
    onChange(next.length ? next.join(',') : null);
  };

  return (
    <ShowMoreList
      items={STANDARD_COLORS.map((color) => (
        <label
          key={color.name}
          className="flex items-center gap-2 py-1.5 cursor-pointer group"
        >
          <div
            className={[
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
              active.includes(color.name)
                ? 'bg-secondary border-secondary'
                : 'border-border group-hover:border-secondary',
            ].join(' ')}
          >
            {active.includes(color.name) && (
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            )}
          </div>
          <input
            type="checkbox"
            className="sr-only"
            checked={active.includes(color.name)}
            onChange={() => toggle(color.name)}
          />
          <span
            aria-hidden="true"
            className="w-4 h-4 rounded-full border border-border shrink-0"
            style={{ backgroundColor: color.hex }}
          />
          <span className="text-secondary text-sm group-hover:text-primary transition-colors">
            {color.name}
          </span>
        </label>
      ))}
    />
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

export function SearchFilterSidebar({ filters, facets, categories, onFilterChange, onClearAll }: Props) {
  const locale = useLocale();
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

      {/* Group order is ours, not the reference's: the reference images have
          no overlap between screenshots so their vertical order could not be
          recovered from them. Ordered by how much each one narrows a result
          set and how many shoppers touch it — price and offers before
          attribute filters, shop reputation last.
          The first four are open by default. Opening everything makes a
          column nobody scrolls; closing everything hides what is on offer. */}

      {/* ── Category ── first: the biggest single narrowing step, and the
          first thing a shopper thinks in. */}
      {categories.length > 0 && (
        <FilterSection title={t('category')} defaultOpen>
          <CategoryTreeFilter
            categories={categories}
            selectedSlug={filters.category}
            onSelect={(slug) => onFilterChange('category', slug)}
          />
        </FilterSection>
      )}

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

      {/* ── Rating ──
          Uses minRating, which SearchQueryDto already accepts (1-5) — the
          sidebar simply never exposed it. No counts: facets carry no rating
          buckets, and inventing one client-side would be a number nobody
          could reconcile with the results. */}
      <FilterSection title={t('rating')}>
        {([4, 3, 2] as const).map((stars) => (
          <label
            key={stars}
            className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-secondary"
          >
            <input
              type="radio"
              name="minRating"
              checked={filters.minRating === String(stars)}
              onChange={() => onFilterChange('minRating', String(stars))}
              className="accent-primary"
            />
            <span className="text-secondary text-sm">
              {t('ratingAndUp', { stars })}
            </span>
          </label>
        ))}
        {filters.minRating && (
          <button
            type="button"
            onClick={() => onFilterChange('minRating', null)}
            className="text-xs text-primary hover:underline mt-1"
          >
            {t('anyRating')}
          </button>
        )}
      </FilterSection>

      {/* ── When made ──
          Radios: a listing is one or the other, and the API takes a single
          enum value. The field is nullable and unanswered on every existing
          listing, so this narrows nothing until sellers fill it in — which is
          the honest state, not a bug. */}
      <FilterSection title={t('whenMade')}>
        {(['RECENTLY_MADE', 'VINTAGE'] as const).map((v) => (
          <label
            key={v}
            className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-secondary"
          >
            <input
              type="radio"
              name="whenMade"
              checked={filters.whenMade === v}
              onChange={() => onFilterChange('whenMade', v)}
              className="accent-primary"
            />
            <span className="text-secondary text-sm">{t(`whenMadeOptions.${v}`)}</span>
          </label>
        ))}
        {filters.whenMade && (
          <button
            type="button"
            onClick={() => onFilterChange('whenMade', null)}
            className="text-xs text-primary hover:underline mt-1"
          >
            {t('anyWhenMade')}
          </button>
        )}
      </FilterSection>

      {/* ── Ordering options ── */}
      <FilterSection title={t('orderingOptions')}>
        <FilterCheckbox
          label={t('giftWrapping')}
          checked={filters.giftWrapping === 'true'}
          onChange={(v) => onFilterChange('giftWrapping', v ? 'true' : null)}
        />
      </FilterSection>

      {/* ── Ready to dispatch ──
          Radios, not checkboxes: the API takes one upper bound, and "1 day"
          is already contained in "1-3 days", so two boxes ticked together
          would be the same query as the looser one alone. */}
      <FilterSection title={t('readyToDispatch')}>
        {([1, 3, 7] as const).map((days) => (
          <label
            key={days}
            className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-secondary"
          >
            <input
              type="radio"
              name="maxProcessingDays"
              checked={filters.maxProcessingDays === String(days)}
              onChange={() => onFilterChange('maxProcessingDays', String(days))}
              className="accent-primary"
            />
            <span className="text-secondary text-sm">{t('dispatchWithin', { days })}</span>
          </label>
        ))}
        {filters.maxProcessingDays && (
          <button
            type="button"
            onClick={() => onFilterChange('maxProcessingDays', null)}
            className="text-xs text-primary hover:underline mt-1"
          >
            {t('anyDispatchTime')}
          </button>
        )}
      </FilterSection>

      {/* ── Ships from ──
          Only rendered when the result set actually spans a country we know
          about. Hiding it on an empty facet avoids a filter group that can
          never narrow anything. */}
      {(facets?.countries?.length ?? 0) > 0 && (
        <FilterSection title={t('shipsFrom')}>
          <ShowMoreList
            items={facets!.countries!.map((c) => (
              <FilterCheckbox
                key={c.value}
                label={countryName(c.value, locale)}
                count={c.count}
                checked={filters.shipsFrom === c.value}
                onChange={(v) => onFilterChange('shipsFrom', v ? c.value : null)}
              />
            ))}
          />
        </FilterSection>
      )}

      {/* ── Color ── */}
      <FilterSection title={t('color')}>
        <ColorSwatchFilter
          selected={filters.color}
          onChange={(color) => onFilterChange('color', color)}
        />
      </FilterSection>

      {/* ── Style (from facets) ── */}
      {(facets?.styles?.length ?? 0) > 0 && (
        <FilterSection title={t('style')}>
          <ShowMoreList
            items={facets!.styles!.map((s) => (
              <FilterCheckbox
                key={s.value}
                label={s.value}
                count={s.count}
                checked={filters['attr[Style]'] === s.value}
                onChange={(v) => onFilterChange('attr[Style]', v ? s.value : null)}
              />
            ))}
          />
        </FilterSection>
      )}

      {/* ── Material (from facets) ── */}
      {(facets?.materials?.length ?? 0) > 0 && (
        <FilterSection title={t('material')}>
          <ShowMoreList
            items={facets!.materials!.map((m) => (
              <FilterCheckbox
                key={m.value}
                label={m.value}
                count={m.count}
                checked={filters['attr[Material]'] === m.value}
                onChange={(v) => onFilterChange('attr[Material]', v ? m.value : null)}
              />
            ))}
          />
        </FilterSection>
      )}

      {/* ── More filters (Occasion, Holiday, Recipient, Hat type) ──
          "Celebration" from the reference is not a separate group here: it
          lists the same things our Holiday facet already holds
          (Halloween, Christmas, Mother's Day...), and splitting one set of
          holidayTags across two headings would give the shopper two places to
          look for one thing. Product decision, not reference parity. */}
      <MoreFiltersSection
        filters={filters}
        facets={facets}
        onFilterChange={onFilterChange}
      />

      {/* ── Star Seller ── last: the narrowest filter here and the one
          fewest shoppers reach for. */}
      <FilterSection title={t('starSeller')}>
        <FilterCheckbox
          label={t('starSellerShopsOnly')}
          checked={filters.starSeller === 'true'}
          onChange={(v) => onFilterChange('starSeller', v ? 'true' : null)}
        />
      </FilterSection>
    </div>
  );
}
