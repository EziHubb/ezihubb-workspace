'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';

interface PricingRec {
  productId:        string;
  currentPrice:     number;
  recommendedPrice: number;
  minPrice:         number;
  maxPrice:         number;
  reasoning:        string;
  confidenceScore:  number;
}

interface ABTestStatus {
  id:            string;
  status:        string;
  variantA:      number;
  variantB:      number;
  impressionsA:  number;
  impressionsB:  number;
  conversionsA:  number;
  conversionsB:  number;
  endsAt:        string;
  winnerId:      string | null;
}

interface PricingInsightPanelProps {
  productId:   string;
  productName: string;
  onClose?:    () => void;
}

function ABTestPanel({ test, onEndEarly }: { test: ABTestStatus; onEndEarly: () => void }) {
  const convA = test.impressionsA > 0 ? ((test.conversionsA / test.impressionsA) * 100).toFixed(1) : '0.0';
  const convB = test.impressionsB > 0 ? ((test.conversionsB / test.impressionsB) * 100).toFixed(1) : '0.0';
  const bWinning = parseFloat(convB) > parseFloat(convA);

  const daysTotal = 7;
  const daysLeft  = Math.max(0, Math.ceil((new Date(test.endsAt).getTime() - Date.now()) / 86400000));
  const daysDone  = daysTotal - daysLeft;

  return (
    <div className="space-y-4">
      <div>
        <h5 className="font-semibold text-gray-900">A/B Pricing test</h5>
        <div className="flex items-center gap-1.5 mt-2">
          {Array.from({ length: daysTotal }).map((_, i) => (
            <div
              key={i}
              className="h-2 flex-1 rounded-full"
              style={{ background: i < daysDone ? '#E85D3F' : '#E8E4DF' }}
            />
          ))}
          <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">Day {daysDone}/{daysTotal}</span>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DF' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b" style={{ borderColor: '#E8E4DF' }}>
              <th className="px-3 py-2 text-left font-semibold text-gray-600"></th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Variant A</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Variant B</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#E8E4DF' }}>
            {[
              { label: 'Price',       a: `$${Number(test.variantA).toFixed(2)}`,  b: `$${Number(test.variantB).toFixed(2)}` },
              { label: 'Views',       a: String(test.impressionsA),               b: String(test.impressionsB) },
              { label: 'Conversions', a: String(test.conversionsA),               b: String(test.conversionsB) },
              { label: 'Conv. rate',  a: `${convA}%`,                             b: `${convB}%`, highlight: true },
            ].map(row => (
              <tr
                key={row.label}
                className={row.highlight && bWinning ? 'bg-green-50' : 'bg-white'}
              >
                <td className="px-3 py-2 text-gray-600">{row.label}</td>
                <td className="px-3 py-2 text-right text-gray-700 font-medium">{row.a}</td>
                <td className={`px-3 py-2 text-right font-semibold ${row.highlight && bWinning ? 'text-green-700' : 'text-gray-700'}`}>
                  {row.b} {row.highlight && bWinning ? '↑' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bWinning && (
          <div className="px-3 py-2 border-t bg-blue-50 text-xs text-blue-700 font-medium" style={{ borderColor: '#BFDBFE' }}>
            B is leading by +{(parseFloat(convB) - parseFloat(convA)).toFixed(1)}% conversion rate
          </div>
        )}
      </div>

      {/* Projected outcome */}
      <div className="rounded-xl p-3 text-xs text-gray-600" style={{ background: '#FAFAF8' }}>
        <p>If B wins: +${(Number(test.variantB) - Number(test.variantA)).toFixed(2)} per sale · auto-applies in {daysLeft} days if B maintains lead</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onEndEarly}
          className="flex-1 rounded-xl py-2 text-xs font-semibold text-white"
          style={{ background: '#E85D3F' }}
        >
          End test early → apply B
        </button>
        <button
          className="rounded-xl border px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          style={{ borderColor: '#FCA5A5' }}
        >
          Cancel test
        </button>
      </div>
    </div>
  );
}

export function PricingInsightPanel({ productId, productName, onClose }: PricingInsightPanelProps) {
  const [rec, setRec]           = useState<PricingRec | null>(null);
  const [test, setTest]         = useState<ABTestStatus | null>(null);
  const [loading, setLoading]   = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [open, setOpen]         = useState(false);

  const fetchData = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const [recData, testData] = await Promise.all([
        apiClient.get<PricingRec>(`/seller/products/${productId}/pricing/recommendation`),
        apiClient.get<ABTestStatus>(`/seller/products/${productId}/pricing/ab-test`).catch(() => null),
      ]);
      setRec(recData);
      setTest(testData);
    } catch {
      setError('Could not load pricing data.');
    } finally {
      setLoading(false);
    }
  };

  const startTest = async () => {
    setStarting(true);
    try {
      await apiClient.post(`/seller/products/${productId}/pricing/ab-test`, {});
      const testData = await apiClient.get<ABTestStatus>(`/seller/products/${productId}/pricing/ab-test`);
      setTest(testData);
    } catch {
      setError('Could not start A/B test.');
    } finally {
      setStarting(false);
    }
  };

  const endTestEarly = async () => {
    if (!test) return;
    try {
      await apiClient.post(`/seller/products/${productId}/pricing/ab-test/${test.id}/end`, {});
      setTest(null);
    } catch {
      // ignore
    }
  };

  const delta    = rec ? rec.recommendedPrice - rec.currentPrice : 0;
  const deltaAbs = Math.abs(delta).toFixed(2);
  const deltaPct = rec ? Math.round(Math.abs(delta / rec.currentPrice) * 100) : 0;
  const confPct  = rec ? Math.round(rec.confidenceScore * 100) : 0;

  // ── Pill trigger ──────────────────────────────────────────────────────────

  const pill = (
    <button
      onClick={fetchData}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
      style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D' }}
    >
      💡 {rec ? `$${rec.recommendedPrice.toFixed(2)} recommended` : '+$? opportunity'}
    </button>
  );

  if (!open) return pill;

  // ── Slide-in panel ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
      <div className="relative ml-auto w-[380px] bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
          <div>
            <h4 className="font-semibold text-gray-900">Pricing insight</h4>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{productName}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-5">
          {loading && (
            <div className="animate-pulse space-y-3">
              <div className="h-20 rounded-xl bg-gray-100" />
              <div className="h-12 rounded-xl bg-gray-100" />
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          {rec && !loading && (
            <>
              {/* Active A/B test */}
              {test && test.status === 'RUNNING' ? (
                <ABTestPanel test={test} onEndEarly={endTestEarly} />
              ) : (
                <>
                  {/* Current vs Recommended */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Your price</p>
                        <p className="text-2xl font-bold text-gray-900">${rec.currentPrice.toFixed(2)}</p>
                      </div>
                      <div style={{ borderLeft: '1px solid #FCD34D' }} className="pl-4">
                        <p className="text-xs text-gray-500">AI recommends</p>
                        <p className="text-2xl font-bold" style={{ color: '#D97706' }}>${rec.recommendedPrice.toFixed(2)}</p>
                        <p className="text-xs font-semibold" style={{ color: '#2E7D52' }}>
                          +${deltaAbs} (+{deltaPct}%)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#E8E4DF' }}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Why AI recommends this:</p>
                    <div className="space-y-1">
                      {rec.reasoning.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i} className="text-xs text-gray-700">{line}</p>
                      ))}
                    </div>
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">Confidence: {confPct}%</p>
                      </div>
                      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${confPct}%`, background: '#E85D3F' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={startTest}
                      disabled={starting}
                      className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: '#E85D3F' }}
                    >
                      🧪 {starting ? 'Starting…' : 'Run 7-day A/B test'}
                    </button>
                    <button
                      className="w-full rounded-xl border py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      style={{ borderColor: '#E8E4DF' }}
                    >
                      Apply ${rec.recommendedPrice.toFixed(2)} now
                    </button>
                    <button className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
                      Skip this suggestion
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
