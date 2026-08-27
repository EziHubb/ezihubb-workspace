'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ReloadButton } from '../../../components/ui/ReloadButton';

interface ShopHealth {
  performanceScore: number | null;
  scoreShipping:    number | null;
  scoreRefund:      number | null;
  scoreReview:      number | null;
  scoreResponse:    number | null;
  scoreBadge:       string | null;
}

function ScoreCard({
  label, value, unit, standard, target,
}: {
  label:    string;
  value:    number | null;
  unit:     string;
  standard: string;
  target:   string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <p className="text-xs font-bold text-muted mb-1">{label} →</p>
      <p className="font-display text-2xl font-bold text-secondary tabular-nums mb-2">
        {value == null ? '—' : `${value}${unit}`}
      </p>
      <p className="text-[11px] text-muted leading-relaxed">Service standard: {standard}</p>
      <p className="text-[11px] text-[#7C3AED] font-semibold leading-relaxed mt-0.5">Star Seller target: {target}</p>
    </div>
  );
}

const TOOLS = [
  { title: 'How the Star Seller Badge Works', meta: 'Video · 2:31' },
  { title: 'Your Star Seller Checklist', meta: 'Article · 7 min read' },
  { title: 'The Ultimate Guide to Creating a Great Customer Experience', meta: 'Article · 37 min read' },
];

export default function CustomerServiceStatsPage() {
  const { data, isLoading } = useQuery<ShopHealth>({
    queryKey: ['shop-health'],
    queryFn:  () => api.get<ShopHealth>(API_ROUTES.ADMIN.DASHBOARD_SHOP_HEALTH),
  });

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold text-secondary">Customer service stats</h1>
        <ReloadButton queryKey={['shop-health']} />
      </div>
      <p className="text-sm text-muted max-w-2xl leading-relaxed mb-1">
        This is where you&apos;ll track your customer service and Star Seller progress. Great customer service helps
        you build trust with shoppers and keep them coming back.
      </p>
      <p className="text-xs text-muted mb-8">These stats are refreshed every 24 hours.</p>

      {isLoading || !data ? (
        <div className="h-40 bg-surface rounded-card border border-border animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <ScoreCard
              label="Message response rate" value={data.scoreResponse} unit="%"
              standard="reply to 80% of first messages within 24-48 hours"
              target="reply to 95% of first messages within 24 hours"
            />
            <ScoreCard
              label="On-time dispatch &amp; tracking" value={data.scoreShipping} unit="%"
              standard="at least 80% of orders dispatch on time"
              target="95% of orders dispatch on time with tracking"
            />
            <ScoreCard
              label="Average review rating" value={data.scoreReview} unit="%"
              standard="no more than 4 reviews have a rating of 3 or lower"
              target="4.8 or higher"
            />
            <ScoreCard
              label="Case rate" value={data.scoreRefund} unit="%"
              standard="no more than 3 orders had cases that Ezihubb refunded"
              target="the lower your case rate, the better"
            />
          </div>

          {data.scoreBadge && (
            <div className="bg-hero-purple rounded-card p-5 mb-10 flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-bold text-secondary">You&apos;ve earned the &quot;{data.scoreBadge}&quot; badge</p>
                <p className="text-xs text-secondary/70 mt-0.5">Keep up your service standards to hold onto it at the next review.</p>
              </div>
            </div>
          )}

          <div className="mb-10">
            <h2 className="font-display text-lg font-bold text-secondary mb-3">Tools and tips for success</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TOOLS.map((t) => (
                <div key={t.title} className="bg-surface border border-border rounded-card p-4">
                  <h4 className="text-sm font-bold text-secondary mb-1.5">{t.title}</h4>
                  <p className="text-xs text-muted">{t.meta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-hero-purple rounded-card p-4 sm:p-6 text-center">
            <p className="text-sm font-bold text-secondary mb-3">Can&apos;t find what you&apos;re looking for?</p>
            <a href="/settings" className="inline-flex items-center px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-pill transition-colors">
              Try the Help Centre →
            </a>
          </div>
        </>
      )}
    </>
  );
}
