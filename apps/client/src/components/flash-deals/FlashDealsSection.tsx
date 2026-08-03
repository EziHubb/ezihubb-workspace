'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Zap, ShoppingBag } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCountdown } from '../../hooks/useCountdown';
import { UrgencyBadge } from '../campaign/UrgencyBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlashDeal {
  id:            string;
  productId:     string;
  productSlug:   string;
  productName:   string;
  productImage:  string | null;
  originalPrice: number;
  discountPct:   number;
  endsAt:        string;
  stockLeft?:    number | null;
  soldOut?:      boolean;
}

// ── Section-level countdown (resets HH:MM:SS) ────────────────────────────────

function SectionCountdown({ endsAt }: { endsAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isUrgent = !expired && hours === 0;

  if (expired) {
    return <span className="text-xs font-bold text-error">Expired</span>;
  }

  const cells = [
    { val: pad(hours),   unit: 'h' },
    { val: pad(minutes), unit: 'm' },
    { val: pad(seconds), unit: 's' },
  ];

  return (
    <div className="flex items-center gap-1">
      {cells.map(({ val, unit }, i) => (
        <div key={i} className="flex items-center gap-0.5">
          <div
            className={[
              'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold tabular-nums',
              isUrgent
                ? 'bg-error text-white animate-pulse'
                : 'bg-secondary text-white',
            ].join(' ')}
          >
            {val}
          </div>
          <span className="text-[10px] text-muted font-medium">{unit}</span>
          {i < cells.length - 1 && (
            <span className="text-muted text-xs font-bold mx-0.5">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Per-card countdown (inline) ───────────────────────────────────────────────

function InlineCountdown({ endsAt }: { endsAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);
  if (expired) return <span className="text-xs text-error font-semibold">Ended</span>;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="text-xs tabular-nums font-bold text-error">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

// ── Deal card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, locale }: { deal: FlashDeal; locale: string }) {
  const dealPrice  = deal.originalPrice * (1 - deal.discountPct / 100);
  const { hours }  = useCountdown(deal.endsAt);
  const isUrgent   = hours === 0;
  const isSoldOut  = deal.soldOut === true || deal.stockLeft === 0;

  return (
    <article className={[
      'snap-start shrink-0 w-[200px] sm:w-[220px] border rounded-card overflow-hidden bg-surface flex flex-col transition-colors',
      isSoldOut ? 'border-border opacity-70' : 'border-border hover:border-primary/40',
    ].join(' ')}>
      {/* Product image */}
      <div className="relative w-full h-[160px] bg-muted/10">
        {deal.productImage ? (
          <Image
            src={deal.productImage}
            alt={deal.productName}
            fill
            sizes="220px"
            className={['object-cover', isSoldOut ? 'grayscale' : ''].join(' ')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-10 h-10 text-muted/30" />
          </div>
        )}

        {isSoldOut ? (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="bg-background border border-border text-secondary text-xs font-bold px-3 py-1 rounded-full">
              Sold out
            </span>
          </div>
        ) : (
          <>
            <div className="absolute top-2 left-2">
              <UrgencyBadge variant="flash" />
            </div>
            <div className="absolute top-2 right-2 bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
              -{deal.discountPct}%
            </div>
            {typeof deal.stockLeft === 'number' && deal.stockLeft > 0 && deal.stockLeft <= 5 && (
              <div className="absolute bottom-2 left-2">
                <UrgencyBadge variant="remaining" count={deal.stockLeft} />
              </div>
            )}
            {isUrgent && (
              <div className="absolute bottom-2 right-2">
                <UrgencyBadge variant="endstoday" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-medium text-secondary line-clamp-2 leading-snug">
          {deal.productName}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline gap-1.5">
          {isSoldOut ? (
            <span className="text-base font-bold text-muted line-through tabular-nums">
              ${dealPrice.toFixed(2)}
            </span>
          ) : (
            <>
              <span className="text-base font-bold text-primary tabular-nums">
                ${dealPrice.toFixed(2)}
              </span>
              <span className="text-xs text-muted line-through tabular-nums">
                ${deal.originalPrice.toFixed(2)}
              </span>
            </>
          )}
        </div>

        {/* Countdown or sold-out message */}
        {isSoldOut ? (
          <div className="flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs text-muted">Deal ended</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Ends in</span>
            <InlineCountdown endsAt={deal.endsAt} />
          </div>
        )}

        {/* CTA */}
        {isSoldOut ? (
          <button
            type="button"
            disabled
            className="mt-auto block w-full text-center bg-muted/10 text-muted font-semibold text-xs py-2 rounded-button uppercase tracking-wide cursor-not-allowed"
          >
            Sold Out
          </button>
        ) : (
          <Link
            href={`/${locale}/products/${deal.productSlug}`}
            className="mt-auto block w-full text-center bg-primary hover:bg-primary-dark text-white font-semibold text-xs py-2 rounded-button transition-colors uppercase tracking-wide"
          >
            Shop Now
          </Link>
        )}
      </div>
    </article>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface FlashDealsSectionProps {
  locale: string;
}

export function FlashDealsSection({ locale }: FlashDealsSectionProps) {
  const [deals, setDeals]     = useState<FlashDeal[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<FlashDeal[]>(API_ROUTES.FLASH_DEALS.ACTIVE)
      .then((data) => { if (!cancelled) setDeals(data ?? []); })
      .catch(() => { if (!cancelled) setDeals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Earliest expiry drives the section-level "resets in" timer
  const nearestExpiry = useMemo(() => {
    if (!deals?.length) return null;
    return deals.reduce((min, d) =>
      new Date(d.endsAt) < new Date(min) ? d.endsAt : min,
      deals[0].endsAt,
    );
  }, [deals]);

  if (loading || !deals || deals.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-[#FFF5F5]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-error" aria-hidden />
              <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary">
                Flash Deals
              </h2>
            </div>
            <p className="text-sm text-muted mt-1">
              Limited-time offers — grab them before they&apos;re gone!
            </p>
          </div>

          {/* Section-level countdown */}
          {nearestExpiry && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-muted uppercase tracking-widest font-semibold">
                Resets in
              </span>
              <SectionCountdown endsAt={nearestExpiry} />
            </div>
          )}
        </div>

        {/* Horizontal scroll list */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} locale={locale} />
          ))}
        </div>

        {/* See all link */}
        <div className="mt-5 text-right">
          <Link
            href={`/${locale}/flash-deals`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            See all deals →
          </Link>
        </div>
      </div>
    </section>
  );
}
