'use client';

import { useTranslations } from 'next-intl';

// ── Color map ─────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  White:     '#FFFFFF',
  Black:     '#1A1A1A',
  Natural:   '#D4B896',
  Navy:      '#1B2A6B',
  Red:       '#DC2626',
  Pink:      '#F9A8D4',
  Blue:      '#3B82F6',
  Green:     '#16A34A',
  Gray:      '#9CA3AF',
  Beige:     '#F5E6D0',
  Brown:     '#78350F',
  Purple:    '#7C3AED',
  Orange:    '#EA580C',
  Yellow:    '#EAB308',
  'Rose Gold': '#C2958A',
  Gold:      '#D4AF37',
  Silver:    '#C0C0C0',
  Clear:     '#E8F4F8',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ColorSwatchPickerProps {
  name:               string;
  values:             string[];
  selected:           string;
  onChange:           (value: string) => void;
  unavailableValues:  string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ColorSwatchPicker({
  name,
  values,
  selected,
  onChange,
  unavailableValues,
}: ColorSwatchPickerProps) {
  const t = useTranslations('product');

  return (
    <div>
      {/* Label row */}
      <p className="text-sm font-semibold text-secondary mb-3">
        {name}
        {selected && (
          <span className="font-normal text-muted ml-2">— {selected}</span>
        )}
      </p>

      <div
        className="flex flex-wrap gap-3"
        role="radiogroup"
        aria-label={t('variants.selectOption', { name })}
      >
        {values.map((val) => {
          const hex        = COLOR_MAP[val];
          const isActive   = selected === val;
          const isUnavail  = unavailableValues.includes(val);
          const isWhite    = val === 'White';

          // Unknown color → labeled pill fallback
          if (!hex) {
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
                  'relative px-4 py-2 rounded-button border text-sm font-medium transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive   ? 'bg-primary text-white border-primary shadow-sm'
                  : isUnavail ? 'border-border text-muted/40 cursor-not-allowed'
                  : 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer',
                ].join(' ')}
              >
                {isUnavail && !isActive && (
                  <span className="absolute inset-0 rounded-button overflow-hidden pointer-events-none" aria-hidden="true">
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1" className="text-border" />
                    </svg>
                  </span>
                )}
                <span className={isUnavail && !isActive ? 'line-through opacity-50' : ''}>{val}</span>
              </button>
            );
          }

          return (
            <div key={val} className="relative group">
              <button
                type="button"
                role="radio"
                aria-label={t('variants.colorLabel', { color: val })}
                aria-checked={isActive}
                aria-disabled={isUnavail}
                onClick={() => !isUnavail && onChange(isActive ? '' : val)}
                title={val}
                className={[
                  'relative w-8 h-8 rounded-full transition-all focus:outline-none',
                  'focus-visible:ring-2 focus-visible:ring-primary/40',
                  isUnavail ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                ].join(' ')}
                style={{
                  backgroundColor: hex,
                  border: isWhite ? '1px solid #D1D5DB' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: isActive
                    ? '0 0 0 2px white, 0 0 0 4px #E85D3F'
                    : undefined,
                }}
              >
                {/* Diagonal strikethrough for unavailable */}
                {isUnavail && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                    style={{
                      background: 'linear-gradient(to bottom right, transparent 45%, rgba(120,120,120,0.6) 45%, rgba(120,120,120,0.6) 55%, transparent 55%)',
                    }}
                  />
                )}
              </button>

              {/* Tooltip */}
              <span
                aria-hidden="true"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 text-xs font-medium text-white bg-secondary rounded-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
              >
                {val}
                {isUnavail && ` · ${t('variants.unavailable')}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
