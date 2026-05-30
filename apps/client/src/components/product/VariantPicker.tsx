'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { VariantDto } from '@mlh/types';

interface VariantPickerProps {
  variants:          VariantDto[];
  onVariantChange?:  (variant: VariantDto | null) => void;
}

type OptionKey = 'size' | 'color' | 'material';
const OPTION_LABELS: Record<OptionKey, string> = {
  size:     'Size',
  color:    'Color',
  material: 'Material',
};

function getDistinctValues(variants: VariantDto[], key: OptionKey): string[] {
  return [
    ...new Set(
      variants
        .filter((v) => v.isActive && v[key])
        .map((v) => v[key] as string),
    ),
  ];
}

function findMatchingVariant(
  variants:  VariantDto[],
  selected:  Partial<Record<OptionKey, string>>,
  optionKeys: OptionKey[],
): VariantDto | null {
  return (
    variants.find((v) => {
      return optionKeys.every((key) => {
        const sel = selected[key];
        if (!sel) return true;
        return v[key] === sel;
      });
    }) ?? null
  );
}

export function VariantPicker({ variants, onVariantChange }: VariantPickerProps) {
  const setVariantInStore = useCustomizerStore((s) => s.setVariant);

  // Determine which option types exist in this product's variants
  const optionKeys = (['size', 'color', 'material'] as OptionKey[]).filter(
    (k) => variants.some((v) => v[k]),
  );

  const [selected, setSelected] = useState<Partial<Record<OptionKey, string>>>({});

  const selectedVariant = useCallback(
    () => findMatchingVariant(variants, selected, optionKeys),
    [variants, selected, optionKeys],
  );

  // Sync selected variant to customizer store and parent callback
  useEffect(() => {
    const variant = selectedVariant();
    setVariantInStore(variant?.id ?? '');
    onVariantChange?.(variant);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (optionKeys.length === 0 || variants.length === 0) return null;

  const currentVariant = selectedVariant();

  return (
    <div className="space-y-4">
      {optionKeys.map((key) => {
        const values = getDistinctValues(variants, key);
        if (values.length === 0) return null;

        return (
          <div key={key}>
            <p className="text-sm font-semibold text-secondary mb-2">
              {OPTION_LABELS[key]}
              {selected[key] && (
                <span className="font-normal text-muted ml-2">— {selected[key]}</span>
              )}
            </p>

            <div className="flex flex-wrap gap-2" role="group" aria-label={`Select ${OPTION_LABELS[key]}`}>
              {values.map((val) => {
                const active = selected[key] === val;
                // Check if this option value is available given other selections
                const hypothetical = { ...selected, [key]: val };
                const isAvailable  = findMatchingVariant(variants, hypothetical, optionKeys)?.stock !== 0;

                return (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={active}
                    aria-disabled={!isAvailable}
                    disabled={!isAvailable}
                    onClick={() =>
                      setSelected((prev) => ({
                        ...prev,
                        [key]: active ? undefined : val,
                      }))
                    }
                    className={[
                      'px-4 py-2 rounded-button border text-sm font-medium transition-all',
                      active
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : isAvailable
                        ? 'border-border text-secondary hover:border-primary hover:text-primary'
                        : 'border-border text-muted opacity-40 cursor-not-allowed line-through',
                    ].join(' ')}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Show selected variant's stock warning */}
      {currentVariant && currentVariant.stock <= 3 && currentVariant.stock > 0 && (
        <p className="text-xs text-warning font-medium">
          ⚠️ Only {currentVariant.stock} left in stock
        </p>
      )}
      {currentVariant && currentVariant.stock === 0 && (
        <p className="text-xs text-error font-medium">Out of stock</p>
      )}

      {/* Variant price update */}
      {currentVariant?.price !== undefined &&
        currentVariant.price !== 0 && (
        <p className="text-sm font-semibold text-primary">
          This variant: ${currentVariant.price.toFixed(2)}
        </p>
      )}
    </div>
  );
}
