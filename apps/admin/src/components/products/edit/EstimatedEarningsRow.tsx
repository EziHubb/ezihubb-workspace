'use client';

import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

// ── Fee constants ─────────────────────────────────────────────────────────────

const PLATFORM_FEE_RATE = 0.065; // 6.5% transaction fee
const PAYMENT_FEE_RATE  = 0.03;  // 3% payment processing
const LISTING_FEE       = 0.20;  // $0.20 per listing renewal

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

function calcEarnings(price: number): {
  platformFee: number;
  paymentFee:  number;
  net:         number;
} {
  const platformFee = price * PLATFORM_FEE_RATE;
  const paymentFee  = price * PAYMENT_FEE_RATE;
  const net         = Math.max(0, price - platformFee - paymentFee - LISTING_FEE);
  return { platformFee, paymentFee, net };
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
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

  const price = Number(basePrice) || 0;
  if (price <= 0) return null;

  // Determine price range (single price or variation spread)
  const minPrice = hasVariations ? (minVariantPrice ?? price) : price;
  const maxPrice = hasVariations ? (maxVariantPrice ?? price) : price;

  const minEarnings = calcEarnings(minPrice);
  const maxEarnings = calcEarnings(maxPrice);

  // Earnings label: single value or range
  const earningsRange =
    minPrice === maxPrice
      ? `$${fmt(minEarnings.net)}`
      : `$${fmt(minEarnings.net)} to $${fmt(maxEarnings.net)}`;

  // Fee breakdown uses basePrice (most common price)
  const breakdown = calcEarnings(price);

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
            Based on a listing price of ${fmt(price)}
          </p>

          <FeeRow
            label="Listing price"
            value={`$${fmt(price)}`}
          />
          <FeeRow
            label={`Transaction fee (${fmt(PLATFORM_FEE_RATE * 100, 1)}%)`}
            value={`−$${fmt(breakdown.platformFee)}`}
            negative
          />
          <FeeRow
            label={`Payment processing (${fmt(PAYMENT_FEE_RATE * 100, 1)}%)`}
            value={`−$${fmt(breakdown.paymentFee)}`}
            negative
          />
          <FeeRow
            label="Listing fee"
            value={`−$${fmt(LISTING_FEE)}`}
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
            Actual earnings may vary based on promotions, refunds, and taxes.
            Does not include shipping fees.
          </p>
        </div>
      )}
    </div>
  );
}
