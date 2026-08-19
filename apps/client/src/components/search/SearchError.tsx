'use client';

import { useTranslations } from 'next-intl';

/**
 * Shown when the search request itself failed.
 *
 * Deliberately separate from SearchNoResults. Both end up with an empty grid,
 * but they mean opposite things: "nothing matched" is about the query, "we
 * could not reach the server" is not. Showing the first for the second sends
 * the shopper off rewording a search that was never the problem.
 *
 * The retry button re-runs the same query rather than navigating, so the
 * filters and page in the URL survive.
 */
export function SearchError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('search');

  return (
    <div role="alert" className="flex flex-col items-center text-center py-20 px-4">
      {/* Plain-token SVG, no icon asset. aria-hidden: the text below already
          carries the meaning for assistive tech. */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-muted mb-4"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="20" y1="20" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="12" />
        <line x1="11" y1="14.5" x2="11" y2="14.51" />
      </svg>

      <h2 className="font-display text-lg font-bold text-secondary mb-1.5">
        {t('error.title')}
      </h2>
      <p className="text-sm text-muted max-w-sm mb-6">
        {t('error.body')}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-6 py-2.5 rounded-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {t('error.retry')}
      </button>
    </div>
  );
}
