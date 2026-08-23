'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Pencil, Trash2, Check, X, Search } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface TagItem {
  id:           string;
  name:         string;
  slug:         string;
  productCount: number;
}

type SortKey = 'least' | 'most' | 'name';

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20';

/**
 * Tags are created by sellers, not here.
 *
 * Every tag typed on a listing, applied through the Listings bulk editor, or
 * arriving in a CSV import upserts its own row — so this page never needed to
 * be the place tags are made, and led with a "Create Tag" card anyway. What has
 * no other home is the cleanup: a misspelling splits a filter in two, and one
 * seller's private shorthand sits in the taxonomy forever, because removing a
 * tag from a listing leaves the tag itself behind.
 *
 * So the list leads, sorted by how little a tag is used — the least-used tags
 * are the ones worth a look. Creating one by hand is still possible, just no
 * longer the headline.
 */
export default function TagsPage() {
  const qc = useQueryClient();
  const [newName,   setNewName]   = useState('');
  const [creating,  setCreating]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editName,  setEditName]  = useState('');
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState<SortKey>('least');

  const { data: tags = [], isLoading } = useQuery<TagItem[]>({
    queryKey: ['admin-tags'],
    queryFn:  () => api.get<TagItem[]>(API_ROUTES.ADMIN.ADMIN_TAGS),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (name: string) => api.post(API_ROUTES.ADMIN.ADMIN_TAGS, { name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setNewName(''); setCreating(false); },
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

  const unusedCount = tags.filter((t) => t.productCount === 0).length;

  // Sorted client-side: the list is small enough that a round trip to change
  // the order would be slower than the seller can notice it changed.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const diff = sort === 'most'
        ? b.productCount - a.productCount
        : a.productCount - b.productCount;
      // Name as the tie-break, so equal counts do not shuffle between renders.
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [tags, search, sort]);

  return (
    <>
      <AdminPageHeader
        title="Tags"
        subtitle="Tags appear here on their own as sellers use them — this is where you tidy them up"
        queryKey={['admin-tags']}
      />

      <div className="max-w-[900px] space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              className={`${inputCls} pl-9`}
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="least">Least used first</option>
            <option value="most">Most used first</option>
            <option value="name">A–Z</option>
          </select>

          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-secondary border border-border rounded-button hover:border-primary/40 hover:text-primary transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New tag
          </button>
        </div>

        {/* Manual create — kept, but out of the way. A tag made here has no
            listings until a seller uses the same word. */}
        {creating && (
          <div className="bg-surface rounded-card border border-border shadow-card p-4">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim());
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                autoFocus
                className={inputCls}
                placeholder="Tag name (e.g. Personalized, Wedding, Eco-friendly)"
              />
              <button
                type="button"
                onClick={() => { if (newName.trim()) create.mutate(newName.trim()); }}
                disabled={!newName.trim() || create.isPending}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50 shrink-0"
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              Creating a tag here does not attach it to anything — it only reserves the name.
            </p>
            {create.isError && (
              <p className="text-xs text-red-600 mt-2">
                {(create.error as Error)?.message ?? 'Failed to create tag'}
              </p>
            )}
          </div>
        )}

        {/* List */}
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
            <h4 className="font-semibold text-secondary text-sm">
              {search ? 'Matching tags' : 'All tags'}{' '}
              <span className="text-muted font-normal">({visible.length})</span>
            </h4>
            {unusedCount > 0 && !search && (
              <span className="text-xs text-muted">
                {unusedCount} attached to no listing
              </span>
            )}
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
          ) : visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Tag className="w-8 h-8 text-muted/40 mx-auto mb-3" />
              {search ? (
                <p className="text-sm text-muted">No tag matches “{search}”.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-secondary">No tags yet</p>
                  <p className="text-sm text-muted mt-1 max-w-[400px] mx-auto leading-relaxed">
                    Tags are added by sellers on their listings, and show up here automatically.
                    Nothing to tidy up until then.
                  </p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Tag</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Slug</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Listings</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((tag) => (
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
                            className="px-2 py-1 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
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
                    <td className="px-5 py-3">
                      {tag.productCount === 0 ? (
                        <span className="text-xs text-muted italic">none</span>
                      ) : (
                        <span className="text-secondary tabular-nums">{tag.productCount}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {deleteId === tag.id ? (
                        <div className="flex items-center justify-end gap-2">
                          {/* The consequence, spelled out. Deleting a tag drops
                              it from every listing carrying it — that used to
                              live in a title attribute nobody hovers. */}
                          <span className="text-xs text-red-600">
                            {tag.productCount > 0
                              ? `Remove from ${tag.productCount} listing${tag.productCount === 1 ? '' : 's'}?`
                              : 'Delete this tag?'}
                          </span>
                          <button type="button" onClick={() => remove.mutate(tag.id)}
                            className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded transition-colors">
                            Delete
                          </button>
                          <button type="button" onClick={() => setDeleteId(null)}
                            className="text-xs text-muted hover:bg-muted/10 px-2 py-1 rounded transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => { setEditId(tag.id); setEditName(tag.name); }}
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors"
                            title="Rename — listings keep the tag">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteId(tag.id)}
                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete tag">
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
