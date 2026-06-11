'use client';
import { useState } from 'react';
import { apiClient } from '@mlh/api-client';

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
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-orange-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct}%</span>
    </div>
  );
}

export function PricingInsightPanel({ productId, productName }: PricingInsightPanelProps) {
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

  const delta     = rec ? rec.recommendedPrice - rec.currentPrice : 0;
  const deltaSign = delta > 0 ? '+' : '';

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <button
        onClick={fetchData}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span>AI Pricing Insights</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {loading && <p className="text-xs text-gray-400 py-2">Analyzing pricing…</p>}
          {error   && <p className="text-xs text-red-500 py-2">{error}</p>}
          {rec && !loading && (
            <>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Current</div>
                  <div className="text-lg font-bold text-gray-800">${rec.currentPrice.toFixed(2)}</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center border border-blue-200">
                  <div className="text-xs text-blue-600 mb-1">Recommended</div>
                  <div className="text-lg font-bold text-blue-800">${rec.recommendedPrice.toFixed(2)}</div>
                  <div className={`text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {deltaSign}${Math.abs(delta).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Range</div>
                  <div className="text-xs font-medium text-gray-700">
                    ${rec.minPrice.toFixed(2)}–${rec.maxPrice.toFixed(2)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Confidence</div>
                <ConfidenceBar value={rec.confidenceScore} />
              </div>
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{rec.reasoning}</p>
              {!test || test.status === 'CANCELLED' ? (
                <button
                  onClick={startTest}
                  disabled={starting}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {starting ? 'Starting…' : 'Start A/B Price Test'}
                </button>
              ) : (
                <ABTestDisplay test={test} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ABTestDisplay({ test }: { test: ABTestStatus }) {
  const convA = test.impressionsA > 0 ? ((test.conversionsA / test.impressionsA) * 100).toFixed(1) : '0.0';
  const convB = test.impressionsB > 0 ? ((test.conversionsB / test.impressionsB) * 100).toFixed(1) : '0.0';
  const statusColors: Record<string, string> = {
    RUNNING:   'bg-green-100 text-green-800',
    WINNER_A:  'bg-blue-100 text-blue-800',
    WINNER_B:  'bg-purple-100 text-purple-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">A/B Price Test</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[test.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {test.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded p-2 ${test.winnerId === 'A' ? 'bg-green-50 border border-green-300' : 'bg-gray-50'}`}>
          <div className="font-semibold text-gray-700">A: ${Number(test.variantA).toFixed(2)}</div>
          <div className="text-gray-500">{test.impressionsA} views · {convA}% conv.</div>
        </div>
        <div className={`rounded p-2 ${test.winnerId === 'B' ? 'bg-green-50 border border-green-300' : 'bg-gray-50'}`}>
          <div className="font-semibold text-gray-700">B: ${Number(test.variantB).toFixed(2)}</div>
          <div className="text-gray-500">{test.impressionsB} views · {convB}% conv.</div>
        </div>
      </div>
      <div className="text-xs text-gray-400">Ends {new Date(test.endsAt).toLocaleDateString()}</div>
    </div>
  );
}
