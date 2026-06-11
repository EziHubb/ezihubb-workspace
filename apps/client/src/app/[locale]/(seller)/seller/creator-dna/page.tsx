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
  niches:               DNANiche[];
  storePersonalization: {
    recommendedStoreName:        string;
    recommendedDescription:      string;
    recommendedTags:             string[];
  };
}

interface DNAAnalysis {
  insights:   DNAInsights;
  platform:   string;
  createdAt:  string;
}

export default function CreatorDNAPage() {
  const [platforms, setPlatforms]   = useState<ConnectedPlatform[]>([]);
  const [analysis, setAnalysis]     = useState<DNAAnalysis | null>(null);
  const [loading, setLoading]       = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<ConnectedPlatform[]>('/creator-dna/platforms'),
      apiClient.get<DNAAnalysis>('/creator-dna/analysis').catch(() => null),
    ]).then(([p, a]) => {
      setPlatforms(Array.isArray(p) ? p : []);
      setAnalysis(a);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      await apiClient.delete(`/creator-dna/platforms/${platform}`);
      setPlatforms(p => p.filter(x => x.platform !== platform));
    } catch {
      // ignore
    } finally {
      setDisconnecting(null);
    }
  };

  const competitionColor = (level: string) =>
    level === 'low' ? 'text-green-700 bg-green-50' :
    level === 'medium' ? 'text-yellow-700 bg-yellow-50' :
    'text-red-700 bg-red-50';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Creator DNA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your social accounts to get AI-powered niche recommendations for your store.
        </p>
      </div>

      {/* Social Connections */}
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Connected Accounts</h2>
        {loading ? (
          <div className="animate-pulse h-12 rounded bg-gray-100" />
        ) : (
          <div className="space-y-3">
            {/* TikTok */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">&#127925;</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">TikTok</div>
                  {platforms.find(p => p.platform === 'tiktok') ? (
                    <div className="text-xs text-green-600">Connected</div>
                  ) : (
                    <div className="text-xs text-gray-400">Not connected</div>
                  )}
                </div>
              </div>
              {platforms.find(p => p.platform === 'tiktok') ? (
                <button
                  onClick={() => handleDisconnect('tiktok')}
                  disabled={disconnecting === 'tiktok'}
                  className="text-xs text-red-600 border border-red-200 rounded px-2.5 py-1 hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting === 'tiktok' ? '…' : 'Disconnect'}
                </button>
              ) : (
                <a
                  href="/api/v1/creator-dna/tiktok/connect"
                  className="text-xs bg-black text-white rounded px-3 py-1.5 hover:bg-gray-800"
                >
                  Connect TikTok
                </a>
              )}
            </div>

            {/* Instagram */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">&#128247;</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">Instagram</div>
                  {platforms.find(p => p.platform === 'instagram') ? (
                    <div className="text-xs text-green-600">Connected</div>
                  ) : (
                    <div className="text-xs text-gray-400">Not connected</div>
                  )}
                </div>
              </div>
              {platforms.find(p => p.platform === 'instagram') ? (
                <button
                  onClick={() => handleDisconnect('instagram')}
                  disabled={disconnecting === 'instagram'}
                  className="text-xs text-red-600 border border-red-200 rounded px-2.5 py-1 hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting === 'instagram' ? '…' : 'Disconnect'}
                </button>
              ) : (
                <a
                  href="/api/v1/creator-dna/instagram/connect"
                  className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded px-3 py-1.5"
                >
                  Connect Instagram
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DNA Analysis Results */}
      {analysis ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Your Creator DNA</h2>
            <span className="text-xs text-gray-400">
              via {analysis.platform} &middot; {new Date(analysis.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Primary Audience</p>
            <p className="text-sm text-blue-900">{analysis.insights.primaryAudience}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {analysis.insights.niches?.map((niche, i) => (
              <div key={i} className="rounded-xl border bg-white p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{niche.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${competitionColor(niche.competitionLevel)}`}>
                    {niche.competitionLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{niche.reason}</p>
                <div className="text-xs text-green-700 font-medium">
                  Conv. rate: {niche.estimatedConversionRate}
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {niche.designIdeas?.slice(0, 3).map((idea, j) => (
                    <li key={j} className="flex items-start gap-1">
                      <span className="text-gray-400 mt-0.5">&#8226;</span>
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {analysis.insights.storePersonalization && (
            <div className="rounded-xl border bg-white p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Store Personalization</h3>
              <div>
                <p className="text-xs text-gray-500">Suggested Store Name</p>
                <p className="font-medium text-gray-800">{analysis.insights.storePersonalization.recommendedStoreName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Suggested Bio</p>
                <p className="text-sm text-gray-700">{analysis.insights.storePersonalization.recommendedDescription}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.insights.storePersonalization.recommendedTags?.map((tag, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !loading && platforms.length > 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-gray-500 text-sm">Analysis is running. Check back in a few minutes.</p>
        </div>
      ) : !loading && platforms.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-gray-500 text-sm">Connect a social account above to get your Creator DNA analysis.</p>
        </div>
      ) : null}
    </div>
  );
}
