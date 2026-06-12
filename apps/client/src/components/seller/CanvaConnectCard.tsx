'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiClient } from '@mlh/api-client';

interface CanvaStatus {
  connected:    boolean;
  canvaUserId?: string;
  email?:       string;
  expiresAt?:   string;
  createdAt?:   string;
}

const HOW_IT_WORKS = [
  { step: '1', label: 'Design in Canva' },
  { step: '2', label: 'Click Publish' },
  { step: '3', label: 'Product updates automatically' },
];

export function CanvaConnectCard() {
  const [status, setStatus]           = useState<CanvaStatus | null>(null);
  const [loading, setLoading]         = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    apiClient.get<CanvaStatus>('/canva/status')
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiClient.delete('/canva/disconnect');
      setStatus({ connected: false });
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 animate-pulse h-32" style={{ borderColor: '#E8E4DF' }} />;
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-5" style={{ borderColor: '#E8E4DF' }}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Canva logo circle */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: '#00C4CC' }}
          >
            C
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Canva</h4>
            <p className="text-xs text-gray-400">Design tool integration</p>
          </div>
        </div>

        {status?.connected ? (
          /* Connected state */
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: '#F0FDF4', color: '#2E7D52' }}
            >
              <Check className="w-3 h-3" /> Connected
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <a
            href="/api/v1/canva/authorize"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#00C4CC' }}
          >
            Connect Canva
          </a>
        )}
      </div>

      {/* Connected email */}
      {status?.connected && (status.email || status.canvaUserId) && (
        <p className="text-xs text-gray-500 -mt-2">
          Connected as {status.email ?? status.canvaUserId}
        </p>
      )}

      {/* How it works — 3 steps */}
      <div className="flex items-center gap-2">
        {HOW_IT_WORKS.map((s, i) => (
          <div key={s.step} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center text-center flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1"
                style={{ background: status?.connected ? '#00C4CC' : '#D1D5DB' }}
              >
                {s.step}
              </div>
              <span className="text-[10px] text-gray-500 leading-tight">{s.label}</span>
            </div>
            {i < HOW_IT_WORKS.length - 1 && (
              <div className="w-6 h-px shrink-0" style={{ background: '#E8E4DF' }} />
            )}
          </div>
        ))}
      </div>

      {/* Permissions / benefits (shown when not connected) */}
      {!status?.connected && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: '#FAFAF8' }}>
          {[
            '✓ Read your Canva designs',
            '✓ Export designs as PNG (3000×3000)',
            '✓ We never post or modify your Canva account',
          ].map(line => (
            <p key={line} className="text-xs text-gray-600">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
