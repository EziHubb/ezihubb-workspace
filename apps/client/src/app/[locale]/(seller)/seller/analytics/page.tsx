'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Search, TrendingUp, TrendingDown, Bookmark, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useTrendingTerms,
  useSavedSearches,
  useMutateSavedSearches,
  useCategories,
  useInsightsQuota,
} from '@ezihubb/api-client';
import { fmtCompactNum } from '@ezihubb/utils';

const SCROLL_STEP = 260;

export default function MarketplaceInsightsPage() {
  const router = useRouter();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  // undefined = "All" tab. Category is the dominant category inferred from
  // each search's results (see SearchService.dominantCategorySlug), not an
  // explicit filter buyers set — most free-text searches don't set one.
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const { data: categories } = useCategories({ parentId: null, isActive: true });
  const { data: trending, isLoading: trendingLoading } = useTrendingTerms(24, activeCategory);
  const { data: savedSearches, isLoading: savedLoading } = useSavedSearches();
  const { removeSavedSearch } = useMutateSavedSearches();
  const { data: quota } = useInsightsQuota();

  const goToTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    router.push(`/${locale}/seller/analytics/${encodeURIComponent(clean)}`);
  };

  const scrollCategories = (dir: 'left' | 'right') => {
    categoryScrollRef.current?.scrollBy({ left: dir === 'left' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary">Marketplace Insights</h1>
        </div>
        {quota && (
          <span
            className={[
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0',
              quota.remaining === 0
                ? 'border-error/30 text-error bg-error/5'
                : 'border-border text-secondary',
            ].join(' ')}
          >
            <Search className="w-3.5 h-3.5" /> {quota.remaining} remaining
          </span>
        )}
      </div>

      {/* Hero search */}
      <div className="bg-surface border border-border rounded-card px-6 py-10 text-center">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-2">
          Explore search terms related to your shop
        </h2>
        <p className="text-sm text-muted max-w-lg mx-auto mb-6">
          Enter a search term to find out how buyers are searching on EziHubb, dig into the
          competitive landscape, and discover similar keywords to help optimise your shop.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); goToTerm(query); }}
          className="flex gap-2 max-w-xl mx-auto"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try a search term like "vase"'
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-button bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            Search
          </button>
        </form>
      </div>

      {/* Saved searches */}
      <section className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-secondary">Saved searches</h2>
        </div>
        {savedLoading ? (
          <div className="p-5 flex gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 bg-border/20 rounded-full animate-pulse" />)}
          </div>
        ) : !savedSearches?.length ? (
          <div className="p-8 text-center">
            <Bookmark className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">
              No saved searches yet — search a term below and save it to track it over time.
            </p>
          </div>
        ) : (
          <div className="p-5 flex flex-wrap gap-2">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-background border border-border rounded-full text-sm"
              >
                <button
                  type="button"
                  onClick={() => goToTerm(s.term)}
                  className="text-secondary hover:text-primary transition-colors"
                >
                  {s.term}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedSearch.mutate(s.id)}
                  aria-label={`Remove saved search "${s.term}"`}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted hover:text-error hover:bg-error/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trending keywords */}
      <section className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-secondary">What buyers are searching for</h2>
          <p className="text-xs text-muted mt-0.5">Last 30 days</p>
        </div>

        {!!categories?.length && (
          <div className="px-5 pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              aria-label="Scroll categories left"
              className="shrink-0 w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div
              ref={categoryScrollRef}
              className="flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                onClick={() => setActiveCategory(undefined)}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === undefined
                    ? 'bg-secondary text-white border-secondary'
                    : 'border-border text-secondary hover:border-primary/40',
                ].join(' ')}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.slug)}
                  className={[
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    activeCategory === c.slug
                      ? 'bg-secondary text-white border-secondary'
                      : 'border-border text-secondary hover:border-primary/40',
                  ].join(' ')}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              aria-label="Scroll categories right"
              className="shrink-0 w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted hover:border-primary/40 hover:text-primary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {trendingLoading ? (
          <div className="p-5 flex gap-4 overflow-x-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-40 h-40 bg-border/20 rounded-card animate-pulse" />
            ))}
          </div>
        ) : !trending?.length ? (
          <div className="p-10 text-center">
            <TrendingUp className="w-10 h-10 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">
              Not enough search data yet — trending keywords will appear here as buyers search the marketplace.
            </p>
          </div>
        ) : (
          <div className="p-5 flex gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {trending.map((t) => (
              <button
                key={t.term}
                type="button"
                onClick={() => goToTerm(t.term)}
                className="group shrink-0 w-40 text-left"
              >
                <div className="relative w-40 h-40 rounded-card overflow-hidden bg-[#F5F1EB]">
                  {t.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- decorative trending-term thumbnail, not worth the Image optimizer config here
                    <img
                      src={t.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Search className="w-8 h-8 text-muted/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 text-white">
                    <p className="text-sm font-semibold truncate">{t.term}</p>
                    <p className="text-xs opacity-90">{fmtCompactNum(t.searches)}</p>
                  </div>
                  {t.changePercent !== null && (
                    <span
                      className={[
                        'absolute top-2 right-2 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        t.changePercent >= 0 ? 'bg-success/90 text-white' : 'bg-error/90 text-white',
                      ].join(' ')}
                    >
                      {t.changePercent >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {Math.abs(t.changePercent)}%
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
