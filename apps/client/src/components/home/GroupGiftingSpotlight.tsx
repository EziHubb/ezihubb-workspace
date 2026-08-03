'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { ProgressFill } from '../campaign/ProgressFill';

interface GiftPoolPreview {
  id:              string;
  title:           string;
  shareToken:      string;
  targetAmount:    number;
  collectedAmount: number;
  contributors:    number;
  product: {
    name:     string;
    imageUrl: string | null;
  } | null;
}

interface GroupGiftingSpotlightProps {
  locale: string;
}

export function GroupGiftingSpotlight({ locale }: GroupGiftingSpotlightProps) {
  const [pools, setPools] = useState<GiftPoolPreview[] | null>(null);

  useEffect(() => {
    apiClient.get<GiftPoolPreview[]>('/gift-pools/public?limit=3')
      .then((data) => setPools(Array.isArray(data) ? data : []))
      .catch(() => setPools([]));
  }, []);

  if (!pools || pools.length === 0) return null;

  return (
    <section className="py-14 bg-background">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-display text-2xl font-bold text-secondary">
                Team up for a group gift
              </h3>
            </div>
            <p className="text-muted text-sm">{pools.length} active gift pools — chip in with friends</p>
          </div>
          <Link
            href={`/${locale}/gift-finder`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Start a gift pool →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pools.map((pool) => {
            const pct = Math.min(100, (pool.collectedAmount / pool.targetAmount) * 100);
            return (
              <div
                key={pool.id}
                className="bg-surface border border-border rounded-card p-4 space-y-3 hover:border-primary/40 transition-colors"
              >
                {pool.product?.imageUrl && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pool.product.imageUrl} alt={pool.product.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm text-secondary line-clamp-1">{pool.title}</p>
                  {pool.product && (
                    <p className="text-xs text-muted line-clamp-1">{pool.product.name}</p>
                  )}
                </div>
                <ProgressFill pct={pct} size="thin" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Users className="w-3 h-3" /> {pool.contributors} contributors
                  </span>
                  <span className="text-xs font-bold text-primary tabular-nums">
                    ${pool.collectedAmount.toFixed(0)} / ${pool.targetAmount.toFixed(0)}
                  </span>
                </div>
                <Link
                  href={`/${locale}/gift/${pool.shareToken}`}
                  className="block w-full text-center text-xs font-semibold border border-border hover:border-primary hover:text-primary rounded-button py-2 transition-colors"
                >
                  Join →
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
