'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, GitBranch } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtNum, fmtAmount } from '../../../../lib/fmt';
import { FilterSelect } from '../../../../components/ui/FilterSelect';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReferralUserRow {
  id:              string;
  email:           string;
  firstName:       string | null;
  lastName:        string | null;
  referralCode:    string;
  totalReferrals:  number;
  referralBalance: number;
  referralEarned:  number;
  referralTier: {
    id:         string;
    name:       string;
    badgeColor: string;
  } | null;
}

interface ReferralUsersResponse {
  data: ReferralUserRow[];
  meta: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}

interface Tier {
  id:   string;
  name: string;
  badgeColor: string;
}

// ── Tree modal ─────────────────────────────────────────────────────────────────

interface TreeNode {
  userId:    string;
  email:     string;
  firstName: string | null;
  lastName:  string | null;
  level:     number;
  children:  TreeNode[];
}

function TreeNodeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <>
      <tr className="hover:bg-muted/3 transition-colors">
        <td className="px-4 py-2.5">
          <div style={{ paddingLeft: depth * 20 }} className="flex items-center gap-2">
            {depth > 0 && <span className="text-muted text-xs">└</span>}
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${depth === 0 ? 'bg-primary' : depth === 1 ? 'bg-blue-500' : 'bg-purple-500'}`}>
              {node.level}
            </span>
            <div>
              <p className="text-xs font-medium text-secondary">
                {[node.firstName, node.lastName].filter(Boolean).join(' ') || '—'}
              </p>
              <p className="text-xs text-muted font-mono">{node.email}</p>
            </div>
          </div>
        </td>
      </tr>
      {node.children.map((child) => (
        <TreeNodeRow key={child.userId} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function TreeModal({ userId, userEmail, onClose }: { userId: string; userEmail: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<TreeNode[]>({
    queryKey: ['admin-referral-tree', userId],
    queryFn:  () => api.get<TreeNode[]>(API_ROUTES.ADMIN.ADMIN_CREATORS_MEMBER_TREE(userId)),
    staleTime: 60_000,
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[540px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-secondary">Referral Tree</h3>
            <p className="text-xs text-muted mt-0.5 font-mono">{userEmail}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-button hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading
            ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 bg-muted/10 rounded animate-pulse" />
                  ))}
                </div>
              )
            : (data ?? []).length === 0
              ? (
                  <p className="text-center text-sm text-muted py-10">No referred users yet.</p>
                )
              : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {(data ?? []).map((node) => (
                        <TreeNodeRow key={node.userId} node={node} />
                      ))}
                    </tbody>
                  </table>
                )
          }
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReferralUsersPage() {
  const [search,   setSearch]   = useState('');
  const [tierId,   setTierId]   = useState('');
  const [page,     setPage]     = useState(1);
  const [viewTree, setViewTree] = useState<{ id: string; email: string } | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  if (tierId) params.set('tierId', tierId);

  const { data, isLoading } = useQuery<ReferralUsersResponse>({
    queryKey: ['admin-referral-users', search, tierId, page],
    queryFn:  () => api.get<ReferralUsersResponse>(`${API_ROUTES.ADMIN.ADMIN_CREATORS_MEMBERS}?${params.toString()}`),
    staleTime: 30_000,
  });

  const { data: tiers = [] } = useQuery<Tier[]>({
    queryKey: ['admin-referral-tiers-list'],
    queryFn:  () => api.get<Tier[]>(API_ROUTES.ADMIN.ADMIN_CREATORS_TIERS),
    staleTime: 300_000,
  });

  return (
    <>
      <AdminPageHeader
        title="Referral Users"
        subtitle="All users with their referral programme statistics"
        queryKey={['admin-referral-users']}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <FilterSelect
          value={tierId}
          onChange={(v) => { setTierId(v); setPage(1); }}
          options={[{ value: '', label: 'All Tiers' }, ...(tiers as Tier[]).map((t) => ({ value: t.id, label: t.name }))]}
        />

        {data && (
          <span className="text-sm text-muted ml-auto">{fmtNum(data.meta.total)} user{data.meta.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {['User', 'Tier', 'Code', 'Direct Refs', 'Earned', 'Balance', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : (data?.data ?? []).length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No users found.</td>
                      </tr>
                    )
                  : (data?.data ?? []).map((u) => (
                      <tr key={u.id} className="hover:bg-muted/3 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-secondary">
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-xs text-muted mt-0.5 font-mono">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {u.referralTier
                            ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                  style={{ background: u.referralTier.badgeColor }}
                                >
                                  {u.referralTier.name}
                                </span>
                              )
                            : <span className="text-xs text-muted">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <code className="font-mono text-xs bg-muted/10 px-2 py-0.5 rounded">{u.referralCode}</code>
                        </td>
                        <td className="px-4 py-3 text-secondary tabular-nums text-xs">{u.totalReferrals}</td>
                        <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">${fmtAmount(u.referralEarned)}</td>
                        <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">${fmtAmount(u.referralBalance)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setViewTree({ id: u.id, email: u.email })}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded-button text-muted hover:text-primary hover:border-primary/40 transition-colors"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            View Tree
                          </button>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">Page {data.meta.page} of {data.meta.totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page >= data.meta.totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {viewTree && (
        <TreeModal userId={viewTree.id} userEmail={viewTree.email} onClose={() => setViewTree(null)} />
      )}
    </>
  );
}
