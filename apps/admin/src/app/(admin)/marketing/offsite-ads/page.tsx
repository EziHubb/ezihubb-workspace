'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, TrendingUp, MousePointerClick, Wallet, Shuffle } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../lib/fmt';

interface OffsiteAdsStats {
  offsiteAdsOptedOut: boolean;
  totalFee:           number;
  directClicks:       number;
  indirectClicks:     number;
  conversions:        number;
  dailyTraffic:       { date: string; count: number }[];
  byChannel:          { channel: string; clicks: number }[];
  byListing:          { productId: string; productName: string; clicks: number }[];
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-secondary tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function OffsiteAdsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<OffsiteAdsStats>({
    queryKey: ['offsite-ads-stats'],
    queryFn:  () => api.get<OffsiteAdsStats>(API_ROUTES.ADMIN.OFFSITE_ADS, { params: { days: '30' } }),
  });

  const handleToggleOptOut = async () => {
    if (!data) return;
    await api.patch(API_ROUTES.ADMIN.OFFSITE_ADS_OPT_OUT, { optedOut: !data.offsiteAdsOptedOut });
    qc.invalidateQueries({ queryKey: ['offsite-ads-stats'] });
  };

  if (isLoading || !data) {
    return (
      <>
        <AdminPageHeader title="Offsite Ads" subtitle="Loading…" />
        <div className="h-40 bg-surface rounded-card border border-border animate-pulse" />
      </>
    );
  }

  const maxDaily = Math.max(1, ...data.dailyTraffic.map((d) => d.count));

  return (
    <>
      <AdminPageHeader
        title="Offsite Ads"
        subtitle="External traffic that leads to a sale — a small ad fee applies only when it converts"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Direct ad traffic (30d)" value={data.directClicks} icon={MousePointerClick} />
        <StatCard label="Indirect ad traffic (30d)" value={data.indirectClicks} icon={Shuffle} />
        <StatCard label="Orders attributed (30d)" value={data.conversions} icon={TrendingUp} />
        <StatCard label="Ad fees charged (30d)" value={fmtAmount(data.totalFee)} icon={Wallet} />
      </div>
      <p className="text-xs text-muted -mt-4 mb-6">
        Direct = clicks on your own shop pages that converted here. Indirect = a shopper clicked an ad for a different shop but ended up buying from you — no fee applies.
      </p>

      {/* Traffic chart */}
      <div className="bg-surface rounded-card border border-border shadow-card p-5 mb-6">
        <p className="text-sm font-bold text-secondary mb-4">Ad traffic over time</p>
        {data.dailyTraffic.length === 0 ? (
          <p className="text-sm text-muted italic">No external ad traffic in the last 30 days.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.dailyTraffic.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors"
                  style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                  title={`${d.date}: ${d.count} clicks`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By channel */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <p className="text-sm font-bold text-secondary mb-4">Ad performance by channel</p>
          {data.byChannel.length === 0 ? (
            <p className="text-sm text-muted italic">No channel data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.byChannel.map((c) => (
                <div key={c.channel} className="flex items-center justify-between text-sm">
                  <span className="text-secondary truncate">{c.channel}</span>
                  <span className="text-muted tabular-nums">{c.clicks} clicks</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By listing */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <p className="text-sm font-bold text-secondary mb-4">Ad performance by listing</p>
          {data.byListing.length === 0 ? (
            <p className="text-sm text-muted italic">No listing data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.byListing.map((l) => (
                <div key={l.productId} className="flex items-center justify-between text-sm">
                  <span className="text-secondary truncate">{l.productName}</span>
                  <span className="text-muted tabular-nums">{l.clicks} clicks</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Opt-out */}
      <div className="bg-surface rounded-card border border-border shadow-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-muted shrink-0" />
          <div>
            <p className="text-sm font-semibold text-secondary">Opt out from Offsite Ads</p>
            <p className="text-xs text-muted mt-0.5">Turning this off means external-referral orders will no longer be charged an ad fee.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleOptOut}
          role="switch"
          aria-checked={!data.offsiteAdsOptedOut}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${!data.offsiteAdsOptedOut ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${!data.offsiteAdsOptedOut ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </>
  );
}
