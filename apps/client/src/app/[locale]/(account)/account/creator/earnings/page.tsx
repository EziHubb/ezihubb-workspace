'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { TrendingUp, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useAuthQuery } from '../../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreatorBalance {
  confirmedBalance: number;
  pendingBalance:   number;
  totalEarned:      number;
}

interface Earning {
  id:        string;
  amount:    number;
  status:    'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  level:     number;
  orderId:   string | null;
  createdAt: string;
  lockedAt:  string | null;
  paidAt:    string | null;
}

interface EarningsPage {
  data:  Earning[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function formatDate(d: string) { return fmt.format(new Date(d)); }

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

const STATUS_COLORS: Record<Earning['status'], string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  PAID:      'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_TABS  = ['ALL', 'PENDING', 'CONFIRMED', 'PAID', 'CANCELLED'] as const;
const TYPE_TABS    = ['ALL', 'DIRECT', 'COMMUNITY']                       as const;
type  StatusTab = typeof STATUS_TABS[number];
type  TypeTab   = typeof TYPE_TABS[number];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatorEarningsPage() {
  const locale     = useLocale();
  const [status,   setStatus  ] = useState<StatusTab>('ALL');
  const [typeTab,  setTypeTab ] = useState<TypeTab>('ALL');
  const [page,     setPage    ] = useState(1);

  const { data: me } = useAuthQuery<CreatorBalance>(
    ['creator', 'me', 'balance-summary'],
    API_ROUTES.CREATORS.ME,
  );

  const qp: Record<string, string | number> = { page, limit: 20 };
  if (status  !== 'ALL') qp.status = status;
  if (typeTab !== 'ALL') qp.level  = typeTab === 'DIRECT' ? 1 : 2;

  const { data, isLoading } = useAuthQuery<EarningsPage>(
    ['creator', 'me', 'earnings', status, typeTab, page],
    API_ROUTES.CREATORS.ME_EARNINGS,
    qp,
  );

  const handleStatus = (t: StatusTab) => { setStatus(t);  setPage(1); };
  const handleType   = (t: TypeTab)   => { setTypeTab(t); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Earnings History</h1>
          <p className="text-sm text-muted mt-0.5">Every earning from your direct and community sales.</p>
        </div>
        <Link href={`/${locale}/account/creator/payouts`}
          className="text-sm font-medium text-primary hover:underline">
          Withdraw earnings →
        </Link>
      </div>

      {/* ── Balance summary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: DollarSign,   label: 'Available',    value: fmtAmount(me?.confirmedBalance ?? 0), sub: 'ready to withdraw', color: 'bg-green-500'  },
          { icon: Clock,        label: 'Pending',       value: fmtAmount(me?.pendingBalance   ?? 0), sub: 'unlocking soon',    color: 'bg-amber-500' },
          { icon: CheckCircle2, label: 'All-time',      value: fmtAmount(me?.totalEarned      ?? 0), sub: 'total earned',      color: 'bg-[#7C3AED]' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-lg font-bold text-secondary tabular-nums">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Type filter ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_TABS.map((t) => (
          <button key={t} type="button" onClick={() => handleType(t)}
            className={[
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
              typeTab === t
                ? t === 'DIRECT'    ? 'bg-primary/10 text-primary border-primary/30'
                  : t === 'COMMUNITY' ? 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30'
                  : 'bg-secondary/10 text-secondary border-secondary/20'
                : 'text-muted border-border hover:border-secondary/30',
            ].join(' ')}>
            {t === 'ALL' ? 'All types' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <nav className="flex gap-0.5 -mb-px">
          {STATUS_TABS.map((t) => (
            <button key={t} type="button" onClick={() => handleStatus(t)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                status === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-secondary hover:border-border',
              ].join(' ')}>
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="border border-border rounded-card overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
              <div className="space-y-1.5"><Skeleton variant="text" className="w-40" /><Skeleton variant="text" className="w-24" /></div>
              <Skeleton variant="text" className="w-16" />
            </div>
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <TrendingUp className="w-10 h-10 text-muted/30" />
          <p className="text-sm text-muted">No earnings found for this filter.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#FAFAF8]">
                    {['Date', 'Type', 'Order', 'Unlock', 'Status', 'Amount'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((c) => {
                    const lockDays = c.status === 'PENDING' ? daysUntil(c.lockedAt) : null;
                    return (
                      <tr key={c.id} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.level === 1 ? 'bg-primary/10 text-primary' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>
                            {c.level === 1 ? '⬤ Direct' : '⬡ Community'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted font-mono">
                          {c.orderId ? `#${c.orderId.slice(-8).toUpperCase()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                          {c.paidAt
                            ? `Paid ${formatDate(c.paidAt)}`
                            : c.lockedAt
                              ? lockDays !== null
                                ? `${lockDays}d remaining`
                                : formatDate(c.lockedAt)
                              : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                            {c.status === 'CONFIRMED' ? 'Ready' : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-green-700 text-sm whitespace-nowrap">
                          +{fmtAmount(c.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data.total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{data.total} total earnings</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                  Previous
                </button>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={data.data.length < 20}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
