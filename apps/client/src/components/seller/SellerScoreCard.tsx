'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';

interface ScoreBreakdown {
  totalScore:    number;
  scoreBadge:    string | null;
  breakdown: {
    shipping: { score: number; weight: number; detail: string };
    refund:   { score: number; weight: number; detail: string };
    review:   { score: number; weight: number; detail: string };
    response: { score: number; weight: number; detail: string };
  };
  lastCalculatedAt: string | null;
}

interface ScoreRowProps {
  icon:    string;
  label:   string;
  score:   number;
  barColor: string;
}

function ScoreRow({ icon, label, score, barColor }: ScoreRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 flex items-center gap-1.5">
          <span>{icon}</span> {label}
        </span>
        <span className="text-xs font-semibold text-gray-800 tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function tierBadge(badge: string) {
  switch (badge) {
    case 'PLATINUM':
    case 'GOLD':     return { label: '⭐ Top Seller', bg: '#F0FDF4', text: '#2E7D52', border: '#86EFAC' };
    case 'SILVER':   return { label: '✓ Trusted',    bg: '#EFF6FF', text: '#185FA5', border: '#93C5FD' };
    default:         return { label: '✓ Rising',     bg: '#F5F5F4', text: '#57534E', border: '#D6D3D1' };
  }
}

export function SellerScoreCard() {
  const [data, setData]       = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiClient.get<ScoreBreakdown>('/seller/score/breakdown')
      .then(setData)
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- swallow so .finally still clears loading state
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rounded-2xl border bg-white p-5 animate-pulse h-48" style={{ borderColor: '#E8E4DF' }} />
  );

  if (!data) return null;

  const badge      = data.scoreBadge ?? '';
  const tier       = tierBadge(badge);
  const hasLowScore = data.breakdown.response.score < 60 || data.breakdown.refund.score < 60;

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4" style={{ borderColor: '#E8E4DF' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Your performance score</h3>
        <a href="/seller/score/history" className="text-xs" style={{ color: '#E85D3F' }}>
          History →
        </a>
      </div>

      {/* Score + tier */}
      <div className="flex items-end gap-3">
        <div>
          <span className="text-6xl font-bold text-gray-900 leading-none">{data.totalScore}</span>
          <span className="text-2xl font-medium text-gray-400">/100</span>
        </div>
        <span
          className="mb-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
          style={{ background: tier.bg, color: tier.text, borderColor: tier.border }}
        >
          {tier.label}
        </span>
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <ScoreRow icon="📦" label="Shipping accuracy" score={data.breakdown.shipping.score}   barColor="#2E7D52" />
        <ScoreRow icon="💰" label="Refund rate"        score={data.breakdown.refund.score}     barColor="#185FA5" />
        <ScoreRow icon="⭐" label="Review rating"      score={data.breakdown.review.score}     barColor="#2E7D52" />
        <ScoreRow icon="💬" label="Response time"      score={data.breakdown.response.score}   barColor="#0D9488" />
      </div>

      {/* Low score alert */}
      {hasLowScore && (
        <div className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <div className="flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: '#92400E' }}>
                Response time is low. Reply to messages within 24h to improve.
              </p>
              <a href="/seller/messages" className="text-xs font-medium mt-0.5 inline-block" style={{ color: '#D97706' }}>
                View messages →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full rounded-xl border py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#E8E4DF' }}
      >
        {expanded ? 'Hide details' : 'See full breakdown'}
      </button>

      {expanded && data.lastCalculatedAt && (
        <p className="text-xs text-center text-gray-400">
          Updated daily · Last: {new Date(data.lastCalculatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
