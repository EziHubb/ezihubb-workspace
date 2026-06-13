'use client';

import { useState } from 'react';
import { StoreProductsClient } from './StoreProductsClient';
import { StoreReviewsClient } from './StoreReviewsClient';

type Tab = 'featured' | 'all' | 'reviews' | 'about';

interface StoreDto {
  id:            string;
  name:          string;
  slug:          string;
  description:   string | null;
  rating:        number;
  totalProducts: number;
  totalOrders:   number;
}

// ── About section ─────────────────────────────────────────────────────────────

function AboutSection({ store }: { store: StoreDto }) {
  return (
    <div className="max-w-2xl space-y-6 py-4">
      {store.description ? (
        <div>
          <h2 className="font-display text-lg font-bold text-secondary mb-3">About this shop</h2>
          <p className="text-secondary/80 leading-relaxed whitespace-pre-line">{store.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-1">Total Sales</h3>
          <p className="text-2xl font-bold text-secondary">{store.totalOrders.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-1">Active Listings</h3>
          <p className="text-2xl font-bold text-secondary">{store.totalProducts.toLocaleString()}</p>
        </div>
      </div>

      {!store.description && (
        <p className="text-muted text-sm">No shop description provided yet.</p>
      )}
    </div>
  );
}

// ── Tab nav + content ─────────────────────────────────────────────────────────

export function StorePageClient({
  store,
  locale,
}: {
  store:  StoreDto;
  locale: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('featured');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'featured', label: 'Featured Items'                  },
    { id: 'all',      label: `All Items (${store.totalProducts})` },
    { id: 'reviews',  label: 'Reviews'                         },
    { id: 'about',    label: 'About'                           },
  ];

  return (
    <div className="mt-6">
      {/* ── Sticky Tab Navigation ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8">
          <div
            role="tablist"
            aria-label="Store sections"
            className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-secondary',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 min-h-[400px]">
        {activeTab === 'featured' && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-secondary">Featured Items</h2>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="text-sm text-primary font-medium hover:underline underline-offset-2"
              >
                See all items →
              </button>
            </div>
            <StoreProductsClient
              storeSlug={store.slug}
              locale={locale}
              mode="featured"
              onSeeAll={() => setActiveTab('all')}
            />
          </section>
        )}

        {activeTab === 'all' && (
          <section>
            <h2 className="font-display text-xl font-bold text-secondary mb-6">All Items</h2>
            <StoreProductsClient
              storeSlug={store.slug}
              locale={locale}
              mode="all"
            />
          </section>
        )}

        {activeTab === 'reviews' && (
          <StoreReviewsClient storeSlug={store.slug} storeRating={store.rating} />
        )}

        {activeTab === 'about' && (
          <AboutSection store={store} />
        )}
      </div>
    </div>
  );
}
