'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCartStore } from '../../lib/store/cart.store';
import type { ProductDto, CustomizationConfigDto } from '@mlh/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValue = { text?: string; selectValue?: string };
type ItemFields = Record<string, FieldValue>;
type AllItemFields = Record<number, ItemFields>;

interface BundleCustomizerPanelProps {
  product:     ProductDto;
  bundleCount: number;
  onCartSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "item_1_name" → { itemIndex: 0, baseId: 'name' } */
function parseFieldId(id: string): { itemIndex: number; baseId: string } | null {
  const m = id.match(/^item_(\d+)_(.+)$/);
  if (!m) return null;
  return { itemIndex: Number(m[1]) - 1, baseId: m[2] };
}

/** Get fields belonging to a specific item index */
function fieldsForItem(
  fields: CustomizationConfigDto['fields'],
  itemIndex: number,
): CustomizationConfigDto['fields'] {
  return fields.filter((f) => {
    const parsed = parseFieldId(f.id);
    return parsed?.itemIndex === itemIndex;
  });
}

/** Get the primary name field value for a tab label */
function getItemName(itemFields: ItemFields, itemIndex: number): string {
  const nameKey = `item_${itemIndex + 1}_name`;
  return itemFields[nameKey]?.text?.trim() ?? '';
}

/** Check if all required fields for a given item are filled */
function isItemComplete(
  fields: CustomizationConfigDto['fields'],
  itemFields: ItemFields,
  itemIndex: number,
): boolean {
  const requiredFields = fieldsForItem(fields, itemIndex).filter((f) => f.required);
  return requiredFields.every((f) => {
    const val = itemFields[f.id];
    if (f.type === 'text' || f.type === 'textarea') return Boolean(val?.text?.trim());
    if (f.type === 'select') return Boolean(val?.selectValue?.trim());
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BundleCustomizerPanel({
  product,
  bundleCount,
  onCartSuccess,
}: BundleCustomizerPanelProps) {
  const t           = useTranslations('customizer');
  const { addItem } = useCartStore();
  const openDrawer  = useCartStore((s) => s.openDrawer);

  const [activeItem,  setActiveItem]  = useState(0);
  const [allFields,   setAllFields]   = useState<AllItemFields>({});
  const [isAdding,    setIsAdding]    = useState(false);
  const [addError,    setAddError]    = useState('');

  const config = product.customization as CustomizationConfigDto | null;
  if (!config) return null;

  const setFieldValue = useCallback(
    (fieldId: string, value: Partial<FieldValue>) => {
      const parsed = parseFieldId(fieldId);
      const idx = parsed?.itemIndex ?? activeItem;
      setAllFields((prev) => ({
        ...prev,
        [idx]: {
          ...(prev[idx] ?? {}),
          [fieldId]: { ...(prev[idx]?.[fieldId] ?? {}), ...value },
        },
      }));
    },
    [activeItem],
  );

  const items = Array.from({ length: bundleCount }, (_, i) => i);
  const allComplete = items.every((i) =>
    isItemComplete(config.fields, allFields[i] ?? {}, i),
  );

  const handleAddToCart = async () => {
    if (!allComplete) return;
    setIsAdding(true);
    setAddError('');
    try {
      const customizationData = {
        bundleCount,
        items: items.map((i) => ({
          fields: Object.entries(allFields[i] ?? {}).reduce<Record<string, unknown>>(
            (acc, [fId, fVal]) => {
              const field = config.fields.find((f) => f.id === fId);
              if (!field) return acc;
              if (field.type === 'text' || field.type === 'textarea') {
                acc[fId] = { type: field.type, value: fVal.text ?? '' };
              } else if (field.type === 'select') {
                acc[fId] = { type: 'select', value: fVal.selectValue ?? '' };
              }
              return acc;
            },
            {},
          ),
        })),
      };

      await addItem({
        productId:         product.id,
        variantId:         null,
        quantity:          1,
        customizationData,
      });
      openDrawer();
      onCartSuccess();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  const activeFields = fieldsForItem(config.fields, activeItem);
  const activeItemFields = allFields[activeItem] ?? {};

  return (
    <div className="border-2 border-primary/20 rounded-card bg-primary/5 p-5 space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-secondary text-base mb-1">
          🎁 Personalize Your Set
        </h3>
        <p className="text-xs text-muted">
          Customize each item in the set individually
        </p>
      </div>

      {/* ── Item tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-primary/15 pb-3">
        {items.map((i) => {
          const name       = getItemName(allFields[i] ?? {}, i);
          const complete   = isItemComplete(config.fields, allFields[i] ?? {}, i);
          const hasFields  = (allFields[i] ?? {}) && Object.keys(allFields[i] ?? {}).length > 0;
          const isActive   = activeItem === i;

          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveItem(i)}
              title={complete ? t('bundle.complete') : t('bundle.incomplete')}
              className={[
                'relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-button border transition-all flex-1',
                isActive
                  ? 'border-primary bg-primary/8 text-primary font-bold'
                  : 'border-border text-muted hover:border-primary/40 hover:text-secondary',
              ].join(' ')}
            >
              {/* Status indicator */}
              {complete ? (
                <span className="text-success text-xs">✓</span>
              ) : hasFields ? (
                <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
              ) : null}

              <span className="truncate">
                {name
                  ? `${t('bundle.itemTab', { n: i + 1 })} for ${name}`
                  : t('bundle.itemTab', { n: i + 1 })}
              </span>

              {/* Active underline */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active item fields ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {activeFields.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            No fields for this item.
          </p>
        ) : (
          activeFields.map((field) => {
            const val = activeItemFields[field.id] ?? {};

            return (
              <div key={field.id}>
                <label className="text-xs font-semibold text-secondary mb-1.5 block">
                  {field.label}
                  {field.required && (
                    <span className="text-error ml-1">*</span>
                  )}
                </label>

                {(field.type === 'text' || field.type === 'textarea') && (
                  <input
                    type="text"
                    value={val.text ?? ''}
                    maxLength={field.maxLength}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    onChange={(e) =>
                      setFieldValue(field.id, { text: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-button bg-white text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                )}

                {field.type === 'select' && field.options && (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setFieldValue(field.id, { selectValue: opt })
                        }
                        className={[
                          'px-3 py-1.5 text-sm rounded-button border transition-colors',
                          val.selectValue === opt
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border text-secondary hover:border-primary',
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {field.maxLength && field.type === 'text' && (
                  <p className="text-[10px] text-muted mt-0.5 text-right">
                    {(val.text ?? '').length}/{field.maxLength}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Progress across items ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-muted py-1 border-t border-primary/15 pt-3">
        {items.map((i) => {
          const complete = isItemComplete(config.fields, allFields[i] ?? {}, i);
          return (
            <span
              key={i}
              className={complete ? 'text-success font-medium' : 'text-muted'}
            >
              {complete ? '✓' : '○'} Item {i + 1}
            </span>
          );
        })}
        <span className="ml-auto">
          {items.filter((i) => isItemComplete(config.fields, allFields[i] ?? {}, i)).length}
          /{bundleCount} complete
        </span>
      </div>

      {/* ── Price note ────────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted text-center">
        💰 {t('bundle.priceNote')} — ${product.basePrice.toFixed(2)}
      </p>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {addError && (
        <p className="text-xs text-error text-center" role="alert">{addError}</p>
      )}

      {/* ── Add to Cart ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!allComplete || isAdding}
        className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
      >
        {isAdding
          ? 'Adding to Cart…'
          : allComplete
          ? `Add Set to Cart — $${product.basePrice.toFixed(2)}`
          : `Personalize all ${bundleCount} items to continue`}
      </button>

      {/* ── Trust strip ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 border-t border-primary/10 text-xs text-muted">
        <span>🚚 Ships in 3–5 days</span>
        <span>✅ Cancel within 2h</span>
        <span>🔒 Secure checkout</span>
      </div>
    </div>
  );
}
