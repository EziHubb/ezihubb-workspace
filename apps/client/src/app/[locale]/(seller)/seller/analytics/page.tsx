'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Search, TrendingUp, TrendingDown, Bookmark, X } from 'lucide-react';
import {
  useTrendingTerms,
  useSavedSearches,
  useMutateSavedSearches,
  useCategories,
} from '@ezihubb/api-client';

export default function MarketplaceInsightsPage() {
  const router = useRouter();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  // undefined = "All" tab. Category is the dominant category inferred from
  // each search's results (see SearchService.dominantCategorySlug), not an
  // explicit filter buyers set — most free-text searches don't set one.
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);

  const { data: categories } = useCategories({ parentId: null, isActive: true });
  const { data: trending, isLoading: trendingLoading } = useTrendingTerms(24, activeCategory);
  const { data: savedSearches, isLoading: savedLoading } = useSavedSearches();
  const { removeSavedSearch } = useMutateSavedSearches();

  const goToTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    router.push(`/${locale}/seller/analytics/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-secondary">Marketplace Insights</h1>
        <p className="text-sm text-muted mt-1">
          See how buyers search across EziHubb — find keyword ideas, check conversion, and
          benchmark your prices against similar listings.
        </p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); goToTerm(query); }}
        className="flex gap-2 max-w-xl"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try a search term like "badge reel"'
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
          <div className="px-5 pt-4 flex gap-2 overflow-x-auto">
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
        )}

        {trendingLoading ? (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-12 bg-border/20 rounded-button animate-pulse" />
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
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trending.map((t) => (
              <button
                key={t.term}
                type="button"
                onClick={() => goToTerm(t.term)}
                className="flex items-center justify-between px-4 py-3 border border-border rounded-button text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{t.term}</p>
                  <p className="text-xs text-muted">{t.searches.toLocaleString()} searches</p>
                </div>
                {t.changePercent !== null && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-semibold shrink-0 ml-2 ${
                      t.changePercent >= 0 ? 'text-success' : 'text-error'
                    }`}
                  >
                    {t.changePercent >= 0
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(t.changePercent)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
