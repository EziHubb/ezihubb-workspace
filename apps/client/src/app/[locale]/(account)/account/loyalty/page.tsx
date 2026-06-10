'use client';

import { Star, Clock, TrendingUp, Tag } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyTransaction {
  id:          string;
  type:        'EARN' | 'REDEEM' | 'CANCEL' | 'EXPIRE' | 'ADJUST';
  points:      number;
  description: string | null;
  orderId:     string | null;
  confirmedAt: string | null;
  createdAt:   string;
}

interface LoyaltyAccount {
  pointsBalance:  number;
  pointsPending:  number;
  pointsLifetime: number;
  transactions:   LoyaltyTransaction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function formatDate(d: string) {
  return fmt.format(new Date(d));
}

const TX_LABELS: Record<LoyaltyTransaction['type'], string> = {
  EARN:   'Points earned',
  REDEEM: 'Points redeemed',
  CANCEL: 'Points cancelled',
  EXPIRE: 'Points expired',
  ADJUST: 'Manual adjustment',
};

const TX_COLOR: Record<LoyaltyTransaction['type'], string> = {
  EARN:   'text-success',
  REDEEM: 'text-primary',
  CANCEL: 'text-error',
  EXPIRE: 'text-muted',
  ADJUST: 'text-secondary',
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-secondary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoyaltySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-card p-5 space-y-2">
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="text" className="w-16 h-8" />
          </div>
        ))}
      </div>
      <div className="border border-border rounded-card overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
            <div className="space-y-1.5">
              <Skeleton variant="text" className="w-36" />
              <Skeleton variant="text" className="w-24" />
            </div>
            <Skeleton variant="text" className="w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const { data, isLoading } = useAuthQuery<LoyaltyAccount>(
    ['loyalty', 'me'],
    API_ROUTES.LOYALTY.ME,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Loyalty Points</h1>
        <p className="text-sm text-muted mt-1">
          Earn 10 points for every $1 spent. Redeem 100 points = $1 off your next order.
        </p>
      </div>

      {isLoading && <LoyaltySkeleton />}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Star}
              label="Available balance"
              value={`${data.pointsBalance.toLocaleString()} pts`}
              sub={`worth $${(data.pointsBalance * 0.01).toFixed(2)}`}
              color="text-primary"
            />
            <StatCard
              icon={Clock}
              label="Pending (14-day lock)"
              value={`${data.pointsPending.toLocaleString()} pts`}
              sub="Unlocks 14 days after delivery"
            />
            <StatCard
              icon={TrendingUp}
              label="Lifetime earned"
              value={`${data.pointsLifetime.toLocaleString()} pts`}
              sub={`worth $${(data.pointsLifetime * 0.01).toFixed(2)}`}
            />
          </div>

          {/* How it works */}
          <div className="bg-[#FAFAF8] border border-border rounded-card p-5 text-sm text-secondary space-y-2">
            <p className="font-semibold">How it works</p>
            <ul className="space-y-1 text-muted list-disc list-inside">
              <li>Earn <strong className="text-secondary">10 points</strong> for every $1 spent on an order.</li>
              <li>Points are <strong className="text-secondary">locked for 14 days</strong> after your order is delivered.</li>
              <li>Redeem at checkout — <strong className="text-secondary">100 points = $1 off</strong>. Minimum 100 points.</li>
              <li>Points cannot cover more than 50% of your order total.</li>
              <li>Points are cancelled if an order is refunded.</li>
            </ul>
          </div>

          {/* Transaction history */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">Transaction History</h2>
            {data.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Tag className="w-10 h-10 text-muted/30" />
                <p className="text-sm text-muted">No transactions yet. Place your first order to earn points!</p>
              </div>
            ) : (
              <div className="border border-border rounded-card overflow-hidden">
                {data.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-surface transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-secondary">
                        {tx.description ?? TX_LABELS[tx.type]}
                      </p>
                      <p className="text-xs text-muted">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${TX_COLOR[tx.type]}`}>
                      {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
