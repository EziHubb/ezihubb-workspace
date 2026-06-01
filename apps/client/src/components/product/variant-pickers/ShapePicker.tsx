'use client';

import { useTranslations } from 'next-intl';

// ── Shape icon map ────────────────────────────────────────────────────────────

const SHAPE_ICONS: Record<string, React.ReactNode> = {
  Round: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="20" cy="20" r="17" />
    </svg>
  ),
  Heart: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 32 C8 24 4 16 4 12 C4 6 9 4 14 7 C17 8 19 10 20 12 C21 10 23 8 26 7 C31 4 36 6 36 12 C36 16 32 24 20 32Z" />
    </svg>
  ),
  Star: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="20,4 24,15 36,15 27,23 30,35 20,28 10,35 13,23 4,15 16,15" />
    </svg>
  ),
  Square: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="6" width="28" height="28" rx="2" />
    </svg>
  ),
  Rectangle: (
    <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="10" width="32" height="20" rx="2" />
    </svg>
  ),
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShapePickerProps {
  name:              string;
  values:            string[];
  selected:          string;
  onChange:          (value: string) => void;
  unavailableValues: string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShapePicker({
  name,
  values,
  selected,
  onChange,
  unavailableValues,
}: ShapePickerProps) {
  const t = useTranslations('product');

  return (
    <div>
      <p className="text-sm font-semibold text-secondary mb-3">
        {name}
        {selected && (
          <span className="font-normal text-muted ml-2">
            — {t('variants.shapeLabel', { shape: selected })}
          </span>
        )}
      </p>

      <div
        className="flex flex-wrap gap-3"
        role="radiogroup"
        aria-label={t('variants.selectOption', { name })}
      >
        {values.map((val) => {
          const icon      = SHAPE_ICONS[val];
          const isActive  = selected === val;
          const isUnavail = unavailableValues.includes(val);

          // No icon → pill fallback
          if (!icon) {
            return (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-disabled={isUnavail}
                onClick={() => !isUnavail && onChange(isActive ? '' : val)}
                className={[
                  'relative px-4 py-2 rounded-button border text-sm font-medium transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive   ? 'border-primary bg-primary/5 text-primary'
                  : isUnavail ? 'border-border text-muted/40 cursor-not-allowed line-through'
                  : 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer',
                ].join(' ')}
              >
                {val}
              </button>
            );
          }

          return (
            <button
              key={val}
              type="button"
              role="radio"
              aria-label={val}
              aria-checked={isActive}
              aria-disabled={isUnavail}
              onClick={() => !isUnavail && onChange(isActive ? '' : val)}
              className={[
                'relative flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive   ? 'border-primary bg-primary/5 text-primary'
                : isUnavail ? 'border-border bg-muted/10 text-muted/40 cursor-not-allowed'
                : 'border-border bg-white text-secondary hover:border-primary hover:text-primary cursor-pointer',
              ].join(' ')}
            >
              {/* Selected checkmark badge */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                >
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
              )}

              {/* SVG icon */}
              <span className={isUnavail ? 'opacity-40' : ''}>{icon}</span>

              {/* Label */}
              <span
                className={[
                  'text-[10px] font-medium mt-0.5 leading-none',
                  isUnavail ? 'line-through opacity-40' : '',
                ].join(' ')}
              >
                {val}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
