'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart2, DollarSign, Wallet, Store, Clock } from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../components/data/StatCard';
import { api } from '../../../lib/api-client';
import { fmtAmount } from '../../../lib/fmt';

interface FinanceStats {
  totalFeesCollected:  number;
  feesThisMonth:       number;
  pendingPayoutAmount: number;
  pendingPayoutCount:  number;
  totalPaidOutAmount:  number;
  totalPaidOutCount:   number;
  activeStores:        number;
}

const QK = ['admin-finance-stats'];

export default function AdminFinancePage() {
  const { data: stats, isLoading } = useQuery<FinanceStats>({
    queryKey: QK,
    queryFn:  () => api.get<FinanceStats>('/admin/finance/stats'),
    staleTime: 60_000,
  });

  return (
    <div>
      <AdminPageHeader
        title="Finance"
        subtitle="Platform revenue and payout overview"
        queryKey={QK}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-card p-5 shadow-card border border-border h-24 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Fees Collected"
              value={fmtAmount(stats?.totalFeesCollected ?? 0)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              label="Fees This Month"
              value={fmtAmount(stats?.feesThisMonth ?? 0)}
              icon={BarChart2}
              color="coral"
            />
            <StatCard
              label="Pending Payout"
              value={fmtAmount(stats?.pendingPayoutAmount ?? 0)}
              icon={Clock}
              color="amber"
            />
            <StatCard
              label="Total Paid Out"
              value={fmtAmount(stats?.totalPaidOutAmount ?? 0)}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              label="Active Stores"
              value={String(stats?.activeStores ?? 0)}
              icon={Store}
              color="coral"
            />
          </>
        )}
      </div>

      <div className="bg-surface border border-border rounded-card p-6">
        <p className="text-sm text-muted">
          Detailed revenue charts, store-by-store breakdowns, and custom date range reports
          will be available in a future update.
        </p>
      </div>
    </div>
  );
}
