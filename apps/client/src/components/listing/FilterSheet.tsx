'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CategoryDto, TagDto } from '@ezihubb/types';
import type { ListingFilters } from './types';

const MAX_PRICE = 500;
const RATING_OPTIONS = [5, 4, 3, 2] as const;

interface FilterSheetProps {
  isOpen:     boolean;
  onClose:    () => void;
  filters:    ListingFilters;
  categories: CategoryDto[];
  tags:       TagDto[];
  /** Called when user taps "Apply Filters" — receives the new full filter state. */
  onApply:    (filters: ListingFilters) => void;
}

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  categories,
  tags,
  onApply,
}: FilterSheetProps) {
  // Buffer local edits; apply all at once on "Apply Filters"
  const [local, setLocal] = useState<ListingFilters>(filters);

  // Re-seed local state every time the sheet opens (so it reflects URL changes)
  useEffect(() => {
    if (isOpen) setLocal(filters);
  }, [isOpen]); // intentionally not including `filters` — snapshot on open

  if (!isOpen) return null;

  const update = (partial: Partial<ListingFilters>) =>
    setLocal((prev) => ({ ...prev, ...partial }));

  const handleApply = () => {
    onApply({ ...local, page: 1 });
    onClose();
  };

  const handleClear = () =>
    setLocal((prev) => ({
      ...prev,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      rating:   undefined,
      tags:     [],
    }));

  const activeCount = [
    local.category,
    local.minPrice,
    local.maxPrice,
    local.rating,
    ...local.tags,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — slides up */}
      <div className="relative w-full bg-surface rounded-t-2xl max-h-[85dvh] flex flex-col animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-secondary">
            Filters{' '}
            {activeCount > 0 && (
              <span className="text-primary">({activeCount})</span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="p-2 -mr-2 text-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-7">

          {/* Category */}
          {categories.length > 0 && (
            <section aria-labelledby="sheet-cat-title">
              <p id="sheet-cat-title" className="font-semibold text-sm text-secondary mb-3">
                Category
              </p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const active = local.category === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        update({ category: active ? undefined : cat.slug })
                      }
                      className={[
                        'text-sm px-3 py-2.5 rounded-button border text-left transition-colors leading-snug',
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-secondary hover:border-primary',
                      ].join(' ')}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Price Range */}
          <section aria-labelledby="sheet-price-title">
            <p id="sheet-price-title" className="font-semibold text-sm text-secondary mb-3">
              Price Range
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Min</span>
                  <span className="font-medium text-secondary">${local.minPrice ?? 0}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_PRICE}
                  step={5}
                  value={local.minPrice ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    update({ minPrice: v > 0 ? v : undefined });
                  }}
                  aria-label="Minimum price"
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Max</span>
                  <span className="font-medium text-secondary">
                    {(local.maxPrice ?? MAX_PRICE) >= MAX_PRICE
                      ? '$500+'
                      : `$${local.maxPrice}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_PRICE}
                  step={5}
                  value={local.maxPrice ?? MAX_PRICE}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    update({ maxPrice: v < MAX_PRICE ? v : undefined });
                  }}
                  aria-label="Maximum price"
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </section>

          {/* Rating */}
          <section aria-labelledby="sheet-rating-title">
            <p id="sheet-rating-title" className="font-semibold text-sm text-secondary mb-3">
              Customer Rating
            </p>
            <div className="space-y-2" role="radiogroup">
              {RATING_OPTIONS.map((r) => {
                const active = local.rating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ rating: active ? undefined : r })}
                    className={[
                      'w-full flex items-center justify-between px-4 py-3.5 rounded-button border text-sm transition-colors',
                      active
                        ? 'bg-primary/8 border-primary text-primary'
                        : 'border-border text-secondary',
                    ].join(' ')}
                  >
                    <span>
                      {'★'.repeat(r)}
                      {r < 5 && (
                        <span className="text-muted ml-1.5">& up</span>
                      )}
                    </span>
                    {active && <span aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tags */}
          {tags.length > 0 && (
            <section aria-labelledby="sheet-tags-title">
              <p id="sheet-tags-title" className="font-semibold text-sm text-secondary mb-3">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = local.tags.includes(tag.slug);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? local.tags.filter((t) => t !== tag.slug)
                          : [...local.tags, tag.slug];
                        update({ tags: next });
                      }}
                      className={[
                        'text-xs px-3 py-1.5 rounded-pill border transition-colors',
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-secondary',
                      ].join(' ')}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer — Apply + Clear */}
        <div className="shrink-0 px-5 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-3 border border-border rounded-button text-sm font-medium text-secondary hover:border-error hover:text-error transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-[2] py-3 bg-primary hover:bg-primary-dark text-white rounded-button text-sm font-semibold transition-colors"
          >
            Apply Filters{activeCount > 0 && ` (${activeCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
