'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dna, RefreshCw, ChevronDown, ChevronRight, Loader2,
  Link2Off, Play, AlertCircle,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDateTime, fmtRelative, capitalize, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectedPlatform {
  platform:       string;
  platformUserId: string | null;
  createdAt:      string;
}

interface CreatorDna {
  id:            string;
  userId:        string;
  creatorName:   string;
  email:         string;
  primaryStyle:  string | null;
  colorPalette:  string[];
  techniques:    string[];
  themes:        string[];
  audienceMatch: number | null;
  analysedAt:    string;
  summary:       string | null;
}

interface CreatorDnaResponse {
  data:       CreatorDna[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Platform brand icons ───────────────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.87a8.18 8.18 0 0 0 4.77 1.52V6.9a4.85 4.85 0 0 1-1-.21z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

// ── Platform definitions ───────────────────────────────────────────────────────

const PLATFORMS: Array<{
  id:       string;
  label:    string;
  Icon:     (p: { className?: string }) => React.ReactElement;
  btnClass: string;
  style?:   CSSProperties;
}> = [
  {
    id:       'tiktok',
    label:    'TikTok',
    Icon:     TikTokIcon,
    btnClass: 'bg-[#010101] hover:bg-[#1c1c1c] text-white',
  },
  {
    id:       'instagram',
    label:    'Instagram',
    Icon:     InstagramIcon,
    btnClass: 'text-white hover:opacity-90',
    style:    { background: 'linear-gradient(45deg,#833AB4,#C13584,#E1306C,#FD1D1D,#F77737)' },
  },
];

// ── Tag chip ──────────────────────────────────────────────────────────────────

function Tag({ label, color = 'bg-primary/10 text-primary' }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {label}
    </span>
  );
}

// ── Audience score bar ────────────────────────────────────────────────────────

function AudienceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted text-xs">—</span>;
  const pct   = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums">{score}%</span>
    </div>
  );
}

// ── Expandable analysis row ───────────────────────────────────────────────────

function DnaRow({
  dna,
  onReanalyze,
  reanalyzing,
}: {
  dna:         CreatorDna;
  onReanalyze: (id: string) => void;
  reanalyzing: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="hover:bg-background transition-colors cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="px-4 py-3">
          <span className="text-muted">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-secondary">{dna.creatorName}</p>
          <p className="text-xs text-muted">{dna.email}</p>
        </td>
        <td className="px-4 py-3 text-sm text-secondary">{dna.primaryStyle ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {dna.colorPalette.slice(0, 4).map((c) => (
              <span key={c} className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </td>
        <td className="px-4 py-3"><AudienceBar score={dna.audienceMatch} /></td>
        <td className="px-4 py-3 text-xs text-muted">{fmtRelative(dna.analysedAt)}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onReanalyze(dna.id)}
            disabled={reanalyzing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-secondary border border-border rounded-button hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"
          >
            {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Reanalyze
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-background">
          <td colSpan={7} className="px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Techniques</p>
                <div className="flex flex-wrap gap-1">
                  {dna.techniques.length > 0
                    ? dna.techniques.map((t) => <Tag key={t} label={capitalize(t)} />)
                    : <span className="text-xs text-muted">None identified</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Themes</p>
                <div className="flex flex-wrap gap-1">
                  {dna.themes.length > 0
                    ? dna.themes.map((t) => <Tag key={t} label={capitalize(t)} color="bg-green-50 text-green-700" />)
                    : <span className="text-xs text-muted">None identified</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">AI Summary</p>
                {dna.summary
                  ? <p className="text-xs text-muted leading-relaxed">{dna.summary}</p>
                  : <em className="text-xs text-muted">No summary available.</em>}
                <p className="text-xs text-muted/50 mt-2">Analysed {fmtDateTime(dna.analysedAt)}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Platform connect card ─────────────────────────────────────────────────────

function ConnectSection({
  platforms,
  onConnect,
  onDisconnect,
  onFetch,
  connectingP,
  connectError,
  disconnecting,
  fetching,
}: {
  platforms:    ConnectedPlatform[];
  onConnect:    (p: string) => void;
  onDisconnect: (p: string) => void;
  onFetch:      (p: string) => void;
  connectingP:  string | null;
  connectError: string | null;
  disconnecting: string | null;
  fetching:      string | null;
}) {
  const connectedIds = new Set(platforms.map((p) => p.platform));

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold text-secondary mb-1">Social Media Connections</h2>
      <p className="text-xs text-muted mb-4">
        Connect your store&apos;s social accounts. After connecting, click <strong>Fetch &amp; Analyze</strong> to generate a Creator DNA profile.
      </p>

      <div className="flex flex-wrap gap-3">
        {PLATFORMS.map((pl) => {
          const connected    = connectedIds.has(pl.id);
          const conn         = platforms.find((p) => p.platform === pl.id);
          const isConnecting = connectingP === pl.id;

          if (connected && conn) {
            return (
              <div key={pl.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-button bg-background">
                <pl.Icon className="w-4 h-4 text-secondary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary">{pl.label}</p>
                  {conn.platformUserId && (
                    <p className="text-[11px] text-muted truncate max-w-[120px]">ID: {conn.platformUserId}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onFetch(pl.id)}
                  disabled={!!fetching}
                  title="Fetch & Analyze"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-green-700 border border-green-200 rounded-button hover:bg-green-50 disabled:opacity-40 transition-colors"
                >
                  {fetching === pl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Fetch
                </button>
                <button
                  type="button"
                  onClick={() => onDisconnect(pl.id)}
                  disabled={!!disconnecting}
                  title="Disconnect"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-error border border-error/20 rounded-button hover:bg-error/5 disabled:opacity-40 transition-colors"
                >
                  {disconnecting === pl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                  Disconnect
                </button>
              </div>
            );
          }

          return (
            <button
              key={pl.id}
              type="button"
              onClick={() => onConnect(pl.id)}
              disabled={connectingP !== null}
              className={[
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-button transition-all',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                pl.btnClass,
              ].join(' ')}
              style={pl.style}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <pl.Icon className="w-4 h-4" />
                  Connect {pl.label}
                </>
              )}
            </button>
          );
        })}
      </div>

      {connectError && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-error/8 border border-error/20">
          <AlertCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
          <span className="text-xs text-error">{connectError}</span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK_LIST      = (page: number) => ['ai-creator-dna', page];
const QK_PLATFORMS = ['ai-creator-dna-platforms'];

export default function AiCreatorDnaPage() {
  const [page,        setPage]        = useState(1);
  const [actionId,    setActionId]    = useState<string | null>(null);
  const [disconnectP, setDisconnectP] = useState<string | null>(null);
  const [fetchingP,   setFetchingP]   = useState<string | null>(null);
  const [fetchMsg,    setFetchMsg]    = useState<string | null>(null);
  const [connectingP, setConnectingP] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const qc = useQueryClient();

  // Handle OAuth callback:
  //  – If running inside a popup (window.opener exists), post a message to the
  //    parent and close this window.
  //  – Otherwise (direct navigation fallback), show the success banner.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp       = new URLSearchParams(window.location.search);
    const platform = sp.get('platform');
    if (!platform) return;

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: 'oauth-callback', platform, success: true },
          window.location.origin,
        );
      } catch {
        // cross-origin guard; ignore
      }
      window.close();
      return;
    }

    // Fallback: direct redirect (no popup)
    const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
    setFetchMsg(`${label} connected! Click Fetch & Analyze to generate a Creator DNA profile.`);
    qc.invalidateQueries({ queryKey: QK_PLATFORMS });
    window.history.replaceState({}, '', window.location.pathname);
  }, [qc]);

  const { data: platformsData } = useQuery<ConnectedPlatform[]>({
    queryKey: QK_PLATFORMS,
    queryFn:  () => api.get<ConnectedPlatform[]>(API_ROUTES.ADMIN.AI_CREATOR_DNA_PLATFORMS),
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery<CreatorDnaResponse>({
    queryKey: QK_LIST(page),
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      return api.get<CreatorDnaResponse>(`${API_ROUTES.ADMIN.AI_CREATOR_DNA_LIST}?${p}`);
    },
    staleTime: 60_000,
  });

  const reanalyze = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_CREATOR_DNA_REANALYZE(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-creator-dna'] }); },
  });

  const disconnect = useMutation({
    mutationFn: (platform: string) => api.delete(API_ROUTES.ADMIN.AI_CREATOR_DNA_PLATFORM(platform)),
    onMutate:   (p) => setDisconnectP(p),
    onSettled:  () => { setDisconnectP(null); qc.invalidateQueries({ queryKey: QK_PLATFORMS }); },
  });

  const fetchAnalyze = useMutation({
    mutationFn: (platform: string) => api.post(API_ROUTES.ADMIN.AI_CREATOR_DNA_FETCH, { platform }),
    onMutate:   (p) => { setFetchingP(p); setFetchMsg(null); },
    onSuccess:  () => {
      setFetchMsg('Analysis started — results will appear in the table below shortly.');
      qc.invalidateQueries({ queryKey: ['ai-creator-dna'] });
    },
    onError:    () => setFetchMsg('Fetch failed — check that the API keys are configured.'),
    onSettled:  () => setFetchingP(null),
  });

  function handleConnect(platform: string) {
    const connectUrl = `/api/v1/creator-dna/${platform}/connect`;
    const features   = 'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no';
    const popup      = window.open(connectUrl, `oauth_${platform}`, features);

    if (!popup || popup.closed) {
      setConnectError('Popup was blocked. Please allow pop-ups for this page and try again.');
      return;
    }

    setConnectingP(platform);
    setConnectError(null);
    setFetchMsg(null);
    let resolved = false;

    function cleanup() {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    }

    function handleMessage(evt: MessageEvent) {
      if (evt.origin !== window.location.origin) return;
      if (evt.data?.type !== 'oauth-callback' || evt.data?.platform !== platform) return;
      resolved = true;
      cleanup();
      setConnectingP(null);
      if (evt.data.success) {
        qc.invalidateQueries({ queryKey: QK_PLATFORMS });
        const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
        setFetchMsg(`${label} connected! Click Fetch & Analyze to generate a Creator DNA profile.`);
      } else {
        const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
        setConnectError(evt.data.error ?? `Failed to connect ${label}. Please try again.`);
      }
    }

    // Poll for popup closure — fires when user closes the window without completing OAuth
    const interval = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      if (!resolved) {
        setConnectingP(null);
        const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
        setConnectError(`${label} connection was cancelled — the authorization window was closed.`);
      }
    }, 500);

    window.addEventListener('message', handleMessage);
  }

  const profiles   = safeArr(data?.data);
  const pagination = data?.pagination;
  const platforms  = safeArr(platformsData);

  return (
    <div>
      <AdminPageHeader
        title="Creator DNA"
        subtitle="Connect social accounts, fetch content, and generate AI-powered creator profiles"
        queryKey={QK_LIST(page)}
      />

      {/* ── Connect section ── */}
      <ConnectSection
        platforms={platforms}
        onConnect={handleConnect}
        onDisconnect={(p) => disconnect.mutate(p)}
        onFetch={(p) => fetchAnalyze.mutate(p)}
        connectingP={connectingP}
        connectError={connectError}
        disconnecting={disconnectP}
        fetching={fetchingP}
      />

      {fetchMsg && (
        <div className="mb-4 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-card text-xs text-primary">
          {fetchMsg}
        </div>
      )}

      {/* ── Analysis results table ── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center">
            <Dna className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted">No Creator DNA profiles yet.</p>
            <p className="text-xs text-muted/60 mt-1">Connect a social account above and click Fetch &amp; Analyze.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="w-8" />
                  {['Creator', 'Primary Style', 'Color Palette', 'Audience Match', 'Analysed', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((d) => (
                  <DnaRow
                    key={d.id}
                    dna={d}
                    onReanalyze={(id) => reanalyze.mutate(id)}
                    reanalyzing={reanalyze.isPending && actionId === d.id}
                  />
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Previous</button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
