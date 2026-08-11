'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Wallet, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';

interface PayoutStats { available: number; pending: number; totalPaid: number }
interface Payout { id: string; amount: number; status: string; requestedAt: string; paidAt: string | null }

export default function SellerPayoutsPage() {
  const t      = useTranslations('seller');
  const locale = useLocale();
  const token  = useAuthStore((s) => s.accessToken);

  const { data: stats } = useQuery<PayoutStats>({
    queryKey: ['seller-payout-stats'],
    queryFn:  () => apiClient.get<PayoutStats>(API_ROUTES.SELLER.PAYOUT_STATS, { token: token ?? undefined }),
    enabled:  !!token,
  });

  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ['seller-payouts'],
    queryFn:  () => apiClient.get<Payout[]>(API_ROUTES.SELLER.PAYOUTS, { token: token ?? undefined }),
    enabled:  !!token,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-secondary">{t('payouts.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('payouts.stats.available'),  value: stats?.available  ?? 0, icon: Wallet,      color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: t('payouts.stats.pending'),    value: stats?.pending    ?? 0, icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: t('payouts.stats.totalPaid'), value: stats?.totalPaid  ?? 0, icon: CheckCircle, color: 'text-blue-600',   bg: 'bg-blue-50'   },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-5 space-y-2">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-secondary">{fmtAmount(value)}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">{t('payouts.history')}</h2>
        </div>
        {payouts.length === 0 ? (
          <div className="p-10 text-center">
            <TrendingUp className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">{t('payouts.noPayouts')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/40">
              <tr>
                {[t('payouts.table.amount'), t('payouts.table.status'), t('payouts.table.requested'), t('payouts.table.paid')].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-3 font-bold text-secondary">{fmtAmount(p.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-border/30 text-muted'
                    }`}>{t.has(`status.${p.status}`) ? t(`status.${p.status}`) : p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-muted">{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(p.requestedAt))}</td>
                  <td className="px-5 py-3 text-muted">{p.paidAt ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(p.paidAt)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
