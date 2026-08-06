'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
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

interface ApiKeySummary {
  id:         string;
  name:       string;
  keyPrefix:  string;
  lastUsedAt: string | null;
  revokedAt:  string | null;
  createdAt:  string;
}

interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

const QUERY_KEY = ['admin-api-keys'];

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ApiKeysSettingsPage() {
  const qc = useQueryClient();

  const [name, setName]           = useState('');
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');
  const [revealedKey, setRevealedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied]       = useState(false);

  const { data: keys, isLoading } = useQuery<ApiKeySummary[]>({
    queryKey: QUERY_KEY,
    queryFn:  () => api.get<ApiKeySummary[]>(API_ROUTES.ADMIN.API_KEYS),
    staleTime: 30_000,
  });

  const activeKeys = (keys ?? []).filter((k) => !k.revokedAt);

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) {
      setError('Give this key a name so you can recognize it later');
      return;
    }
    setCreating(true);
    try {
      const created = await api.post<CreatedApiKey>(API_ROUTES.ADMIN.API_KEYS, { name: name.trim() });
      setName('');
      setRevealedKey(created);
      setCopied(false);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any tool using it will immediately lose access.')) return;
    await api.delete(API_ROUTES.ADMIN.API_KEY_DELETE(id));
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey.key);
    setCopied(true);
  };

  return (
    <>
      <AdminPageHeader
        title="API Keys"
        subtitle="Issue keys so 3rd-party tools can list, update, and search your products"
        queryKey={QUERY_KEY}
      />

      <div className="max-w-[640px] space-y-6">

        {/* One-time reveal modal */}
        {revealedKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-surface rounded-card border border-border shadow-card max-w-[480px] w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-semibold">Copy your key now</h4>
              </div>
              <p className="text-sm text-muted">
                This is the only time the full key will be shown. Store it somewhere safe — you won&apos;t be able to view it again.
              </p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-button px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-secondary break-all">{revealedKey.key}</code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="w-full px-5 py-2.5 text-sm font-bold rounded-button bg-primary hover:bg-primary/90 text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Existing keys */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
          <h4 className="font-semibold text-secondary">Active Keys</h4>

          {isLoading && (
            <div className="h-16 bg-background border border-border rounded-button animate-pulse" />
          )}

          {!isLoading && activeKeys.length === 0 && (
            <p className="text-sm text-muted">No API keys yet.</p>
          )}

          {activeKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 border border-border rounded-button px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">{k.name}</p>
                  <p className="text-xs text-muted font-mono">{k.keyPrefix}… · Last used: {formatDate(k.lastUsedAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(k.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-button hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          ))}
        </div>

        {/* Create new */}
        <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-5">
          <h4 className="font-semibold text-secondary">Create a New Key</h4>
          <p className="text-xs text-muted -mt-3">
            Use a key to let a 3rd-party tool (e.g. Zapier, a bulk-listing app) create, update, and search your products via our Partner API.
          </p>

          <div>
            <FieldLabel>Key name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zapier integration"
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-button bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {creating ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </>
  );
}
