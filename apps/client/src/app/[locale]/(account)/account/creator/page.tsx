'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Users, DollarSign, TrendingUp, Copy, Check, Share2, ChevronRight,
} from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreatorTier {
  name:           string;
  badgeColor:     string;
  badgeIcon:      string;
  commissionRate: number;
  minReferrals:   number;
  nextTier?: { name: string; minReferrals: number };
}

interface CreatorMe {
  referralCode:     string;
  tier:             CreatorTier;
  directReferrals:  number;
  level2Referrals:  number;
  level3Referrals:  number;
  totalEarned:      number;
  pendingBalance:   number;
  confirmedBalance: number;
}

interface Earning {
  id:        string;
  amount:    number;
  status:    'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  level:     number;
  orderId:   string | null;
  createdAt: string;
  lockedAt:  string | null;
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

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  return (
    <button type="button" onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-2 rounded-button border border-border text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors shrink-0">
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-secondary' }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatorHubPage() {
  const locale = useLocale();

  const { data: me, isLoading: meLoading } = useAuthQuery<CreatorMe>(
    ['creator', 'me'],
    API_ROUTES.CREATORS.ME,
  );

  const { data: earningsPage, isLoading: earningsLoading } = useAuthQuery<EarningsPage>(
    ['creator', 'me', 'earnings', 'recent'],
    API_ROUTES.CREATORS.ME_EARNINGS,
    { page: 1, limit: 5 },
  );

  const isLoading = meLoading || earningsLoading;

  const creatorLink = me?.referralCode
    ? (typeof window !== 'undefined'
        ? `${window.location.origin}/products?c=${me.referralCode}`
        : `/products?c=${me.referralCode}`)
    : '';

  const whatsappUrl = creatorLink
    ? `https://wa.me/?text=${encodeURIComponent(`Check out Maple Loom Handmade! ${creatorLink}`)}`
    : '#';
  const facebookUrl = creatorLink
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(creatorLink)}`
    : '#';
  const twitterUrl = creatorLink
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Shop handmade gifts with my link and save! ${creatorLink}`)}`
    : '#';

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Creator Hub</h1>
        <p className="text-sm text-muted mt-1">
          Share what you love. Earn when your community shops.
        </p>
      </div>

      {isLoading && (
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
        </div>
      )}

      {me && (
        <>
          {/* ── Tier card ───────────────────────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-card p-5 flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: me.tier.badgeColor + '20', border: `2px solid ${me.tier.badgeColor}` }}
            >
              {me.tier.badgeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: me.tier.badgeColor + '20', color: me.tier.badgeColor }}>
                  {me.tier.name}
                </span>
                <span className="text-xs text-muted">
                  {(me.tier.commissionRate * 100).toFixed(0)}% earnings rate
                </span>
              </div>
              <p className="text-sm text-secondary mt-1">
                {me.directReferrals} direct member{me.directReferrals !== 1 ? 's' : ''}
              </p>
              {me.tier.nextTier && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span>Progress to {me.tier.nextTier.name}</span>
                    <span>{me.directReferrals} / {me.tier.nextTier.minReferrals}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
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

          {/* ── Creator link ─────────────────────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <Share2 className="w-4 h-4 text-primary" />
              Your creator link
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={creatorLink}
                className="flex-1 min-w-0 bg-[#FAFAF8] border border-border rounded-button px-3 py-2 text-sm text-secondary font-mono truncate focus:outline-none focus:border-primary" />
              <CopyButton text={creatorLink} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">Share via:</span>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors">
                WhatsApp
              </a>
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors">
                Facebook
              </a>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition-colors">
                Twitter / X
              </a>
            </div>
            <p className="text-xs text-muted">
              People who shop via your link get a discount automatically.
            </p>
          </div>

          {/* ── Stats row ────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Direct members" value={me.directReferrals} color="text-primary" />
            <StatCard icon={Users} label="Network" value={me.level2Referrals + me.level3Referrals} />
            <StatCard icon={TrendingUp} label="Total earned" value={`$${me.totalEarned.toFixed(2)}`} />
            <StatCard icon={DollarSign} label="Available" value={`$${me.confirmedBalance.toFixed(2)}`}
              sub={me.pendingBalance > 0 ? `+$${me.pendingBalance.toFixed(2)} pending` : undefined}
              color="text-green-700" />
          </div>

          {/* ── Quick links ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`/${locale}/account/creator/earnings`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary transition-colors group">
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">Earnings History</p>
                <p className="text-xs text-muted mt-0.5">View all your earnings by order</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link href={`/${locale}/account/creator/payouts`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary transition-colors group">
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">Withdraw Earnings</p>
                <p className="text-xs text-muted mt-0.5">Request a withdrawal of your balance</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>

          {/* ── Recent earnings ──────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-secondary">Recent Earnings</h2>
              <Link href={`/${locale}/account/creator/earnings`} className="text-xs text-primary hover:underline">View all</Link>
            </div>

            {earningsLoading && (
              <div className="border border-border rounded-card overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
                    <div className="space-y-1.5"><Skeleton variant="text" className="w-36" /><Skeleton variant="text" className="w-24" /></div>
                    <Skeleton variant="text" className="w-16" />
                  </div>
                ))}
              </div>
            )}

            {!earningsLoading && earningsPage && (
              earningsPage.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Users className="w-10 h-10 text-muted/30" />
                  <p className="text-sm text-muted">No earnings yet. Share your creator link to start earning!</p>
                </div>
              ) : (
                <div className="border border-border rounded-card overflow-hidden">
                  {earningsPage.data.map((c) => {
                    const lockDays = c.status === 'PENDING' ? daysUntil(c.lockedAt) : null;
                    return (
                      <div key={c.id}
                        className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-surface transition-colors">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-secondary">
                            {c.level === 1 ? 'Direct sale' : 'Network sale'}
                            {c.orderId && <span className="text-xs text-muted ml-2">Order #{c.orderId.slice(-8).toUpperCase()}</span>}
                          </p>
                          <p className="text-xs text-muted">
                            {formatDate(c.createdAt)}
                            {lockDays !== null && ` · Unlocks in ${lockDays}d`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                            {c.status === 'CONFIRMED' ? 'Ready' : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-green-700">+${c.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
