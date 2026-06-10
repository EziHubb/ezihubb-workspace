'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bookmark, Pencil, Trash2, GripVertical, Check, X } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

interface ShopSection {
  id:        string;
  name:      string;
  sortOrder: number;
  _count:    { products: number };
}

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function ShopSectionsPage() {
  const qc = useQueryClient();
  const [newName,      setNewName]      = useState('');
  const [newOrder,     setNewOrder]     = useState(0);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [editName,     setEditName]     = useState('');
  const [editOrder,    setEditOrder]    = useState(0);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);

  const { data: sections = [], isLoading } = useQuery<ShopSection[]>({
    queryKey: ['admin-shop-sections'],
    queryFn:  () => api.get<ShopSection[]>(API_ROUTES.ADMIN.SHOP_SECTIONS),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (dto: { name: string; sortOrder: number }) =>
      api.post(API_ROUTES.ADMIN.SHOP_SECTIONS, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-sections'] });
      setNewName('');
      setNewOrder(0);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name: string; sortOrder: number }) =>
      api.patch(API_ROUTES.ADMIN.SHOP_SECTION(id), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-sections'] });
      setEditId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(API_ROUTES.ADMIN.SHOP_SECTION(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-sections'] });
      setDeleteId(null);
    },
  });

  const startEdit = (s: ShopSection) => {
    setEditId(s.id);
    setEditName(s.name);
    setEditOrder(s.sortOrder);
  };

  return (
    <>
      <AdminPageHeader
        title="Shop Sections"
        subtitle="Organise products into named sections (e.g. New Arrivals, Best Sellers)"
      />

      <div className="max-w-[680px] space-y-5">
        {/* Create */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <h4 className="font-semibold text-secondary text-sm mb-3">New Section</h4>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate({ name: newName.trim(), sortOrder: newOrder }); }}
              className={inputCls}
              placeholder="Section name (e.g. New Arrivals)"
            />
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value))}
              className="w-20 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
              placeholder="Sort"
              min={0}
              title="Sort order"
            />
            <button
              type="button"
              onClick={() => { if (newName.trim()) create.mutate({ name: newName.trim(), sortOrder: newOrder }); }}
              disabled={!newName.trim() || create.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
          <p className="text-xs text-muted mt-1.5">Sort order controls the display order (lower = first).</p>
        </div>

        {/* List */}
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h4 className="font-semibold text-secondary text-sm">
              All Sections <span className="text-muted font-normal">({sections.length})</span>
            </h4>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="h-4 w-36 bg-muted/10 rounded animate-pulse" />
                  <div className="h-4 w-12 bg-muted/10 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Bookmark className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No sections yet. Create your first above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Section</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Sort</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Products</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sections.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/3 transition-colors group">
                    <td className="px-5 py-3 font-medium text-secondary">
                      {editId === s.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') update.mutate({ id: s.id, name: editName.trim(), sortOrder: editOrder });
                              if (e.key === 'Escape') setEditId(null);
                            }}
                            autoFocus
                            className="px-2 py-1 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          {s.name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {editId === s.id ? (
                        <input
                          type="number"
                          value={editOrder}
                          onChange={(e) => setEditOrder(Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border border-border rounded-button bg-background focus:outline-none"
                          min={0}
                        />
                      ) : s.sortOrder}
                    </td>
                    <td className="px-5 py-3 text-muted">{s._count.products}</td>
                    <td className="px-5 py-3 text-right">
                      {editId === s.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button"
                            onClick={() => update.mutate({ id: s.id, name: editName.trim(), sortOrder: editOrder })}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditId(null)}
                            className="p-1 text-muted hover:bg-muted/10 rounded transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : deleteId === s.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600">Delete?</span>
                          <button type="button" onClick={() => remove.mutate(s.id)}
                            className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded">
                            Yes
                          </button>
                          <button type="button" onClick={() => setDeleteId(null)}
                            className="text-xs text-muted hover:bg-muted/10 px-2 py-1 rounded">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => startEdit(s)}
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteId(s.id)}
                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title={s._count.products > 0 ? `Detaches ${s._count.products} product(s)` : 'Delete section'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
