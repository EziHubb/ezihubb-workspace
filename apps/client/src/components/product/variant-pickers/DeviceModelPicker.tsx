'use client';

import { useTranslations } from 'next-intl';

// ── Brand detection ───────────────────────────────────────────────────────────

type DeviceBrand = 'apple' | 'samsung' | 'google' | 'other';

function getDeviceBrand(model: string): DeviceBrand {
  if (model.includes('iPhone') || model.includes('iPad') || model.includes('AirPod'))
    return 'apple';
  if (model.includes('Samsung') || model.includes('Galaxy'))
    return 'samsung';
  if (model.includes('Pixel'))
    return 'google';
  return 'other';
}

const BRAND_LABELS: Record<DeviceBrand, string> = {
  apple:   'Apple',
  samsung: 'Samsung',
  google:  'Google',
  other:   'Other',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DeviceModelPickerProps {
  name:     string;
  values:   string[];
  selected: string;
  onChange: (value: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeviceModelPicker({
  name,
  values,
  selected,
  onChange,
}: DeviceModelPickerProps) {
  const t = useTranslations('product');

  // Group by brand
  const groups = new Map<DeviceBrand, string[]>();
  for (const val of values) {
    const brand = getDeviceBrand(val);
    if (!groups.has(brand)) groups.set(brand, []);
    groups.get(brand)!.push(val);
  }

  const brandOrder: DeviceBrand[] = ['apple', 'samsung', 'google', 'other'];
  const orderedGroups = brandOrder
    .filter((b) => groups.has(b))
    .map((b) => ({ brand: b, models: groups.get(b)! }));

  const showBrandLabels = orderedGroups.length > 1;

  return (
    <div>
      <p className="text-sm font-semibold text-secondary mb-3">
        {name}
        {selected && (
          <span className="font-normal text-muted ml-2">
            — {t('variants.modelLabel', { model: selected })}
          </span>
        )}
      </p>

      <div className="space-y-3">
        {orderedGroups.map(({ brand, models }) => (
          <div key={brand}>
            {showBrandLabels && (
              <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                {BRAND_LABELS[brand]}
              </p>
            )}

            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={`${BRAND_LABELS[brand]} ${t('variants.selectOption', { name })}`}
            >
              {models.map((model) => {
                const isActive = selected === model;
                return (
                  <button
                    key={model}
                    type="button"
                    role="radio"
                    aria-label={t('variants.modelLabel', { model })}
                    aria-checked={isActive}
                    onClick={() => onChange(isActive ? '' : model)}
                    className={[
                      'px-3 py-1.5 rounded-button border text-xs font-medium transition-all',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      isActive
                        ? 'border-primary text-primary bg-primary/5 shadow-sm'
                        : 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer',
                    ].join(' ')}
                  >
                    {model}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
