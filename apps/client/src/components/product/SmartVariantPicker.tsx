'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { useModal } from '../../lib/hooks/useModal';
import type { ProductVariantDto } from '@ezihubb/types';
import {
  ColorSwatchPicker,
  ShapePicker,
  DeviceModelPicker,
  SizePicker,
} from './variant-pickers';
import { SizeGuideModal } from './SizeGuideModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type VariantWidget = 'color-swatch' | 'shape-picker' | 'device-model' | 'size-picker' | 'pill';

type ProductType = 'apparel' | 'canvas' | 'drinkware' | 'other';

export interface SmartVariantPickerProps {
  variantOptions:  { name: string; values: string[] }[];
  variants:        ProductVariantDto[];
  primaryCategory?: { slug: string } | null;
  onVariantChange: (variant: ProductVariantDto | null) => void;
  /** Optional custom size guide HTML from MongoDB ProductDetail.sizeGuide */
  sizeGuide?:      string;
}

// ── Widget detection ──────────────────────────────────────────────────────────

const OPTION_WIDGET_MAP: Record<string, VariantWidget> = {
  Color:    'color-swatch',
  Colour:   'color-swatch',
  Shape:    'shape-picker',
  Model:    'device-model',
  Device:   'device-model',
  Size:     'size-picker',
  Capacity: 'size-picker',
};

function detectWidget(optionName: string): VariantWidget {
  return OPTION_WIDGET_MAP[optionName] ?? 'pill';
}

// ── Product type detection ────────────────────────────────────────────────────

function getProductType(categorySlug: string): ProductType {
  if (['classic-tees', 'hoodies', 'sweatshirts', 'onesies', 'kids-t-shirts',
       'v-neck-tees', 'long-sleeve-shirts', 'tank-tops', 'zip-hoodies',
       'bomber-jackets'].includes(categorySlug))
    return 'apparel';
  if (['canvas', 'posters-canvas', 'wood-acrylic-art'].includes(categorySlug))
    return 'canvas';
  if (['coffee-mugs', 'photo-mugs', 'travel-mugs', 'enamel-mugs', 'tumblers',
       'stainless-steel-tumblers', 'glass-tumblers', 'sports-bottles',
       'wine-glasses', 'beer-glasses'].includes(categorySlug))
    return 'drinkware';
  return 'other';
}

// ── Availability helpers ──────────────────────────────────────────────────────

function isValueAvailable(
  variants:    ProductVariantDto[],
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

function findVariant(
  variants:    ProductVariantDto[],
  selected:    Record<string, string>,
  dimNames:    string[],
): ProductVariantDto | null {
  if (dimNames.length === 0) return null;
  if (!dimNames.every((n) => selected[n])) return null;
  return (
    variants.find((v) => dimNames.every((n) => v.options[n] === selected[n])) ?? null
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SmartVariantPicker({
  variantOptions,
  variants,
  primaryCategory,
  onVariantChange,
  sizeGuide,
}: SmartVariantPickerProps) {
  const t               = useTranslations('product');
  const setVariantInStore = useCustomizerStore((s) => s.setVariant);
  const sizeGuideModal  = useModal();

  const dimNames = variantOptions.map((o) => o.name);

  // Auto-select default variant on mount
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  const [selected, setSelected] = useState<Record<string, string>>(
    defaultVariant?.options ?? {},
  );

  const getVariant = useCallback(
    () => findVariant(variants, selected, dimNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variants, selected, JSON.stringify(dimNames)],
  );

  useEffect(() => {
    const v = getVariant();
    setVariantInStore(v?.sku ?? '');
    onVariantChange(v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (variantOptions.length === 0 || variants.length === 0) return null;

  const activeVariant = getVariant();
  const isOutOfStock  = activeVariant?.isAvailable === false;
  const productType   = getProductType(primaryCategory?.slug ?? '');

  const handleChange = (dimName: string, val: string) => {
    setSelected((prev) => ({ ...prev, [dimName]: val }));
  };

  return (
    <div className="space-y-5">
      {variantOptions.map((opt) => {
        const widget       = detectWidget(opt.name);
        const currentVal   = selected[opt.name] ?? '';
        const unavailable  = opt.values.filter(
          (v) => !isValueAvailable(variants, selected, opt.name, v, dimNames),
        );

        if (widget === 'color-swatch') {
          return (
            <ColorSwatchPicker
              key={opt.name}
              name={opt.name}
              values={opt.values}
              selected={currentVal}
              onChange={(val) => handleChange(opt.name, val)}
              unavailableValues={unavailable}
            />
          );
        }

        if (widget === 'shape-picker') {
          return (
            <ShapePicker
              key={opt.name}
              name={opt.name}
              values={opt.values}
              selected={currentVal}
              onChange={(val) => handleChange(opt.name, val)}
              unavailableValues={unavailable}
            />
          );
        }

        if (widget === 'device-model') {
          return (
            <DeviceModelPicker
              key={opt.name}
              name={opt.name}
              values={opt.values}
              selected={currentVal}
              onChange={(val) => handleChange(opt.name, val)}
            />
          );
        }

        if (widget === 'size-picker') {
          return (
            <SizePicker
              key={opt.name}
              name={opt.name}
              values={opt.values}
              selected={currentVal}
              onChange={(val) => handleChange(opt.name, val)}
              unavailableValues={unavailable}
              productType={productType}
              onSizeGuideClick={
                productType !== 'other' ? sizeGuideModal.open : undefined
              }
            />
          );
        }

        // ── Generic pill fallback ─────────────────────────────────────────────
        return (
          <div key={opt.name}>
            <p className="text-sm font-semibold text-secondary mb-3">
              {opt.name}
              {currentVal && (
                <span className="font-normal text-muted ml-2">— {currentVal}</span>
              )}
            </p>

            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={t('variants.selectOption', { name: opt.name })}
            >
              {opt.values.map((val) => {
                const isActive  = currentVal === val;
                const isUnavail = unavailable.includes(val);

                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-disabled={isUnavail}
                    onClick={() => !isUnavail && handleChange(opt.name, isActive ? '' : val)}
                    className={[
                      'relative px-4 py-2 rounded-button border text-sm font-medium transition-all select-none',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      isActive   ? 'bg-primary text-white border-primary shadow-sm'
                      : isUnavail ? 'border-border text-muted/50 cursor-not-allowed'
                      : 'border-border text-secondary hover:border-primary hover:text-primary cursor-pointer',
                    ].join(' ')}
                  >
                    {!isAvail(variants, selected, opt.name, val, dimNames) && !isActive && (
                      <span
                        className="absolute inset-0 rounded-button overflow-hidden pointer-events-none"
                        aria-hidden="true"
                      >
                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1" className="text-border" />
                        </svg>
                      </span>
                    )}
                    <span className={isUnavail && !isActive ? 'opacity-50 line-through' : ''}>
                      {val}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Price feedback */}
      {activeVariant && (
        <div>
          {isOutOfStock ? (
            <p className="text-sm font-medium text-error">✗ {t('variants.outOfStock')}</p>
          ) : (activeVariant.compareAtPrice ?? 0) > activeVariant.price ? (
            <p className="flex items-baseline gap-2 text-sm">
              <span className="font-bold text-primary">${activeVariant.price.toFixed(2)}</span>
              <span className="line-through text-muted text-xs">
                ${activeVariant.compareAtPrice!.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-success">
                Save ${(activeVariant.compareAtPrice! - activeVariant.price).toFixed(2)}
              </span>
            </p>
          ) : activeVariant.price > 0 ? (
            <p className="text-sm font-semibold text-primary">${activeVariant.price.toFixed(2)}</p>
          ) : null}
        </div>
      )}
      {/* Size guide modal — managed internally */}
      <SizeGuideModal
        isOpen={sizeGuideModal.isOpen}
        onClose={sizeGuideModal.close}
        productType={productType}
        customSizeGuide={sizeGuide}
      />
    </div>
  );
}

// Alias for use inside the generic pill fallback above
const isAvail = isValueAvailable;
