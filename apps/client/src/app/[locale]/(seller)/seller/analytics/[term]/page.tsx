'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronLeft, Bookmark, BookmarkCheck, Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useTermDetail,
  useTermAnalysis,
  useSavedSearches,
  useMutateSavedSearches,
  useSubmitRelatedTermFeedback,
} from '@ezihubb/api-client';
import { fmtAmount } from '@ezihubb/utils';
import type { ConversionBucket } from '@ezihubb/types';

// ── Conversion badge ─────────────────────────────────────────────────────────

const CONVERSION_LABEL: Record<ConversionBucket, string> = {
  very_low: 'Very low conversion rate',
  low:      'Low conversion rate',
  medium:   'Medium conversion rate',
  high:     'High conversion rate',
  very_high:'Very high conversion rate',
};

const CONVERSION_COLOR: Record<ConversionBucket, string> = {
  very_low: 'text-error',
  low:      'text-warning',
  medium:   'text-secondary',
  high:     'text-success',
  very_high:'text-success',
};

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-floating text-sm">
      <p className="text-muted mb-0.5">{label}</p>
      <p className="font-bold text-secondary">{payload[0].value.toLocaleString()} searches</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TermInsightsPage() {
  const params = useParams<{ term: string }>();
  const router = useRouter();
  const locale = useLocale();
  const term = decodeURIComponent(params.term ?? '');

  const { data: detail, isLoading: detailLoading } = useTermDetail(term);
  const { data: analysis, isLoading: analysisLoading } = useTermAnalysis(term);
  const { data: savedSearches } = useSavedSearches();
  const { saveSearch, removeSavedSearch } = useMutateSavedSearches();
  const submitFeedback = useSubmitRelatedTermFeedback();
  const [votedTerms, setVotedTerms] = useState<Record<string, 'helpful' | 'not_helpful'>>({});

  const voteRelatedTerm = (relatedTerm: string, helpful: boolean) => {
    setVotedTerms((prev) => ({ ...prev, [relatedTerm]: helpful ? 'helpful' : 'not_helpful' }));
    submitFeedback.mutate({ term, relatedTerm, helpful });
  };

  const savedEntry = savedSearches?.find((s) => s.term === term.trim().toLowerCase());
  const isSaved = Boolean(savedEntry);

  const toggleSave = () => {
    if (savedEntry) removeSavedSearch.mutate(savedEntry.id);
    else saveSearch.mutate(term);
  };

  const priceRange = analysis?.priceRange;
  const yourPrices = analysis?.yourPrices;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push(`/${locale}/seller/analytics`)}
        className="flex items-center gap-1 text-sm text-muted hover:text-secondary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Marketplace Insights
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">{term}</h1>
          {!detailLoading && detail && (
            <p className={`text-xs font-medium mt-1 ${CONVERSION_COLOR[detail.conversionBucket]}`}>
              {CONVERSION_LABEL[detail.conversionBucket]} · Last 30 days
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSave}
          disabled={saveSearch.isPending || removeSavedSearch.isPending}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-button border transition-colors disabled:opacity-50',
            isSaved
              ? 'bg-primary/5 border-primary/30 text-primary'
              : 'border-border text-secondary hover:border-primary/40',
          ].join(' ')}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Summary stats */}
      {!detailLoading && detail && (
        <div className="flex flex-wrap gap-8 text-sm">
          <div>
            <p className="text-muted text-xs mb-0.5">Searches</p>
            <p className="font-bold text-secondary">{detail.searches.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-0.5">Search results</p>
            <p className="font-bold text-secondary">{detail.resultsCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-0.5">Conversion rate</p>
            <p className="font-bold text-secondary">{detail.conversionRate}%</p>
          </div>
        </div>
      )}

      {/* Volume chart */}
      <div className="bg-surface rounded-card border border-border shadow-card p-5">
        <h2 className="text-sm font-semibold text-secondary mb-4">Searches over time</h2>
        {detailLoading ? (
          <div className="h-[220px] bg-border/10 rounded animate-pulse" />
        ) : !detail?.timeSeries.length ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted">
            Not enough search data yet for this term.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={detail.timeSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="searchVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E85D3F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E85D3F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="searches"
                stroke="#E85D3F"
                strokeWidth={2}
                fill="url(#searchVolumeGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#E85D3F', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Related terms */}
      {!detailLoading && !!detail?.relatedTerms.length && (
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <h2 className="text-sm font-semibold text-secondary mb-1">Similar search terms</h2>
          <p className="text-xs text-muted mb-3">Are these search term ideas helpful?</p>
          <div className="flex flex-wrap gap-2">
            {detail.relatedTerms.map((t) => {
              const vote = votedTerms[t];
              return (
                <div
                  key={t}
                  className="flex items-center gap-1 pl-3 pr-1.5 py-1 border border-border rounded-full text-sm"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/seller/analytics/${encodeURIComponent(t)}`)}
                    className="text-secondary hover:text-primary transition-colors"
                  >
                    {t}
                  </button>
                  <span className="flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => voteRelatedTerm(t, true)}
                      disabled={!!vote}
                      aria-label={`Mark "${t}" as helpful`}
                      className={[
                        'w-6 h-6 rounded-full flex items-center justify-center transition-colors disabled:cursor-default',
                        vote === 'helpful' ? 'bg-success/10 text-success' : 'text-muted hover:text-success hover:bg-success/10',
                      ].join(' ')}
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => voteRelatedTerm(t, false)}
                      disabled={!!vote}
                      aria-label={`Mark "${t}" as not helpful`}
                      className={[
                        'w-6 h-6 rounded-full flex items-center justify-center transition-colors disabled:cursor-default',
                        vote === 'not_helpful' ? 'bg-error/10 text-error' : 'text-muted hover:text-error hover:bg-error/10',
                      ].join(' ')}
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Price + bestseller analysis */}
      <div className="bg-surface rounded-card border border-border shadow-card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-secondary">Search term analysis</h2>
          <p className="text-xs text-muted mt-0.5">
            Based on current listings matching this term — sellers should independently verify prices and results.
          </p>
        </div>

        {analysisLoading ? (
          <div className="h-16 bg-border/10 rounded animate-pulse" />
        ) : priceRange ? (
          <div>
            <p className="text-xs font-medium text-muted mb-2">Listing price range</p>
            <div className="relative h-2 bg-border/40 rounded-full">
              <div
                className="absolute h-2 bg-primary/30 rounded-full"
                style={{
                  left:  `${((priceRange.typicalLow - priceRange.min) / Math.max(1, priceRange.max - priceRange.min)) * 100}%`,
                  right: `${100 - ((priceRange.typicalHigh - priceRange.min) / Math.max(1, priceRange.max - priceRange.min)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted mt-1.5">
              <span>{fmtAmount(priceRange.min)}</span>
              <span className="font-medium text-secondary">
                Typical: {fmtAmount(priceRange.typicalLow)} – {fmtAmount(priceRange.typicalHigh)}
              </span>
              <span>{fmtAmount(priceRange.max)}</span>
            </div>
            {yourPrices && (
              <p className="text-xs text-muted mt-2">
                Your prices: {yourPrices.count > 0
                  ? `${fmtAmount(yourPrices.min)} – ${fmtAmount(yourPrices.max)} (${yourPrices.count} listing${yourPrices.count === 1 ? '' : 's'})`
                  : 'No listings detected'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">No matching listings found for this term yet.</p>
        )}

        {/* Bestseller grid */}
        {analysisLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-border/10 rounded-card animate-pulse" />
            ))}
          </div>
        ) : !!analysis?.bestsellers.length && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {analysis.bestsellers.map((p) => (
              <a
                key={p.id}
                href={`/${locale}/products/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="aspect-square rounded-card overflow-hidden bg-[#F5F1EB] mb-2">
                  {(p.primaryImageUrl ?? p.images?.[0]?.url ?? p.primaryImage) && (
                    // eslint-disable-next-line @next/next/no-img-element -- external competitor listing thumbnails, not worth the Image optimizer config for this admin-only view
                    <img
                      src={p.primaryImageUrl ?? p.images?.[0]?.url ?? p.primaryImage ?? ''}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <p className="text-xs text-secondary line-clamp-2 leading-snug">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-bold text-secondary">{fmtAmount(p.basePrice)}</span>
                  {!!p.reviewCount && p.averageRating != null && (
                    <span className="flex items-center gap-0.5 text-xs text-muted">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {p.averageRating.toFixed(1)} ({p.reviewCount})
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
