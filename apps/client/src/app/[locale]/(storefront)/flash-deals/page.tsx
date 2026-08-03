'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Zap } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCountdown } from '../../../../hooks/useCountdown';

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
}

// ── Countdown helpers ─────────────────────────────────────────────────────────

function InlineCountdown({ endsAt }: { endsAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (expired) return <span className="text-xs text-error font-semibold">Ended</span>;
  return (
    <span className="text-xs tabular-nums font-bold text-error">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

// ── Section-level reset timer ─────────────────────────────────────────────────
// Extracted as a component so useCountdown is always called at the top level.

function SectionResetTimer({ endsAt }: { endsAt: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isUrgent = !expired && hours === 0;

  if (expired) return <span className="text-xs font-bold text-error">Expired</span>;

  const cells = [
    { val: pad(hours),   unit: 'h' },
    { val: pad(minutes), unit: 'm' },
    { val: pad(seconds), unit: 's' },
  ];

  return (
    <div className="flex items-center gap-1">
      {cells.map(({ val, unit }, i) => (
        <div key={i} className="flex items-center gap-0.5">
          <div className={[
            'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold tabular-nums',
            isUrgent ? 'bg-error text-white animate-pulse' : 'bg-secondary text-white',
          ].join(' ')}>
            {val}
          </div>
          <span className="text-[10px] text-muted font-medium">{unit}</span>
          {i < cells.length - 1 && <span className="text-muted text-xs font-bold mx-0.5">:</span>}
        </div>
      ))}
    </div>
  );
}

// ── Deal card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, locale }: { deal: FlashDeal; locale: string }) {
  const dealPrice = deal.originalPrice * (1 - deal.discountPct / 100);
  const { hours }  = useCountdown(deal.endsAt);
  const isUrgent   = hours === 0;

  return (
    <article className="border border-border rounded-card overflow-hidden bg-surface hover:border-primary/40 hover:shadow-md transition-all flex flex-col">
      <div className="relative w-full aspect-square bg-muted/10">
        {deal.productImage ? (
          <Image src={deal.productImage} alt={deal.productName} fill sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,220px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-10 h-10 text-muted/30" />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
          -{deal.discountPct}%
        </div>
        {typeof deal.stockLeft === 'number' && deal.stockLeft > 0 && deal.stockLeft <= 5 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {deal.stockLeft} left
          </div>
        )}
        {isUrgent && (
          <div className="absolute bottom-2 right-2 bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            Ends today
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-medium text-secondary line-clamp-2 leading-snug">{deal.productName}</p>

        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-primary tabular-nums">${dealPrice.toFixed(2)}</span>
          <span className="text-xs text-muted line-through tabular-nums">${deal.originalPrice.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Ends in</span>
          <InlineCountdown endsAt={deal.endsAt} />
        </div>

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

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DealSkeleton() {
  return (
    <div className="border border-border rounded-card overflow-hidden bg-surface animate-pulse">
      <div className="aspect-square bg-muted/20" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted/20 rounded w-3/4" />
        <div className="h-4 bg-muted/20 rounded w-1/2" />
        <div className="h-8 bg-muted/20 rounded mt-2" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlashDealsPage() {
  const locale = useLocale();
  const [deals,   setDeals]   = useState<FlashDeal[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<FlashDeal[]>(API_ROUTES.FLASH_DEALS.ACTIVE)
      .then((data) => { if (!cancelled) setDeals(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setDeals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const nearestExpiry = useMemo(() => {
    if (!deals?.length) return null;
    return deals.reduce((min, d) =>
      new Date(d.endsAt) < new Date(min) ? d.endsAt : min,
      deals[0].endsAt,
    );
  }, [deals]);

  return (
    <div className="min-h-screen bg-[#FFF5F5]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-6 h-6 text-error" aria-hidden />
              <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary">Flash Deals</h1>
            </div>
            <p className="text-sm text-muted">
              Limited-time offers — grab them before they&apos;re gone!
            </p>
          </div>

          {nearestExpiry && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-muted uppercase tracking-widest font-semibold">Resets in</span>
              <SectionResetTimer endsAt={nearestExpiry} />
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <DealSkeleton key={i} />)}
          </div>
        ) : !deals || deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Zap className="w-12 h-12 text-muted/30" />
            <p className="text-secondary font-semibold">No active flash deals right now</p>
            <p className="text-sm text-muted">Check back soon — new deals drop every day!</p>
            <Link
              href={`/${locale}/search`}
              className="mt-2 px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-button hover:bg-primary-dark transition-colors"
            >
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
