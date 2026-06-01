'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, ChevronDown, Plus, Save, Trash2,
  LayoutGrid, RefreshCw, GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { clientFetch } from '../../../../lib/api';
import { fetchArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id:           string;
  name:         string;
  slug:         string;
  description?: string;
  imageUrl?:    string;
  level:        number;
  parentId?:    string;
  sortOrder:    number;
  isVisible:    boolean;
  productCount?: number;
  children?:    Category[];
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

// ── Category tree node ────────────────────────────────────────────────────────

function TreeNode({
  cat,
  depth,
  selectedId,
  onSelect,
}: {
  cat:        Category;
  depth:      number;
  selectedId: string | null;
  onSelect:   (c: Category) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren     = (cat.children?.length ?? 0) > 0;
  const isSelected      = selectedId === cat.id;
  const indent          = depth * 16;

  const levelColors = ['border-primary', 'border-blue-400', 'border-gray-300'];
  const borderClass = depth === 0 ? levelColors[0] : depth === 1 ? levelColors[1] : levelColors[2];

  return (
    <li>
      <div
        onClick={() => onSelect(cat)}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-button cursor-pointer transition-colors group select-none',
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/5 text-secondary',
          `border-l-2 ${isSelected ? 'border-primary' : `${borderClass} border-opacity-0 group-hover:border-opacity-50`}`,
        ].join(' ')}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            className="shrink-0 w-4 h-4 flex items-center justify-center text-muted hover:text-secondary"
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <GripVertical className="w-3 h-3 text-muted/40 shrink-0 hidden group-hover:block" />

        {/* Name */}
        <span className={`flex-1 text-sm truncate ${depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : 'font-normal text-muted'}`}>
          {cat.name}
        </span>

        {/* Product count badge */}
        {cat.productCount != null && cat.productCount > 0 && (
          <span className="text-[10px] font-semibold bg-muted/10 text-muted rounded-pill px-1.5 py-0.5 tabular-nums shrink-0">
            {cat.productCount}
          </span>
        )}

        {!cat.isVisible && (
          <EyeOff className="w-3 h-3 text-muted/50 shrink-0" />
        )}
      </div>

      {/* Children */}
      {hasChildren && open && (
        <ul>
          {cat.children!.map((child) => (
            <TreeNode
              key={child.id}
              cat={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Category form ─────────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  slug:        string;
  description: string;
  sortOrder:   number;
  isVisible:   boolean;
}

function CategoryForm({
  category,
  parentPath,
  onSave,
  onDelete,
  onAddChild,
}: {
  category:   Category | null;  // null = creating new
  parentPath: string;
  onSave:     (data: Partial<Category> & { id?: string; parentId?: string }) => Promise<void>;
  onDelete:   (id: string) => Promise<void>;
  onAddChild: (parentId: string) => void;
}) {
  const isNew = !category?.id;

  const [form,    setForm]    = useState<FormState>(() => ({
    name:        category?.name        ?? '',
    slug:        category?.slug        ?? '',
    description: category?.description ?? '',
    sortOrder:   category?.sortOrder   ?? 0,
    isVisible:   category?.isVisible   ?? true,
  }));
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Reset form when category changes
  useEffect(() => {
    setForm({
      name:        category?.name        ?? '',
      slug:        category?.slug        ?? '',
      description: category?.description ?? '',
      sortOrder:   category?.sortOrder   ?? 0,
      isVisible:   category?.isVisible   ?? true,
    });
    setSlugEdited(false);
    setError(null);
  }, [category?.id]);

  const handleNameChange = (v: string) => {
    setForm((f) => ({
      ...f,
      name: v,
      ...(!slugEdited ? { slug: toSlug(v) } : {}),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ id: category?.id, ...form, parentId: category?.parentId });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category?.id) return;
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(category.id);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Delete failed');
      setDeleting(false);
    }
  };

  if (!category && isNew) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted">
        <LayoutGrid className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-medium text-secondary">Select a category to edit</p>
        <p className="text-sm mt-1">or create a new top-level category</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      {parentPath && (
        <p className="text-xs text-muted">
          <span className="font-medium">Path:</span> {parentPath} / {form.name || '…'}
        </p>
      )}

      {/* Level + parent info */}
      {category && (
        <div className="flex gap-4 text-xs text-muted bg-background rounded-button px-3 py-2">
          <span><strong>Level:</strong> {category.level ?? '?'}</span>
          {category.parentId && <span><strong>Parent ID:</strong> {category.parentId.slice(0, 8)}…</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="e.g. Kitchen & Dining"
          />
        </div>

        {/* Slug */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Slug</label>
          <input
            value={form.slug}
            onChange={(e) => { setSlugEdited(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-muted mt-1">Auto-generated from name. URL: /categories/{form.slug}</p>
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
            placeholder="Short description for this category"
          />
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Sort Order</label>
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Visible toggle */}
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isVisible: !f.isVisible }))}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.isVisible ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isVisible ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-secondary flex items-center gap-1.5">
            {form.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {form.isVisible ? 'Visible' : 'Hidden'}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-button px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {category?.id && (
          <button
            type="button"
            onClick={() => onAddChild(category.id)}
            className="flex items-center gap-1.5 text-sm text-secondary border border-border rounded-button px-3 py-2 hover:border-primary/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Child
          </button>
        )}

        {category?.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto flex items-center gap-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-button transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mega menu sync ────────────────────────────────────────────────────────────

function MegaMenuEditor({ onSync }: { onSync: () => Promise<void> }) {
  const [open,    setOpen]    = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch { /* silent */ } finally { setSyncing(false); }
  };

  return (
    <div className="mt-6 border border-border rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-background hover:bg-muted/5 transition-colors"
      >
        <h4 className="font-semibold text-secondary text-sm">🗂 Mega Menu Configuration</h4>
        {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted">
            The mega menu is built from L1 (nav tab) → L2 (group) → L3 (leaf item) categories stored in MongoDB.
            Click "Sync" to regenerate from the current category tree.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-button transition-colors disabled:opacity-50 ${done ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : done ? '✓ Synced' : 'Sync from Category Tree'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const qc = useQueryClient();

  // Fetch full category tree
  const { data: tree = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn:  async () => {
      const res = await clientFetch('/catalog/categories');
      return fetchArr<Category>(res);
    },
  });

  const [selected,   setSelected]   = useState<Category | null>(null);
  const [parentPath, setParentPath] = useState('');
  const [creatingFor, setCreatingFor] = useState<{ parentId: string; level: number } | null>(null);

  // Build parent path string for breadcrumb display
  const buildPath = useCallback((catId: string, nodes: Category[], path: string[] = []): string[] | null => {
    for (const n of nodes) {
      if (n.id === catId) return [...path, n.name];
      if (n.children?.length) {
        const found = buildPath(catId, n.children, [...path, n.name]);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const handleSelect = (cat: Category) => {
    setSelected(cat);
    setCreatingFor(null);
    if (cat.parentId) {
      const path = buildPath(cat.parentId, tree);
      setParentPath(path ? path.join(' / ') : '');
    } else {
      setParentPath('Root');
    }
  };

  const handleAddChild = (parentId: string) => {
    const parent = findById(parentId, tree);
    const newCat: Category = {
      id: '',
      name: '',
      slug: '',
      level: (parent?.level ?? 1) + 1,
      sortOrder: 0,
      isVisible: true,
      parentId,
    };
    setSelected(newCat);
    const path = buildPath(parentId, tree);
    setParentPath(path ? path.join(' / ') : '');
  };

  const handleAddTopLevel = () => {
    setSelected({
      id: '', name: '', slug: '', level: 1, sortOrder: 0, isVisible: true,
    });
    setParentPath('Root');
  };

  const handleSave = async (data: Partial<Category> & { id?: string; parentId?: string }) => {
    if (data.id) {
      await clientFetch(`/admin/categories/${data.id}`, {
        method: 'PATCH',
        body:   JSON.stringify(data),
      });
    } else {
      await clientFetch('/admin/categories', {
        method: 'POST',
        body:   JSON.stringify(data),
      });
    }
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    setSelected(null);
  };

  const handleDelete = async (id: string) => {
    const res  = await clientFetch(`/admin/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? 'Delete failed — the category may have active products.');
    }
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    setSelected(null);
  };

  const handleSync = async () => {
    await clientFetch('/admin/catalog/sync-mega-menu', { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
  };

  // Stats from selected category
  const totalL1  = tree.length;
  const totalL2  = tree.reduce((s, n) => s + (n.children?.length ?? 0), 0);
  const totalL3  = tree.reduce((s, n) => s + (n.children?.reduce((s2, c) => s2 + (c.children?.length ?? 0), 0) ?? 0), 0);

  return (
    <>
      <AdminPageHeader
        title="Categories"
        subtitle={`${totalL1} nav tabs · ${totalL2} groups · ${totalL3} items`}
        actions={
          <button
            type="button"
            onClick={handleAddTopLevel}
            className="flex items-center gap-1.5 text-sm font-semibold bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Top-Level
          </button>
        }
      />

      {/* 3-panel layout */}
      <div className="flex gap-5 min-h-[600px]">

        {/* LEFT: Category tree */}
        <div className="w-[300px] shrink-0 bg-surface rounded-card border border-border shadow-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Category Tree</p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-muted">Loading…</div>
            ) : tree.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted">No categories yet</div>
            ) : (
              <ul>
                {tree.map((cat) => (
                  <TreeNode
                    key={cat.id}
                    cat={cat}
                    depth={0}
                    selectedId={selected?.id ?? null}
                    onSelect={handleSelect}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="px-3 py-3 border-t border-border">
            <button
              type="button"
              onClick={handleAddTopLevel}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-muted border border-dashed border-border rounded-button py-2 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Top-Level Category
            </button>
          </div>
        </div>

        {/* CENTER: Form */}
        <div className="flex-1 bg-surface rounded-card border border-border shadow-card p-6">
          <CategoryForm
            category={selected?.id ? selected : (selected ? { ...selected } : null)}
            parentPath={parentPath}
            onSave={handleSave}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
          />
        </div>

        {/* RIGHT: Quick stats */}
        <div className="w-[240px] shrink-0 space-y-3">
          {[
            { label: 'Nav Tabs (L1)',  value: totalL1,  color: 'text-primary' },
            { label: 'Groups (L2)',    value: totalL2,  color: 'text-blue-500' },
            { label: 'Leaf Items (L3)',value: totalL3,  color: 'text-muted'   },
          ].map((s) => (
            <div key={s.label} className="bg-surface rounded-card border border-border shadow-card p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}

          {selected?.id && (
            <div className="bg-surface rounded-card border border-border shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Selected</p>
              <p className="text-sm font-medium text-secondary truncate">{selected.name}</p>
              <p className="text-xs text-muted">Level {selected.level}</p>
              {selected.productCount != null && (
                <p className="text-xs text-muted">{selected.productCount} products</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mega menu editor */}
      <MegaMenuEditor onSync={handleSync} />
    </>
  );
}

// ── findById util ──────────────────────────────────────────────────────────────

function findById(id: string, nodes: Category[]): Category | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findById(id, n.children);
      if (found) return found;
    }
  }
  return null;
}
