'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Pencil, Trash2, Check, X } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface TagItem {
  id:           string;
  name:         string;
  slug:         string;
  productCount: number;
}

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function TagsPage() {
  const qc = useQueryClient();
  const [newName,   setNewName]   = useState('');
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editName,  setEditName]  = useState('');
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  const { data: tags = [], isLoading } = useQuery<TagItem[]>({
    queryKey: ['admin-tags'],
    queryFn:  () => api.get<TagItem[]>(API_ROUTES.ADMIN.ADMIN_TAGS),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (name: string) => api.post(API_ROUTES.ADMIN.ADMIN_TAGS, { name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setNewName(''); },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(API_ROUTES.ADMIN.ADMIN_TAG(id), { name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setEditId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(API_ROUTES.ADMIN.ADMIN_TAG(id)),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setDeleteId(null); },
  });

  const startEdit = (tag: TagItem) => {
    setEditId(tag.id);
    setEditName(tag.name);
  };

  return (
    <>
      <AdminPageHeader
        title="Tags"
        subtitle="Manage product tags — tags are used for filtering and discovery"
        queryKey={['admin-tags']}
      />

      <div className="max-w-[640px] space-y-5">
        {/* Create */}
        <div className="bg-surface rounded-card border border-border shadow-card p-5">
          <h4 className="font-semibold text-secondary text-sm mb-3">Create Tag</h4>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim()); }}
              className={inputCls}
              placeholder="Tag name (e.g. Personalized, Wedding, Eco-friendly)"
            />
            <button
              type="button"
              onClick={() => { if (newName.trim()) create.mutate(newName.trim()); }}
              disabled={!newName.trim() || create.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
          {create.isError && (
            <p className="text-xs text-red-600 mt-2">
              {(create.error as Error)?.message ?? 'Failed to create tag'}
            </p>
          )}
        </div>

        {/* List */}
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h4 className="font-semibold text-secondary text-sm">
              All Tags <span className="text-muted font-normal">({tags.length})</span>
            </h4>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="h-4 w-32 bg-muted/10 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted/10 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Tag className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No tags yet. Create your first tag above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Tag</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Slug</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Products</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-muted/3 transition-colors">
                    <td className="px-5 py-3 font-medium text-secondary">
                      {editId === tag.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') rename.mutate({ id: tag.id, name: editName.trim() });
                              if (e.key === 'Escape') setEditId(null);
                            }}
                            autoFocus
                            className="px-2 py-1 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-36"
                          />
                          <button type="button" onClick={() => rename.mutate({ id: tag.id, name: editName.trim() })}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditId(null)}
                            className="p-1 text-muted hover:bg-muted/10 rounded transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : tag.name}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted font-mono">{tag.slug}</td>
                    <td className="px-5 py-3 text-muted">{tag.productCount}</td>
                    <td className="px-5 py-3 text-right">
                      {deleteId === tag.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600">Delete?</span>
                          <button type="button" onClick={() => remove.mutate(tag.id)}
                            className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded transition-colors">
                            Yes
                          </button>
                          <button type="button" onClick={() => setDeleteId(null)}
                            className="text-xs text-muted hover:bg-muted/10 px-2 py-1 rounded transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => startEdit(tag)}
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteId(tag.id)}
                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title={tag.productCount > 0 ? `Removes tag from ${tag.productCount} product(s)` : 'Delete tag'}>
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
