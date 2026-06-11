'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock,
  Search, ExternalLink, ChevronDown, Eye,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

type FlagType   = 'PRODUCT' | 'REVIEW' | 'STORE' | 'USER';
type Severity   = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type FlagStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';

interface ModerationFlag {
  id:          string;
  type:        FlagType;
  severity:    Severity;
  status:      FlagStatus;
  reason:      string;
  aiScore:     number | null;
  aiLabel:     string | null;
  createdAt:   string;
  resolvedAt:  string | null;
  resolvedBy:  string | null;
  targetId:    string;
  targetName:  string;
  targetUrl:   string | null;
  reportedBy:  string | null;
}

interface ModerationStats {
  totalPending:  number;
  totalToday:    number;
  avgResolutionHours: number;
  criticalCount: number;
}

interface FlagsResponse {
  data:       ModerationFlag[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<Severity, string> = {
  LOW:      'bg-gray-100 text-gray-600',
  MEDIUM:   'bg-amber-100 text-amber-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const SEVERITY_DOT: Record<Severity, string> = {
  LOW:      'bg-gray-400',
  MEDIUM:   'bg-amber-400',
  HIGH:     'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

const STATUS_COLORS: Record<FlagStatus, string> = {
  PENDING:   'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
  ESCALATED: 'bg-purple-100 text-purple-700',
};

const TYPE_ICONS: Record<FlagType, string> = {
  PRODUCT: '📦',
  REVIEW:  '⭐',
  STORE:   '🏪',
  USER:    '👤',
};

const TYPE_OPTIONS:     string[] = ['', 'PRODUCT', 'REVIEW', 'STORE', 'USER'];
const SEVERITY_OPTIONS: string[] = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS:   string[] = ['', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon, label, value, color,
}: {
  icon:  React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-3 bg-surface border border-border rounded-card p-4`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted font-medium">{label}</p>
        <p className="text-xl font-bold text-secondary tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Flag row ─────────────────────────────────────────────────────────────────

function FlagRow({
  flag,
  onApprove,
  onReject,
  onEscalate,
}: {
  flag:       ModerationFlag;
  onApprove:  (id: string) => void;
  onReject:   (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-background/60 transition-colors">
        {/* Severity dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[flag.severity]}`} />

        {/* Type + target */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-base">{TYPE_ICONS[flag.type]}</span>
            <span className="text-sm font-medium text-secondary truncate max-w-xs">{flag.targetName}</span>
            {flag.targetUrl && (
              <a href={flag.targetUrl} target="_blank" rel="noopener noreferrer"
                className="text-muted hover:text-primary transition-colors">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted line-clamp-1">{flag.reason}</p>
          {flag.aiLabel && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full mt-1">
              🤖 {flag.aiLabel}
              {flag.aiScore !== null && ` · ${(flag.aiScore * 100).toFixed(0)}%`}
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[flag.severity]}`}>
            {flag.severity}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[flag.status]}`}>
            {flag.status}
          </span>
          <span className="text-xs text-muted whitespace-nowrap">
            {format(new Date(flag.createdAt), 'MMM d, HH:mm')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {flag.status === 'PENDING' && (
            <>
              <button type="button" onClick={() => onApprove(flag.id)} title="Approve (keep content)"
                className="p-1.5 text-muted hover:text-green-600 transition-colors" >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => onReject(flag.id)} title="Remove content"
                className="p-1.5 text-muted hover:text-error transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => onEscalate(flag.id)} title="Escalate for manual review"
                className="p-1.5 text-muted hover:text-purple-600 transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </button>
            </>
          )}
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="p-1.5 text-muted hover:text-secondary transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 text-xs space-y-2 bg-background/40 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            <div>
              <p className="text-muted font-medium mb-0.5">Target ID</p>
              <p className="font-mono text-secondary">{flag.targetId.slice(0, 16)}…</p>
            </div>
            <div>
              <p className="text-muted font-medium mb-0.5">Type</p>
              <p className="text-secondary">{flag.type}</p>
            </div>
            <div>
              <p className="text-muted font-medium mb-0.5">Reported by</p>
              <p className="text-secondary">{flag.reportedBy ?? 'AI system'}</p>
            </div>
            <div>
              <p className="text-muted font-medium mb-0.5">Resolved</p>
              <p className="text-secondary">
                {flag.resolvedAt
                  ? `${format(new Date(flag.resolvedAt), 'MMM d')} by ${flag.resolvedBy ?? 'system'}`
                  : '—'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-muted font-medium mb-0.5">Full reason</p>
            <p className="text-secondary leading-relaxed">{flag.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrustSafetyQueuePage() {
  const qc = useQueryClient();
  const [page,     setPage    ] = useState(1);
  const [type,     setType    ] = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus  ] = useState('PENDING');
  const [search,   setSearch  ] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const { data, isLoading } = useQuery<FlagsResponse>({
    queryKey: ['admin-moderation-flags', page, type, severity, status, debouncedSearch],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (type)             p.set('type',     type);
      if (severity)         p.set('severity', severity);
      if (status)           p.set('status',   status);
      if (debouncedSearch)  p.set('search',   debouncedSearch);
      return api.get<FlagsResponse>(`${API_ROUTES.ADMIN.MODERATION_FLAGS}?${p}`);
    },
  });

  const { data: stats } = useQuery<ModerationStats>({
    queryKey: ['admin-moderation-stats'],
    queryFn:  () => api.get<ModerationStats>(API_ROUTES.ADMIN.MODERATION_STATS),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-moderation-flags'] });
    qc.invalidateQueries({ queryKey: ['admin-moderation-stats'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.MODERATION_FLAG_APPROVE(id), {}),
    onSuccess:  invalidate,
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.MODERATION_FLAG_REJECT(id), {}),
    onSuccess:  invalidate,
  });
  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.MODERATION_FLAG_ESCALATE(id), {}),
    onSuccess:  invalidate,
  });

  const flags      = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <AdminPageHeader
        title="Trust & Safety"
        subtitle="Review flagged content across the platform"
        queryKey={['admin-moderation-flags']}
      />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatChip icon={Clock}         label="Pending Review"      value={stats?.totalPending  ?? '—'} color="bg-amber-500" />
        <StatChip icon={AlertTriangle} label="Critical"            value={stats?.criticalCount ?? '—'} color="bg-red-500" />
        <StatChip icon={Shield}        label="Flagged Today"       value={stats?.totalToday    ?? '—'} color="bg-blue-500" />
        <StatChip icon={Eye}           label="Avg. Resolution (h)" value={stats?.avgResolutionHours?.toFixed(1) ?? '—'} color="bg-green-500" />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Search by name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-border rounded-button focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        {[
          { value: type,     options: TYPE_OPTIONS,     onChange: (v: string) => { setType(v);     setPage(1); }, label: 'All types'     },
          { value: severity, options: SEVERITY_OPTIONS, onChange: (v: string) => { setSeverity(v); setPage(1); }, label: 'All severities' },
          { value: status,   options: STATUS_OPTIONS,   onChange: (v: string) => { setStatus(v);   setPage(1); }, label: 'All statuses'  },
        ].map(({ value, options, onChange, label }, idx) => (
          <select key={idx} value={value} onChange={(e) => onChange(e.target.value)}
            className="text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary transition-colors">
            {options.map((o) => (
              <option key={o} value={o}>{o || label}</option>
            ))}
          </select>
        ))}
      </div>

      {/* ── Queue ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {/* Table head */}
        <div className="grid grid-cols-[16px_1fr_auto] md:grid-cols-[16px_1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-border bg-background">
          <span />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">Target</span>
          <span className="hidden md:block text-xs font-semibold text-muted uppercase tracking-wide">Details</span>
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">Actions</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/10 rounded animate-pulse" />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Shield className="w-12 h-12 text-green-400" />
            <p className="font-semibold text-secondary">Queue is clear</p>
            <p className="text-sm text-muted">No flagged items match the current filters.</p>
          </div>
        ) : (
          flags.map((flag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id)  => rejectMutation.mutate(id)}
              onEscalate={(id) => escalateMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted">{pagination.total} flags total</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-muted">Page {page} of {pagination.totalPages}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
