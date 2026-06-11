'use client';
import { useState } from 'react';

interface ScoreData {
  totalScore:    number;
  scoreBadge:    string | null;
  breakdown: {
    shipping:  number;
    refund:    number;
    review:    number;
    response:  number;
  };
}

interface StoreScorePopoverProps {
  score: ScoreData;
}

const badgeColors: Record<string, string> = {
  PLATINUM: 'bg-slate-100 text-slate-800 border border-slate-300',
  GOLD:     'bg-yellow-100 text-yellow-800 border border-yellow-300',
  SILVER:   'bg-gray-100 text-gray-700 border border-gray-300',
  BRONZE:   'bg-orange-100 text-orange-800 border border-orange-300',
};

const badgeEmoji: Record<string, string> = {
  PLATINUM: '💎',
  GOLD:     '🥇',
  SILVER:   '🥈',
  BRONZE:   '🥉',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium text-gray-800">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${value >= 85 ? 'bg-green-500' : value >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function StoreScorePopover({ score }: StoreScorePopoverProps) {
  const [open, setOpen] = useState(false);
  const badge = score.scoreBadge ?? '';
  const badgeClass = badgeColors[badge] ?? 'bg-green-100 text-green-800 border border-green-300';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {badgeEmoji[badge] ?? '⭐'} {score.totalScore}/100
        {badge && <span className="hidden sm:inline">{badge}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 text-sm">Seller Score</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass}`}>
                {badgeEmoji[badge] ?? '⭐'} {badge || 'Rated'}
              </span>
            </div>
            <ScoreBar label="Shipping Speed" value={score.breakdown.shipping} />
            <ScoreBar label="Refund Rate"    value={score.breakdown.refund}   />
            <ScoreBar label="Review Rating"  value={score.breakdown.review}   />
            <ScoreBar label="Response Time"  value={score.breakdown.response} />
            <p className="text-xs text-gray-400 pt-1 border-t">Based on last 90 days of activity</p>
          </div>
        </>
      )}
    </div>
  );
}
