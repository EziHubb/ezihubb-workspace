'use client';

import type { ProductListItemDto } from '@ezihubb/types';
import { SearchProductCard } from './SearchProductCard';

// ── SearchProductGrid ─────────────────────────────────────────────────────────

interface SearchProductGridProps {
  products: ProductListItemDto[];
  isPending: boolean;
  /** Active search query — forwarded to each card for ?st= click attribution. */
  searchTerm?: string;
}

export function SearchProductGrid({ products, isPending, searchTerm }: SearchProductGridProps) {
  return (
    <div
      className={[
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4',
        isPending ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      {products.map((product, index) => (
        <SearchProductCard
          key={product.id}
          product={product}
          priority={index < 8}
          searchTerm={searchTerm}
        />
      ))}
    </div>
  );
}

// ── SearchGridSkeleton ────────────────────────────────────────────────────────

export function SearchGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 48 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-square rounded-2xl bg-[#F0EDEA] animate-pulse mb-2.5" />
          <div className="h-2.5 bg-[#F0EDEA] rounded animate-pulse mb-1.5 w-4/5" />
          <div className="h-2.5 bg-[#F0EDEA] rounded animate-pulse mb-1.5 w-full" />
          <div className="h-2.5 bg-[#F0EDEA] rounded animate-pulse w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ── SearchPagination ──────────────────────────────────────────────────────────

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SearchPaginationProps {
  pagination?: PaginationData;
  onPageChange: (page: number) => void;
}

function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export function SearchPagination({ pagination, onPageChange }: SearchPaginationProps) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const current = Number(pagination.page);
  const { totalPages } = pagination;
  const pages = buildPageRange(current, totalPages);

  const handlePageChange = (page: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onPageChange(page);
  };

  return (
    <div className="flex justify-center items-center gap-1 mt-10">
      <button
        type="button"
        onClick={() => handlePageChange(current - 1)}
        disabled={current === 1}
        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-secondary disabled:opacity-30 hover:border-secondary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="w-9 text-center text-muted select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => handlePageChange(Number(p))}
            className={[
              'w-9 h-9 rounded-full text-sm transition-colors',
              Number(p) === current
                ? 'bg-secondary text-white'
                : 'border border-border hover:border-secondary text-secondary',
            ].join(' ')}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => handlePageChange(current + 1)}
        disabled={current === totalPages}
        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-secondary disabled:opacity-30 hover:border-secondary transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
