'use client';

import { Star, Clock, TrendingUp, Tag, CreditCard } from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useTranslations } from 'next-intl';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '../../../../../lib/fmt';

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

interface StoreCredit {
  id:        string;
  storeId:   string;
  amount:    number;
  expiresAt: string;
  reason:    string;
  createdAt: string;
}

interface StoreCreditSummary {
  credits: StoreCredit[];
  total:   number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function formatDate(d: string) {
  return fmt.format(new Date(d));
}

const TX_TYPE_KEYS: Record<LoyaltyTransaction['type'], string> = {
  EARN:   'EARN',
  REDEEM: 'REDEEM',
  CANCEL: 'CANCEL',
  EXPIRE: 'EXPIRE',
  ADJUST: 'ADJUST',
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
  const t = useTranslations('account');
  const { data, isLoading } = useAuthQuery<LoyaltyAccount>(
    ['loyalty', 'me'],
    API_ROUTES.LOYALTY.ME,
  );
  const { data: storeCreditData } = useAuthQuery<StoreCreditSummary>(
    ['account', 'store-credits'],
    API_ROUTES.STORE_CREDITS.STORE_CREDITS_ME,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">{t('loyalty.title')}</h1>
        <p className="text-sm text-muted mt-1">
          {t('loyalty.subtitle')}
        </p>
      </div>

      {isLoading && <LoyaltySkeleton />}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Star}
              label={t('loyalty.stats.availableBalance')}
              value={`${data.pointsBalance.toLocaleString()} pts`}
              sub={`worth $${(data.pointsBalance * 0.01).toFixed(2)}`}
              color="text-primary"
            />
            <StatCard
              icon={Clock}
              label={t('loyalty.stats.pending')}
              value={`${data.pointsPending.toLocaleString()} pts`}
              sub={t('loyalty.stats.pendingUnlock')}
            />
            <StatCard
              icon={TrendingUp}
              label={t('loyalty.stats.lifetimeEarned')}
              value={`${data.pointsLifetime.toLocaleString()} pts`}
              sub={`worth $${(data.pointsLifetime * 0.01).toFixed(2)}`}
            />
          </div>

          {/* How it works */}
          <div className="bg-[#FAFAF8] border border-border rounded-card p-5 text-sm text-secondary space-y-2">
            <p className="font-semibold">{t('loyalty.howItWorks.title')}</p>
            <ul className="space-y-1 text-muted list-disc list-inside">
              <li>{t('loyalty.howItWorks.earn', { points: 10 })}</li>
              <li>{t('loyalty.howItWorks.lock')}</li>
              <li>{t('loyalty.howItWorks.redeem')}</li>
              <li>{t('loyalty.howItWorks.cap')}</li>
              <li>{t('loyalty.howItWorks.cancel')}</li>
            </ul>
          </div>

          {/* Transaction history */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">{t('loyalty.history.title')}</h2>
            {data.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Tag className="w-10 h-10 text-muted/30" />
                <p className="text-sm text-muted">{t('loyalty.history.empty')}</p>
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
                        {tx.description ?? t(`loyalty.history.types.${TX_TYPE_KEYS[tx.type]}` as Parameters<typeof t>[0])}
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

      {/* ── Store Credits ──────────────────────────────────────────────────────── */}
      {storeCreditData && (storeCreditData.total > 0 || storeCreditData.credits.length > 0) && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-secondary">Store Credits</h2>
          </div>

          {/* Balance summary */}
          <div className="bg-green-50 border border-green-200 rounded-card p-4 flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Available balance</p>
              <p className="text-xl font-bold text-green-700 tabular-nums">{fmtAmount(storeCreditData.total)}</p>
              <p className="text-xs text-muted">Applied automatically at checkout</p>
            </div>
          </div>

          {/* Individual credits */}
          {storeCreditData.credits.length > 0 && (
            <div className="border border-border rounded-card overflow-hidden">
              {storeCreditData.credits.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {c.reason === 'BUYER_REFERRAL' ? '🎁 Referral' : c.reason === 'ADMIN_GRANT' ? '🎟️ Grant' : '↩ Return'}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Expires {new Date(c.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-green-700">{fmtAmount(Number(c.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
