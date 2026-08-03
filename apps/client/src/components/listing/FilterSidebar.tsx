'use client';

import { useState, useEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CategoryDto, TagDto } from '@ezihubb/types';
import type { ListingFilters } from './types';

const MAX_PRICE = 500;
const RATING_OPTIONS = [5, 4, 3, 2] as const;

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title:        string;
  defaultOpen?: boolean;
  children:     React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-b border-border pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between group mb-3"
      >
        <span className="font-semibold text-sm text-secondary">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div id={id}>{children}</div>}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AttributeFilterOption {
  key:    string;
  values: string[];
}

interface FilterSidebarProps {
  filters:           ListingFilters;
  categories:        CategoryDto[];
  tags:              TagDto[];
  onChange:          (updates: Partial<ListingFilters>) => void;
  onClearAll:        () => void;
  /** Category-specific filterable attributes (e.g. Material, Size) */
  attributeFilters?: AttributeFilterOption[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FilterSidebar({
  filters,
  categories,
  tags,
  onChange,
  onClearAll,
  attributeFilters,
}: FilterSidebarProps) {
  // Local price state avoids a router.push on every slider tick
  const [localMin, setLocalMin] = useState(filters.minPrice ?? 0);
  const [localMax, setLocalMax] = useState(filters.maxPrice ?? MAX_PRICE);

  // Keep in sync when URL changes (e.g. "Clear All" resets URL)
  useEffect(() => {
    setLocalMin(filters.minPrice ?? 0);
    setLocalMax(filters.maxPrice ?? MAX_PRICE);
  }, [filters.minPrice, filters.maxPrice]);

  const applyPrice = () => {
    onChange({
      minPrice: localMin > 0           ? localMin  : undefined,
      maxPrice: localMax < MAX_PRICE   ? localMax  : undefined,
      page:     1,
    });
  };

  const hasActive =
    !!filters.category ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.rating   !== undefined ||
    filters.tags.length > 0;

  return (
    <aside className="w-[260px] shrink-0 sticky top-24 self-start">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-secondary">Filters</h2>
        {hasActive && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-primary hover:underline font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* ── Category ───────────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <Section title="Category">
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat.id}>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.category === cat.slug}
                    onChange={(e) =>
                      onChange({
                        category: e.target.checked ? cat.slug : undefined,
                        page: 1,
                      })
                    }
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm text-secondary group-hover:text-primary transition-colors flex-1 leading-snug">
                    {cat.name}
                  </span>
                  {cat.productCount !== undefined && (
                    <span className="text-xs text-muted tabular-nums">{cat.productCount}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Price Range ────────────────────────────────────────────────────── */}
      <Section title="Price Range">
        <div className="space-y-4">
          {/* Min */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Min price</span>
              <span className="font-medium text-secondary">${localMin}</span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_PRICE}
              step={5}
              value={localMin}
              onChange={(e) =>
                setLocalMin(Math.min(Number(e.target.value), localMax - 5))
              }
              onMouseUp={applyPrice}
              onTouchEnd={applyPrice}
              aria-label="Minimum price"
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          {/* Max */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Max price</span>
              <span className="font-medium text-secondary">
                {localMax >= MAX_PRICE ? '$500+' : `$${localMax}`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_PRICE}
              step={5}
              value={localMax}
              onChange={(e) =>
                setLocalMax(Math.max(Number(e.target.value), localMin + 5))
              }
              onMouseUp={applyPrice}
              onTouchEnd={applyPrice}
              aria-label="Maximum price"
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          <p className="text-xs text-center text-muted">
            ${localMin} –{' '}
            {localMax >= MAX_PRICE ? '$500+' : `$${localMax}`}
          </p>
        </div>
      </Section>

      {/* ── Rating ─────────────────────────────────────────────────────────── */}
      <Section title="Customer Rating">
        <ul className="space-y-2" role="radiogroup" aria-label="Filter by rating">
          {RATING_OPTIONS.map((r) => (
            <li key={r}>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="sidebar-rating"
                  checked={filters.rating === r}
                  onChange={() => onChange({ rating: r, page: 1 })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="flex items-center gap-1 text-sm text-secondary group-hover:text-primary transition-colors">
                  {'★'.repeat(r)}
                  <span className="text-muted ml-0.5">{r < 5 ? '& up' : ''}</span>
                </span>
              </label>
            </li>
          ))}
          {filters.rating !== undefined && (
            <li>
              <button
                type="button"
                onClick={() => onChange({ rating: undefined, page: 1 })}
                className="text-xs text-primary hover:underline"
              >
                Any rating
              </button>
            </li>
          )}
        </ul>
      </Section>

      {/* ── Tags ───────────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <Section title="Tags" defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = filters.tags.includes(tag.slug);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? filters.tags.filter((t) => t !== tag.slug)
                      : [...filters.tags, tag.slug];
                    onChange({ tags: next, page: 1 });
                  }}
                  className={[
                    'text-xs px-3 py-1.5 rounded-pill border transition-colors',
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-secondary hover:border-primary hover:text-primary',
                  ].join(' ')}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Attribute Filters (category-specific) ──────────────────────── */}
      {attributeFilters && attributeFilters.length > 0 && attributeFilters.map((attr) => {
        const selectedVal = filters.attributes?.[attr.key];
        return (
          <Section key={attr.key} title={attr.key} defaultOpen={false}>
            <ul className="space-y-2">
              {attr.values.map((val) => {
                const checked = selectedVal === val;
                return (
                  <li key={val}>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = { ...(filters.attributes ?? {}) };
                          if (e.target.checked) {
                            next[attr.key] = val;
                          } else {
                            delete next[attr.key];
                          }
                          onChange({
                            attributes: Object.keys(next).length > 0 ? next : undefined,
                            page: 1,
                          });
                        }}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm text-secondary group-hover:text-primary transition-colors">
                        {val}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
    </aside>
  );
}
