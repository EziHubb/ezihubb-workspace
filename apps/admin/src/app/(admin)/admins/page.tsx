'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { Shield, RotateCcw, ChevronRight, Store } from 'lucide-react';
import Link from 'next/link';
import type { PermissionDocument } from '@mlh/constants';

interface AdminUser {
  id:                   string;
  email:                string;
  firstName:            string | null;
  lastName:             string | null;
  avatarUrl:            string | null;
  createdAt:            string;
  permissions:          PermissionDocument | null;
  storeId:              string | null;
  ownedStore:           { id: string; name: string; slug: string; status: string } | null;
  effectivePermissions: Record<string, boolean>;
}

export default function AdminsPage() {
  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn:  () => api.get<AdminUser[]>('/admin/users'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Shop Admins</h1>
        <p className="text-sm text-gray-400 mt-1">Manage permissions for each shop owner account</p>
      </div>

      <div className="space-y-3">
        {admins.length === 0 && (
          <div className="text-center py-16 text-gray-500">No shop admin accounts yet.</div>
        )}
        {admins.map((admin) => (
          <Link
            key={admin.id}
            href={`/admins/${admin.id}/permissions`}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">
                {admin.firstName} {admin.lastName}
                <span className="ml-2 text-xs text-gray-500">{admin.email}</span>
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {admin.ownedStore?.name ?? 'No store'} · {admin.ownedStore?.status ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                {(admin.permissions as PermissionDocument | null)?.roles?.map((r) => (
                  <span key={r} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                    {r}
                  </span>
                ))}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
