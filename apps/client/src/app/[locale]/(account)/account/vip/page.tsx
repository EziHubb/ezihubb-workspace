'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, Star, Zap, Clock, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useLocale, useTranslations } from 'next-intl';
import { apiClient } from '@mlh/api-client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type VipTier = 'STANDARD' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

interface VipMe {
  tier:            VipTier;
  rollingSpend:    number;
  nextTierAt:      number | null;
  nextTier:        VipTier | null;
}

interface FlashDeal {
  id:          string;
  title:       string;
  description: string | null;
  startsAt:    string;
  endsAt:      string;
  discount:    number;
  productSlug: string | null;
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_THRESHOLDS: Record<VipTier, number> = {
  STANDARD: 0,
  GOLD:     200,
  PLATINUM: 500,
  DIAMOND:  1000,
};

const TIER_ORDER: VipTier[] = ['STANDARD', 'GOLD', 'PLATINUM', 'DIAMOND'];

const TIER_COLORS: Record<VipTier, { bg: string; text: string; border: string; badge: string }> = {
  STANDARD: {
    bg:     'bg-muted/10',
    text:   'text-secondary',
    border: 'border-border',
    badge:  'bg-muted/20 text-secondary',
  },
  GOLD: {
    bg:     'bg-yellow-50',
    text:   'text-yellow-700',
    border: 'border-yellow-200',
    badge:  'bg-yellow-100 text-yellow-800',
  },
  PLATINUM: {
    bg:     'bg-blue-50',
    text:   'text-blue-700',
    border: 'border-blue-200',
    badge:  'bg-blue-100 text-blue-800',
  },
  DIAMOND: {
    bg:     'bg-purple-50',
    text:   'text-purple-700',
    border: 'border-purple-200',
    badge:  'bg-purple-100 text-purple-800',
  },
};

const TIER_BENEFITS: Record<VipTier, string[]> = {
  STANDARD: [
    'Access to regular flash deals',
    'Standard loyalty point earn rate',
  ],
  GOLD: [
    '1-hour early access to flash deals',
    'Standard loyalty point earn rate',
    'Gold member badge on profile',
  ],
  PLATINUM: [
    '2-hour early access to flash deals',
    '1.25× loyalty point earn rate',
    'Platinum member badge on profile',
    'Priority customer support',
  ],
  DIAMOND: [
    '3-hour early access to flash deals',
    '1.5× loyalty point earn rate',
    'Access to exclusive Diamond-only products',
    'Diamond member badge on profile',
    'Dedicated VIP support line',
  ],
};

const TIER_ICONS: Record<VipTier, React.ElementType> = {
  STANDARD: Star,
  GOLD:     Crown,
  PLATINUM: Zap,
  DIAMOND:  Crown,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// ── Loading skeleton ──────────────────────────────────────────────────────────

function VipSkeleton() {
  return (
    <div className="space-y-6">
      <div className="border border-border rounded-card p-6 space-y-4">
        <Skeleton variant="rect" className="w-24 h-8 rounded-full" />
        <Skeleton variant="text" className="w-48" />
        <div className="h-3 bg-border/30 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-border rounded-card p-4 space-y-2">
            <Skeleton variant="text" className="w-20" />
            <Skeleton variant="text" className="w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VipPage() {
  const locale = useLocale();
  const t      = useTranslations('account.vip');
  const token  = useAuthStore((s) => s.accessToken);

  const { data: vip, isLoading: vipLoading } = useQuery<VipMe>({
    queryKey: ['vip', 'me'],
    queryFn:  () => apiClient.get<VipMe>('/vip/me', { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 60_000,
  });

  const { data: flashDeals } = useQuery<FlashDeal[]>({
    queryKey: ['vip', 'flash-deals-preview'],
    queryFn:  () => apiClient.get<FlashDeal[]>('/vip/flash-deals/preview', { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 120_000,
  });

  const currentTierIdx     = vip ? TIER_ORDER.indexOf(vip.tier) : 0;
  const nextTierThreshold  = vip?.nextTierAt ?? null;
  const currentSpend       = vip?.rollingSpend ?? 0;
  const tierFloor          = vip ? TIER_THRESHOLDS[vip.tier] : 0;
  const progressPct        = nextTierThreshold !== null
    ? Math.min(100, ((currentSpend - tierFloor) / (nextTierThreshold - tierFloor)) * 100)
    : 100;

  const colors   = vip ? TIER_COLORS[vip.tier] : TIER_COLORS.STANDARD;
  const TierIcon = vip ? TIER_ICONS[vip.tier] : Star;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      {vipLoading && <VipSkeleton />}

      {vip && (
        <>
          {/* Current tier card */}
          <div className={`rounded-card border p-6 space-y-5 ${colors.bg} ${colors.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors.badge}`}>
                <TierIcon className="w-6 h-6" />
              </div>
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${colors.badge}`}>
                  {vip.tier}
                </span>
                <p className="text-xs text-muted mt-0.5">{t('currentTier')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary font-medium">
                  {t('rollingSpend')} <span className="font-bold tabular-nums">${currentSpend.toFixed(2)}</span>
                </span>
                {vip.nextTier && vip.nextTierAt !== null && (
                  <span className="text-muted text-xs">
                    {t('nextAt', { tier: vip.nextTier, amount: vip.nextTierAt })}
                  </span>
                )}
              </div>

              <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width:      `${progressPct}%`,
                    background: vip.tier === 'DIAMOND' ? '#a855f7' :
                                vip.tier === 'PLATINUM' ? '#3b82f6' :
                                vip.tier === 'GOLD'     ? '#eab308' : '#6b7280',
                  }}
                />
              </div>

              {vip.nextTier && vip.nextTierAt !== null ? (
                <p className="text-xs text-muted">
                  {t('moreToReach', { amount: Math.max(0, vip.nextTierAt - currentSpend).toFixed(2), tier: vip.nextTier })}
                </p>
              ) : (
                <p className="text-xs text-muted">{t('maxTier')}</p>
              )}
            </div>
          </div>

          {/* Tier progression overview */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-secondary">{t('allTiers')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TIER_ORDER.map((tier, idx) => {
                const tc      = TIER_COLORS[tier];
                const Icon    = TIER_ICONS[tier];
                const isCurrent = tier === vip.tier;
                const isPast    = idx < currentTierIdx;

                return (
                  <div
                    key={tier}
                    className={[
                      'rounded-card border p-4 space-y-3',
                      isCurrent ? `${tc.bg} ${tc.border} ring-1 ring-inset ring-current/20` : 'bg-surface border-border',
                      isPast ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isCurrent ? tc.badge : 'bg-muted/10'}`}>
                          <Icon className={`w-4 h-4 ${isCurrent ? tc.text : 'text-muted'}`} />
                        </div>
                        <span className={`font-bold text-sm ${isCurrent ? tc.text : 'text-secondary'}`}>
                          {tier}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wide">
                            {t('currentBadge')}
                          </span>
                        )}
                      </div>
                      {TIER_THRESHOLDS[tier] > 0 && (
                        <span className="text-xs text-muted tabular-nums">${TIER_THRESHOLDS[tier]}+</span>
                      )}
                    </div>

                    <ul className="space-y-1">
                      {TIER_BENEFITS[tier].map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-xs text-muted">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-50" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Upcoming VIP flash deals */}
          {flashDeals && flashDeals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-secondary">{t('upcomingDeals')}</h2>
              </div>
              <div className="space-y-3">
                {flashDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="border border-border rounded-card px-4 py-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-semibold text-secondary line-clamp-1">{deal.title}</p>
                      {deal.description && (
                        <p className="text-xs text-muted line-clamp-1">{deal.description}</p>
                      )}
                      <p className="text-xs text-muted">
                        {t('dealStarts', { date: dateFmt.format(new Date(deal.startsAt)) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {t('dealOff', { discount: deal.discount })}
                      </span>
                      {deal.productSlug && (
                        <Link
                          href={`/${locale}/products/${deal.productSlug}`}
                          className="text-xs font-medium border border-border px-3 py-1.5 rounded-button hover:border-primary hover:text-primary transition-colors"
                        >
                          {t('dealView')}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {flashDeals && flashDeals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-border rounded-card">
              <ShoppingBag className="w-10 h-10 text-muted/30" />
              <p className="text-sm text-muted">{t('noDeals')}</p>
            </div>
          )}
        </>
      )}

      {!vipLoading && !vip && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Crown className="w-14 h-14 text-muted/30" />
          <div>
            <p className="font-semibold text-secondary text-base">{t('signIn')}</p>
            <p className="text-sm text-muted mt-1">{t('signInSub')}</p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            {t('signInBtn')}
          </Link>
        </div>
      )}
    </div>
  );
}
