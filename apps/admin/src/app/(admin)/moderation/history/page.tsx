'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDate, fmtDateTime, safeArr } from '../../../../lib/fmt';
import { FilterSelect } from '../../../../components/ui/FilterSelect';

type Verdict = 'PENDING' | 'CLEAN' | 'FLAGGED' | 'REJECTED' | 'APPEALED' | 'APPROVED';

interface ModerationLog {
  id:           string;
  entityType:   string;
  entityId:     string;
  fieldName:    string | null;
  verdict:      Verdict;
  severity:     string;
  categories:   string[];
  confidence:   number;
  reasoning:    string | null;
  sellerMessage:string | null;
  provider:     string;
  modelVersion: string | null;
  latencyMs:    number | null;
  triggeredBy:  string;
  reviewedBy:   string | null;
  reviewedAt:   string | null;
  adminNotes:   string | null;
  createdAt:    string;
}

interface LogsResponse {
  data:       ModerationLog[];
  total:      number;
  totalPages: number;
  page:       number;
}

const VERDICT_COLORS: Record<string, string> = {
  CLEAN:    'bg-green-100 text-green-700',
  FLAGGED:  'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  APPEALED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-purple-100 text-purple-700',
  PENDING:  'bg-gray-100 text-gray-600',
};

const SEVERITY_COLORS: Record<string, string> = {
  CLEAN:    'bg-gray-100 text-gray-500',
  LOW:      'bg-gray-100 text-gray-600',
  MEDIUM:   'bg-amber-100 text-amber-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const ENTITY_ICONS: Record<string, string> = {
  Product: '📦', Store: '🏪', Review: '⭐', Message: '💬', Image: '🖼️',
};

function ExpandableRow({ log }: { log: ModerationLog }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-background/60 transition-colors cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span>{ENTITY_ICONS[log.entityType] ?? '📄'}</span>
            <span className="text-xs font-medium text-secondary">{log.entityType}</span>
            {log.fieldName && <span className="text-xs text-muted">· {log.fieldName}</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-muted">{log.entityId.slice(0, 12)}…</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${VERDICT_COLORS[log.verdict] ?? 'bg-gray-100 text-gray-600'}`}>
            {log.verdict}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[log.severity] ?? 'bg-gray-100 text-gray-600'}`}>
            {log.severity}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-secondary">
          {log.categories.join(', ') || '—'}
        </td>
        <td className="px-4 py-3 text-xs tabular-nums text-secondary">
          {(log.confidence * 100).toFixed(0)}%
        </td>
        <td className="px-4 py-3 text-xs text-muted">
          {log.reviewedBy ? `Admin` : log.triggeredBy}
        </td>
        <td className="px-4 py-3 text-muted">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {open && (
        <tr className="bg-background/40">
          <td colSpan={9} className="px-6 py-4 text-xs space-y-2 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-muted font-medium mb-0.5">Model</p><p className="font-mono text-secondary">{log.modelVersion ?? log.provider}</p></div>
              <div><p className="text-muted font-medium mb-0.5">Latency</p><p className="text-secondary">{log.latencyMs != null ? `${log.latencyMs}ms` : '—'}</p></div>
              <div><p className="text-muted font-medium mb-0.5">Reviewed at</p><p className="text-secondary">{log.reviewedAt ? fmtDateTime(log.reviewedAt) : '—'}</p></div>
              <div><p className="text-muted font-medium mb-0.5">Admin notes</p><p className="text-secondary">{log.adminNotes ?? '—'}</p></div>
            </div>
            {log.reasoning && <div><p className="text-muted font-medium mb-0.5">Reasoning</p><p className="text-secondary leading-relaxed">{log.reasoning}</p></div>}
            {log.sellerMessage && <div><p className="text-muted font-medium mb-0.5">Seller message</p><p className="text-secondary leading-relaxed">{log.sellerMessage}</p></div>}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ModerationHistoryPage() {
  const [page,       setPage      ] = useState(1);
  const [verdict,    setVerdict   ] = useState('');
  const [entityType, setEntityType] = useState('');

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['admin-mod-logs', page, verdict, entityType],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (verdict)    p.set('verdict',    verdict);
      if (entityType) p.set('entityType', entityType);
      return api.get<LogsResponse>(`${API_ROUTES.ADMIN.MODERATION_LOGS}?${p}`);
    },
  });

  const logs = safeArr(data?.data);

  return (
    <>
      <AdminPageHeader
        title="Moderation History"
        subtitle="Full audit trail of all moderation checks"
        queryKey={['admin-mod-logs']}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <FilterSelect value={verdict} onChange={(v) => { setVerdict(v); setPage(1); }} options={[{value:'',label:'All Verdicts'},{value:'CLEAN',label:'Clean'},{value:'FLAGGED',label:'Flagged'},{value:'REJECTED',label:'Rejected'},{value:'APPEALED',label:'Appealed'},{value:'APPROVED',label:'Approved'}]} />
        <FilterSelect value={entityType} onChange={(v) => { setEntityType(v); setPage(1); }} options={[{value:'',label:'All Types'},{value:'Product',label:'Product'},{value:'Store',label:'Store'},{value:'Review',label:'Review'},{value:'Message',label:'Message'}]} />
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {['Date', 'Type', 'Entity', 'Verdict', 'Severity', 'Categories', 'Conf.', 'By', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : logs.length === 0
                  ? <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-muted"><History className="w-8 h-8 text-muted/30 mx-auto mb-2" />No logs found.</td></tr>
                  : logs.map((log) => <ExpandableRow key={log.id} log={log} />)
              }
            </tbody>
          </table>
        </div>
      </div>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted">{data?.total ?? 0} total logs</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-muted">Page {page} of {data?.totalPages}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
