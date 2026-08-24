'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ── Fee rates — fetched live from Platform Settings so this preview never
// drifts out of sync with what's actually charged (see fees.util.ts on the
// API side for the real calculation this mirrors). Defaults below only cover
// the brief window before the settings request resolves. ───────────────────

interface FeeRates {
  transactionFeeRate:        number;
  paymentProcessingFeeRate:  number;
  paymentProcessingFixedFee: number;
  listingFee:                number;
}

const DEFAULT_RATES: FeeRates = {
  transactionFeeRate:        0.065,
  paymentProcessingFeeRate:  0.05,
  paymentProcessingFixedFee: 0.25,
  listingFee:                0.20,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface EstimatedEarningsRowProps {
  basePrice:         number;
  compareAtPrice?:   number | null;
  /** When true, uses minVariantPrice/maxVariantPrice for the range */
  hasVariations?:    boolean;
  minVariantPrice?:  number;
  maxVariantPrice?:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcEarnings(price: number, rates: FeeRates): {
  platformFee: number;
  paymentFee:  number;
  listingFee:  number;
  net:         number;
} {
  const platformFee = price * rates.transactionFeeRate;
  const paymentFee  = price * rates.paymentProcessingFeeRate + rates.paymentProcessingFixedFee;
  const listingFee  = rates.listingFee;
  const net         = Math.max(0, price - platformFee - paymentFee - listingFee);
  return { platformFee, paymentFee, listingFee, net };
}

/**
 * Coerces before formatting, and never throws.
 *
 * This used to be `n.toFixed(decimals)` on a value typed `number`, and the
 * type was wrong: the platform-settings endpoint returned Prisma Decimals,
 * which serialise as strings. `"0.2".toFixed` is not a function, so opening
 * the fee breakdown threw and the error boundary replaced the whole product
 * editor with "Something went wrong".
 *
 * The real fix is at the API boundary (StoresService.toPlatformSettingsDto),
 * and the rates are coerced again below. This guard is the last resort: a
 * number formatter should never be able to take a page down, whatever it is
 * handed.
 */
function fmt(n: unknown, decimals = 2): string {
  const value = Number(n);
  return Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

/**
 * The four rates as real numbers, whatever the API sent.
 *
 * `settings ?? DEFAULT_RATES` alone was not enough: the defaults only apply
 * when the request has not resolved. Once it resolves with string values, the
 * component was doing `price * rate + fixedFee` — where the multiplication
 * coerces and the addition CONCATENATES — so the estimate read "$NaN".
 */
function toRates(settings: Partial<FeeRates> | undefined): FeeRates {
  if (!settings) return DEFAULT_RATES;
  const pick = (value: unknown, fallback: number) => {
    // null and '' are checked before Number(), because Number(null) is 0 and
    // Number('') is 0 — both finite, so a missing rate would sail past the
    // guard and be charged as 0%. That reads as MORE earnings than the seller
    // will actually receive, which is the wrong direction to be wrong in.
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    transactionFeeRate:        pick(settings.transactionFeeRate,        DEFAULT_RATES.transactionFeeRate),
    paymentProcessingFeeRate:  pick(settings.paymentProcessingFeeRate,  DEFAULT_RATES.paymentProcessingFeeRate),
    paymentProcessingFixedFee: pick(settings.paymentProcessingFixedFee, DEFAULT_RATES.paymentProcessingFixedFee),
    listingFee:                pick(settings.listingFee,                DEFAULT_RATES.listingFee),
  };
}

// ── Sub-component: fee row ────────────────────────────────────────────────────

function FeeRow({
  label, value, negative = false, bold = false,
}: {
  label:     string;
  value:     string;
  negative?: boolean;
  bold?:     boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={negative ? 'text-muted' : 'text-secondary'}>{label}</span>
      <span className={`tabular-nums ${negative ? 'text-muted' : bold ? 'text-green-700' : 'text-secondary'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EstimatedEarningsRow({
  basePrice,
  hasVariations,
  minVariantPrice,
  maxVariantPrice,
}: EstimatedEarningsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: settings } = useQuery({
    queryKey:  ['admin-platform-settings'],
    // Partial: this endpoint returns the whole PlatformSettings row, and
    // nothing guarantees these four fields arrive as numbers — toRates below
    // is what makes that safe.
    queryFn:   () => api.get<Partial<FeeRates>>(API_ROUTES.ADMIN.PLATFORM_SETTINGS),
    staleTime: 5 * 60_000,
  });
  const rates = toRates(settings);

  const price = Number(basePrice) || 0;

  // Determine price range (single price or variation spread). When prices vary
  // per option, basePrice is often 0/unset (the seller never touches it — see
  // PricingShippingTab, which hides that field entirely once any variation
  // group carries its own price) — gating visibility on basePrice alone would
  // hide a perfectly valid earnings range whenever that's the case.
  const minPrice = hasVariations ? (minVariantPrice ?? price) : price;
  const maxPrice = hasVariations ? (maxVariantPrice ?? price) : price;
  if (maxPrice <= 0) return null;

  const minEarnings = calcEarnings(minPrice, rates);
  const maxEarnings = calcEarnings(maxPrice, rates);

  // Earnings label: single value or range
  const earningsRange =
    minPrice === maxPrice
      ? `$${fmt(minEarnings.net)}`
      : `$${fmt(minEarnings.net)} to $${fmt(maxEarnings.net)}`;

  // Fee breakdown: basePrice normally, falling back to the min variant price
  // when basePrice itself is 0/unset (variant-priced listings).
  const breakdownPrice = price > 0 ? price : minPrice;
  const breakdown = calcEarnings(breakdownPrice, rates);

  return (
    <div className="mt-3">
      {/* Collapsed trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors"
      >
        <Lightbulb className="w-4 h-4 text-primary shrink-0" />
        <span>
          Estimated earnings:{' '}
          <strong className="text-secondary">{earningsRange}</strong>
        </span>
        {isExpanded
          ? <ChevronUp   className="w-3.5 h-3.5 text-muted shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />}
      </button>

      {/* Expanded breakdown */}
      {isExpanded && (
        <div className="mt-3 bg-[#F9FAFB] border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted mb-3">
            Based on a listing price of ${fmt(breakdownPrice)}
          </p>

          <FeeRow
            label="Listing price"
            value={`$${fmt(breakdownPrice)}`}
          />
          <FeeRow
            label={`Transaction fee (${fmt(rates.transactionFeeRate * 100, 1)}%)`}
            value={`−$${fmt(breakdown.platformFee)}`}
            negative
          />
          <FeeRow
            label={`Payment processing (${fmt(rates.paymentProcessingFeeRate * 100, 1)}% + $${fmt(rates.paymentProcessingFixedFee)})`}
            value={`−$${fmt(breakdown.paymentFee)}`}
            negative
          />
          <FeeRow
            label="Listing fee"
            value={`−$${fmt(breakdown.listingFee)}`}
            negative
          />

          <div className="border-t border-border pt-2">
            <FeeRow
              label="Estimated earnings"
              value={`$${fmt(breakdown.net)}`}
              bold
            />
          </div>

          {/* Variation range note */}
          {hasVariations && minPrice !== maxPrice && (
            <p className="text-xs text-muted pt-1">
              Range ${fmt(minEarnings.net)} – ${fmt(maxEarnings.net)} across your variant prices.
            </p>
          )}

          <p className="text-xs text-muted/70 pt-1">
            Actual earnings may vary based on promotions and refunds.
            Does not include shipping fees.
          </p>
        </div>
      )}
    </div>
  );
}
