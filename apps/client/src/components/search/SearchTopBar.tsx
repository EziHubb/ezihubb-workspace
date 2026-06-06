'use client';

import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';

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
  isLoading: boolean;
}

// ── Sort options (search-specific — includes relevance) ───────────────────────

const SEARCH_SORT_OPTIONS = [
  { value: 'relevance',  label: 'Relevancy'           },
  { value: 'bestseller', label: 'Most popular'        },
  { value: 'newest',     label: 'Newest'              },
  { value: 'price_asc',  label: 'Price: Low to High'  },
  { value: 'price_desc', label: 'Price: High to Low'  },
  { value: 'rating',     label: 'Top rated'           },
] as const;

// ── Chip helpers ──────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<string, string> = {
  minPrice:    'Min price',
  maxPrice:    'Max price',
  minRating:   'Rating',
  color:       'Color',
  freeShipping:'Free shipping',
  onSale:      'On sale',
  starSeller:  'Star Seller',
  itemType:    'Item type',
};

function formatFilterLabel(key: string, value: string): string {
  if (key === 'minPrice')    return `From $${value}`;
  if (key === 'maxPrice')    return `To $${value}`;
  if (key === 'minRating')   return `${'★'.repeat(Number(value))} & up`;
  if (key === 'freeShipping') return 'Free shipping';
  if (key === 'onSale')       return 'On sale';
  if (key === 'starSeller')   return 'Star Seller';
  if (key === 'itemType') {
    if (value === 'ready_to_ship') return 'Ready to ship';
    if (value === 'to_order')      return 'Made to order';
    if (value === 'digital')       return 'Digital';
  }
  // attr[Key]=Value  → "Key: Value"
  const attrMatch = key.match(/^attr\[([^\]]+)\]$/);
  if (attrMatch) return `${attrMatch[1]}: ${value}`;

  const base = FILTER_LABELS[key] ?? key;
  return `${base}: ${value}`;
}

const SKIP_KEYS = new Set(['q', 'sort', 'page', 'limit']);

function getChips(filters: Record<string, string | undefined>): ActiveFilter[] {
  return Object.entries(filters)
    .filter(([key, value]) => !SKIP_KEYS.has(key) && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, label: formatFilterLabel(key, value as string) }));
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
  isLoading,
}: SearchTopBarProps) {
  const chips = getChips(activeFilters);

  return (
    <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4 py-3">

        {/* Row 1: filter toggle (mobile) + result count + sort */}
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Left: mobile filter button + result count */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="lg:hidden flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm text-secondary hover:border-secondary transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {chips.length > 0 && (
                <span className="w-4 h-4 bg-primary text-white rounded-full text-[10px] flex items-center justify-center leading-none">
                  {chips.length}
                </span>
              )}
            </button>

            <p className="text-sm text-muted">
              {isLoading ? (
                <span className="text-muted">Searching…</span>
              ) : (
                <>
                  <span className="font-semibold text-secondary">{totalCount.toLocaleString()}</span>{' '}
                  {totalCount === 1 ? 'result' : 'results'}
                  {query && (
                    <> for <span className="font-semibold text-secondary">&ldquo;{query}&rdquo;</span></>
                  )}
                </>
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
            <span className="text-xs text-muted">Active filters:</span>
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
              Clear all
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
