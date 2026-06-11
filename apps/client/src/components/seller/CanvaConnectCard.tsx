'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface CanvaStatus {
  connected:   boolean;
  canvaUserId?: string;
  expiresAt?:  string;
  createdAt?:  string;
}

export function CanvaConnectCard() {
  const [status, setStatus]     = useState<CanvaStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    apiClient.get<CanvaStatus>('/canva/status')
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Canva integration?')) return;
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

  if (loading) return <div className="rounded-lg border bg-white p-5 animate-pulse h-24" />;

  if (status?.connected) {
    return (
      <div className="rounded-lg border bg-white p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg">
            &#127914;
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Canva Connected</h3>
            <p className="text-xs text-gray-500">
              {status.canvaUserId ? `User: ${status.canvaUserId}` : 'Integration active'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg">&#127914;</div>
        <div>
          <h3 className="font-semibold text-gray-900">Connect Canva</h3>
          <p className="text-xs text-gray-500">Design in Canva and publish directly to your store</p>
        </div>
      </div>
      <ul className="text-xs text-gray-600 space-y-1">
        <li>&#10003; Publish Canva designs as product images instantly</li>
        <li>&#10003; Browse your products inside Canva</li>
        <li>&#10003; Two-way sync with your store</li>
      </ul>
      <a
        href="/api/v1/canva/authorize"
        className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
      >
        Connect Canva
      </a>
    </div>
  );
}
