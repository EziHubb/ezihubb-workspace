'use client';

import { useTranslations } from 'next-intl';

// ── Product types that benefit from a size guide link ─────────────────────────

const SIZE_GUIDE_TYPES = new Set<ProductType>(['apparel', 'canvas', 'drinkware']);

type ProductType = 'apparel' | 'canvas' | 'drinkware' | 'other';

// ── Format display value by product type ──────────────────────────────────────

function formatSizeValue(value: string, productType: ProductType): string {
  if (productType === 'canvas') {
    // "12x16" → "12×16""
    return value.replace(/(\d+)x(\d+)/i, '$1×$2"');
  }
  return value;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SizePickerProps {
  name:               string;
  values:             string[];
  selected:           string;
  onChange:           (value: string) => void;
  unavailableValues:  string[];
  productType:        ProductType;
  onSizeGuideClick?:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SizePicker({
  name,
  values,
  selected,
  onChange,
  unavailableValues,
  productType,
  onSizeGuideClick,
}: SizePickerProps) {
  const t = useTranslations('product');

  const isApparel       = productType === 'apparel';
  const showSizeGuide   = Boolean(onSizeGuideClick) && SIZE_GUIDE_TYPES.has(productType);

  return (
    <div>
      {/* Label row with optional size guide link */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-secondary">
          {name}
          {selected && (
            <span className="font-normal text-muted ml-2">
              — {formatSizeValue(selected, productType)}
            </span>
          )}
        </p>

        {showSizeGuide && (
          <button
            type="button"
            onClick={onSizeGuideClick}
            className="text-xs text-primary hover:underline underline-offset-2 font-medium flex items-center gap-0.5"
          >
            {t('variants.sizeGuide')}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={t('variants.selectOption', { name })}
      >
        {values.map((val) => {
          const isActive  = selected === val;
          const isUnavail = unavailableValues.includes(val);
          const display   = formatSizeValue(val, productType);

          return (
            <button
              key={val}
              type="button"
              role="radio"
              aria-label={display}
              aria-checked={isActive}
              aria-disabled={isUnavail}
              onClick={() => !isUnavail && onChange(isActive ? '' : val)}
              className={[
                'relative border rounded-button text-sm transition-all select-none',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isApparel ? 'min-w-[40px] h-10 px-3 font-bold' : 'px-4 py-2 font-medium',
                isActive   ? 'border-primary bg-primary/5 text-primary shadow-sm'
                : isUnavail ? 'border-border text-muted/40 cursor-not-allowed'
                : 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer',
              ].join(' ')}
            >
              {/* Diagonal strike for unavailable */}
              {isUnavail && !isActive && (
                <span
                  className="absolute inset-0 rounded-button overflow-hidden pointer-events-none"
                  aria-hidden="true"
                >
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <line
                      x1="0" y1="0" x2="100%" y2="100%"
                      stroke="currentColor" strokeWidth="1"
                      className="text-border"
                    />
                  </svg>
                </span>
              )}
              <span className={isUnavail && !isActive ? 'line-through opacity-50' : ''}>
                {display}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
