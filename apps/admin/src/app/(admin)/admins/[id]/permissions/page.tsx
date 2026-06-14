'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import {
  PERMISSION_RESOURCES,
  RESOURCE_ACTIONS,
  BUILTIN_ROLE_NAMES,
  resolveEffectivePermissions,
  type PermissionDocument,
  type PermissionResource,
  type BuiltinRole,
} from '@mlh/constants';
import { RotateCcw, Save, ArrowLeft, Plus, X, Shield } from 'lucide-react';
import Link from 'next/link';

interface PermissionsData {
  userId:               string;
  email:                string;
  name:                 string;
  document:             PermissionDocument;
  effectivePermissions: Record<string, boolean>;
  availableRoles:       BuiltinRole[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function permKey(resource: PermissionResource, action: string) {
  return `${resource}:${action}`;
}

function permissionSource(
  doc: PermissionDocument,
  perm: string,
): 'deny' | 'allow' | 'role' | 'none' {
  if (doc.overrides?.deny?.includes(perm))  return 'deny';
  if (doc.overrides?.allow?.includes(perm)) return 'allow';
  for (const role of doc.roles) {
    const rolePerms = BUILTIN_ROLE_NAMES.includes(role as BuiltinRole)
      ? (resolveEffectivePermissions('ADMIN', { roles: [role] }))
      : {};
    if (rolePerms[perm]) return 'role';
  }
  return 'none';
}

// ── Checkbox cell ──────────────────────────────────────────────────────────────

function PermCell({
  source,
  onToggle,
}: {
  source:   'deny' | 'allow' | 'role' | 'none';
  onToggle: () => void;
}) {
  const base = 'w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all select-none text-xs font-bold border';

  if (source === 'deny') {
    return (
      <button onClick={onToggle} className={`${base} bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30`} title="Explicit deny — click to remove">
        ✕
      </button>
    );
  }
  if (source === 'allow') {
    return (
      <button onClick={onToggle} className={`${base} bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400`} title="Explicit allow override — click to deny">
        ✓
      </button>
    );
  }
  if (source === 'role') {
    return (
      <button onClick={onToggle} className={`${base} bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400`} title="Granted by role — click to deny">
        ✓
      </button>
    );
  }
  return (
    <button onClick={onToggle} className={`${base} bg-white/5 border-white/10 text-gray-600 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-400`} title="Not granted — click to allow">
      –
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ['admin-permissions', id],
    queryFn:  () => api.get<PermissionsData>(`/admin/users/${id}/permissions`),
  });

  const [doc, setDoc] = useState<PermissionDocument | null>(null);
  const current = doc ?? data?.document ?? { roles: ['shop_owner'] };

  const saveMut = useMutation({
    mutationFn: (d: PermissionDocument) =>
      api.put(`/admin/users/${id}/permissions`, { document: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-permissions', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDoc(null);
    },
  });

  const resetMut = useMutation({
    mutationFn: () => api.put(`/admin/users/${id}/permissions/reset`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-permissions', id] });
      setDoc(null);
    },
  });

  // Toggle a cell: deny → remove deny → allow override → role or none
  function togglePerm(resource: PermissionResource, action: string) {
    const perm   = permKey(resource, action);
    const source = permissionSource(current, perm);
    const d      = JSON.parse(JSON.stringify(current)) as PermissionDocument;
    d.overrides  = d.overrides ?? {};
    d.overrides.allow = d.overrides.allow ?? [];
    d.overrides.deny  = d.overrides.deny  ?? [];

    if (source === 'deny') {
      // Remove from deny
      d.overrides.deny = d.overrides.deny.filter((p) => p !== perm);
    } else if (source === 'allow') {
      // Remove explicit allow → add to deny
      d.overrides.allow = d.overrides.allow.filter((p) => p !== perm);
      d.overrides.deny.push(perm);
    } else if (source === 'role') {
      // Has role grant → deny it
      d.overrides.deny.push(perm);
    } else {
      // None → explicitly allow
      d.overrides.allow.push(perm);
    }

    setDoc(d);
  }

  function toggleRole(role: BuiltinRole) {
    const d = JSON.parse(JSON.stringify(current)) as PermissionDocument;
    if (d.roles.includes(role)) {
      d.roles = d.roles.filter((r) => r !== role);
    } else {
      d.roles.push(role);
    }
    setDoc(d);
  }

  const isDirty = doc !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admins" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Permissions — {data?.name ?? id}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{data?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={() => setDoc(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </button>
          <button
            onClick={() => saveMut.mutate(current)}
            disabled={!isDirty || saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white disabled:opacity-40 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMut.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Role assignment */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Role Assignment</h2>
        <p className="text-xs text-gray-400">
          Roles define the base set of permissions. Multiple roles are unioned — assign the most restrictive role, then use overrides below for exceptions.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {BUILTIN_ROLE_NAMES.map((role) => {
            const active = current.roles.includes(role);
            return (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  active
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10',
                ].join(' ')}
              >
                {role.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Permission table */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
        <div className="p-5 pb-2">
          <h2 className="text-sm font-semibold text-white">Permission Overrides</h2>
          <p className="text-xs text-gray-400 mt-1">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/30" /> Role grant</span>
            &nbsp;·&nbsp;
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> Explicit allow</span>
            &nbsp;·&nbsp;
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" /> Explicit deny</span>
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 font-semibold text-gray-400 w-40">Resource</th>
              {['view', 'edit', 'add', 'delete'].map((a) => (
                <th key={a} className="px-3 py-3 text-center font-semibold text-gray-400 w-20">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_RESOURCES.map((resource, i) => {
              const actions = RESOURCE_ACTIONS[resource];
              return (
                <tr key={resource} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                  <td className="px-5 py-3 font-medium text-gray-300 capitalize">{resource}</td>
                  {['view', 'edit', 'add', 'delete'].map((action) => {
                    if (!actions.includes(action as typeof actions[number])) {
                      return <td key={action} className="px-3 py-3 text-center text-gray-700">—</td>;
                    }
                    const perm   = permKey(resource, action);
                    const source = permissionSource(current, perm);
                    return (
                      <td key={action} className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          <PermCell source={source} onToggle={() => togglePerm(resource, action as PermissionResource)} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Conditions (read-only display for now) */}
      {Object.keys(current.conditions ?? {}).length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Active Conditions</h2>
          <div className="space-y-2">
            {Object.entries(current.conditions ?? {}).map(([perm, cond]) => (
              <div key={perm} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-indigo-300">{perm}</span>
                <span className="text-gray-400">→ {JSON.stringify(cond)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
