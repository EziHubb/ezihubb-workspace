'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

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

const badgeEmoji: Record<string, string> = {
  PLATINUM: '💎',
  GOLD:     '🥇',
  SILVER:   '🥈',
  BRONZE:   '🥉',
};

function ProgressBar({ value, weight, detail }: { value: number; weight: number; detail: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{detail}</span>
        <span className="font-medium text-gray-800">{value}<span className="text-gray-400">/{weight * 100}</span></span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${value / (weight * 100) >= 0.85 ? 'bg-green-500' : value / (weight * 100) >= 0.65 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${(value / (weight * 100)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function SellerScoreCard() {
  const [data, setData]       = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ScoreBreakdown>('/seller/score/breakdown')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rounded-lg border bg-white p-5 animate-pulse h-40" />
  );

  if (!data) return null;

  const badge      = data.scoreBadge ?? '';
  const badgeColor = badge === 'PLATINUM' ? 'text-slate-700'
                   : badge === 'GOLD'     ? 'text-yellow-600'
                   : badge === 'SILVER'   ? 'text-gray-500'
                   : badge === 'BRONZE'   ? 'text-orange-600'
                   : 'text-green-700';

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Seller Performance Score</h3>
          {data.lastCalculatedAt && (
            <p className="text-xs text-gray-400">
              Updated {new Date(data.lastCalculatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${badgeColor}`}>{data.totalScore}</div>
          {badge && (
            <div className={`text-sm font-medium ${badgeColor}`}>{badgeEmoji[badge] ?? ''} {badge}</div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <ProgressBar
          value={data.breakdown.shipping.score}
          weight={data.breakdown.shipping.weight}
          detail="Shipping Speed"
        />
        <ProgressBar
          value={data.breakdown.refund.score}
          weight={data.breakdown.refund.weight}
          detail="Refund Rate"
        />
        <ProgressBar
          value={data.breakdown.review.score}
          weight={data.breakdown.review.weight}
          detail="Customer Reviews"
        />
        <ProgressBar
          value={data.breakdown.response.score}
          weight={data.breakdown.response.weight}
          detail="Response Time"
        />
      </div>
    </div>
  );
}
