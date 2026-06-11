'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Users, DollarSign, TrendingUp, Copy, Check, Share2, ChevronRight, MousePointer,
} from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount } from '../../../../../lib/fmt';

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
  linkClicks?:      number;
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
      className="flex items-center gap-1.5 px-3 py-2 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
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

  const isLoading = meLoading;

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
  const pinterestUrl = creatorLink
    ? `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(creatorLink)}&description=${encodeURIComponent('Shop MapleLoom Handmade!')}`
    : '#';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Creator Hub</h1>
          <p className="text-sm text-muted mt-0.5">Share what you love. Earn when your community shops.</p>
        </div>
        <Link href={`/${locale}/account/creator/earnings`}
          className="text-xs text-primary hover:underline font-medium">
          View earnings history →
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton variant="rect" className="h-32 rounded-card" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rect" className="h-20 rounded-card" />)}
          </div>
        </div>
      )}

      {me && (
        <>
          {/* ── Tier hero card ──────────────────────────────────────────────── */}
          <div
            className="rounded-card border p-5"
            style={{
              background: `linear-gradient(135deg, #F3F0FF 0%, #EEEDFE 100%)`,
              borderColor: '#C4B5FD',
            }}
          >
            <div className="flex items-start gap-4 flex-wrap">
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
                    {(me.tier.commissionRate * 100).toFixed(0)}% earnings rate
                  </span>
                </div>
                <p className="text-sm font-semibold text-secondary mt-1">
                  {me.directReferrals} direct member{me.directReferrals !== 1 ? 's' : ''}
                </p>
                {me.tier.nextTier && (
                  <div className="mt-3 max-w-xs">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                      <span>Progress to {me.tier.nextTier.name}</span>
                      <span>{me.directReferrals} / {me.tier.nextTier.minReferrals}</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: me.tier.badgeColor + '30' }}>
                      <div className="h-full rounded-full transition-all duration-700"
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
          </div>

          {/* ── KPI row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Users,        label: 'Direct members', value: String(me.directReferrals),                                               sub: 'in your network',    color: 'bg-[#7C3AED]' },
              { icon: DollarSign,   label: 'Available',       value: fmtAmount(me.confirmedBalance),                                          sub: 'ready to withdraw',  color: 'bg-green-500' },
              { icon: TrendingUp,   label: 'Total earned',    value: fmtAmount(me.totalEarned),                                               sub: 'all time',           color: 'bg-primary'   },
              { icon: MousePointer, label: 'Link clicks',      value: String(me.linkClicks ?? 0),                                              sub: 'this month',         color: 'bg-blue-500'  },
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

          {/* ── Creator link card ─────────────────────────────────────────────── */}
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
              <span className="text-xs text-muted font-medium">Share via:</span>
              {[
                { href: twitterUrl,   label: 'Twitter/X',  bg: 'bg-[#1DA1F2]/10 text-[#1DA1F2]' },
                { href: facebookUrl,  label: 'Facebook',   bg: 'bg-[#1877F2]/10 text-[#1877F2]' },
                { href: pinterestUrl, label: 'Pinterest',  bg: 'bg-[#E60023]/10 text-[#E60023]' },
                { href: whatsappUrl,  label: 'WhatsApp',   bg: 'bg-[#25D366]/10 text-[#25D366]' },
              ].map(({ href, label, bg }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium ${bg} hover:opacity-80 transition-opacity`}>
                  {label}
                </a>
              ))}
            </div>
            <div className="p-3 rounded-xl text-xs text-[#7C3AED] font-medium" style={{ background: '#F3F0FF' }}>
              🎁 People who shop via your link get 5% off automatically — no coupon needed.
            </div>
          </div>

          {/* ── Quick links ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`/${locale}/account/creator/earnings`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary/40 transition-colors group">
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">Earnings History</p>
                <p className="text-xs text-muted mt-0.5">View all earnings by order and type</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link href={`/${locale}/account/creator/payouts`}
              className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-card hover:border-primary/40 transition-colors group">
              <div>
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">Withdraw Earnings</p>
                <p className="text-xs text-muted mt-0.5">
                  {me.confirmedBalance > 0
                    ? `${fmtAmount(me.confirmedBalance)} available`
                    : 'Request a withdrawal'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>

          {/* ── Recent earnings ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-secondary">Recent Earnings</h2>
              <Link href={`/${locale}/account/creator/earnings`} className="text-xs text-primary hover:underline">View all →</Link>
            </div>

            {earningsLoading && (
              <div className="border border-border rounded-card overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
                    <div className="space-y-1.5"><Skeleton variant="text" className="w-36" /><Skeleton variant="text" className="w-24" /></div>
                    <Skeleton variant="text" className="w-16" />
                  </div>
                ))}
              </div>
            )}

            {!earningsLoading && earningsPage && (
              earningsPage.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-dashed border-border rounded-card">
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
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.level === 1 ? 'bg-primary/10 text-primary' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>
                              {c.level === 1 ? 'Direct' : 'Community'}
                            </span>
                            {c.orderId && <span className="text-xs text-muted font-mono">#{c.orderId.slice(-8).toUpperCase()}</span>}
                          </div>
                          <p className="text-xs text-muted">
                            {formatDate(c.createdAt)}
                            {lockDays !== null && ` · Unlocks in ${lockDays}d`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                            {c.status === 'CONFIRMED' ? 'Ready' : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-green-700">+{fmtAmount(c.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </section>
        </>
      )}
    </div>
  );
}
