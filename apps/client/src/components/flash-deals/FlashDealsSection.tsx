'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useCountdown } from '../../hooks/useCountdown';

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
}

// ── Countdown cell ────────────────────────────────────────────────────────────

function Countdown({ endsAt }: { endsAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);

  if (expired) {
    return <span className="text-xs text-error font-semibold">Ended</span>;
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="text-xs tabular-nums font-bold text-error">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

// ── Deal card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, locale }: { deal: FlashDeal; locale: string }) {
  const dealPrice = deal.originalPrice * (1 - deal.discountPct / 100);

  return (
    <article className="snap-start shrink-0 w-[200px] sm:w-[220px] border border-border rounded-card overflow-hidden bg-surface hover:border-primary/40 transition-colors flex flex-col">
      {/* Product image */}
      <div className="relative w-full h-[160px] bg-muted/10">
        {deal.productImage ? (
          <Image
            src={deal.productImage}
            alt={deal.productName}
            fill
            sizes="220px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-10 h-10 text-muted/30" />
          </div>
        )}
        {/* Discount badge */}
        <div className="absolute top-2 left-2 bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
          -{deal.discountPct}%
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-medium text-secondary line-clamp-2 leading-snug">
          {deal.productName}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-primary tabular-nums">
            ${dealPrice.toFixed(2)}
          </span>
          <span className="text-xs text-muted line-through tabular-nums">
            ${deal.originalPrice.toFixed(2)}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Ends in</span>
          <Countdown endsAt={deal.endsAt} />
        </div>

        {/* CTA */}
        <Link
          href={`/${locale}/products/${deal.productSlug}`}
          className="mt-auto block w-full text-center bg-primary hover:bg-primary-dark text-white font-semibold text-xs py-2 rounded-button transition-colors uppercase tracking-wide"
        >
          Shop Now
        </Link>
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
      .then((data) => {
        if (!cancelled) setDeals(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDeals([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Don't render the section at all while loading or if there are no deals
  if (loading || !deals || deals.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-error" aria-hidden />
              <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary">
                Flash Deals
              </h2>
            </div>
            <p className="text-sm text-muted mt-1">Limited time offers — grab them before they&apos;re gone!</p>
          </div>
        </div>

        {/* Horizontal scroll list */}
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
