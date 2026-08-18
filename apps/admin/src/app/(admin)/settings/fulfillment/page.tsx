'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, Trash2, CheckCircle2, Copy, Check, Webhook, PackageCheck, ArrowLeft, Store as StoreIcon } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../../../contexts/DialogContext';
import { useAdminMode } from '../../../../lib/store-context';
import { StorePicker, type StoreOption } from '../../../../components/ui/StorePicker';

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

type ProviderType = 'PRINTIFY' | 'MERCHIZE';

interface FulfillmentConnection {
  id:                  string;
  provider:            ProviderType;
  status:              'ACTIVE' | 'INVALID' | 'DISCONNECTED';
  externalShopId:      string;
  externalShopName:    string | null;
  lastVerifiedAt:      string | null;
  lastErrorMessage:    string | null;
  webhookCallbackUrl:  string | null;
  hasWebhookSecret:    boolean;
  /** Only present in the platform-wide aggregate (SUPER_ADMIN, no store selected). */
  store?: StoreOption;
}

const QUERY_KEY = ['admin-fulfillment-connections'];

const PROVIDER_FIELDS: Record<ProviderType, { keyLabel: string; keyPlaceholder: string; idLabel: string; idPlaceholder: string; help: string }> = {
  PRINTIFY: {
    keyLabel: 'Printify API key',
    keyPlaceholder: 'eyJ0eXAiOiJKV1Qi...',
    idLabel: 'Printify shop ID',
    idPlaceholder: 'e.g. 815256',
    help: 'Find your API key under Printify → My Account → Connections, and your shop ID in the URL of your Printify shop settings.',
  },
  MERCHIZE: {
    keyLabel: 'Merchize access token',
    keyPlaceholder: 'Paste your access token',
    idLabel: 'Merchize base URL',
    idPlaceholder: 'https://bo-group-x-y.merchize.com/your-slug/bo-api',
    help: 'Find both under your Merchize seller dashboard → Integrations → API.',
  },
};

/** Appends `?storeId=` only when acting on an explicit store — omitted entirely for a scoped caller (ambient store) so their existing behavior is untouched. */
function qsWithStore(storeId?: string): string {
  return storeId ? `?storeId=${storeId}` : '';
}

// ─── Merchize webhook setup panel ──────────────────────────────────────────

function MerchizeWebhookPanel({ connection, storeId }: { connection: FulfillmentConnection; storeId?: string }) {
  const qc = useQueryClient();
  const { alert } = useDialog();
  const [copied, setCopied] = useState(false);
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCopy = async () => {
    if (!connection.webhookCallbackUrl) return;
    await navigator.clipboard.writeText(connection.webhookCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSecret = async () => {
    if (!secret.trim()) return;
    setSaving(true);
    try {
      await api.put(`${API_ROUTES.ADMIN.FULFILLMENT_WEBHOOK_SECRET(connection.id)}${qsWithStore(storeId)}`, { secret: secret.trim() });
      setSecret('');
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      await alert((err as Error).message || 'Could not save the webhook secret.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 ml-12 p-3 rounded-button border border-dashed border-border bg-background space-y-2.5">
      <p className="text-xs font-semibold text-secondary flex items-center gap-1.5">
        <Webhook className="w-3.5 h-3.5" /> Webhook setup (manual — Merchize has no auto-registration API)
      </p>
      <p className="text-xs text-muted">
        1. Copy this URL into Merchize → Settings → Webhook → Add webhook (select all events).
      </p>
      <div className="flex items-center gap-2 bg-surface border border-border rounded-button px-2.5 py-2">
        <code className="flex-1 text-[11px] font-mono text-secondary break-all">{connection.webhookCallbackUrl}</code>
        <button type="button" onClick={handleCopy} className="shrink-0 text-primary hover:text-primary/80">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {connection.hasWebhookSecret ? (
        <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Webhook secret configured</p>
      ) : (
        <>
          <p className="text-xs text-muted">2. Click "Add secret Key" in that same page, then paste it here:</p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Merchize webhook secret"
              className={inputCls}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSaveSecret}
              disabled={saving || !secret.trim()}
              className="shrink-0 px-3 py-2 text-xs font-bold rounded-button bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Fulfillment mode card ──────────────────────────────────────────────────

type FulfillmentMode = 'AUTOMATIC' | 'MANUAL';
const MODE_QUERY_KEY = ['admin-fulfillment-mode'];

function FulfillmentModeCard({ storeId }: { storeId?: string }) {
  const qc = useQueryClient();
  const { alert } = useDialog();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ fulfillmentMode: FulfillmentMode }>({
    queryKey: [...MODE_QUERY_KEY, storeId ?? null],
    queryFn:  () => api.get<{ fulfillmentMode: FulfillmentMode }>(`${API_ROUTES.ADMIN.FULFILLMENT_MODE}${qsWithStore(storeId)}`),
    staleTime: 30_000,
  });

  const mode = data?.fulfillmentMode ?? 'AUTOMATIC';

  const handleSetMode = async (next: FulfillmentMode) => {
    if (next === mode || saving) return;
    setSaving(true);
    try {
      await api.put(API_ROUTES.ADMIN.FULFILLMENT_MODE, { mode: next, storeId });
      qc.setQueryData([...MODE_QUERY_KEY, storeId ?? null], { fulfillmentMode: next });
    } catch (err) {
      await alert((err as Error).message || 'Could not update fulfillment mode.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-secondary">How do you fulfill orders?</h4>
        <p className="text-xs text-muted mt-0.5">
          Choose whether orders are pushed automatically to a connected print-on-demand provider, or shipped by you.
        </p>
      </div>

      {isLoading ? (
        <div className="h-16 bg-background border border-border rounded-button animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSetMode('AUTOMATIC')}
            disabled={saving}
            className={[
              'text-left p-4 rounded-button border-2 transition-colors disabled:opacity-60',
              mode === 'AUTOMATIC' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-secondary">Use a fulfillment provider</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Orders for mapped products are pushed automatically to Printify or Merchize.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('MANUAL')}
            disabled={saving}
            className={[
              'text-left p-4 rounded-button border-2 transition-colors disabled:opacity-60',
              mode === 'MANUAL' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-secondary">I'll fulfill orders myself</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Nothing is auto-pushed anywhere. Ship orders yourself from the Orders page — mark shipped and add tracking there.
            </p>
          </button>
        </div>
      )}

      {mode === 'MANUAL' && (
        <p className="text-xs text-secondary bg-primary/5 border border-primary/20 rounded-button px-3 py-2">
          Manual fulfillment is on — the sections below are optional. Connecting a provider still works, but no orders will be auto-pushed until you switch back to "Use a fulfillment provider".
        </p>
      )}
    </div>
  );
}

// ─── Platform-wide overview (SUPER_ADMIN, no store selected) ────────────────

function PlatformOverview({ connections, isLoading, onPickStore }: {
  connections: FulfillmentConnection[];
  isLoading:   boolean;
  onPickStore: (store: StoreOption) => void;
}) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-secondary">Platform overview</h4>
        <p className="text-xs text-muted mt-0.5">Every store's connected fulfillment provider, across the whole system.</p>
      </div>

      {isLoading && <div className="h-16 bg-background border border-border rounded-button animate-pulse" />}

      {!isLoading && connections.length === 0 && (
        <p className="text-sm text-muted">No store has connected a fulfillment provider yet.</p>
      )}

      {!isLoading && connections.length > 0 && (
        <div className="divide-y divide-border/60 -mx-2">
          {connections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => c.store && onPickStore(c.store)}
              className="w-full flex items-center justify-between gap-4 px-2 py-2.5 text-left hover:bg-muted/5 rounded-button transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Plug className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">{c.store?.name ?? 'Unknown store'}</p>
                  <p className="text-xs text-muted truncate">{c.provider} — {c.externalShopName ?? c.externalShopId}</p>
                </div>
              </div>
              <span className="text-xs font-medium shrink-0 flex items-center gap-1">
                {c.status === 'ACTIVE'
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Active</>
                  : <span className="text-amber-600">{c.lastErrorMessage ?? 'Needs attention'}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function FulfillmentSettingsPage() {
  const qc = useQueryClient();
  const { isPlatformContext, isReady } = useAdminMode();
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);

  const [provider, setProvider]             = useState<ProviderType>('PRINTIFY');
  const [apiKey, setApiKey]                 = useState('');
  const [externalShopId, setExternalShopId] = useState('');
  const [connecting, setConnecting]         = useState(false);
  const [error, setError]                   = useState('');

  // Chrome ignores autocomplete="off" for fields it heuristically matches to
  // a saved profile value (this base-URL field was getting the admin's own
  // saved email filled in). Browsers don't autofill readonly fields on load,
  // so drop readonly the moment the user actually focuses in.
  const [keyFieldLocked, setKeyFieldLocked] = useState(true);
  const [idFieldLocked, setIdFieldLocked]   = useState(true);

  // Only pass an explicit storeId once a platform-context SUPER_ADMIN has picked one —
  // every other caller (plain ADMIN, or SUPER_ADMIN in "My Store" mode) stays ambient,
  // exactly as before. Absence of storeId + isPlatformContext is what makes the
  // GET below return the platform-wide aggregate instead of one store's list.
  const explicitStoreId = isPlatformContext && selectedStore ? selectedStore.id : undefined;
  const showOverview = isPlatformContext && !selectedStore;

  // The connect-a-provider form is shared UI across whichever store is currently
  // targeted — without this, an unsubmitted API key typed for one store would
  // silently carry over into the form after switching to a different store.
  useEffect(() => {
    setApiKey('');
    setExternalShopId('');
    setError('');
  }, [explicitStoreId]);

  const { data: connections, isLoading } = useQuery<FulfillmentConnection[]>({
    queryKey: [...QUERY_KEY, explicitStoreId ?? (showOverview ? 'platform' : null)],
    queryFn:  () => api.get<FulfillmentConnection[]>(`${API_ROUTES.ADMIN.FULFILLMENT_CONNECTIONS}${qsWithStore(explicitStoreId)}`),
    staleTime: 30_000,
  });

  const activeConnections = (connections ?? []).filter((c) => c.status !== 'DISCONNECTED');
  const fields = PROVIDER_FIELDS[provider];

  const handleConnect = async () => {
    setError('');
    if (!apiKey.trim() || !externalShopId.trim()) {
      setError(`Enter both your ${fields.keyLabel} and ${fields.idLabel}`);
      return;
    }
    setConnecting(true);
    try {
      await api.post(API_ROUTES.ADMIN.FULFILLMENT_CONNECTIONS, {
        provider,
        apiKey:   apiKey.trim(),
        externalShopId: externalShopId.trim(),
        storeId: explicitStoreId,
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
    await api.delete(`${API_ROUTES.ADMIN.FULFILLMENT_CONNECTION_DELETE(id)}${qsWithStore(explicitStoreId)}`);
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return (
    <>
      <AdminPageHeader
        title="Fulfillment Providers"
        subtitle="Auto-fulfill via a print-on-demand provider, or manage every order yourself"
        queryKey={QUERY_KEY}
      />

      <div className="max-w-[640px] space-y-6">

        {isPlatformContext && selectedStore && (
          <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-card px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-secondary min-w-0">
              <StoreIcon className="w-4 h-4 text-primary shrink-0" />
              Managing: <span className="text-primary truncate">{selectedStore.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedStore(null)}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to overview
            </button>
          </div>
        )}

        {/* Same guard as settings/api-keys: isPlatformContext is false while
            the session loads (the shop-owner value), so this would briefly
            render store-scoped fulfillment to a platform SUPER_ADMIN. Render
            neither branch until the role is known; no spinner by design. */}
        {!isReady ? null : showOverview ? (
          <>
            <PlatformOverview
              connections={connections ?? []}
              isLoading={isLoading}
              onPickStore={setSelectedStore}
            />
            <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-3">
              <h4 className="font-semibold text-secondary">Manage a specific store</h4>
              <p className="text-xs text-muted -mt-1.5">Pick a store to view, connect, or disconnect its fulfillment provider.</p>
              <StorePicker value={selectedStore} onChange={setSelectedStore} />
            </div>
          </>
        ) : (
          <>
            <FulfillmentModeCard storeId={explicitStoreId} />

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
                <div key={c.id}>
                  <div className="flex items-center justify-between gap-4 border border-border rounded-button px-4 py-3">
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
                  {c.provider === 'MERCHIZE' && c.status === 'ACTIVE' && (
                    <MerchizeWebhookPanel connection={c} storeId={explicitStoreId} />
                  )}
                </div>
              ))}
            </div>

            {/* Connect new */}
            <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
              <h4 className="font-semibold text-secondary">Connect a Provider</h4>

              <div>
                <FieldLabel>Provider</FieldLabel>
                <div className="flex gap-2">
                  {(['PRINTIFY', 'MERCHIZE'] as ProviderType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className={[
                        'px-4 py-2 text-sm font-medium rounded-button border transition-colors',
                        provider === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted hover:border-primary/40',
                      ].join(' ')}
                    >
                      {p === 'PRINTIFY' ? 'Printify (default)' : 'Merchize'}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted -mt-2">{fields.help}</p>

              <div>
                <FieldLabel>{fields.keyLabel}</FieldLabel>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onFocus={() => setKeyFieldLocked(false)}
                  placeholder={fields.keyPlaceholder}
                  className={inputCls}
                  name="mlh-fulfillment-key"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  readOnly={keyFieldLocked}
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-bwignore="true"
                  data-form-type="other"
                />
              </div>

              <div>
                <FieldLabel>{fields.idLabel}</FieldLabel>
                <input
                  type="text"
                  value={externalShopId}
                  onChange={(e) => setExternalShopId(e.target.value)}
                  onFocus={() => setIdFieldLocked(false)}
                  placeholder={fields.idPlaceholder}
                  className={inputCls}
                  name="mlh-fulfillment-shop-ref"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  readOnly={idFieldLocked}
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-bwignore="true"
                  data-form-type="other"
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
          </>
        )}
      </div>
    </>
  );
}
