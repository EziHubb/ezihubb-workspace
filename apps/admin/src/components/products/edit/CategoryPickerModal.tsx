'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight, Check, Search, Tag, AlertCircle } from 'lucide-react';
import { clientFetch } from '../../../lib/api';
import { fetchArr } from '../../../lib/fmt';

interface Category {
  id:         string;
  name:       string;
  slug?:      string;
  level?:     number;
  parentId?:  string | null;
  isVisible?: boolean;
  breadcrumb?: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  isOpen:            boolean;
  currentCategoryId: string | null;
  onSelect:          (categoryId: string, breadcrumb: string) => void;
  onClose:           () => void;
}

export function CategoryPickerModal({
  isOpen, currentCategoryId, onSelect, onClose,
}: ModalProps) {
  const [selectedL1,   setSelectedL1]   = useState<string | null>(null);
  const [selectedL2,   setSelectedL2]   = useState<string | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const { data: l1Categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories-l1'],
    queryFn:  () => clientFetch('/categories?level=1&isVisible=true').then(fetchArr<Category>),
    enabled:  isOpen,
    staleTime: 10 * 60_000,
  });

  const { data: l2Categories = [] } = useQuery<Category[]>({
    queryKey: ['categories-l2', selectedL1],
    queryFn:  () => clientFetch(`/categories?level=2&parentId=${selectedL1}`).then(fetchArr<Category>),
    enabled:  !!selectedL1,
    staleTime: 10 * 60_000,
  });

  const { data: l3Categories = [] } = useQuery<Category[]>({
    queryKey: ['categories-l3', selectedL2],
    queryFn:  () => clientFetch(`/categories?level=3&parentId=${selectedL2}`).then(fetchArr<Category>),
    enabled:  !!selectedL2,
    staleTime: 10 * 60_000,
  });

  const { data: searchResults = [] } = useQuery<Category[]>({
    queryKey: ['categories-search', searchQuery],
    queryFn:  () => clientFetch(`/categories?level=3&q=${encodeURIComponent(searchQuery)}`).then(fetchArr<Category>),
    enabled:  searchQuery.length >= 2,
  });

  if (!isOpen) return null;

  const handleSelect = (cat: Category) => {
    onSelect(cat.id, cat.breadcrumb ?? cat.name);
    onClose();
  };

  const isSearching = searchQuery.length >= 2;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[680px] flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-secondary">Select a category</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for a category..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {isSearching ? (
            <div className="overflow-y-auto h-full px-5 py-3">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">
                  No categories found for &ldquo;{searchQuery}&rdquo;
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {searchResults.map(cat => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(cat)}
                        className={[
                          'w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left',
                          currentCategoryId === cat.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/5 text-secondary',
                        ].join(' ')}
                      >
                        <span>{cat.name}</span>
                        {currentCategoryId === cat.id && (
                          <Check className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* 3-column tree browser */
            <div className="flex divide-x divide-border h-full overflow-hidden">
              {/* L1 */}
              <div className="w-1/3 overflow-y-auto py-2">
                {isLoading ? (
                  <p className="px-4 py-3 text-sm text-muted">Loading…</p>
                ) : l1Categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setSelectedL1(cat.id); setSelectedL2(null); }}
                    className={[
                      'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                      selectedL1 === cat.id
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-secondary hover:bg-muted/5',
                    ].join(' ')}
                  >
                    <span className="truncate">{cat.name}</span>
                    {selectedL1 === cat.id && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* L2 */}
              <div className="w-1/3 overflow-y-auto py-2 bg-muted/3">
                {!selectedL1 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">Select a top-level category</p>
                ) : l2Categories.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">No sub-categories</p>
                ) : l2Categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedL2(cat.id)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                      selectedL2 === cat.id
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-secondary hover:bg-muted/5',
                    ].join(' ')}
                  >
                    <span className="truncate">{cat.name}</span>
                    {selectedL2 === cat.id && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* L3 — selectable */}
              <div className="w-1/3 overflow-y-auto py-2">
                {!selectedL2 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">Select a sub-category</p>
                ) : l3Categories.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">No leaf categories</p>
                ) : l3Categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={[
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                      currentCategoryId === cat.id
                        ? 'bg-primary text-white font-semibold'
                        : 'text-secondary hover:bg-muted/5',
                    ].join(' ')}
                  >
                    {currentCategoryId === cat.id
                      ? <Check className="w-3.5 h-3.5 shrink-0" />
                      : <span className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-lg hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  value:    string | null;
  onChange: (id: string) => void;
}

export function CategoryPickerCard({ value: categoryId, onChange }: CardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [breadcrumb,  setBreadcrumb]  = useState('');

  const { data: category } = useQuery<Category>({
    queryKey: ['category', categoryId],
    queryFn:  () => clientFetch(`/categories/${categoryId}`)
      .then(r => r.json()).then(r => r.data),
    enabled:  !!categoryId,
  });

  return (
    <>
      <div className={[
        'flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 transition-colors',
        category ? 'border-border bg-background' : 'border-dashed border-border bg-background',
      ].join(' ')}>
        <div className="flex-1 min-w-0">
          {category ? (
            <>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-sm font-semibold text-secondary truncate">{category.name}</p>
              </div>
              {(breadcrumb || category.breadcrumb) && (
                <p className="text-xs text-muted mt-0.5 truncate">
                  {breadcrumb || category.breadcrumb}
                </p>
              )}
              <p className="text-xs text-muted/60 mt-0.5">Physical item</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">No category selected</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline focus:outline-none"
        >
          {category ? 'Change' : 'Select'}
        </button>
      </div>

      <CategoryPickerModal
        isOpen={isModalOpen}
        currentCategoryId={categoryId}
        onSelect={(id, crumb) => { onChange(id); setBreadcrumb(crumb); }}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
