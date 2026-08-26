'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { fmtAmount, safeNum } from '@ezihubb/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlexVariant {
  sku:             string;
  options:         Record<string, string>;
  price:           number;
  compareAtPrice?: number;
  isDefault?:      boolean;
  /** undefined = available by default; false = explicitly unavailable */
  isAvailable?:    boolean;
}

export interface VariantOption {
  name:   string;
  values: string[];
}

export type SelectedVariant = FlexVariant;

interface VariantPickerProps {
  variantOptions:   VariantOption[];
  variants:         FlexVariant[];
  onVariantChange?: (variant: SelectedVariant | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findVariant(
  variants:    FlexVariant[],
  selected:    Record<string, string>,
  dimNames:    string[],
): FlexVariant | null {
  if (dimNames.length === 0) return null;
  if (!dimNames.every((n) => selected[n])) return null;
  return variants.find((v) => dimNames.every((n) => v.options[n] === selected[n])) ?? null;
}

/** Is at least one variant with this dimension value available? */
function isValueAvailable(
  variants:    FlexVariant[],
  selected:    Record<string, string>,
  dimName:     string,
  dimValue:    string,
  allDimNames: string[],
): boolean {
  const hypo = { ...selected, [dimName]: dimValue };
  return variants.some((v) => {
    if (v.options[dimName] !== dimValue) return false;
    for (const n of allDimNames) {
      if (n === dimName) continue;
      if (hypo[n] && v.options[n] !== hypo[n]) return false;
    }
    return v.isAvailable !== false;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VariantPicker({ variantOptions, variants, onVariantChange }: VariantPickerProps) {
  const t = useTranslations('product.variants');
  const setVariantInStore = useCustomizerStore((s) => s.setVariant);
  const dimNames          = variantOptions.map((o) => o.name);

  // Auto-select the default variant on mount
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  const [selected, setSelected] = useState<Record<string, string>>(defaultVariant?.options ?? {});

  const getVariant = useCallback(
    () => findVariant(variants, selected, dimNames),
    [variants, selected, dimNames],
  );

  useEffect(() => {
    const v = getVariant();
    setVariantInStore(v?.sku ?? '');
    onVariantChange?.(v ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (variantOptions.length === 0 || variants.length === 0) return null;

  const activeVariant = getVariant();
  const isOutOfStock  = activeVariant?.isAvailable === false;

  return (
    <div className="space-y-4">
      {variantOptions.map((opt) => (
        <div key={opt.name}>
          <p className="text-sm font-semibold text-secondary mb-2">
            {opt.name}
            {selected[opt.name] && (
              <span className="font-normal text-muted ml-2">— {selected[opt.name]}</span>
            )}
          </p>

          <div className="flex flex-wrap gap-2" role="group" aria-label={t('selectOption', { name: opt.name })}>
            {opt.values.map((val) => {
              const isActive = selected[opt.name] === val;
              const isAvail  = isValueAvailable(variants, selected, opt.name, val, dimNames);

              return (
                <button
                  key={val}
                  type="button"
                  aria-pressed={isActive}
                  title={!isAvail ? t('notAvailableInCombination') : undefined}
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [opt.name]: isActive ? '' : val }))
                  }
                  className={[
                    'relative px-4 py-2 rounded-button border text-sm font-medium transition-all select-none',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : isAvail
                      ? 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer'
                      : 'border-border text-muted/50 cursor-default',
                  ].join(' ')}
                >
                  {/* Diagonal strike for unavailable */}
                  {!isAvail && !isActive && (
                    <span className="absolute inset-0 rounded-button overflow-hidden pointer-events-none" aria-hidden="true">
                      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1" className="text-border" />
                      </svg>
                    </span>
                  )}
                  <span className={!isAvail && !isActive ? 'opacity-50 line-through' : ''}>{val}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Feedback */}
      {activeVariant && (
        <div>
          {isOutOfStock ? (
            <p className="text-sm font-medium text-error">✗ {t('outOfStock')}</p>
          ) : (activeVariant.compareAtPrice ?? 0) > activeVariant.price ? (
            <p className="flex items-baseline gap-2 text-sm">
              <span className="font-bold text-badge-sale">{fmtAmount(activeVariant.price)}</span>
              <span className="line-through text-muted text-xs">{fmtAmount(activeVariant.compareAtPrice)}</span>
              {/* Muted, like the percent beside every other sale price. Green
                  here fought with the red price on the same line. */}
              <span className="text-xs text-muted">
                {t('save', { amount: fmtAmount(safeNum(activeVariant.compareAtPrice) - safeNum(activeVariant.price)) })}
              </span>
            </p>
          ) : activeVariant.price > 0 ? (
            <p className="text-sm font-semibold text-primary">{fmtAmount(activeVariant.price)}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
