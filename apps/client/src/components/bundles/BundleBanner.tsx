'use client';

import Link from 'next/link';
import { Gift, Tag, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleSuggestion {
  id:    string;
  name:  string;
  slug:  string;
  price: number;
}

interface BundleBannerProps {
  storeId:         string;
  currentItemCount: number;
  nextTierAt:      number | null;
  discountAmt:     number;
  discountPct:     number;
  suggestions?:    BundleSuggestion[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BundleBanner({
  currentItemCount,
  nextTierAt,
  discountAmt,
  discountPct,
  suggestions = [],
}: BundleBannerProps) {
  const isQualifying = discountPct > 0 && discountAmt > 0;
  const itemsNeeded  = nextTierAt !== null ? nextTierAt - currentItemCount : null;

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3 space-y-3',
        isQualifying
          ? 'bg-green-50 border-green-200'
          : 'bg-primary/5 border-primary/20',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div
          className={[
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            isQualifying ? 'bg-green-100' : 'bg-primary/10',
          ].join(' ')}
        >
          {isQualifying ? (
            <Tag className="w-4 h-4 text-green-600" />
          ) : (
            <Gift className="w-4 h-4 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={[
              'text-sm font-semibold',
              isQualifying ? 'text-green-800' : 'text-secondary',
            ].join(' ')}
          >
            {isQualifying ? 'Bundle & Save!' : 'Bundle & Save!'}
          </p>

          {isQualifying ? (
            <p className="text-xs text-green-700 mt-0.5">
              You&apos;re saving{' '}
              <span className="font-bold">${discountAmt.toFixed(2)}</span> with
              a bundle discount!
            </p>
          ) : itemsNeeded !== null && itemsNeeded > 0 ? (
            <p className="text-xs text-muted mt-0.5">
              Add{' '}
              <span className="font-semibold text-secondary">{itemsNeeded}</span>{' '}
              more item{itemsNeeded !== 1 ? 's' : ''} for{' '}
              <span className="font-semibold text-primary">{discountPct}% off!</span>
            </p>
          ) : null}
        </div>

        {isQualifying && (
          <span className="shrink-0 text-sm font-bold text-green-700 tabular-nums">
            −${discountAmt.toFixed(2)}
          </span>
        )}
      </div>

      {/* Suggestions — only shown when not yet qualifying */}
      {!isQualifying && suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-2">
            Complete your bundle with:
          </p>
          <ul className="space-y-1.5">
            {suggestions.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/products/${s.slug}`}
                  className="flex items-center justify-between gap-3 text-xs text-secondary hover:text-primary transition-colors group"
                >
                  <span className="line-clamp-1 flex-1">{s.name}</span>
                  <span className="flex items-center gap-0.5 shrink-0 font-medium tabular-nums">
                    ${s.price.toFixed(2)}
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
