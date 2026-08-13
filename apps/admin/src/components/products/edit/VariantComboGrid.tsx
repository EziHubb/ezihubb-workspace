'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { computeCombos, comboKey } from './helpers';
import { Toggle } from './primitives/Toggle';
import { InlinePriceInput } from './primitives/InlinePriceInput';
import type { VariationGroup, ProductVariantRow, VariantEditPatch } from './types';

// ─── Row shape (combo + whatever's currently set, edit applied on top) ────────

interface ComboRow {
  key:         string;
  name:        string;
  options:     Record<string, string>;
  price:       number | null;
  quantity:    number | null;
  sku:         string | null;
  isAvailable: boolean;
}

function buildRows(
  groups:  VariationGroup[],
  variants: ProductVariantRow[],
  edits:   Record<string, VariantEditPatch>,
): ComboRow[] {
  const combos = computeCombos(groups);
  const variantByKey = new Map(
    variants.filter((v) => v.isAvailable).map((v) => [comboKey(v.options), v]),
  );

  return combos.map((combo) => {
    const existing = variantByKey.get(combo.key);
    const edit = edits[combo.key];
    return {
      key:         combo.key,
      name:        combo.name,
      options:     combo.options,
      price:       edit && 'price' in edit ? edit.price ?? null : existing?.price ?? null,
      quantity:    edit && 'quantity' in edit ? edit.quantity ?? null : existing?.quantity ?? null,
      sku:         edit && 'sku' in edit ? edit.sku ?? null : existing?.sku ?? null,
      isAvailable: edit?.isAvailable ?? existing?.isAvailable ?? true,
    };
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

interface VariantComboGridProps {
  groups:        VariationGroup[];
  variesBy:      string[];
  variants:      ProductVariantRow[];
  edits:         Record<string, VariantEditPatch>;
  onEditsChange: (edits: Record<string, VariantEditPatch>) => void;
}

export function VariantComboGrid({ groups, variesBy, variants, edits, onEditsChange }: VariantComboGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');

  const groupNames = groups.map((g) => g.name);
  const showQuantity = variesBy.includes('quantity');
  const showSku = variesBy.includes('sku');

  const rows = useMemo(() => buildRows(groups, variants, edits), [groups, variants, edits]);

  const patchRow = (key: string, options: Record<string, string>, patch: Partial<Omit<VariantEditPatch, 'options'>>) => {
    onEditsChange({
      ...edits,
      [key]: { ...edits[key], ...patch, options },
    });
  };

  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  const toggleSelected = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.key)));
  };

  const applyBulkPrice = () => {
    if (bulkPrice.trim() === '' || selected.size === 0) return;
    const price = Number(bulkPrice);
    if (Number.isNaN(price)) return;
    const next = { ...edits };
    for (const row of rows) {
      if (!selected.has(row.key)) continue;
      next[row.key] = { ...next[row.key], price, options: row.options };
    }
    onEditsChange(next);
    setBulkPrice('');
    setSelected(new Set());
  };

  if (rows.length === 0) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Bulk-edit toolbar — only when ≥1 row selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-border">
          <span className="text-xs font-semibold text-primary">{selected.size} selected</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="Set price"
              className="pl-6 pr-2 py-1.5 text-sm border border-border rounded-button bg-background w-28 focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
            />
          </div>
          <button
            type="button"
            onClick={applyBulkPrice}
            disabled={bulkPrice.trim() === ''}
            className="px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary-dark text-white rounded-button disabled:opacity-40 transition-colors"
          >
            Apply to {selected.size}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted hover:text-secondary transition-colors ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/3">
              <th className="w-10 px-4 py-2.5">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                  className={[
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    allSelected ? 'bg-primary border-primary' : 'border-muted hover:border-primary/50',
                  ].join(' ')}
                >
                  {allSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </button>
              </th>
              {groupNames.map((name) => (
                <th key={name} className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">
                  {name}
                </th>
              ))}
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Price</th>
              {showQuantity && (
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Quantity</th>
              )}
              {showSku && (
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">SKU</th>
              )}
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Visible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className={row.isAvailable ? '' : 'opacity-40'}>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSelected(row.key)}
                    aria-label={`Select ${row.name}`}
                    className={[
                      'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                      selected.has(row.key) ? 'bg-primary border-primary' : 'border-muted hover:border-primary/50',
                    ].join(' ')}
                  >
                    {selected.has(row.key) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </button>
                </td>
                {groupNames.map((name) => (
                  <td key={name} className="px-3 py-2 text-secondary">{row.options[name]}</td>
                ))}
                <td className="px-3 py-2">
                  {/* Local draft-string state inside InlinePriceInput — commits
                      on blur/Enter, so typing "12.5" doesn't get clobbered
                      mid-keystroke by a controlled value round-tripped
                      through parent state on every character (the DOM would
                      normalize "12." back to "12" before the "5" lands). */}
                  <InlinePriceInput
                    value={row.price}
                    onChange={(price) => patchRow(row.key, row.options, { price })}
                    prefix="US$"
                    placeholder="0.00"
                  />
                </td>
                {showQuantity && (
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={row.quantity ?? ''}
                      onChange={(e) => patchRow(row.key, row.options, { quantity: numOrNull(e.target.value) })}
                      placeholder="∞"
                      className="w-20 px-2 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums"
                    />
                  </td>
                )}
                {showSku && (
                  <td className="px-3 py-2">
                    <input
                      value={row.sku ?? ''}
                      onChange={(e) => patchRow(row.key, row.options, { sku: e.target.value || null })}
                      placeholder="SKU"
                      className="w-32 px-2 py-1.5 text-sm border border-border rounded-button bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </td>
                )}
                <td className="px-4 py-2 text-right">
                  <Toggle
                    checked={row.isAvailable}
                    onChange={(v) => patchRow(row.key, row.options, { isAvailable: v })}
                    ariaLabel={`Toggle visibility of ${row.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
