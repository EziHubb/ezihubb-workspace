'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface ConnectedPlatform {
  platform:       string;
  platformUserId: string;
  createdAt:      string;
}

interface DNANiche {
  name:                    string;
  reason:                  string;
  designIdeas:             string[];
  estimatedConversionRate: string;
  competitionLevel:        'low' | 'medium' | 'high';
}

interface DNAInsights {
  primaryAudience:      string;
  topContentCategories: string[];
  avgEngagement?:       string;
  followerCount?:       number;
  bestPostTime?:        string;
  niches:               DNANiche[];
  storePersonalization: {
    recommendedStoreName:   string;
    recommendedDescription: string;
    recommendedTags:        string[];
  };
}

interface DNAAnalysis {
  insights:  DNAInsights;
  platform:  string;
  createdAt: string;
}

type PageState = 'connect' | 'analyzing' | 'results';

const ANALYSIS_STEPS = [
  { key: 'connect',  label: 'Connected to TikTok' },
  { key: 'reading',  label: 'Analyzing 47 posts' },
  { key: 'audience', label: 'Identifying your audience' },
  { key: 'niches',   label: 'Finding your best niches' },
  { key: 'designs',  label: 'Generating design ideas' },
];

const COMPETITION_STYLES: Record<string, { bg: string; text: string }> = {
  low:    { bg: '#F0FDF4', text: '#2E7D52' },
  medium: { bg: '#FFFBEB', text: '#D97706' },
  high:   { bg: '#FEF2F2', text: '#DC2626' },
};

export default function CreatorDNAPage() {
  const [platforms, setPlatforms]           = useState<ConnectedPlatform[]>([]);
  const [analysis, setAnalysis]             = useState<DNAAnalysis | null>(null);
  const [loading, setLoading]               = useState(true);
  const [pageState, setPageState]           = useState<PageState>('connect');
  const [analyzingStep, setAnalyzingStep]   = useState(0);
  const [disconnecting, setDisconnecting]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<ConnectedPlatform[]>('/creator-dna/platforms'),
      apiClient.get<DNAAnalysis>('/creator-dna/analysis').catch(() => null),
    ]).then(([p, a]) => {
      const ps = Array.isArray(p) ? p : [];
      setPlatforms(ps);
      setAnalysis(a);
      if (a) setPageState('results');
      else if (ps.length > 0) setPageState('analyzing');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Simulate analysis progress steps
  useEffect(() => {
    if (pageState !== 'analyzing') return;
    const timer = setInterval(() => {
      setAnalyzingStep(s => {
        if (s >= ANALYSIS_STEPS.length - 1) {
          clearInterval(timer);
          return s;
        }
        return s + 1;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [pageState]);

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      await apiClient.delete(`/creator-dna/platforms/${platform}`);
      setPlatforms(p => p.filter(x => x.platform !== platform));
      if (platforms.length <= 1) setPageState('connect');
    } catch {
      // ignore
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnectTikTok = () => {
    setPageState('analyzing');
    window.location.href = '/api/v1/creator-dna/tiktok/connect';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── STEP 1: Connect social ────────────────────────────────────────────────

  if (pageState === 'connect') {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-4">
        {/* Connect card */}
        <div
          className="rounded-2xl p-8 text-center space-y-4"
          style={{ background: 'linear-gradient(135deg, #F3F0FF 0%, #EEEDFE 100%)', border: '1px solid #DDD6FE' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto"
            style={{ background: '#7C3AED' }}
          >
            🧬
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Discover your perfect niche</h2>
            <p className="text-sm text-gray-600 mt-2">
              Connect TikTok or Instagram. AI analyzes your content and audience to recommend the 3 most profitable product niches for you.
            </p>
            <p className="text-xs text-gray-400 mt-1.5">Takes 2 minutes. Works with any account size.</p>
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={handleConnectTikTok}
              className="flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white"
              style={{ background: '#000' }}
            >
              🎵 Connect TikTok
            </button>
            <a
              href="/api/v1/creator-dna/instagram/connect"
              className="flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)' }}
            >
              📸 Connect Instagram
            </a>
          </div>
        </div>

        <p className="text-center">
          <a href="/seller/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
            Skip for now → set up manually
          </a>
        </p>

        {/* Already connected accounts */}
        {platforms.length > 0 && (
          <div className="rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: '#E8E4DF' }}>
            <h3 className="text-sm font-semibold text-gray-700">Connected accounts</h3>
            {platforms.map(p => (
              <div key={p.platform} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: '#E8E4DF' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.platform === 'tiktok' ? '🎵' : '📸'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{p.platform}</p>
                    <p className="text-xs text-green-600">Connected</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(p.platform)}
                  disabled={disconnecting === p.platform}
                  className="text-xs border rounded-lg px-2.5 py-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  style={{ borderColor: '#FCA5A5' }}
                >
                  {disconnecting === p.platform ? '…' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── STEP 2: Analyzing ─────────────────────────────────────────────────────

  if (pageState === 'analyzing') {
    return (
      <div className="max-w-sm mx-auto py-12 text-center space-y-6">
        <div className="w-12 h-12 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analyzing your content…</h2>
          <p className="text-sm text-gray-500 mt-1">Reading your last 47 posts</p>
        </div>

        {/* Progress steps */}
        <div className="text-left space-y-3">
          {ANALYSIS_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3">
              {i < analyzingStep ? (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                  style={{ background: '#7C3AED' }}
                >
                  ✓
                </div>
              ) : i === analyzingStep ? (
                <div
                  className="w-5 h-5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  i < analyzingStep ? 'text-gray-500 line-through' :
                  i === analyzingStep ? 'font-medium text-gray-900' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">About 30 seconds</p>
      </div>
    );
  }

  // ── STEP 3: Results ───────────────────────────────────────────────────────

  if (!analysis) return null;
  const { insights } = analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creator DNA</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            via {analysis.platform} · {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => setPageState('connect')}
          className="rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          style={{ borderColor: '#E8E4DF' }}
        >
          Re-analyze
        </button>
      </div>

      {/* Audience summary */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'linear-gradient(135deg, #F3F0FF 0%, #EEEDFE 100%)', border: '1px solid #DDD6FE' }}
      >
        <h4 className="font-semibold text-gray-700 text-sm">Your audience</h4>
        <p className="text-xl font-bold italic" style={{ color: '#7C3AED' }}>
          {insights.primaryAudience}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {insights.topContentCategories?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400">Top content</p>
              <p className="text-gray-700 font-medium">{insights.topContentCategories.slice(0, 3).join(' · ')}</p>
            </div>
          )}
          {insights.avgEngagement && (
            <div>
              <p className="text-xs text-gray-400">Avg engagement</p>
              <p className="text-gray-700 font-medium">{insights.avgEngagement}</p>
            </div>
          )}
          {insights.followerCount && (
            <div>
              <p className="text-xs text-gray-400">Followers</p>
              <p className="text-gray-700 font-medium">{insights.followerCount.toLocaleString()}</p>
            </div>
          )}
          {insights.bestPostTime && (
            <div>
              <p className="text-xs text-gray-400">Best post time</p>
              <p className="text-gray-700 font-medium">{insights.bestPostTime}</p>
            </div>
          )}
        </div>
      </div>

      {/* Niche cards */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Your top 3 niches</h4>
        <div className="grid sm:grid-cols-3 gap-4">
          {insights.niches?.map((niche, i) => {
            const compStyle = COMPETITION_STYLES[niche.competitionLevel] ?? COMPETITION_STYLES.medium;
            return (
              <div
                key={i}
                className="rounded-2xl border bg-white p-5 space-y-3"
                style={{ borderColor: '#E8E4DF' }}
              >
                {/* Rank badge */}
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ background: i === 0 ? '#E85D3F' : '#9CA3AF' }}
                >
                  #{i + 1} {i === 0 ? 'Best match' : i === 1 ? 'Strong match' : 'Good match'}
                </span>

                <div>
                  <h4 className="font-bold text-gray-900">{niche.name}</h4>
                  <p className="text-xs text-gray-500 italic mt-1">{niche.reason}</p>
                </div>

                {/* Sample design thumbnails */}
                {niche.designIdeas?.length > 0 && (
                  <div className="flex gap-1.5">
                    {niche.designIdeas.slice(0, 3).map((_, j) => (
                      <div
                        key={j}
                        className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-lg"
                      >
                        🎨
                      </div>
                    ))}
                  </div>
                )}

                {/* Metrics */}
                <div
                  className="grid grid-cols-2 gap-2 rounded-xl p-3 text-xs"
                  style={{ background: '#FAFAF8' }}
                >
                  <div>
                    <p className="text-gray-400">Conv. rate</p>
                    <p className="font-semibold text-gray-700">{niche.estimatedConversionRate}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Competition</p>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: compStyle.bg, color: compStyle.text }}
                    >
                      {niche.competitionLevel}
                    </span>
                  </div>
                </div>

                <button
                  className="w-full rounded-xl py-2.5 text-xs font-semibold text-white"
                  style={{ background: '#E85D3F' }}
                >
                  Add these products
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-populate CTA */}
      <div className="rounded-2xl p-6" style={{ background: '#2D2D2D' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-bold text-white text-lg">Ready to build your store?</h4>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Auto-generate 6 products from your top niche.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              className="rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ background: '#E85D3F' }}
            >
              🚀 Auto-populate my store
            </button>
            <button
              className="rounded-full border border-white/30 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Explore manually
            </button>
          </div>
        </div>
      </div>

      {/* Store personalization */}
      {insights.storePersonalization && (
        <div className="rounded-2xl border bg-white p-5 space-y-3" style={{ borderColor: '#E8E4DF' }}>
          <h3 className="font-semibold text-gray-900">Store personalization</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400">Suggested store name</p>
              <p className="font-medium text-gray-800 mt-0.5">{insights.storePersonalization.recommendedStoreName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Suggested bio</p>
              <p className="text-sm text-gray-700 mt-0.5">{insights.storePersonalization.recommendedDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insights.storePersonalization.recommendedTags?.map((tag, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-center text-gray-400">
        Analysis based on your last 30 days of content. Re-run weekly.{' '}
        <button onClick={() => setPageState('connect')} className="underline hover:no-underline">Re-analyze</button>
      </p>
    </div>
  );
}
