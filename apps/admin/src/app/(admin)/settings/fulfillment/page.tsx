'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, Trash2, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

interface FulfillmentConnection {
  id:               string;
  provider:         string;
  status:           'ACTIVE' | 'INVALID' | 'DISCONNECTED';
  externalShopId:   string;
  externalShopName: string | null;
  lastVerifiedAt:   string | null;
  lastErrorMessage: string | null;
}

const QUERY_KEY = ['admin-fulfillment-connections'];

export default function FulfillmentSettingsPage() {
  const qc = useQueryClient();

  const [apiKey, setApiKey]                 = useState('');
  const [externalShopId, setExternalShopId] = useState('');
  const [connecting, setConnecting]         = useState(false);
  const [error, setError]                   = useState('');

  const { data: connections, isLoading } = useQuery<FulfillmentConnection[]>({
    queryKey: QUERY_KEY,
    queryFn:  () => api.get<FulfillmentConnection[]>(API_ROUTES.ADMIN.FULFILLMENT_CONNECTIONS),
    staleTime: 30_000,
  });

  const activeConnections = (connections ?? []).filter((c) => c.status !== 'DISCONNECTED');

  const handleConnect = async () => {
    setError('');
    if (!apiKey.trim() || !externalShopId.trim()) {
      setError('Enter both your Printify API key and shop ID');
      return;
    }
    setConnecting(true);
    try {
      await api.post(API_ROUTES.ADMIN.FULFILLMENT_CONNECTIONS, {
        provider: 'PRINTIFY',
        apiKey:   apiKey.trim(),
        externalShopId: externalShopId.trim(),
      });
      setApiKey('');
      setExternalShopId('');
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this fulfillment provider? Products mapped to it will no longer be auto-fulfilled.')) return;
    await api.delete(API_ROUTES.ADMIN.FULFILLMENT_CONNECTION_DELETE(id));
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return (
    <>
      <AdminPageHeader
        title="Fulfillment Providers"
        subtitle="Connect a print-on-demand provider (e.g. Printify) to auto-fulfill mapped products"
        queryKey={QUERY_KEY}
      />

      <div className="max-w-[640px] space-y-6">

        {/* Existing connections */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
          <h4 className="font-semibold text-secondary">Connected Accounts</h4>

          {isLoading && (
            <div className="h-16 bg-background border border-border rounded-button animate-pulse" />
          )}

          {!isLoading && activeConnections.length === 0 && (
            <p className="text-sm text-muted">No fulfillment provider connected yet.</p>
          )}

          {activeConnections.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 border border-border rounded-button px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Plug className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">
                    {c.provider} — {c.externalShopName ?? c.externalShopId}
                  </p>
                  <p className="text-xs text-muted flex items-center gap-1">
                    {c.status === 'ACTIVE'
                      ? <><CheckCircle2 className="w-3 h-3 text-green-600" /> Active</>
                      : (c.lastErrorMessage ?? 'Needs attention')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDisconnect(c.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-button hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          ))}
        </div>

        {/* Connect new */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
          <h4 className="font-semibold text-secondary">Connect Printify</h4>
          <p className="text-xs text-muted -mt-3">
            Find your API key under Printify → My Account → Connections, and your shop ID in the URL of your Printify shop settings.
          </p>

          <div>
            <FieldLabel>Printify API key</FieldLabel>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="eyJ0eXAiOiJKV1Qi..."
              className={inputCls}
              autoComplete="off"
            />
          </div>

          <div>
            <FieldLabel>Printify shop ID</FieldLabel>
            <input
              type="text"
              value={externalShopId}
              onChange={(e) => setExternalShopId(e.target.value)}
              placeholder="e.g. 815256"
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-button bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
          >
            <Plug className="w-4 h-4" />
            {connecting ? 'Connecting…' : 'Verify & Connect'}
          </button>
        </div>
      </div>
    </>
  );
}
