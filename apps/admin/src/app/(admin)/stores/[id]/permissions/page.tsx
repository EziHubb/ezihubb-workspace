'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import {
  PERMISSION_RESOURCES,
  RESOURCE_ACTIONS,
  BUILTIN_ROLE_NAMES,
  resolveEffectivePermissions,
  type PermissionDocument,
  type PermissionResource,
  type BuiltinRole,
} from '@mlh/constants';
import { RotateCcw, Save, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreDetail {
  id:    string;
  name:  string;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string };
}

interface PermissionsData {
  userId:               string;
  email:                string;
  name:                 string;
  document:             PermissionDocument;
  effectivePermissions: Record<string, boolean>;
  availableRoles:       BuiltinRole[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function permissionSource(doc: PermissionDocument, perm: string): 'deny' | 'allow' | 'role' | 'none' {
  if (doc.overrides?.deny?.includes(perm))  return 'deny';
  if (doc.overrides?.allow?.includes(perm)) return 'allow';
  for (const role of doc.roles) {
    if (resolveEffectivePermissions('ADMIN', { roles: [role] })[perm]) return 'role';
  }
  return 'none';
}

// ── Checkbox cell ──────────────────────────────────────────────────────────────

function PermCell({ source, onToggle }: { source: 'deny' | 'allow' | 'role' | 'none'; onToggle: () => void }) {
  const base = 'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors';
  if (source === 'deny')  return <button onClick={onToggle} title="Denied — click to remove" className={`${base} bg-red-50 border-red-200 text-red-500 hover:bg-red-100`}>✕</button>;
  if (source === 'allow') return <button onClick={onToggle} title="Explicit allow — click to deny" className={`${base} bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500`}>✓</button>;
  if (source === 'role')  return <button onClick={onToggle} title="Role grant — click to deny" className={`${base} bg-indigo-50 border-indigo-200 text-indigo-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500`}>✓</button>;
  return <button onClick={onToggle} title="Not granted — click to allow" className={`${base} bg-muted/5 border-border text-muted hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600`}>–</button>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StorePermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = use(params);
  const qc = useQueryClient();

  // Fetch store to get owner's user ID
  const { data: store } = useQuery<StoreDetail>({
    queryKey: ['admin-store', storeId],
    queryFn:  () => api.get<StoreDetail>(`${API_ROUTES.ADMIN.STORES}/${storeId}`),
  });

  const ownerId = store?.owner?.id;

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ['admin-permissions', ownerId],
    queryFn:  () => api.get<PermissionsData>(`/admin/users/${ownerId}/permissions`),
    enabled:  !!ownerId,
  });

  const [doc, setDoc] = useState<PermissionDocument | null>(null);
  const current = doc ?? data?.document ?? { roles: ['shop_owner'] };
  const isDirty = doc !== null;

  const saveMut = useMutation({
    mutationFn: (d: PermissionDocument) => api.put(`/admin/users/${ownerId}/permissions`, { document: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-permissions', ownerId] });
      setDoc(null);
    },
  });

  const resetMut = useMutation({
    mutationFn: () => api.put(`/admin/users/${ownerId}/permissions/reset`, {}),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-permissions', ownerId] }); setDoc(null); },
  });

  function togglePerm(resource: PermissionResource, action: string) {
    const perm   = `${resource}:${action}`;
    const source = permissionSource(current, perm);
    const d      = JSON.parse(JSON.stringify(current)) as PermissionDocument;
    d.overrides       = d.overrides ?? {};
    d.overrides.allow = d.overrides.allow ?? [];
    d.overrides.deny  = d.overrides.deny  ?? [];

    if (source === 'deny')  d.overrides.deny  = d.overrides.deny.filter((p) => p !== perm);
    else if (source === 'allow') { d.overrides.allow = d.overrides.allow.filter((p) => p !== perm); d.overrides.deny.push(perm); }
    else if (source === 'role') d.overrides.deny.push(perm);
    else d.overrides.allow.push(perm);
    setDoc(d);
  }

  function toggleRole(role: BuiltinRole) {
    const d = JSON.parse(JSON.stringify(current)) as PermissionDocument;
    d.roles = d.roles.includes(role) ? d.roles.filter((r) => r !== role) : [...d.roles, role];
    setDoc(d);
  }

  if (isLoading || !store) {
    return <div className="flex items-center justify-center py-24"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const ownerName = [store.owner.firstName, store.owner.lastName].filter(Boolean).join(' ') || store.owner.email;

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/stores/${storeId}`} className="mt-0.5 p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-secondary flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Permissions — {store.name}
          </h1>
          <p className="text-sm text-muted mt-0.5">Owner: {ownerName} · {store.owner.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => resetMut.mutate()} disabled={resetMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:bg-muted/10 transition-all disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          {isDirty && (
            <button onClick={() => setDoc(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:bg-muted/10 transition-all">
              Cancel
            </button>
          )}
          <button onClick={() => saveMut.mutate(current)} disabled={!isDirty || saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-all">
            <Save className="w-3.5 h-3.5" />
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Role pills */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-secondary">Role</h2>
          <p className="text-xs text-muted mt-0.5">Base permission set. Multiple roles are unioned.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_ROLE_NAMES.map((role) => (
            <button key={role} onClick={() => toggleRole(role)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                current.roles.includes(role)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-muted/5 border-border text-muted hover:bg-muted/10',
              ].join(' ')}>
              {role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Permission table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h2 className="text-sm font-semibold text-secondary">Permission Matrix</h2>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {[
              { color: 'bg-indigo-50 border-indigo-200',   label: 'From role'      },
              { color: 'bg-emerald-50 border-emerald-200', label: 'Explicit allow' },
              { color: 'bg-red-50 border-red-200',         label: 'Explicit deny'  },
              { color: 'bg-muted/5 border-border',         label: 'Not granted'    },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`w-3.5 h-3.5 rounded border ${color}`} /> {label}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide w-36">Resource</th>
                {(['view', 'edit', 'add', 'delete'] as const).map((a) => (
                  <th key={a} className="px-3 py-2.5 text-center text-xs font-semibold text-muted uppercase tracking-wide w-20">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_RESOURCES.map((resource) => {
                const actions = RESOURCE_ACTIONS[resource];
                return (
                  <tr key={resource} className="hover:bg-muted/3 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-secondary capitalize">{resource}</td>
                    {(['view', 'edit', 'add', 'delete'] as const).map((action) => (
                      <td key={action} className="px-3 py-3">
                        <div className="flex justify-center">
                          {actions.includes(action as typeof actions[number]) ? (
                            <PermCell source={permissionSource(current, `${resource}:${action}`)} onToggle={() => togglePerm(resource, action)} />
                          ) : (
                            <span className="w-7 h-7 flex items-center justify-center text-muted/30">—</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
