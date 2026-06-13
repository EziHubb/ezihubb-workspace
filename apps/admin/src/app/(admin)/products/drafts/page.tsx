'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { FileEdit, Trash2, Plus, Package, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDate, fmtAmount } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';

interface DraftProduct {
  id:              string;
  name:            string;
  slug:            string;
  basePrice:       number;
  primaryImageUrl: string | null;
  primaryImage:    string | null;
  createdAt:       string;
}

const QK = ['admin-products-drafts'];

export default function ProductDraftsPage() {
  const router    = useRouter();
  const qc        = useQueryClient();
  const { confirm } = useDialog();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn:  () =>
      api.get<{ data: DraftProduct[]; pagination: { total: number } }>(
        `${API_ROUTES.ADMIN.PRODUCTS}?status=DRAFT&limit=100&sort=newest`,
      ),
    staleTime: 30_000,
  });

  const drafts = data?.data ?? [];

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm(
      `"${name || 'Untitled draft'}" will be removed and cannot be recovered.`,
      { title: 'Delete draft permanently?', confirmLabel: 'Delete', destructive: true },
    );
    if (!ok) return;
    setDeletingId(id);
    try {
      await api.delete(API_ROUTES.ADMIN.PRODUCT(id));
      qc.invalidateQueries({ queryKey: QK });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Drafts"
        subtitle="Products you started creating but haven't published yet"
        queryKey={QK}
        actions={
          <Link
            href="/products/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-muted/40 mb-4" />
          <p className="text-secondary font-medium">No drafts</p>
          <p className="text-sm text-muted mt-1">Products you start creating will appear here until you publish them.</p>
          <Link
            href="/products/new"
            className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first product
          </Link>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm text-muted">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
          </div>

          <ul className="divide-y divide-border">
            {drafts.map((draft) => {
              const thumb = draft.primaryImageUrl ?? draft.primaryImage;
              const name  = draft.name?.trim() || 'Untitled draft';
              return (
                <li key={draft.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/5 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg border border-border bg-muted/10 shrink-0 overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <Image src={thumb} alt={name} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-muted/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      Started {fmtDate(draft.createdAt)}
                      {draft.basePrice > 0 && ` · ${fmtAmount(draft.basePrice)}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/products/${draft.id}/edit`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 rounded-button hover:bg-primary/5 transition-colors"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Continue editing
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(draft.id, name)}
                      disabled={deletingId === draft.id}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                      title="Delete permanently"
                    >
                      {deletingId === draft.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
