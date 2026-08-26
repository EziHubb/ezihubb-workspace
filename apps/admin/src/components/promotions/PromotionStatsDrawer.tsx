'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { X, Users, DollarSign, TrendingUp, Award } from 'lucide-react';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtNum, fmtAmount, safeArr, fmtDate, capitalize } from '../../lib/fmt';
import type { Promotion } from './PromotionModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyUsage {
  date:  string;
  count: number;
}

interface UsageRow {
  id:           string;
  customerName: string;
  customerEmail: string;
  orderId:      string;
  orderNumber:  string;
  discountAmount: number;
  usedAt:       string;
}

interface PromotionStats {
  totalUsed:        number;
  totalDiscount:    number;
  avgOrderSize:     number;
  topUserEmail?:    string;
  topUserUses?:     number;
  dailyUsage:       DailyUsage[];
  recentUsages:     UsageRow[];
}

// ── Status badge (reused from page) ──────────────────────────────────────────

function getStatus(p: Promotion): 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'SCHEDULED' {
  const now = new Date();
  if (p.expiresAt && new Date(p.expiresAt) < now) return 'EXPIRED';
  if (!p.isActive)                                 return 'PAUSED';
  if (p.startsAt && new Date(p.startsAt) > now)   return 'SCHEDULED';
  return 'ACTIVE';
}

const STATUS_STYLE = {
  ACTIVE:    'bg-green-100 text-green-700',
  PAUSED:    'bg-amber-100 text-amber-700',
  EXPIRED:   'bg-red-100 text-red-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
};

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { value: number }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-button shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-secondary">{label}</p>
      <p className="text-primary mt-0.5">{payload[0].value} uses</p>
    </div>
  );
}

// ── Stat mini card ────────────────────────────────────────────────────────────

function StatMini({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-background rounded-button border border-border p-3 text-center">
      <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
      <p className="text-base font-bold text-secondary tabular-nums">{value}</p>
      <p className="text-[11px] text-muted mt-0.5">{label}</p>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

interface PromotionStatsDrawerProps {
  promotion: Promotion;
  onClose:   () => void;
}

export function PromotionStatsDrawer({ promotion, onClose }: PromotionStatsDrawerProps) {
  const status = getStatus(promotion);

  const { data: stats, isLoading } = useQuery<PromotionStats>({
    queryKey: ['promo-stats', promotion.id],
    queryFn:  () => api.get<PromotionStats>(API_ROUTES.ADMIN.PROMOTION_STATS(promotion.id)),
    staleTime: 60_000,
  });

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
            <code className="font-mono font-bold text-secondary text-base tracking-widest">{promotion.code}</code>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}>
              {capitalize(status)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted/10 rounded-button" />
                ))}
              </div>
              <div className="h-48 bg-muted/10 rounded-card" />
              <div className="h-48 bg-muted/10 rounded-card" />
            </div>
          ) : stats ? (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatMini
                  label="Total Used"
                  value={fmtNum(stats.totalUsed)}
                  icon={Users}
                />
                <StatMini
                  label="Discount Given"
                  value={fmtAmount(stats.totalDiscount)}
                  icon={DollarSign}
                />
                <StatMini
                  label="Avg Order Size"
                  value={fmtAmount(stats.avgOrderSize)}
                  icon={TrendingUp}
                />
                <StatMini
                  label="Top User"
                  value={stats.topUserUses ? `${stats.topUserUses}×` : '—'}
                  icon={Award}
                />
              </div>

              {stats.topUserEmail && (
                <p className="text-xs text-muted -mt-2">
                  Top user: <span className="font-medium text-secondary">{stats.topUserEmail}</span>
                </p>
              )}

              {/* Daily usage chart */}
              <div>
                <h5 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                  Daily Usage — Last 30 Days
                </h5>
                {safeArr(stats.dailyUsage).length > 0 ? (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={safeArr(stats.dailyUsage)} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d: string) => fmtDate(d)}
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
                        <Bar dataKey="count" fill="#E85D3F" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted text-center py-8">No usage data yet.</p>
                )}
              </div>

              {/* Recent usages table */}
              <div>
                <h5 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                  Recent Usages
                </h5>
                {safeArr(stats.recentUsages).length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">No usages recorded yet.</p>
                ) : (
                  <div className="border border-border rounded-card overflow-hidden">
                    <div className="overflow-x-auto">
                      {/* Scrolls itself rather than the page: a table cannot shrink
                          below the width of its columns. */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background">
                          {['Customer', 'Order', 'Discount', 'Date'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {safeArr<UsageRow>(stats.recentUsages).map((u) => (
                          <tr key={u.id} className="hover:bg-muted/3 transition-colors">
                            <td className="px-3 py-2.5">
                              <p className="text-xs font-medium text-secondary truncate max-w-[100px]">
                                {u.customerName}
                              </p>
                              <p className="text-[10px] text-muted truncate max-w-[100px]">
                                {u.customerEmail}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-xs font-mono text-primary">
                                #{u.orderNumber}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-secondary tabular-nums">
                              −{fmtAmount(u.discountAmount)}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-muted whitespace-nowrap">
                              {fmtDate(u.usedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted text-center py-12">Failed to load stats.</p>
          )}
        </div>
      </div>
    </>
  );
}
