'use client';

import { useState } from 'react';
import { Star, TrendingUp, Clock, Camera, PenLine, ShoppingBag, Tag } from 'lucide-react';
import { Skeleton, Pagination } from '@ezihubb/ui';
import { useTranslations } from 'next-intl';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoinBalance {
  balance:         number;
  lifetimeEarned:  number;
  expiringIn30Days: number;
}

interface CoinTransaction {
  id:            string;
  type:          'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST' | 'BONUS';
  amount:        number;
  balanceAfter:  number;
  description:   string | null;
  createdAt:     string;
}

interface CoinHistoryPage {
  data: CoinTransaction[];
  pagination: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const TX_COLOR: Record<CoinTransaction['type'], string> = {
  EARN:   'text-success',
  REDEEM: 'text-primary',
  EXPIRE: 'text-muted',
  ADJUST: 'text-secondary',
  BONUS:  'text-success',
};

function signedAmount(tx: CoinTransaction) {
  if (tx.type === 'REDEEM' || tx.type === 'EXPIRE') return `-${Math.abs(tx.amount)}`;
  return `+${Math.abs(tx.amount)}`;
}

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

// ── Earn method card ──────────────────────────────────────────────────────────

function EarnCard({
  icon: Icon,
  label,
  coins,
  iconColor = 'text-primary',
}: {
  icon:       React.ElementType;
  label:      string;
  coins:      number;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-card">
      <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary">{label}</p>
      </div>
      <span className="text-sm font-bold text-primary tabular-nums shrink-0">+{coins} coins</span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CoinsSkeleton() {
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
            <div className="text-right space-y-1.5">
              <Skeleton variant="text" className="w-16" />
              <Skeleton variant="text" className="w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoinsPage() {
  const t = useTranslations('account.coins');
  const [page, setPage] = useState(1);

  const { data: balance, isLoading: balanceLoading } = useAuthQuery<CoinBalance>(
    ['coins', 'me'],
    API_ROUTES.COINS.ME,
  );

  const { data: history, isLoading: historyLoading } = useAuthQuery<CoinHistoryPage>(
    ['coins', 'history', page],
    API_ROUTES.COINS.HISTORY,
    { page, limit: 20 },
  );

  const isLoading  = balanceLoading || historyLoading;
  const totalPages = history?.pagination?.totalPages ?? 1;

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      {isLoading && <CoinsSkeleton />}

      {!isLoading && (
        <>
          {/* ── Balance summary cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Star}
              label={t('currentBalance')}
              value={`${(balance?.balance ?? 0).toLocaleString()} ${t('coinsUnit')}`}
              sub={t('worth', { value: ((balance?.balance ?? 0) / 100).toFixed(2) })}
              color="text-primary"
            />
            <StatCard
              icon={TrendingUp}
              label={t('lifetimeEarned')}
              value={`${(balance?.lifetimeEarned ?? 0).toLocaleString()} ${t('coinsUnit')}`}
            />
            <StatCard
              icon={Clock}
              label={t('expiringIn30Days')}
              value={`${(balance?.expiringIn30Days ?? 0).toLocaleString()} ${t('coinsUnit')}`}
              sub={balance?.expiringIn30Days ? t('useThemSoon') : t('nothingExpiring')}
              color={balance?.expiringIn30Days ? 'text-error' : 'text-secondary'}
            />
          </div>

          {/* ── How to earn ───────────────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">{t('howToEarn')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <EarnCard icon={ShoppingBag} label={t('earnPurchase')} coins={10} />
              <EarnCard icon={PenLine}     label={t('earnReview')}   coins={50} />
              <EarnCard icon={Camera}      label={t('earnPhotoReview')} coins={100} />
            </div>
            <div className="mt-3 p-4 bg-[#FAFAF8] border border-border rounded-card text-xs text-muted space-y-1">
              <p>{t('infoExchange')}</p>
              <p>{t('infoLock')}</p>
              <p>{t('infoExpiry')}</p>
            </div>
          </div>

          {/* ── Transaction history ───────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">{t('history')}</h2>

            {(!history?.data || history.data.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Tag className="w-10 h-10 text-muted/30" />
                <p className="text-sm text-muted">{t('historyEmpty')}</p>
              </div>
            ) : (
              <>
                <div className="border border-border rounded-card overflow-hidden">
                  <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 bg-muted/5 border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">
                    <span>{t('tableDate')}</span>
                    <span>{t('tableType')}</span>
                    <span className="text-right">{t('tableAmount')}</span>
                    <span className="text-right">{t('tableBalanceAfter')}</span>
                  </div>

                  {history.data.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:grid sm:grid-cols-4 sm:gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-surface transition-colors gap-1"
                    >
                      <div className="flex sm:block items-center gap-2">
                        <span className="text-xs text-muted sm:hidden font-medium">{t('dateLabel')}</span>
                        <span className="text-sm text-secondary">{fmt.format(new Date(tx.createdAt))}</span>
                      </div>
                      <div className="flex sm:block items-center gap-2">
                        <span className="text-xs text-muted sm:hidden font-medium">{t('typeLabel')}</span>
                        <p className="text-sm font-medium text-secondary">{tx.description ?? tx.type}</p>
                      </div>
                      <div className="flex sm:block items-center gap-2 sm:text-right">
                        <span className="text-xs text-muted sm:hidden font-medium">{t('amountLabel')}</span>
                        <span className={`text-sm font-bold tabular-nums ${TX_COLOR[tx.type]}`}>
                          {signedAmount(tx)} {t('coinsUnit')}
                        </span>
                      </div>
                      <div className="flex sm:block items-center gap-2 sm:text-right">
                        <span className="text-xs text-muted sm:hidden font-medium">{t('balanceLabel')}</span>
                        <span className="text-sm tabular-nums text-secondary">
                          {tx.balanceAfter.toLocaleString()} {t('coinsUnit')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
