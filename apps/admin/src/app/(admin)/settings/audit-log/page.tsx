'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { FilterSelect } from '../../../../components/ui/FilterSelect';
import { fmtNum, safeNum } from '../../../../lib/fmt';

interface AuditLogEntry {
  id:         string;
  userId:     string | null;
  action:     string;
  entityType: string;
  entityId:   string | null;
  before:     unknown;
  after:      unknown;
  ip:         string | null;
  userAgent:  string | null;
  createdAt:  string;
  user?:      { email: string; name: string | null } | null;
}

interface PaginatedAuditLogs {
  data:  AuditLogEntry[];
  total: number;
  page:  number;
  pages: number;
}

const selectCls = 'px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

function JsonViewer({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  if (!value) return <span className="text-muted text-xs">—</span>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1.5 p-2 bg-background rounded text-[11px] font-mono text-secondary overflow-x-auto max-w-xs max-h-40 overflow-y-auto border border-border">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [page,       setPage]       = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action,     setAction]     = useState('');
  const [userId,     setUserId]     = useState('');

  const resetPage = useCallback(() => setPage(1), []);

  const params = new URLSearchParams({
    page:  String(page),
    limit: '25',
    ...(entityType ? { entityType } : {}),
    ...(action     ? { action }     : {}),
    ...(userId     ? { userId }     : {}),
  });

  const { data, isLoading } = useQuery<PaginatedAuditLogs>({
    queryKey: ['audit-logs', page, entityType, action, userId],
    queryFn:  () => api.get<PaginatedAuditLogs>(`${API_ROUTES.ADMIN.AUDIT_LOGS}?${params}`),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: entityTypes = [] } = useQuery<string[]>({
    queryKey: ['audit-log-entity-types'],
    queryFn:  () => api.get<string[]>(`${API_ROUTES.ADMIN.AUDIT_LOGS}/entity-types`),
    staleTime: 300_000,
  });

  const entries = data?.data ?? [];

  return (
    <>
      <AdminPageHeader
        title="Audit Log"
        subtitle="Track admin actions — create, update, delete events across all entities"
        queryKey={['audit-logs']}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-secondary mb-1">Entity type</label>
          <FilterSelect value={entityType} onChange={(v) => { setEntityType(v); resetPage(); }} options={[{ value: '', label: 'All Types' }, ...(entityTypes.map((t) => ({ value: t, label: t })))]} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-secondary mb-1">Action</label>
          <FilterSelect value={action} onChange={(v) => { setAction(v); resetPage(); }} options={[{ value: '', label: 'All Actions' }, { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' }]} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-secondary mb-1">User ID</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={userId}
              onChange={(e) => { setUserId(e.target.value); resetPage(); }}
              className="pl-8 pr-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
              placeholder="Filter by user ID"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold text-secondary text-sm">
            Events
            {data && <span className="text-muted font-normal ml-1">({fmtNum(data.total)} total)</span>}
          </h4>
          {data && data.pages > 1 && (
            <p className="text-xs text-muted">Page {page} of {data.pages}</p>
          )}
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="h-4 w-24 bg-muted/10 rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted/10 rounded animate-pulse" />
                <div className="h-4 w-20 bg-muted/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Shield className="w-8 h-8 text-muted/40 mx-auto mb-2" />
            <p className="text-sm text-muted">No audit log entries match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">Time</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Actor</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Action</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Entity</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Changes</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => {
                  const actionColor = e.action === 'delete'
                    ? 'bg-red-100 text-red-700'
                    : e.action === 'create'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700';
                  return (
                    <tr key={e.id} className="hover:bg-muted/3 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {e.user ? (
                          <div>
                            <p className="text-secondary font-medium">{e.user.name ?? e.user.email}</p>
                            {e.user.name && <p className="text-muted">{e.user.email}</p>}
                          </div>
                        ) : (
                          <span className="text-muted font-mono text-[11px]">{e.userId ?? 'system'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${actionColor}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <span className="font-medium text-secondary">{e.entityType}</span>
                        {e.entityId && <p className="text-muted font-mono text-[11px] truncate max-w-[120px]">{e.entityId}</p>}
                      </td>
                      <td className="px-5 py-3 text-xs space-y-1">
                        <JsonViewer value={e.before} label="Before" />
                        <JsonViewer value={e.after}  label="After"  />
                      </td>
                      <td className="px-5 py-3 text-xs text-muted font-mono">{e.ip ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, safeNum(data.total))} of {fmtNum(data.total)}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                className="p-1.5 text-muted hover:text-secondary disabled:opacity-40 hover:bg-muted/10 rounded transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page === data.pages}
                className="p-1.5 text-muted hover:text-secondary disabled:opacity-40 hover:bg-muted/10 rounded transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
