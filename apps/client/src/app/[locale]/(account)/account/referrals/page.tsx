'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  Share2,
  ChevronRight,
} from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralTier {
  name:          string;
  badgeColor:    string;
  badgeIcon:     string;
  commissionRate: number;
  minReferrals:  number;
  nextTier?: {
    name:        string;
    minReferrals: number;
  };
}

interface ReferralMe {
  referralCode:    string;
  tier:            ReferralTier;
  directReferrals: number;
  level2Referrals: number;
  level3Referrals: number;
  totalEarned:     number;
  pendingBalance:  number;
  confirmedBalance: number;
}

interface ReferralCommission {
  id:        string;
  amount:    number;
  status:    'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  level:     number;
  orderId:   string | null;
  fromUser?: { firstName: string; lastName: string };
  createdAt: string;
  lockedAt:  string | null;
}

interface CommissionsPage {
  data:  ReferralCommission[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function formatDate(d: string) { return fmt.format(new Date(d)); }

const STATUS_COLORS: Record<ReferralCommission['status'], string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  PAID:      'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
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

function ReferralsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-card p-5 space-y-3">
        <Skeleton variant="text" className="w-32" />
        <Skeleton variant="text" className="w-full h-10" />
      </div>
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

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-2 rounded-button border border-border text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors shrink-0"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const locale = useLocale();

  const { data: me, isLoading: meLoading } = useAuthQuery<ReferralMe>(
    ['referrals', 'me'],
    API_ROUTES.REFERRALS.ME,
  );

  const { data: commissionsPage, isLoading: commissionsLoading } = useAuthQuery<CommissionsPage>(
    ['referrals', 'me', 'commissions', 'recent'],
    API_ROUTES.REFERRALS.ME_COMMISSIONS,
    { page: 1, limit: 5 },
  );

  const isLoading = meLoading || commissionsLoading;

  const referralLink =
    me?.referralCode
      ? (typeof window !== 'undefined'
          ? `${window.location.origin}/products?ref=${me.referralCode}`
          : `/products?ref=${me.referralCode}`)
      : '';

  const whatsappUrl = referralLink
    ? `https://wa.me/?text=${encodeURIComponent(`Check out Daily Daisy! Use my referral link: ${referralLink}`)}`
    : '#';
  const facebookUrl = referralLink
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`
    : '#';
  const twitterUrl = referralLink
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Shop handmade with my link and we both earn rewards! ${referralLink}`)}`
    : '#';

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Referrals</h1>
        <p className="text-sm text-muted mt-1">
          Share your link, earn commissions when friends shop.
        </p>
      </div>

      {isLoading && <ReferralsSkeleton />}

      {me && (
        <>
          {/* ── Tier badge ─────────────────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-card p-5 flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: me.tier.badgeColor + '20', border: `2px solid ${me.tier.badgeColor}` }}
            >
              {me.tier.badgeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: me.tier.badgeColor + '20', color: me.tier.badgeColor }}
                >
                  {me.tier.name}
                </span>
                <span className="text-xs text-muted">
                  {(me.tier.commissionRate * 100).toFixed(0)}% commission rate
                </span>
              </div>
              <p className="text-sm text-secondary mt-1">
                {me.directReferrals} direct referral{me.directReferrals !== 1 ? 's' : ''}
              </p>
              {me.tier.nextTier && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span>Progress to {me.tier.nextTier.name}</span>
                    <span>{me.directReferrals} / {me.tier.nextTier.minReferrals}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (me.directReferrals / me.tier.nextTier.minReferrals) * 100)}%`,
                        backgroundColor: me.tier.badgeColor,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Referral link ──────────────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <Share2 className="w-4 h-4 text-primary" />
              Your referral link
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 min-w-0 bg-[#FAFAF8] border border-border rounded-button px-3 py-2 text-sm text-secondary font-mono truncate focus:outline-none focus:border-primary"
              />
              <CopyButton text={referralLink} />
            </div>
            {/* Share buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">Share via:</span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors"
              >
                Facebook
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition-colors"
              >
                Twitter / X
              </a>
            </div>
          </div>

          {/* ── How it works ───────────────────────────────────────────────── */}
          <div className="bg-[#FAFAF8] border border-border rounded-card p-5">
            <p className="text-sm font-semibold text-secondary mb-3">How it works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  title: 'Share your link',
                  desc: 'Copy your unique referral link and share it with friends and family.',
                },
                {
                  step: '2',
                  title: 'Friends shop',
                  desc: 'When someone places an order using your link, it gets tracked automatically.',
                },
                {
                  step: '3',
                  title: 'You earn commissions',
                  desc: 'Commissions are confirmed after the order is fulfilled and locked.',
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary">{title}</p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Users}
              label="Direct refs"
              value={me.directReferrals}
              color="text-primary"
            />
            <StatCard
              icon={Users}
              label="Level 2"
              value={me.level2Referrals}
            />
            <StatCard
              icon={Users}
              label="Level 3"
              value={me.level3Referrals}
            />
            <StatCard
              icon={TrendingUp}
              label="All-time earned"
              value={`$${me.totalEarned.toFixed(2)}`}
            />
            <StatCard
              icon={DollarSign}
              label="Balance"
              value={`$${me.confirmedBalance.toFixed(2)}`}
              sub={me.pendingBalance > 0 ? `+$${me.pendingBalance.toFixed(2)} pending` : undefined}
              color="text-green-700"
            />
          </div>

          {/* ── Quick links ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href={`/${locale}/account/referrals/earnings`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary transition-colors group"
            >
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
                  Commission History
                </p>
                <p className="text-xs text-muted mt-0.5">View all your earnings by order</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href={`/${locale}/account/referrals/payouts`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary transition-colors group"
            >
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
                  Payouts
                </p>
                <p className="text-xs text-muted mt-0.5">Request a payout of your balance</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>

          {/* ── Recent commissions ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-secondary">Recent Earnings</h2>
              <Link
                href={`/${locale}/account/referrals/earnings`}
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {commissionsLoading && (
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
            )}

            {!commissionsLoading && commissionsPage && (
              commissionsPage.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Users className="w-10 h-10 text-muted/30" />
                  <p className="text-sm text-muted">No commissions yet. Share your link to start earning!</p>
                </div>
              ) : (
                <div className="border border-border rounded-card overflow-hidden">
                  {commissionsPage.data.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-surface transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-secondary">
                          {c.fromUser
                            ? `${c.fromUser.firstName} ${c.fromUser.lastName}`
                            : `Level ${c.level} commission`}
                          {c.orderId && (
                            <span className="text-xs text-muted ml-2">Order #{c.orderId.slice(-8).toUpperCase()}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">{formatDate(c.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}
                        >
                          {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-green-700">
                          +${c.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
