'use client';
import { useState } from 'react';
import { Select } from '@ezihubb/ui';
import { api } from '../../lib/api-client';

interface IPScanResult {
  verdict:        'SAFE' | 'WARNING' | 'BLOCKED';
  detectedBrands: string[];
  detectedIP:     string[];
  confidence:     number;
  reasoning:      string | null;
  cached:         boolean;
  latencyMs:      number;
}

const VERDICT_STYLE: Record<string, string> = {
  SAFE:    'bg-green-100 text-green-800 border-green-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  BLOCKED: 'bg-red-100 text-red-800 border-red-300',
};

export function IPScanPanel() {
  const [imageUrl,   setImageUrl]   = useState('');
  const [entityType, setEntityType] = useState('product');
  const [entityId,   setEntityId]   = useState('');
  const [result,     setResult]     = useState<IPScanResult | null>(null);
  const [scanning,   setScanning]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.post<IPScanResult>('/admin/moderation/ip-scan', {
        imageUrl,
        entityType,
        entityId: entityId || 'manual-scan',
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">AI Copyright &amp; IP Scanner</h2>
        <p className="text-sm text-muted mt-1">
          Scan any image URL for trademark or copyright violations using Claude AI.
        </p>
      </div>

      <form onSubmit={handleScan} className="rounded-card border border-border bg-surface p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Image URL</label>
          <input
            type="url"
            required
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Entity Type</label>
            <Select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              options={[
                { value: 'product',       label: 'Product' },
                { value: 'design_asset',  label: 'Design Asset' },
                { value: 'store_banner',  label: 'Store Banner' },
                { value: 'profile_image', label: 'Profile Image' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Entity ID (optional)</label>
            <input
              type="text"
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              placeholder="Leave blank for manual scan"
              className="w-full rounded-button border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        {error && (
          <p className="text-xs text-error bg-red-50 border border-red-200 rounded-button p-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {scanning ? 'Scanning…' : 'Scan Image'}
        </button>
      </form>

      {result && (
        <div className="rounded-card border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary">Scan Result</h3>
            <div className="flex items-center gap-2">
              {result.cached && (
                <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs text-muted">Cached</span>
              )}
              <span className="text-xs text-muted">{result.latencyMs}ms</span>
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${VERDICT_STYLE[result.verdict]}`}
          >
            {result.verdict} ({Math.round(result.confidence * 100)}% confidence)
          </div>
          {(result.detectedBrands.length > 0 || result.detectedIP.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Detected</p>
              <div className="flex flex-wrap gap-2">
                {result.detectedBrands.map(b => (
                  <span key={b} className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                    {b}
                  </span>
                ))}
                {result.detectedIP.map(ip => (
                  <span key={ip} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                    {ip}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.reasoning && (
            <div className="rounded-lg bg-background p-3 border border-border">
              <p className="text-xs font-semibold text-muted mb-1">AI Reasoning</p>
              <p className="text-sm text-secondary leading-relaxed">{result.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
