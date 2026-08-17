'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, BarChart2, List as ListIcon } from 'lucide-react';
import { Toggle, Menu } from '@ezihubb/ui';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../lib/fmt';
import { ReloadButton } from '../../../../components/ui/ReloadButton';

const RANGE_OPTIONS = [
  { days: 7,  label: 'Last 7 days'  },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

interface AdsGroupStats {
  revenue:   number;
  orders:    number;
  newBuyers: number;
  adFees?:   number;
  fees?:     number;
}

interface OffsiteAdsStats {
  offsiteAdsOptedOut: boolean;
  totalFee:           number;
  directClicks:       number;
  indirectClicks:     number;
  conversions:        number;
  direct:             AdsGroupStats;
  indirect:           AdsGroupStats;
  dailyTraffic:       { date: string; count: number }[];
  byChannel:          { channel: string; clicks: number }[];
  byListing:          { productId: string; productName: string; clicks: number }[];
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function Stat({
  label, value, info, delta,
}: {
  label: string; value: string | number; info?: string; delta?: number | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted mb-1 flex items-center gap-1">
        {label}
        {info && (
          <span title={info} className="inline-flex w-3.5 h-3.5 rounded-full border border-muted text-muted text-[9px] items-center justify-center cursor-help">i</span>
        )}
      </p>
      <p className="font-display text-xl font-bold text-secondary tabular-nums">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className={`text-xs font-semibold mt-0.5 ${delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-muted'}`}>
          {delta > 0 ? '+' : ''}{delta}% vs previous period
        </p>
      )}
    </div>
  );
}

export default function OffsiteAdsPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);
  const [chartView, setChartView] = useState<'chart' | 'list'>('chart');
  const rangeLabel = RANGE_OPTIONS.find((r) => r.days === days)?.label ?? 'Last 30 days';

  const { data, isLoading } = useQuery<OffsiteAdsStats>({
    queryKey: ['offsite-ads-stats', days],
    queryFn:  () => api.get<OffsiteAdsStats>(API_ROUTES.ADMIN.OFFSITE_ADS, { params: { days: String(days) } }),
  });

  const { data: prevData } = useQuery<OffsiteAdsStats>({
    queryKey: ['offsite-ads-stats', days, 'prev'],
    queryFn:  () => api.get<OffsiteAdsStats>(API_ROUTES.ADMIN.OFFSITE_ADS, { params: { days: String(days), offsetDays: String(days) } }),
    enabled:  compare,
  });

  const handleToggleOptOut = async () => {
    if (!data) return;
    await api.patch(API_ROUTES.ADMIN.OFFSITE_ADS_OPT_OUT, { optedOut: !data.offsiteAdsOptedOut });
    qc.invalidateQueries({ queryKey: ['offsite-ads-stats'] });
  };

  if (isLoading || !data) {
    return (
      <>
        <h1 className="text-lg font-semibold text-secondary mb-4">Offsite Ads</h1>
        <div className="h-40 bg-surface rounded-card border border-border animate-pulse" />
      </>
    );
  }

  const maxDaily = Math.max(1, ...data.dailyTraffic.map((d) => d.count));

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-lg font-semibold text-secondary">Offsite Ads</h1>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-secondary">Share your feedback</span>
          <ReloadButton queryKey={['offsite-ads-stats']} />
        </div>
      </div>
      <p className="text-sm text-muted max-w-2xl leading-relaxed mb-1">
        With Offsite Ads, we promote your listings on high-traffic sites like Google, Instagram, Facebook, Pinterest, and Bing to help bring more shoppers to your shop.
        We cover the upfront advertising costs — you only pay when an Offsite Ad leads to a sale.
      </p>

      <div className="flex items-center justify-between mt-5 mb-4">
        <div className="flex items-center gap-2 select-none">
          <Toggle checked={compare} onChange={setCompare} ariaLabel="Compare to previous period" />
          <button type="button" className="text-sm font-medium text-secondary" onClick={() => setCompare((c) => !c)}>
            Compare to previous period
          </button>
        </div>
        <Menu
          align="end"
          panelWidth="10rem"
          trigger={
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold border border-border rounded-pill bg-surface hover:border-secondary/40 transition-colors">
              {rangeLabel}
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          }
          items={RANGE_OPTIONS.map((r) => ({ label: r.label, onClick: () => setDays(r.days) }))}
        />
      </div>

      {/* Two stat groups */}
      <div className="bg-surface rounded-card border border-border p-5 mb-6">
        <h3 className="text-sm font-bold text-secondary mb-1">Performance driven by your ads</h3>
        <p className="text-xs text-muted mb-4">This performance data shows direct traffic to your shop during the selected time period.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat label="Total revenue" value={fmtAmount(data.direct.revenue)} info="Revenue from orders that came directly from your Offsite Ad clicks." delta={compare && prevData ? pctDelta(data.direct.revenue, prevData.direct.revenue) : undefined} />
          <Stat label="Orders" value={data.direct.orders} delta={compare && prevData ? pctDelta(data.direct.orders, prevData.direct.orders) : undefined} />
          <Stat label="New buyers" value={data.direct.newBuyers} delta={compare && prevData ? pctDelta(data.direct.newBuyers, prevData.direct.newBuyers) : undefined} />
          <Stat label="Ad fees paid" value={fmtAmount(data.direct.adFees ?? 0)} info="Only charged when a direct click leads to a sale." delta={compare && prevData ? pctDelta(data.direct.adFees ?? 0, prevData.direct.adFees ?? 0) : undefined} />
        </div>

        <div className="h-px bg-border my-5" />

        <h3 className="text-sm font-bold text-secondary mb-1">Indirect ad traffic to your shop</h3>
        <p className="text-xs text-muted mb-4">
          A shopper might click an Offsite Ad for another listing and then buy from your shop. You still benefit from the order and revenue,
          but since it isn&apos;t attributed to your shop&apos;s ads, the fee is {fmtAmount(0)}.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat label="Indirect revenue" value={fmtAmount(data.indirect.revenue)} delta={compare && prevData ? pctDelta(data.indirect.revenue, prevData.indirect.revenue) : undefined} />
          <Stat label="Orders" value={data.indirect.orders} delta={compare && prevData ? pctDelta(data.indirect.orders, prevData.indirect.orders) : undefined} />
          <Stat label="New buyers" value={data.indirect.newBuyers} delta={compare && prevData ? pctDelta(data.indirect.newBuyers, prevData.indirect.newBuyers) : undefined} />
          <Stat label="Indirect fees" value={fmtAmount(data.indirect.fees ?? 0)} />
        </div>
      </div>

      {/* Traffic chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-secondary">Ad traffic over time</h3>
          <div className="flex items-center border border-border rounded-pill overflow-hidden">
            <button
              type="button"
              onClick={() => setChartView('chart')}
              className={`p-1.5 transition-colors ${chartView === 'chart' ? 'bg-secondary text-white' : 'text-muted hover:text-secondary hover:bg-muted/8'}`}
              title="Chart view"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartView('list')}
              className={`p-1.5 transition-colors ${chartView === 'list' ? 'bg-secondary text-white' : 'text-muted hover:text-secondary hover:bg-muted/8'}`}
              title="List view"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-surface rounded-card border border-border p-5">
          {data.dailyTraffic.length === 0 ? (
            <p className="text-sm text-muted italic">No external ad traffic in the {rangeLabel.toLowerCase()}.</p>
          ) : chartView === 'chart' ? (
            <div className="flex items-end gap-1 h-32">
              {data.dailyTraffic.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className="w-full bg-secondary/70 hover:bg-secondary rounded-t transition-colors"
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    title={`${d.date}: ${d.count} clicks`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {[...data.dailyTraffic].reverse().map((d) => (
                  <tr key={d.date} className="border-b border-border last:border-0">
                    <td className="py-2 text-secondary">{d.date}</td>
                    <td className="py-2 text-right tabular-nums">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* By channel */}
        <div className="bg-surface rounded-card border border-border p-5">
          <h3 className="text-sm font-bold text-secondary mb-3">Ad performance by channel</h3>
          {data.byChannel.length === 0 ? (
            <p className="text-sm text-muted italic">No channel data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                  <th className="pb-2">Channel</th>
                  <th className="pb-2 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>
                {data.byChannel.map((c) => (
                  <tr key={c.channel} className="border-b border-border last:border-0">
                    <td className="py-2 text-secondary truncate">{c.channel}</td>
                    <td className="py-2 text-right tabular-nums">{c.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By listing */}
        <div className="bg-surface rounded-card border border-border p-5">
          <h3 className="text-sm font-bold text-secondary mb-3">Ad performance by listing</h3>
          {data.byListing.length === 0 ? (
            <p className="text-sm text-muted italic">No listing data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                  <th className="pb-2">Listing</th>
                  <th className="pb-2 text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.byListing.map((l) => (
                  <tr key={l.productId} className="border-b border-border last:border-0">
                    <td className="py-2 text-secondary truncate">{l.productName}</td>
                    <td className="py-2 text-right tabular-nums">{l.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Opt-out */}
      <div className="bg-surface rounded-card border border-border p-5 flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-bold text-secondary">Thinking about opting out?</p>
          <p className="text-xs text-muted mt-0.5 max-w-lg">Opting out of Offsite Ads might reduce your shop&apos;s visibility and sales opportunities.</p>
        </div>
        <Toggle checked={!data.offsiteAdsOptedOut} onChange={handleToggleOptOut} ariaLabel="Opt in to Offsite Ads" />
      </div>
    </>
  );
}
