'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight,
  Loader2, Package, ExternalLink, AlertCircle, ChevronDown as DropdownIcon,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDateTime, fmtRelative, capitalize, safeArr } from '../../../../lib/fmt';

interface TrendSourceMeta {
  id:             string;
  name:           string;
  requiresApiKey: boolean;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendDraft {
  id:                string;
  keyword:           string;
  category:          string | null;
  score:             number;
  source:            string;
  status:            'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  summary:           string | null;
  textContent:       string | null;
  colorPalette:      string | null;
  style:             string | null;
  targetAudience:    string | null;
  imageUrl:          string | null;
  productName:       string | null;
  storeName:         string | null;
  approvedProductId: string | null;
  suggestedAt:       string;
  reviewedAt:        string | null;
  reviewedBy:        string | null;
}

interface TrendDraftsResponse {
  data:       TrendDraft[];
  pagination: { total: number; page: number; totalPages: number };
}

interface ScanResult { created: number; stores: number; message: string; sources?: string[] }

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TrendDraft['status'], string> = {
  PENDING_REVIEW: 'Pending',
  APPROVED:       'Approved',
  REJECTED:       'Rejected',
  EXPIRED:        'Expired',
};

function StatusBadge({ status }: { status: TrendDraft['status'] }) {
  const cfg = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-700',
    APPROVED:       'bg-green-100 text-green-700',
    REJECTED:       'bg-red-100 text-red-700',
    EXPIRED:        'bg-gray-100 text-gray-500',
  }[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct   = Math.min(100, Math.max(0, score / 100_000));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-20 text-right">
        {score >= 1_000_000 ? `${(score / 1_000_000).toFixed(1)}M` : score >= 1_000 ? `${(score / 1_000).toFixed(0)}K` : score}
      </span>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function DraftRow({
  draft,
  onApprove,
  onReject,
  onCreateProduct,
  approving,
  rejecting,
  creating,
}: {
  draft:           TrendDraft;
  onApprove:       (id: string) => void;
  onReject:        (id: string) => void;
  onCreateProduct: (id: string) => void;
  approving:       boolean;
  rejecting:       boolean;
  creating:        boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPending  = draft.status === 'PENDING_REVIEW';
  const isApproved = draft.status === 'APPROVED';

  return (
    <>
      <tr className="hover:bg-background transition-colors cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <td className="px-4 py-3">
          <span className="text-muted">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </td>
        {/* Thumbnail */}
        <td className="px-4 py-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/10 border border-border shrink-0">
            {draft.imageUrl ? (
              <Image src={draft.imageUrl} alt={draft.keyword} width={40} height={40} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-4 h-4 text-muted/40" />
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3 font-medium text-secondary text-sm">{draft.keyword}</td>
        <td className="px-4 py-3 text-sm text-muted">{draft.category ?? '—'}</td>
        <td className="px-4 py-3 w-36"><ScoreBar score={draft.score} /></td>
        <td className="px-4 py-3 text-xs text-muted">{capitalize(draft.source.toLowerCase())}</td>
        <td className="px-4 py-3 text-xs text-muted">{draft.storeName ?? '—'}</td>
        <td className="px-4 py-3"><StatusBadge status={draft.status} /></td>
        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{fmtRelative(draft.suggestedAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => onApprove(draft.id)}
                  disabled={approving || rejecting}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-button hover:bg-green-100 disabled:opacity-40 transition-colors"
                >
                  {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReject(draft.id)}
                  disabled={approving || rejecting}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-button hover:bg-red-100 disabled:opacity-40 transition-colors"
                >
                  {rejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  Reject
                </button>
              </>
            )}
            {isApproved && !draft.approvedProductId && (
              <button
                type="button"
                onClick={() => onCreateProduct(draft.id)}
                disabled={creating}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-button hover:bg-primary/15 disabled:opacity-40 transition-colors"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                Create Product
              </button>
            )}
            {draft.approvedProductId && (
              <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                <CheckCircle className="w-3 h-3" /> Product created
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr className="bg-background">
          <td colSpan={10} className="px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
              {/* Image */}
              {draft.imageUrl && (
                <div className="shrink-0">
                  <div className="w-40 h-40 rounded-xl overflow-hidden border border-border bg-muted/10">
                    <Image src={draft.imageUrl} alt={draft.keyword} width={160} height={160} className="object-cover w-full h-full" />
                  </div>
                </div>
              )}

              {/* Brief details */}
              <div className="space-y-2 text-sm">
                {draft.productName && (
                  <p className="font-semibold text-secondary">{draft.productName}</p>
                )}
                {draft.summary && (
                  <p className="text-muted leading-relaxed">{draft.summary}</p>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
                  {draft.category       && <Pair label="Product type"    value={draft.category} />}
                  {draft.textContent    && <Pair label="Text / Quote"     value={draft.textContent} />}
                  {draft.colorPalette   && <Pair label="Color palette"    value={draft.colorPalette} />}
                  {draft.style          && <Pair label="Style"            value={draft.style} />}
                  {draft.targetAudience && <Pair label="Target audience"  value={draft.targetAudience} />}
                  {draft.storeName      && <Pair label="Store"            value={draft.storeName} />}
                </div>
                {draft.reviewedAt && (
                  <p className="text-xs text-muted/60 mt-1">
                    Reviewed {fmtDateTime(draft.reviewedAt)}{draft.reviewedBy ? ` by ${draft.reviewedBy}` : ''}
                  </p>
                )}
                {draft.approvedProductId && (
                  <a
                    href={`/products/${draft.approvedProductId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View product
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted/60">{label}: </span>
      <span className="text-secondary font-medium">{value}</span>
    </div>
  );
}

// ── Source picker dropdown ─────────────────────────────────────────────────

function SourcePicker({
  sources,
  selected,
  onChange,
}: {
  sources:  TrendSourceMeta[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const label = selected.length === 0
    ? 'All enabled sources'
    : selected.length === 1
      ? sources.find((s) => s.id === selected[0])?.name ?? '1 source'
      : `${selected.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-button hover:border-primary transition-colors text-secondary"
      >
        <span>{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-surface border border-border rounded-card shadow-lg z-10 p-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wide px-2 pb-1">Sources to scan</p>
          <button
            type="button"
            onClick={() => onChange([])}
            className={`w-full text-left px-2 py-1.5 text-xs rounded-button transition-colors ${
              selected.length === 0 ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-background'
            }`}
          >
            All enabled sources (default)
          </button>
          {sources.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => toggle(src.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-button transition-colors ${
                selected.includes(src.id) ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-background'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                selected.includes(src.id) ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {selected.includes(src.id) && <CheckCircle className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="flex-1">{src.name}</span>
              {src.requiresApiKey && (
                <span className="text-[10px] text-amber-600 font-medium">key</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK = (status: string, page: number) => ['ai-trend-drafts', status, page];

export default function AiTrendsPage() {
  const [status,       setStatus]       = useState<'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_REVIEW');
  const [page,         setPage]         = useState(1);
  const [scanMsg,      setScanMsg]      = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [actionId,     setActionId]     = useState<string | null>(null);
  const [scanSources,  setScanSources]  = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: sourceMeta } = useQuery<TrendSourceMeta[]>({
    queryKey: ['ai-sources'],
    queryFn:  () => api.get<TrendSourceMeta[]>(API_ROUTES.ADMIN.AI_SOURCES),
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery<TrendDraftsResponse>({
    queryKey: QK(status, page),
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'ALL') p.set('status', status);
      return api.get<TrendDraftsResponse>(`${API_ROUTES.ADMIN.AI_TREND_DRAFTS}?${p}`);
    },
    staleTime: 30_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_TREND_DRAFT_APPROVE(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => {
      setActionId(null);
      qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] });
      qc.invalidateQueries({ queryKey: ['sidebar-ai-trend-pending'] });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_TREND_DRAFT_REJECT(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => {
      setActionId(null);
      qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] });
      qc.invalidateQueries({ queryKey: ['sidebar-ai-trend-pending'] });
    },
  });

  const createProduct = useMutation({
    mutationFn: (id: string) => api.post<{ productSlug: string }>(API_ROUTES.ADMIN.AI_TREND_DRAFT_CREATE_PRODUCT(id), {}),
    onMutate:   (id) => setActionId(id),
    onSuccess:  (res) => {
      setScanMsg({ type: 'success', text: `Product created — slug: ${res.productSlug}` });
      setTimeout(() => setScanMsg(null), 8000);
      qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] });
    },
    onError: () => setScanMsg({ type: 'error', text: 'Failed to create product — check API logs' }),
    onSettled: () => setActionId(null),
  });

  const scan = useMutation<ScanResult>({
    mutationFn: () => api.post<ScanResult>(
      API_ROUTES.ADMIN.AI_TREND_SCAN,
      scanSources.length > 0 ? { sources: scanSources } : {},
    ),
    onSuccess: (res) => {
      if (res.stores === 0) {
        setScanMsg({ type: 'info', text: res.message });
      } else if (res.created > 0) {
        const srcNote = res.sources?.length ? ` [${res.sources.join(', ')}]` : '';
        setScanMsg({ type: 'success', text: res.message + srcNote });
        setStatus('PENDING_REVIEW');
        setPage(1);
        qc.invalidateQueries({ queryKey: ['ai-trend-drafts'] });
        qc.invalidateQueries({ queryKey: ['sidebar-ai-trend-pending'] });
      } else {
        setScanMsg({ type: 'error', text: res.message });
      }
    },
    onError: () => {
      setScanMsg({ type: 'error', text: 'Scan failed — check API logs and try again' });
    },
  });

  const drafts     = safeArr(data?.data);
  const pagination = data?.pagination;

  return (
    <div>
      <AdminPageHeader
        title="Trend Dashboard"
        subtitle="Review AI-suggested product trends and approve them for merchandising"
        queryKey={QK(status, page)}
        actions={
          <div className="flex items-center gap-2">
            {sourceMeta && sourceMeta.length > 0 && (
              <SourcePicker
                sources={sourceMeta}
                selected={scanSources}
                onChange={setScanSources}
              />
            )}
            <button
              type="button"
              onClick={() => { setScanMsg(null); scan.mutate(); }}
              disabled={scan.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {scan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {scan.isPending ? 'Scanning…' : 'Trigger Scan'}
            </button>
          </div>
        }
      />

      {/* Scan / action feedback */}
      {scanMsg && (
        <div className={`mb-4 flex items-start gap-2.5 px-4 py-3 rounded-button text-sm border ${
          scanMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          scanMsg.type === 'info'    ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                       'bg-red-50 text-red-700 border-red-200'
        }`}>
          {scanMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
           scanMsg.type === 'info'    ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
                                        <XCircle     className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="flex-1">{scanMsg.text}</span>
          <button type="button" onClick={() => setScanMsg(null)} className="text-current/50 hover:text-current">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            className={[
              'px-3 py-1.5 text-sm rounded-button border transition-colors',
              status === s
                ? 'bg-primary text-white border-primary'
                : 'border-border text-muted hover:border-primary hover:text-secondary',
            ].join(' ')}
          >
            {s === 'PENDING_REVIEW' ? 'Pending' : capitalize(s.toLowerCase())}
          </button>
        ))}
        {pagination && (
          <span className="ml-auto text-xs text-muted">{pagination.total} total</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-secondary mb-1">No trend drafts</p>
            <p className="text-xs text-muted">Click "Trigger Scan" to generate AI trend drafts from your active stores.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="w-8" />
                  <th className="w-12" />
                  {['Keyword', 'Type', 'Engagement', 'Source', 'Store', 'Status', 'Suggested', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drafts.map((d) => (
                  <DraftRow
                    key={d.id}
                    draft={d}
                    onApprove={(id) => approve.mutate(id)}
                    onReject={(id) => reject.mutate(id)}
                    onCreateProduct={(id) => createProduct.mutate(id)}
                    approving={approve.isPending && actionId === d.id}
                    rejecting={reject.isPending && actionId === d.id}
                    creating={createProduct.isPending && actionId === d.id}
                  />
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Previous
                  </button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
