'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { CartItemDto } from '@ezihubb/types';
import { fmtAmount, safeNum } from '@ezihubb/utils';

interface CartItemRowProps {
  item:     CartItemDto;
  locale:   string;
  onUpdate: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
}

type CustData = Record<string, unknown>;

function getCustSummary(data: CustData | null | undefined): string | null {
  if (!data) return null;
  const fields = (data as { fields?: Record<string, { type: string; value: string }> }).fields;
  if (!fields) return null;

  const parts: string[] = [];
  Object.entries(fields).forEach(([key, field]) => {
    if ((field.type === 'text' || field.type === 'date') && field.value?.trim()) {
      const label = key
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .replace(/\b(text|field|input|value)\b/gi, '')
        .trim();
      if (label) parts.push(`${label}: ${field.value.trim()}`);
    }
    if (field.type === 'select' && field.value?.trim()) {
      parts.push(`Style: ${field.value}`);
    }
  });
  return parts.slice(0, 3).join(' · ') || null;
}

/** Bundle: extract per-item name summaries → "Item 1: John · Item 2: Sarah" */
function getBundleSummary(data: CustData | null | undefined): string[] | null {
  if (!data) return null;
  const d = data as {
    bundleCount?: number;
    items?: { fields: Record<string, { type: string; value: string }> }[];
  };
  if (!d.bundleCount || d.bundleCount <= 1 || !d.items) return null;

  return d.items.map((item, i) => {
    const nameEntry = Object.entries(item.fields ?? {}).find(([key]) =>
      key.toLowerCase().includes('name'),
    );
    const name = nameEntry?.[1]?.value?.trim() ?? `(empty)`;
    return `Item ${i + 1}: ${name}`;
  });
}

export function CartItemRow({ item, locale, onUpdate, onRemove }: CartItemRowProps) {
  const t = useTranslations('cart.item');
  const [localQty, setLocalQty] = useState(item.quantity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce API calls — 450 ms after last click
  const scheduleUpdate = (qty: number) => {
    const clamped = Math.min(99, Math.max(0, qty));
    setLocalQty(clamped);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (clamped === 0) onRemove(item.id);
      else               onUpdate(item.id, clamped);
    }, 450);
  };

  const thumbUrl      = item.previewUrl ?? item.productImageUrl;
  const lineTotal     = safeNum(item.currentPrice) * localQty;
  const bundleSummary = getBundleSummary(item.customizationData);
  const custSummary   = bundleSummary ? null : getCustSummary(item.customizationData);

  return (
    <li className="flex gap-4 py-5 border-b border-border last:border-0">
      {/* Thumbnail 80×80 */}
      <div className="relative w-20 h-20 shrink-0 rounded-sm overflow-hidden bg-background border border-border">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={item.productName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted/20" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/${locale}/products/${item.productSlug}`}
            className="text-sm font-semibold text-secondary hover:text-primary transition-colors line-clamp-2 leading-snug"
          >
            {item.productName}
          </Link>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={t('remove', { name: item.productName })}
            className="shrink-0 p-1 -mt-0.5 text-muted hover:text-error transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {item.variantName && (
          <p className="text-xs text-muted">{item.variantName}</p>
        )}
        {/* Single-item customization summary */}
        {custSummary && (
          <p className="text-xs text-muted italic line-clamp-2">{custSummary}</p>
        )}
        {/* Bundle customization summary — one line per item */}
        {bundleSummary && (
          <div className="space-y-0.5">
            {bundleSummary.map((line, i) => (
              <p key={i} className="text-xs text-muted italic">{line}</p>
            ))}
          </div>
        )}
        {item.priceChanged && (
          <p className="text-xs text-warning font-medium">
            {t('priceUpdatedTo', { amount: fmtAmount(item.currentPrice) })}
          </p>
        )}

        {/* Quantity + line total */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div
            className="inline-flex items-center border border-border rounded-button overflow-hidden"
            role="group"
            aria-label={t('quantityFor', { name: item.productName })}
          >
            <button
              type="button"
              onClick={() => scheduleUpdate(localQty - 1)}
              disabled={localQty <= 1}
              aria-label={t('decrease')}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/5 transition-colors disabled:opacity-40"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-secondary border-x border-border tabular-nums">
              {localQty}
            </span>
            <button
              type="button"
              onClick={() => scheduleUpdate(localQty + 1)}
              disabled={localQty >= 99}
              aria-label={t('increase')}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/5 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold text-secondary tabular-nums">
              {fmtAmount(lineTotal)}
            </p>
            {localQty > 1 && (
              <p className="text-xs text-muted tabular-nums">
                {t('each', { price: fmtAmount(item.currentPrice) })}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
