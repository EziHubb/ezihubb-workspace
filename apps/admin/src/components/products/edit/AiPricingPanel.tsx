'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, FlaskConical, StopCircle, RotateCcw,
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingRecommendation {
  productId:        string;
  currentPrice:     number;
  recommendedPrice: number;
  minPrice:         number;
  maxPrice:         number;
  reasoning:        string;
  confidenceScore:  number;
}

interface ABTest {
  id:          string;
  status:      string;
  variantA:    number;
  variantB:    number;
  impressionsA: number;
  impressionsB: number;
  conversionsA: number;
  conversionsB: number;
  endsAt:      string;
  createdAt:   string;
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-8">{pct}%</span>
    </div>
  );
}

// ── Lift stat ─────────────────────────────────────────────────────────────────

function LiftStat({ label, a, b }: { label: string; a: number; b: number }) {
  const lift = a > 0 ? ((b - a) / a) * 100 : 0;
  const up   = lift >= 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`flex items-center gap-1 font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
        {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {up ? '+' : ''}{lift.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface AiPricingPanelProps {
  productId: string;
}

export function AiPricingPanel({ productId }: AiPricingPanelProps) {
  const [open, setOpen]     = useState(false);
  const [msg,  setMsg]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const qc = useQueryClient();

  const recQuery = useQuery<PricingRecommendation>({
    queryKey: ['ai-pricing-rec', productId],
    queryFn:  () => api.get<PricingRecommendation>(API_ROUTES.ADMIN.AI_PRICING_RECOMMENDATION(productId)),
    enabled:  false,    // only fetch on demand
    retry:    false,
    staleTime: 24 * 60 * 60_000,
  });

  const testQuery = useQuery<ABTest | null>({
    queryKey: ['ai-pricing-test', productId],
    queryFn:  async () => {
      try {
        return await api.get<ABTest>(API_ROUTES.ADMIN.AI_PRICING_TEST_STATUS(productId));
      } catch {
        return null;
      }
    },
    enabled:  open,
    staleTime: 60_000,
  });

  const analyze = useMutation({
    mutationFn: () => api.get<PricingRecommendation>(API_ROUTES.ADMIN.AI_PRICING_RECOMMENDATION(productId)),
    onSuccess: (data) => {
      qc.setQueryData(['ai-pricing-rec', productId], data);
      setMsg(null);
    },
    onError: () => setMsg({ type: 'error', text: 'Analysis failed — check API logs' }),
  });

  const startTest = useMutation({
    mutationFn: () => api.post<{ testId: string }>(API_ROUTES.ADMIN.AI_PRICING_START_AB_TEST(productId), {}),
    onSuccess: () => {
      setMsg({ type: 'success', text: 'A/B test started — runs for 7 days' });
      qc.invalidateQueries({ queryKey: ['ai-pricing-test', productId] });
    },
    onError: () => setMsg({ type: 'error', text: 'Could not start test — product may already have a running test' }),
  });

  const endTest = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_PRICING_TEST_END(id), {}),
    onSuccess: () => {
      setMsg({ type: 'success', text: 'Test ended — variant B price kept' });
      qc.invalidateQueries({ queryKey: ['ai-pricing-test', productId] });
      qc.invalidateQueries({ queryKey: ['ai-pricing-tests'] });
    },
    onError: () => setMsg({ type: 'error', text: 'Failed to end test' }),
  });

  const revertTest = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_PRICING_TEST_REVERT(id), {}),
    onSuccess: () => {
      setMsg({ type: 'success', text: 'Test reverted — original price restored' });
      qc.invalidateQueries({ queryKey: ['ai-pricing-test', productId] });
      qc.invalidateQueries({ queryKey: ['ai-pricing-tests'] });
    },
    onError: () => setMsg({ type: 'error', text: 'Failed to revert test' }),
  });

  const rec        = recQuery.data ?? (qc.getQueryData(['ai-pricing-rec', productId]) as PricingRecommendation | undefined);
  const test       = testQuery.data;
  const hasRunning = test?.status === 'RUNNING';

  // Conversion rates for running test
  const convRateA  = test && test.impressionsA > 0 ? (test.conversionsA / test.impressionsA * 100) : null;
  const convRateB  = test && test.impressionsB > 0 ? (test.conversionsB / test.impressionsB * 100) : null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/5 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-secondary">AI Pricing Optimizer</p>
          <p className="text-xs text-muted">
            {hasRunning
              ? `A/B test running — ends ${fmtDate(test!.endsAt)}`
              : rec
              ? `Recommendation: ${fmtAmount(rec.recommendedPrice)} (${Math.round(rec.confidenceScore * 100)}% confidence)`
              : 'Analyze to get an AI-suggested price'}
          </p>
        </div>
        {hasRunning && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Live
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted shrink-0" />}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border divide-y divide-border">

          {/* ── Feedback banner ──────────────────────────────────── */}
          {msg && (
            <div className={`flex items-start gap-2.5 px-4 py-3 text-sm ${
              msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {msg.type === 'success'
                ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="flex-1">{msg.text}</span>
              <button type="button" onClick={() => setMsg(null)} className="text-current/50 hover:text-current text-lg leading-none">×</button>
            </div>
          )}

          {/* ── Recommendation section ───────────────────────────── */}
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-secondary">Price recommendation</h4>
              <button
                type="button"
                onClick={() => analyze.mutate()}
                disabled={analyze.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary-dark text-white rounded-button transition-colors disabled:opacity-50"
              >
                {analyze.isPending
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
                  : <><Sparkles className="w-3 h-3" /> {rec ? 'Re-analyze' : 'Analyze'}</>}
              </button>
            </div>

            {rec ? (
              <div className="space-y-3">
                {/* Price row */}
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">Current</p>
                    <p className="text-xl font-bold text-secondary tabular-nums">{fmtAmount(rec.currentPrice)}</p>
                  </div>
                  <span className="text-muted text-lg mb-0.5">→</span>
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">Recommended</p>
                    <p className="text-xl font-bold text-primary tabular-nums">{fmtAmount(rec.recommendedPrice)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">Range</p>
                    <p className="text-xs text-secondary tabular-nums">{fmtAmount(rec.minPrice)} – {fmtAmount(rec.maxPrice)}</p>
                  </div>
                </div>

                {/* Confidence */}
                <div className="space-y-1">
                  <p className="text-xs text-muted flex justify-between">
                    <span>Confidence</span>
                    <span className={
                      rec.confidenceScore >= 0.7 ? 'text-green-600 font-semibold' :
                      rec.confidenceScore >= 0.45 ? 'text-amber-600 font-semibold' :
                      'text-red-500 font-semibold'
                    }>
                      {rec.confidenceScore >= 0.7 ? 'High' : rec.confidenceScore >= 0.45 ? 'Medium' : 'Low'}
                    </span>
                  </p>
                  <ConfidenceBar score={rec.confidenceScore} />
                </div>

                {/* Reasoning */}
                <p className="text-xs text-muted leading-relaxed bg-muted/5 rounded-lg px-3 py-2.5 border border-border">
                  {rec.reasoning}
                </p>

                {/* Start A/B test CTA */}
                {!hasRunning && (
                  <button
                    type="button"
                    onClick={() => startTest.mutate()}
                    disabled={startTest.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-button transition-all disabled:opacity-50"
                  >
                    {startTest.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting test…</>
                      : <><FlaskConical className="w-4 h-4" /> Start A/B test (7 days)</>}
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted">
                <Sparkles className="w-8 h-8 text-muted/20 mx-auto mb-2" />
                Click <strong>Analyze</strong> to get an AI-suggested price based on conversion data and similar products.
              </div>
            )}
          </div>

          {/* ── Active A/B test section ──────────────────────────── */}
          {testQuery.isLoading ? (
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading test status…
            </div>
          ) : test ? (
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-500" />
                  A/B Test
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    test.status === 'RUNNING'   ? 'bg-blue-100 text-blue-700' :
                    test.status === 'WINNER_B' || test.status === 'WINNER_A' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{test.status.replace('_', ' ')}</span>
                </h4>
                {hasRunning && (
                  <p className="text-xs text-muted">Ends {fmtDate(test.endsAt)}</p>
                )}
              </div>

              {/* Variant comparison */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'A — Control', price: test.variantA, impressions: test.impressionsA, conversions: test.conversionsA, convRate: convRateA },
                  { label: 'B — Variant', price: test.variantB, impressions: test.impressionsB, conversions: test.conversionsB, convRate: convRateB },
                ].map(({ label, price, impressions, conversions, convRate }) => (
                  <div key={label} className="bg-background rounded-lg border border-border p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wide">{label}</p>
                    <p className="text-lg font-bold text-secondary tabular-nums">{fmtAmount(Number(price))}</p>
                    <div className="text-xs text-muted space-y-0.5">
                      <p>{impressions.toLocaleString()} impressions</p>
                      <p>{conversions.toLocaleString()} conversions</p>
                      {convRate !== null && (
                        <p className="font-semibold text-secondary">{convRate.toFixed(2)}% conv.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Live lift indicators (only when both sides have data) */}
              {convRateA !== null && convRateB !== null && (
                <div className="space-y-1.5 bg-muted/5 rounded-lg px-3 py-2.5 border border-border">
                  <LiftStat
                    label="Conversion rate lift"
                    a={convRateA}
                    b={convRateB}
                  />
                </div>
              )}

              {/* Actions */}
              {hasRunning && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => endTest.mutate(test.id)}
                    disabled={endTest.isPending || revertTest.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-button hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    {endTest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                    End & keep B
                  </button>
                  <button
                    type="button"
                    onClick={() => revertTest.mutate(test.id)}
                    disabled={endTest.isPending || revertTest.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-button hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {revertTest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Revert to A
                  </button>
                </div>
              )}
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}
