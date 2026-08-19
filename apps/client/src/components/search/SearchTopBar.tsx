'use client';

import { useTranslations } from 'next-intl';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { safeNum } from '@ezihubb/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveFilter {
  key: string;
  label: string;
}

interface SearchTopBarProps {
  query?: string;
  totalCount: number;
  sort: string;
  activeFilters: Record<string, string | undefined>;
  onSortChange: (sort: string) => void;
  onClearFilter: (key: string) => void;
  onClearAll: () => void;
  onOpenSidebar: () => void;
  /** Desktop only — collapses the filter column to give the grid its width. */
  onToggleFilters: () => void;
  filtersOpen: boolean;
  isLoading: boolean;
}

// ── Chip helpers (need `t`, so declared as plain functions and called from
// inside the component rather than as module-level constants) ────────────────

type Translator = ReturnType<typeof useTranslations>;

function formatFilterLabel(t: Translator, key: string, value: string): string {
  if (key === 'minPrice')    return t('chips.fromPrice', { value: `$${value}` });
  if (key === 'maxPrice')    return t('chips.toPrice', { value: `$${value}` });
  if (key === 'minRating')   return t('chips.ratingAndUp', { stars: '★'.repeat(Number(value)) });
  if (key === 'freeShipping') return t('freeShipping');
  if (key === 'onSale')       return t('onSale');
  if (key === 'starSeller')   return t('starSeller');
  if (key === 'itemType') {
    if (value === 'ready_to_ship') return t('readyToShip');
    if (value === 'to_order')      return t('madeToOrder');
    if (value === 'digital')       return t('chips.digital');
  }
  // attr[Key]=Value  → "Key: Value" — attribute names come from product data,
  // not UI chrome, so they're left as-is rather than translated.
  const attrMatch = key.match(/^attr\[([^\]]+)\]$/);
  if (attrMatch) return `${attrMatch[1]}: ${value}`;

  const filterLabels: Record<string, string> = {
    minPrice: t('chips.minPrice'), maxPrice: t('chips.maxPrice'), minRating: t('chips.rating'),
    color: t('color'), freeShipping: t('freeShipping'), onSale: t('onSale'),
    starSeller: t('starSeller'), itemType: t('itemType'),
  };
  const base = filterLabels[key] ?? key;
  return `${base}: ${value}`;
}

const SKIP_KEYS = new Set(['q', 'sort', 'page', 'limit']);

function getChips(t: Translator, filters: Record<string, string | undefined>): ActiveFilter[] {
  return Object.entries(filters)
    .filter(([key, value]) => !SKIP_KEYS.has(key) && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, label: formatFilterLabel(t, key, value as string) }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchTopBar({
  query,
  totalCount,
  sort,
  activeFilters,
  onSortChange,
  onClearFilter,
  onClearAll,
  onOpenSidebar,
  onToggleFilters,
  filtersOpen,
  isLoading,
}: SearchTopBarProps) {
  const t = useTranslations('search');
  const chips = getChips(t, activeFilters);

  // Sort options (search-specific — includes relevance)
  const SEARCH_SORT_OPTIONS = [
    { value: 'relevance',  label: t('sort.relevancy')  },
    { value: 'bestseller', label: t('sort.mostPopular') },
    { value: 'newest',     label: t('sort.newest')      },
    { value: 'price_asc',  label: t('sort.priceAsc')    },
    { value: 'price_desc', label: t('sort.priceDesc')   },
    { value: 'rating',     label: t('sort.topRated')    },
  ] as const;

  return (
    <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="w-full max-w-[1746px] mx-auto px-5 py-3">

        {/* Row 1: filter toggle (mobile) + result count + sort */}
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Left: filter buttons + result count */}
          <div className="flex items-center gap-3">
            {/* Desktop: collapse/expand the filter column. Separate control
                from the mobile one below — mobile opens a sheet, desktop
                reclaims grid width, and they are never both visible. */}
            <button
              type="button"
              onClick={onToggleFilters}
              aria-expanded={filtersOpen}
              className="hidden lg:flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:border-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {filtersOpen ? t('hideFilters') : t('showFilters')}
              {!filtersOpen && chips.length > 0 && (
                <span className="w-4 h-4 bg-primary text-white rounded-full text-[10px] flex items-center justify-center leading-none">
                  {chips.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenSidebar}
              className="lg:hidden flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:border-secondary transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('filters')}
              {chips.length > 0 && (
                <span className="w-4 h-4 bg-primary text-white rounded-full text-[10px] flex items-center justify-center leading-none">
                  {chips.length}
                </span>
              )}
            </button>

            <p className="text-sm text-muted">
              {isLoading ? (
                <span className="text-muted">{t('searching')}</span>
              ) : query ? (
                t('resultsFor', { count: safeNum(totalCount), query })
              ) : (
                t('results', { count: safeNum(totalCount) })
              )}
            </p>
          </div>

          {/* Right: sort select */}
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none border border-border rounded-full pl-4 pr-8 py-1.5 text-sm text-secondary bg-background cursor-pointer hover:border-secondary focus:outline-none focus:border-primary transition-colors"
            >
              {SEARCH_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Row 2: active filter chips */}
        {chips.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-xs text-muted">{t('activeFilters')}</span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onClearFilter(chip.key)}
                className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2.5 py-1 rounded-full hover:bg-secondary/20 transition-colors"
              >
                {chip.label}
                <X className="w-3 h-3 shrink-0" />
              </button>
            ))}
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-primary hover:underline ml-1"
            >
              {t('clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Loading progress bar */}
      {isLoading && (
        <div className="h-0.5 bg-border overflow-hidden">
          <div className="h-full bg-primary animate-[progress_1.2s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  );
}
