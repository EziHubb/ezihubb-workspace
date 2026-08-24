'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Loader2, X } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../lib/api-client';
import { toast } from '../../lib/store/toast.store';
import { useDialog } from '../../contexts/DialogContext';

/**
 * The seller's shop sections — the groups that become the filter rail on
 * their public shop page.
 *
 * Talks to the same endpoints (and the same react-query key) as
 * /catalog/shop-sections, so the two screens can never show different
 * sections for the same shop.
 */

/** Mirrors the API's own limits (admin-shop-sections.controller.ts). Kept in
 *  step by hand, and enforced there — these two only shape the UI. */
export const MAX_SECTIONS   = 20;
export const MAX_NAME_CHARS = 24;

/** Shared with /catalog/shop-sections: one cache entry, one source of truth. */
export const SECTIONS_KEY = ['admin-shop-sections'];

export interface ShopSection {
  id:        string;
  name:      string;
  sortOrder: number;
  _count:    { products: number };
}

export function useShopSections() {
  return useQuery<ShopSection[]>({
    queryKey:  SECTIONS_KEY,
    queryFn:   () => api.get<ShopSection[]>(API_ROUTES.ADMIN.SHOP_SECTIONS),
    staleTime: 30_000,
  });
}

// ── Edit / create one section ────────────────────────────────────────────────

export function EditSectionModal({
  section, onClose, onBack,
}: {
  /** null creates a new one. */
  section: ShopSection | null;
  onClose: () => void;
  onBack?: () => void;
}) {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [name, setName] = useState(section?.name ?? '');

  const done = () => {
    qc.invalidateQueries({ queryKey: SECTIONS_KEY });
    (onBack ?? onClose)();
  };

  const save = useMutation({
    mutationFn: () =>
      section
        ? api.patch(API_ROUTES.ADMIN.SHOP_SECTION(section.id), { name: name.trim() })
        : api.post(API_ROUTES.ADMIN.SHOP_SECTIONS, { name: name.trim() }),
    onSuccess: () => { toast.success(section ? 'Section updated' : 'Section added'); done(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(API_ROUTES.ADMIN.SHOP_SECTION(section!.id)),
    onSuccess: () => { toast.success('Section deleted'); done(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  /**
   * Confirmed, and the message says what happens to the listings.
   * Deleting a section does not delete its products — the API detaches them —
   * but a seller staring at "15" beside the name has every reason to fear it
   * does.
   */
  const confirmDelete = async () => {
    if (!section) return;
    const count = section._count.products;
    const ok = await dialog.confirm(
      count > 0
        ? `Delete "${section.name}"? Its ${count} listing${count === 1 ? '' : 's'} stay in your shop and become unsectioned.`
        : `Delete "${section.name}"?`,
      { title: 'Delete section', confirmLabel: 'Delete section', destructive: true },
    );
    if (ok) remove.mutate();
  };

  const trimmed = name.trim();
  const busy    = save.isPending || remove.isPending;

  return (
    <Sheet onClose={onClose} labelledBy="edit-section-title">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <h2 id="edit-section-title" className="text-xl font-semibold text-secondary">
          {section ? `Edit "${section.name}"` : 'Add section'}
        </h2>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 pt-5">
        <label htmlFor="section-title" className="block text-sm font-medium text-secondary">
          Section title
        </label>
        <input
          id="section-title"
          value={name}
          autoFocus
          maxLength={MAX_NAME_CHARS}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && trimmed && !busy) save.mutate(); }}
          className="mt-2 w-full rounded-card border border-border bg-surface px-4 py-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-right text-xs text-muted">
          {name.length}/{MAX_NAME_CHARS}
        </p>
      </div>

      <div className="flex items-center gap-3 px-6 pb-6 pt-4">
        <button
          type="button"
          onClick={onBack ?? onClose}
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-secondary hover:bg-background"
        >
          Back
        </button>
        <div className="ml-auto flex items-center gap-3">
          {section && (
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={busy}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-secondary hover:bg-background disabled:opacity-50"
            >
              Delete Section
            </button>
          )}
          <button
            type="button"
            onClick={() => save.mutate()}
            // Blocked on an empty name rather than letting the API reject it:
            // the round trip would land as a toast over a form the seller has
            // already stopped looking at.
            disabled={!trimmed || busy}
            className="flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {section ? 'Save changes' : 'Add section'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Manage the list ──────────────────────────────────────────────────────────

export function ManageSectionsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: sections = [], isLoading, isError, error } = useShopSections();
  const [editing, setEditing] = useState<ShopSection | 'new' | null>(null);
  const [dragId,  setDragId]  = useState<string | null>(null);
  /** Local order while dragging, so rows follow the pointer before the save
   *  lands. Null means "show whatever the server last returned". */
  const [order,   setOrder]   = useState<string[] | null>(null);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.patch(API_ROUTES.ADMIN.SHOP_SECTIONS_REORDER, { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_KEY }),
    onError:   (e: Error) => {
      // Dropped back to the server's order: leaving the optimistic one on
      // screen would show an arrangement the shop is not actually using.
      setOrder(null);
      toast.error(e.message);
    },
  });

  const rows = order
    ? order.flatMap((id) => sections.find((s) => s.id === id) ?? [])
    : sections;

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids  = rows.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to   = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    setOrder(ids);
    reorder.mutate(ids);
  };

  if (editing !== null) {
    return (
      <EditSectionModal
        section={editing === 'new' ? null : editing}
        onClose={onClose}
        onBack={() => setEditing(null)}
      />
    );
  }

  const atLimit = sections.length >= MAX_SECTIONS;

  return (
    <Sheet onClose={onClose} labelledBy="manage-sections-title">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <h2 id="manage-sections-title" className="text-xl font-semibold text-secondary">
          Manage Sections
        </h2>
        <CloseButton onClick={onClose} />
      </div>

      <p className="px-6 pt-3 text-sm text-muted">
        Sections help shoppers browse your shop. Drag and drop sections to change their order in your shop.
      </p>
      <p className="px-6 pt-3 text-sm text-secondary">
        Using <strong>{sections.length}</strong> of <strong>{MAX_SECTIONS}</strong> sections
      </p>

      <div className="mt-4 max-h-[50vh] overflow-y-auto border-t border-border px-6">
        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading sections…
          </p>
        ) : isError ? (
          // Distinct from "no sections yet": reporting a failed request as an
          // empty shop sends the seller off to re-create what they already have.
          <p className="py-6 text-sm text-error">Could not load sections. {(error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted">No sections yet. Add one to group your listings.</p>
        ) : (
          <ul className="py-2">
            {rows.map((s) => (
              <li
                key={s.id}
                draggable
                onDragStart={() => setDragId(s.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(s.id)}
                className={`flex items-center gap-3 rounded-card px-1 py-3 ${
                  dragId === s.id ? 'opacity-40' : ''
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-secondary hover:underline"
                >
                  {s.name}
                </button>
                <span className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
                  {s._count.products}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-secondary hover:bg-background"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={atLimit}
          title={atLimit ? `A shop can have at most ${MAX_SECTIONS} sections.` : undefined}
          className="rounded-full bg-secondary px-6 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
        >
          Add Section
        </button>
      </div>
    </Sheet>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

function Sheet({
  children, onClose, labelledBy,
}: { children: React.ReactNode; onClose: () => void; labelledBy: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-card border border-border bg-surface shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="shrink-0 rounded-full bg-background p-2 text-muted hover:text-secondary"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
