'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useAuthQuery } from '../../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, safeArr, safeNum, safeStr } from '@ezihubb/utils';

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ezihubb.com';

interface Commission {
  id:          string;
  orderId:     string;
  orderNumber: string;
  amount:      number;
  status:      string;
  createdAt:   string;
}

interface DashboardData {
  balance:           number;
  totalEarned:       number;
  referralCode:      string;
  totalClicks:       number;
  totalConversions:  number;
  conversionRate:    number;
  recentCommissions: Commission[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-purple-100 text-purple-700',
  PAID:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const fmt     = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDate = (d: string) => fmt.format(new Date(d));

export default function AffiliateDashboardPage() {
  const locale                = useLocale();
  const [copied, setCopied]   = useState(false);

  const { data, isLoading } = useAuthQuery<DashboardData>(
    ['affiliate-dashboard'],
    API_ROUTES.AFFILIATES.ME_DASHBOARD,
  );

  const referralUrl = data ? `${BASE_URL}?ref=${data.referralCode}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
    } catch {
      // Fallback for browsers that block clipboard
      const ta = document.createElement('textarea');
      ta.value = referralUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const minPayout = 50;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">Dashboard</h1>

      {/* ── Balance card ─────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-6">
        <p className="text-sm text-muted mb-1">Available balance</p>
        <p className="font-display text-4xl font-bold text-secondary">
          {fmtAmount(data.balance)}
        </p>
        <p className="text-xs text-muted mt-1">
          All-time earned: {fmtAmount(data.totalEarned)}
        </p>
        <Link
          href={`/${locale}/affiliate/payouts`}
          className={[
            'mt-4 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-button transition-colors uppercase tracking-wide',
            safeNum(data.balance) >= minPayout
              ? 'bg-primary hover:bg-primary/90 text-white'
              : 'bg-muted/10 text-muted cursor-not-allowed pointer-events-none',
          ].join(' ')}
          aria-disabled={safeNum(data.balance) < minPayout}
        >
          {safeNum(data.balance) >= minPayout
            ? 'Request payout'
            : `${fmtAmount(minPayout - safeNum(data.balance))} until minimum`}
        </Link>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total clicks',      value: safeNum(data.totalClicks).toLocaleString()      },
          { label: 'Conversions',       value: safeNum(data.totalConversions).toLocaleString() },
          { label: 'Total earned',      value: fmtAmount(data.totalEarned)                     },
          { label: 'Conversion rate',   value: `${(safeNum(data.conversionRate) * 100).toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 text-center">
            <p className="font-display text-2xl font-bold text-secondary tabular-nums">{value}</p>
            <p className="text-xs text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Referral link ────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5">
        <h2 className="font-semibold text-secondary mb-3 text-sm">Your referral link</h2>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-background border border-border rounded-button px-3 py-2 text-sm text-muted font-mono truncate">
            {referralUrl}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-button px-3 py-2 hover:bg-primary/5 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Social sharing */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: 'Instagram',
              url:   `https://www.instagram.com/`,
              bg:    'bg-pink-50 text-pink-700 border-pink-200',
            },
            {
              label: 'Facebook',
              url:   `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
              bg:    'bg-blue-50 text-blue-700 border-blue-200',
            },
            {
              label: 'Pinterest',
              url:   `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(referralUrl)}`,
              bg:    'bg-red-50 text-red-700 border-red-200',
            },
          ].map(({ label, url, bg }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-button px-3 py-1.5 transition-opacity hover:opacity-80 ${bg}`}
            >
              <ExternalLink className="w-3 h-3" />
              Share on {label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Recent commissions ───────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-sm">Recent commissions</h2>
          <Link
            href={`/${locale}/affiliate/payouts`}
            className="text-xs text-primary hover:underline"
          >
            View all →
          </Link>
        </div>

        {safeArr(data.recentCommissions).length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">
            No commissions yet. Start sharing your link!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Order</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Commission</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeArr(data.recentCommissions).map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background transition-colors">
                    <td className="px-5 py-3 text-muted whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                    <td className="px-5 py-3 font-mono text-secondary whitespace-nowrap">{c.orderNumber}</td>
                    <td className="px-5 py-3 text-right font-semibold text-secondary tabular-nums">
                      {fmtAmount(c.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-muted/10 text-muted'}`}>
                        {safeStr(c.status).charAt(0) + safeStr(c.status).slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
