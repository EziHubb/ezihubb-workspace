'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Wallet, Clock } from 'lucide-react';
import { Pagination, Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';

interface Payout {
  id:            string;
  period:        string;
  amount:        number;
  platformFee:   number;
  orderCount:    number;
  status:        'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt:        string | null;
  paymentMethod: string | null;
}

interface PayoutsResponse {
  data:             Payout[];
  pagination:       { page: number; totalPages: number; total: number };
  availableBalance: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
};

const fmt    = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const $      = (n: number) => `$${n.toFixed(2)}`;

export default function SellerPayoutsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuthQuery<PayoutsResponse>(
    ['seller', 'payouts', page],
    '/seller/payouts',
    { page, limit: 20 },
  );

  const payouts    = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const balance    = data?.availableBalance       ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">Payouts</h1>

      {/* Available balance card */}
      <div className="bg-primary/5 border border-primary/20 rounded-card p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-0.5">Available Balance</p>
          {isLoading
            ? <Skeleton variant="text" className="w-32 h-8" />
            : <p className="text-3xl font-bold text-secondary tabular-nums">{$(balance)}</p>
          }
          <p className="text-xs text-muted mt-1">
            Payouts are processed monthly. Contact support for early payout requests.
          </p>
        </div>
      </div>

      {/* History */}
      <section>
        <h2 className="font-semibold text-secondary mb-4">Payout History</h2>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-16 rounded-card" />
            ))}
          </div>
        )}

        {!isLoading && payouts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-dashed border-border rounded-card">
            <Clock className="w-10 h-10 text-muted/30" />
            <p className="text-sm text-muted">No payouts yet. Your first payout will appear here once processed.</p>
          </div>
        )}

        {!isLoading && payouts.length > 0 && (
          <>
            <div className="space-y-2">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 p-4 border border-border rounded-card"
                >
                  <div>
                    <p className="text-sm font-semibold text-secondary">{p.period}</p>
                    <p className="text-xs text-muted">
                      {p.orderCount} order{p.orderCount !== 1 ? 's' : ''}
                      {p.paidAt && ` · Paid ${fmt.format(new Date(p.paidAt))}`}
                      {p.paymentMethod && ` via ${p.paymentMethod}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status]}`}
                    >
                      {p.status}
                    </span>
                    <span className="font-bold text-secondary tabular-nums">{$(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
