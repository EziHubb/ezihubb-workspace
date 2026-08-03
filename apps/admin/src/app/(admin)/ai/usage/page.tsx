'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, DollarSign, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../../components/data/StatCard';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate, fmtNum, safeArr } from '../../../../lib/fmt';
import { FilterSelect } from '../../../../components/ui/FilterSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageStats {
  costThisMonth:   number;
  costLastMonth:   number;
  callsToday:      number;
  callsThisMonth:  number;
  avgLatencyMs:    number | null;
  errorRatePct:    number | null;
}

interface UsageDataPoint {
  date:     string;
  cost:     number;
  calls:    number;
  errors:   number;
}

interface RateLimitInfo {
  feature:     string;
  used:        number;
  limit:       number;
  resetAt:     string;
}

interface UsageResponse {
  stats:       UsageStats;
  timeSeries:  UsageDataPoint[];
  rateLimits:  RateLimitInfo[];
}

// ── Rate limit bar ────────────────────────────────────────────────────────────

function RateLimitBar({ item }: { item: RateLimitInfo }) {
  const pct   = item.limit > 0 ? Math.min(100, (item.used / item.limit) * 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500';
  const alert = pct >= 90;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <p className="text-xs font-medium text-secondary truncate">{item.feature}</p>
        <p className="text-[10px] text-muted">Resets {fmtDate(item.resetAt)}</p>
      </div>
      <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
        <span className={`text-xs tabular-nums font-medium ${alert ? 'text-red-600' : 'text-secondary'}`}>
          {fmtNum(item.used)} / {fmtNum(item.limit)}
        </span>
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-card p-3 shadow-lg text-xs">
      <p className="font-semibold text-secondary mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-16">{p.name}:</span>
          <span className="font-semibold">
            {p.name === 'Cost' ? fmtAmount(p.value) : fmtNum(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK = (days: number) => ['ai-usage', days];

export default function AiUsagePage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<UsageResponse>({
    queryKey: QK(days),
    queryFn:  () => api.get<UsageResponse>(`${API_ROUTES.ADMIN.AI_USAGE}?days=${days}`),
    staleTime: 60_000,
  });

  const stats      = data?.stats;
  const series     = safeArr(data?.timeSeries);
  const rateLimits = safeArr(data?.rateLimits);

  return (
    <div>
      <AdminPageHeader
        title="AI Usage & Cost"
        subtitle="Monitor API spend, call volumes and rate limits across all AI features"
        queryKey={QK(days)}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Cost This Month"   value={fmtAmount(stats?.costThisMonth  ?? 0)} icon={DollarSign} color="coral" />
            <StatCard label="Cost Last Month"   value={fmtAmount(stats?.costLastMonth  ?? 0)} icon={DollarSign} color="blue"  />
            <StatCard label="Calls Today"       value={fmtNum(stats?.callsToday        ?? 0)} icon={Zap}        color="green" />
            <StatCard label="Calls This Month"  value={fmtNum(stats?.callsThisMonth    ?? 0)} icon={Activity}   color="blue"  />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-6 mb-8">
        {/* Time-series chart */}
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-secondary text-sm">Usage Over Time</h3>
              <p className="text-xs text-muted mt-0.5">API cost and call volume trend</p>
            </div>
            <FilterSelect value={String(days)} onChange={(v) => setDays(Number(v))} size="sm" options={[{value:'7',label:'Last 7 days'},{value:'14',label:'Last 14 days'},{value:'30',label:'Last 30 days'},{value:'90',label:'Last 90 days'}]} />
          </div>
          {isLoading ? (
            <div className="h-64 bg-muted/10 rounded animate-pulse" />
          ) : series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted">No data for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--color-muted, #9ca3af)' }}
                  tickFormatter={(v: string) => fmtDate(v)}
                />
                <YAxis yAxisId="cost"  orientation="left"  tick={{ fontSize: 10, fill: 'var(--color-muted, #9ca3af)' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={55} />
                <YAxis yAxisId="calls" orientation="right" tick={{ fontSize: 10, fill: 'var(--color-muted, #9ca3af)' }} tickFormatter={(v: number) => fmtNum(v)} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="cost"  type="monotone" dataKey="cost"  name="Cost"   stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="calls" type="monotone" dataKey="calls" name="Calls"  stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line yAxisId="calls" type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rate limits */}
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-4">Rate Limits</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted/10 rounded animate-pulse" />
              ))}
            </div>
          ) : rateLimits.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No rate limit data.</div>
          ) : (
            <div className="space-y-4">
              {rateLimits.map((r) => <RateLimitBar key={r.feature} item={r} />)}
            </div>
          )}
        </div>
      </div>

      {/* Stats summary row */}
      {!isLoading && stats && (
        <div className="bg-surface border border-border rounded-card p-5">
          <h3 className="font-semibold text-secondary text-sm mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted mb-1">Avg Latency</p>
              <p className="text-2xl font-bold text-secondary tabular-nums">
                {stats.avgLatencyMs != null ? `${fmtNum(Math.round(stats.avgLatencyMs))}ms` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Error Rate</p>
              <p className={`text-2xl font-bold tabular-nums ${(stats.errorRatePct ?? 0) > 5 ? 'text-red-600' : 'text-secondary'}`}>
                {stats.errorRatePct != null ? `${stats.errorRatePct.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">MoM Cost Change</p>
              <p className={`text-2xl font-bold tabular-nums ${stats.costThisMonth > stats.costLastMonth ? 'text-red-600' : 'text-green-600'}`}>
                {stats.costLastMonth > 0
                  ? `${((stats.costThisMonth - stats.costLastMonth) / stats.costLastMonth * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
