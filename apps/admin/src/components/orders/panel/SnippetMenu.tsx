'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, MessageSquareText, Plus, Settings, Trash2 } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../../lib/api-client';
import { toast } from '../../../lib/store/toast.store';
import { useDialog } from '../../../contexts/DialogContext';

/**
 * The shop's saved message bodies.
 *
 * Picking one INSERTS it into the composer rather than sending it — a saved
 * reply still has a buyer's name and an order in it that the seller edits
 * before it goes anywhere. Nothing in here sends by itself; that is the
 * away-message, which lives in Messages settings.
 */

export interface Snippet {
  id:    string;
  title: string;
  body:  string;
}

const QK = (storeQuery: string) => ['message-snippets', storeQuery] as const;

interface Props {
  /** `?storeId=…` for a platform-context SUPER_ADMIN, or '' for a shop owner. */
  storeQuery: string;
  /** What the composer currently holds — offered as the new snippet's text. */
  currentBody: string;
  onInsert:    (body: string) => void;
}

export function SnippetMenu({ storeQuery, currentBody, onInsert }: Props) {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [open, setOpen]       = useState(false);
  const [managing, setManaging] = useState(false);

  const snippetsQuery = useQuery({
    queryKey: QK(storeQuery),
    // Not fetched until the menu is opened: most messages are typed, not
    // picked, and the queue renders one of these per open order panel.
    enabled:  open,
    queryFn:  () => api.get<Snippet[]>(`${API_ROUTES.ADMIN.MESSAGE_SNIPPETS}${storeQuery}`),
  });

  const save = useMutation({
    mutationFn: (payload: { title: string; body: string }) =>
      api.post(`${API_ROUTES.ADMIN.MESSAGE_SNIPPETS}${storeQuery}`, payload),
    onSuccess: () => {
      toast.success('Snippet saved');
      qc.invalidateQueries({ queryKey: ['message-snippets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete(`${API_ROUTES.ADMIN.MESSAGE_SNIPPET(id)}${storeQuery}`),
    onSuccess: () => {
      toast.success('Snippet deleted');
      qc.invalidateQueries({ queryKey: ['message-snippets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // The app's own dialog, not window.prompt: browsers block the native one
  // in several contexts, and a save that silently never happens is worse than
  // one that is refused out loud.
  const saveCurrent = async () => {
    const body = currentBody.trim();
    if (!body) {
      // Checked before asking for a name: being asked to name something and
      // only then told there was nothing to save wastes the seller's typing.
      toast.error('Write the message first, then save it as a snippet.');
      return;
    }
    const title = await dialog.prompt('Name this snippet so you can find it later.', {
      title:       'Save as a new snippet',
      placeholder: 'Design ready for review',
    });
    if (title === null) return;
    if (!title.trim()) {
      toast.error('A snippet needs a name.');
      return;
    }
    save.mutate({ title: title.trim(), body });
  };

  /**
   * Confirmed first. The delete icon sits directly beside the row that
   * inserts the snippet, so a mis-click is a plausible way to lose one — and
   * there is no undo.
   */
  const deleteSnippet = async (snippet: Snippet) => {
    const ok = await dialog.confirm(`Delete the snippet "${snippet.title}"?`, {
      title:        'Delete snippet',
      confirmLabel: 'Delete',
      destructive:  true,
    });
    if (ok) remove.mutate(snippet.id);
  };

  const snippets = snippetsQuery.data ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setManaging(false); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-secondary hover:bg-background"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Saved replies</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute bottom-full left-0 z-20 mb-1 w-72 rounded-card border border-border bg-surface py-2 shadow-lg"
          >
            {snippetsQuery.isLoading ? (
              <p className="flex items-center gap-2 px-4 py-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
              </p>
            ) : snippetsQuery.isError ? (
              // Distinct from the empty case: reporting a broken request as
              // "no snippets yet" sends someone looking for missing data
              // instead of a bug.
              <p className="px-4 py-2 text-sm text-error">
                Could not load snippets. {(snippetsQuery.error as Error).message}
              </p>
            ) : snippets.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted">No saved replies yet.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {snippets.map((s) => (
                  <li key={s.id} className="flex items-start gap-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onInsert(s.body); setOpen(false); }}
                      className="min-w-0 flex-1 px-4 py-2 text-left hover:bg-background"
                    >
                      <span className="block truncate text-sm text-secondary">{s.title}</span>
                      <span className="block truncate text-xs text-muted">{s.body}</span>
                    </button>
                    {managing && (
                      <button
                        type="button"
                        onClick={() => void deleteSnippet(s)}
                        disabled={remove.isPending}
                        aria-label={`Delete ${s.title}`}
                        className="mr-2 mt-2 shrink-0 rounded-full p-1.5 text-muted hover:bg-background hover:text-error disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              role="menuitem"
              onClick={() => void saveCurrent()}
              disabled={save.isPending}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-primary hover:bg-background disabled:opacity-50"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              Save as a new snippet
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => setManaging((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-secondary hover:bg-background"
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
              {managing ? 'Done managing' : 'Manage snippets'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
