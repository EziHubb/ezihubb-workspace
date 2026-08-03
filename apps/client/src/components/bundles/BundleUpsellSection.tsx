'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface BundleTier {
  minItems:    number;
  discountPct: number;
}

interface BundleCombo {
  productA: { name: string; slug: string; price: number; imageUrl: string | null };
  productB: { name: string; slug: string; price: number; imageUrl: string | null };
  savingsAmount: number;
  comboPrice:    number;
}

interface BundleSettings {
  tiers:  BundleTier[];
  combos: BundleCombo[];
}

interface BundleUpsellSectionProps {
  storeId: string;
  locale:  string;
}

const DEFAULT_TIERS: BundleTier[] = [
  { minItems: 2, discountPct: 15 },
  { minItems: 3, discountPct: 20 },
  { minItems: 4, discountPct: 25 },
];

export function BundleUpsellSection({ storeId, locale }: BundleUpsellSectionProps) {
  const [settings, setSettings] = useState<BundleSettings | null>(null);

  useEffect(() => {
    apiClient.get<BundleSettings>(API_ROUTES.BUNDLES.UPSELL(storeId))
      .then(setSettings)
      .catch(() => setSettings({ tiers: DEFAULT_TIERS, combos: [] }));
  }, [storeId]);

  if (!settings) return null;
  const tiers  = settings.tiers.length ? settings.tiers : DEFAULT_TIERS;
  const combos = settings.combos ?? [];

  const popularIdx = tiers.reduce(
    (best, t, i) => (tiers[i].discountPct > tiers[best].discountPct ? best : i + 1 === 2 ? i : best),
    1,
  );

  return (
    <section className="py-8 space-y-5">
      <h3 className="font-display text-xl font-bold text-secondary">Get more, save more</h3>

      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-3">
        {tiers.map((tier, i) => {
          const isPopular = i === popularIdx;
          return (
            <div
              key={i}
              className={[
                'rounded-xl border p-4 text-center relative',
                isPopular
                  ? 'border-2 border-primary bg-primary/5'
                  : 'border-border bg-surface',
              ].join(' ')}
            >
              {isPopular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wide">
                  Most popular
                </span>
              )}
              <p className={`text-xs font-medium mb-1 ${isPopular ? 'text-primary' : 'text-muted'}`}>
                {tier.minItems} items
              </p>
              <p className={`text-2xl font-bold ${isPopular ? 'text-primary' : 'text-secondary'}`}>
                -{tier.discountPct}%
              </p>
              <p className="text-xs text-muted mt-0.5">Save ~${((tier.discountPct / 100) * 35).toFixed(0)}</p>
            </div>
          );
        })}
      </div>

      {/* Combo suggestions */}
      {combos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {combos.slice(0, 4).map((combo, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted/10 border border-border">
                  {combo.productA.imageUrl && (
                    <Image src={combo.productA.imageUrl} alt={combo.productA.name} fill sizes="40px" className="object-cover" />
                  )}
                </div>
                <span className="text-muted text-sm font-bold">+</span>
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted/10 border border-border">
                  {combo.productB.imageUrl && (
                    <Image src={combo.productB.imageUrl} alt={combo.productB.name} fill sizes="40px" className="object-cover" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-secondary line-clamp-1">
                  {combo.productA.name} + {combo.productB.name}
                </p>
                <p className="text-xs text-muted">
                  <span className="line-through">${(combo.productA.price + combo.productB.price).toFixed(2)}</span>
                  {' '}→{' '}
                  <span className="text-green-700 font-bold">${combo.comboPrice.toFixed(2)}</span>
                </p>
              </div>
              <Link
                href={`/${locale}/products/${combo.productB.slug}`}
                className="shrink-0 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Get combo →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
