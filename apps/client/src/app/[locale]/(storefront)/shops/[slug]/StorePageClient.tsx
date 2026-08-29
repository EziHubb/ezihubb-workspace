'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { StoreProductsClient } from './StoreProductsClient';
import { StoreReviewsClient, type StoreReviewsSummary } from './StoreReviewsClient';
import { safeNum } from '@ezihubb/utils';
import { API_ROUTES, type ShopColorTheme } from '@ezihubb/constants';
import { apiClient } from '@ezihubb/api-client';

type Tab = 'items' | 'reviews' | 'about';

interface StoreDto {
  id:            string;
  name:          string;
  slug:          string;
  description:   string | null;
  rating:        number;
  totalProducts: number;
  totalOrders:   number;
  /** Listings pinned in Shop Home; empty = fall back to the isFeatured flag. */
  featuredProductIds: string[];
  /** 'grid' | 'mixed' — API already forces 'grid' without Plus. */
  featuredLayout: string | null;
}

// ── About section ─────────────────────────────────────────────────────────────

function AboutSection({ store }: { store: StoreDto }) {
  const t = useTranslations('shops');

  return (
    <div className="max-w-2xl space-y-6 py-4">
      {store.description ? (
        <div>
          <h2 className="font-display text-lg font-bold text-secondary mb-3">{t('storePage.about.title')}</h2>
          <p className="text-secondary/80 leading-relaxed whitespace-pre-line">{store.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-1">{t('storePage.about.totalSales')}</h3>
          <p className="text-2xl font-bold text-secondary">{safeNum(store.totalOrders).toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-1">{t('storePage.about.activeListings')}</h3>
          <p className="text-2xl font-bold text-secondary">{safeNum(store.totalProducts).toLocaleString()}</p>
        </div>
      </div>

      {!store.description && (
        <p className="text-muted text-sm">{t('storePage.about.noDescription')}</p>
      )}
    </div>
  );
}

// ── Tab nav + content ─────────────────────────────────────────────────────────

export function StorePageClient({
  store,
  locale,
  theme,
}: {
  store:  StoreDto;
  locale: string;
  /** Ezihubb Plus colour theme, or null for the default app styling. */
  theme?: ShopColorTheme | null;
}) {
  const t = useTranslations('shops');

  const [activeTab,   setActiveTab]   = useState<Tab>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Load the summary with the tab navigation rather than waiting until the
  // Reviews panel mounts. StoreReviewsClient uses the same query key, so this
  // result is shared and does not cause a second summary request after click.
  const { data: reviewsSummary } = useQuery<StoreReviewsSummary>({
    queryKey: ['store-reviews-summary', store.slug],
    queryFn: () => apiClient.get(API_ROUTES.STORES.REVIEWS_SUMMARY(store.slug)),
    staleTime: 120_000,
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'items',   label: t('storePage.tabItems', { count: store.totalProducts }) },
    {
      id: 'reviews',
      label: reviewsSummary
        ? `${t('storePage.tabReviews')} (${reviewsSummary.totalReviews})`
        : t('storePage.tabReviews'),
    },
    { id: 'about',   label: t('storePage.tabAbout')                                 },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setActiveTab('items');
  };

  return (
    <div className="mt-6">
      {/* ── Sticky Tab Navigation ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8">
          <div className="flex items-center gap-4">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label={t('storePage.sectionsAriaLabel')}
              className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden flex-1"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  // textSafeHex, not the raw swatch hex — this color is the
                  // tab's text + underline directly on the page's light
                  // background, same AA-contrast reasoning as
                  // FollowShopButton (see that file's comment).
                  style={theme && activeTab === tab.id ? { borderColor: theme.textSafeHex, color: theme.textSafeHex } : undefined}
                  className={[
                    'px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0',
                    activeTab === tab.id
                      ? theme ? '' : 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-secondary',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search bar — only on items tab */}
            {activeTab === 'items' && (
              <form onSubmit={handleSearch} className="shrink-0 hidden sm:flex">
                <div className="flex items-center gap-2 border border-border rounded-full px-3.5 py-1.5 bg-surface hover:border-primary/40 focus-within:border-primary/60 transition-colors">
                  <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t('storePage.searchPlaceholder', { count: store.totalProducts })}
                    className="bg-transparent text-xs text-secondary placeholder:text-muted outline-none w-44"
                  />
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 min-h-[400px]">

        {activeTab === 'items' && (
          <StoreProductsClient
            storeSlug={store.slug}
            locale={locale}
            searchQuery={searchQuery}
            onSearchClear={() => { setSearchQuery(''); setSearchInput(''); }}
            featuredProductIds={store.featuredProductIds}
            featuredLayout={store.featuredLayout ?? 'grid'}
          />
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
