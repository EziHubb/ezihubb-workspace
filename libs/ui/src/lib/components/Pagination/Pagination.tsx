import React from 'react';

export interface PaginationLabels {
  /** aria-label on the <nav>. Default: "Pagination" */
  navAria?:         string;
  /** aria-label on the previous-page button. Default: "Previous page" */
  previousAria?:    string;
  /** aria-label on the next-page button. Default: "Next page" */
  nextAria?:        string;
  /** Mobile "Prev" button text. Default: "Prev" */
  prev?:            string;
  /** Mobile "Next" button text. Default: "Next" */
  next?:            string;
  /** Mobile page indicator, e.g. "Page {page} of {total}". Default English template. */
  pageOf?:          (page: number, total: number) => string;
  /** Desktop numbered-page aria-label, e.g. "Page {n}". Default English template. */
  pageAria?:        (page: number) => string;
}

export interface PaginationProps {
  page:         number;
  totalPages:   number;
  onPageChange: (page: number) => void;
  className?:   string;
  /** Translated labels — every field falls back to its English default. */
  labels?:      PaginationLabels;
}

const defaultLabels: Required<PaginationLabels> = {
  navAria:      'Pagination',
  previousAria: 'Previous page',
  nextAria:     'Next page',
  prev:         'Prev',
  next:         'Next',
  pageOf:       (page, total) => `Page ${page} of ${total}`,
  pageAria:     (page) => `Page ${page}`,
};

function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end   = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);

  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  className = '',
  labels,
}) => {
  if (totalPages <= 1) return null;

  const L = { ...defaultLabels, ...labels };
  const pages = buildPageList(page, totalPages);

  const btnBase =
    'inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const squareBtn =
    'w-9 h-9 rounded-sm border border-border text-sm text-secondary hover:border-primary hover:text-primary';

  return (
    <nav aria-label={L.navAria} className={`flex items-center justify-center ${className}`}>

      {/* ── Mobile: prev / page-indicator / next ─────────────────────────── */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label={L.previousAria}
          className={`${btnBase} gap-1 px-3 py-2 text-sm font-medium text-secondary disabled:opacity-40 hover:text-primary`}
        >
          <ChevronLeft /> {L.prev}
        </button>

        <span className="text-sm text-muted whitespace-nowrap">
          {L.pageOf(page, totalPages)}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label={L.nextAria}
          className={`${btnBase} gap-1 px-3 py-2 text-sm font-medium text-secondary disabled:opacity-40 hover:text-primary`}
        >
          {L.next} <ChevronRight />
        </button>
      </div>

      {/* ── Desktop: numbered pages ───────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label={L.previousAria}
          className={`${btnBase} ${squareBtn}`}
        >
          <ChevronLeft />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`ellipsis-${i}`}
              className="w-9 h-9 inline-flex items-center justify-center text-muted text-sm"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-label={L.pageAria(p)}
              aria-current={p === page ? 'page' : undefined}
              className={[
                btnBase,
                'w-9 h-9 rounded-sm text-sm font-medium',
                p === page
                  ? 'bg-primary text-white border border-primary'
                  : squareBtn,
              ].join(' ')}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label={L.nextAria}
          className={`${btnBase} ${squareBtn}`}
        >
          <ChevronRight />
        </button>
      </div>
    </nav>
  );
};
