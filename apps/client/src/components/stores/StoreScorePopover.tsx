'use client';

import { useState } from 'react';

interface ScoreData {
  totalScore: number;
  scoreBadge: string | null;
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

function ScoreBar({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 flex items-center gap-1">{icon} {label}</span>
        <span className="text-xs font-semibold text-gray-800 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function getTierConfig(badge: string | null, score: number) {
  if (score >= 80) return { label: '✓ Top Seller', bg: '#F0FDF4', text: '#2E7D52', border: '#86EFAC' };
  if (score >= 60) return { label: '✓ Trusted',    bg: '#EFF6FF', text: '#185FA5', border: '#93C5FD' };
  return null;
}

export function StoreScorePopover({ score }: StoreScorePopoverProps) {
  const [open, setOpen] = useState(false);
  const tier = getTierConfig(score.scoreBadge, score.totalScore);

  if (!tier) return null;

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2">
        {/* Tier badge */}
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border"
          style={{ background: tier.bg, color: tier.text, borderColor: tier.border }}
        >
          {tier.label}
        </span>

        {/* Score + breakdown link */}
        <span className="text-xs text-gray-500">Score: {score.totalScore}/100</span>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-xs font-medium transition-colors"
          style={{ color: '#E85D3F' }}
        >
          {open ? 'Hide' : 'See breakdown'}
        </button>
      </div>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border bg-white p-5 shadow-xl space-y-3"
            style={{ borderColor: '#E8E4DF' }}
          >
            <div className="flex items-center justify-between">
              <h5 className="font-semibold text-gray-900 text-sm">Performance score</h5>
              <span className="text-xs text-gray-400">Last 90 days</span>
            </div>

            <div className="space-y-3">
              <ScoreBar icon="📦" label="Shipping accuracy" value={score.breakdown.shipping}  color="#2E7D52" />
              <ScoreBar icon="💰" label="Refund rate"        value={score.breakdown.refund}    color="#185FA5" />
              <ScoreBar icon="⭐" label="Review rating"      value={score.breakdown.review}    color="#2E7D52" />
              <ScoreBar icon="💬" label="Response time"      value={score.breakdown.response}  color="#0D9488" />
            </div>

            <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: '#E8E4DF' }}>
              <span className="text-xs text-gray-400">Updated daily</span>
              <span className="font-bold text-gray-900 text-sm">{score.totalScore} / 100</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
