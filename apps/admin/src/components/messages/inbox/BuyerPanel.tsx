'use client';

import { useEffect, useState } from 'react';
import { Globe, Plus } from 'lucide-react';
import { Avatar } from './Avatar';
import { LABEL_CHIP, type BuyerPanel as BuyerPanelData, type ConversationLabel } from './types';

/**
 * Who the shop is talking to.
 *
 * Everything here is private to the shop. The note especially: it is about the
 * buyer, follows them across every thread, and is never shown to them.
 */

interface Props {
  buyer:     BuyerPanelData | null;
  labels:    ConversationLabel[];
  allLabels: ConversationLabel[];
  savingNote: boolean;
  onSaveNote:   (body: string) => Promise<void>;
  onToggleLabel: (labelId: string) => void;
  /** "Online" / "Last seen 5m ago". Empty or absent for a guest, who has no
   *  account and therefore no presence to report. */
  presence?: string;
  /** Drives the dot's colour. Separate from the label so the two cannot drift. */
  online?:   boolean;
}

export function BuyerPanel({
  buyer, labels, allLabels, savingNote, onSaveNote, onToggleLabel, presence, online,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [picking, setPicking] = useState(false);

  // Reset when the panel switches buyer, otherwise one buyer's half-typed note
  // appears under the next one's name.
  useEffect(() => {
    setDraft(buyer?.note ?? '');
    setEditing(false);
    setPicking(false);
  }, [buyer?.buyerKey, buyer?.note]);

  if (!buyer) return null;

  const assigned = new Set(labels.map((l) => l.id));

  return (
    // Hidden below 2xl. It is 288px of context sitting beside the conversation
    // itself, and on a narrower screen those pixels are the difference between
    // a readable thread and a squeezed one. Nothing here is unavailable
    // elsewhere — the buyer's name and note are on the thread and the order.
    <aside
      className="hidden w-72 shrink-0 space-y-5 border-l border-border px-5 py-5 text-sm 2xl:block"
      aria-label="About this buyer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-secondary">{buyer.name}</h2>
          {/* Rendered only when there is something true to say. A guest has no
              account, so "Offline" would be a claim about someone who cannot
              be online rather than a fact about them. */}
          {presence && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-border'}`}
                aria-hidden="true"
              />
              {presence}
            </p>
          )}
        </div>
        <Avatar name={buyer.name} src={buyer.avatarUrl} size={40} />
      </div>

      {buyer.location && (
        <p className="flex items-center gap-1.5 text-muted">
          <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
          {buyer.location}
        </p>
      )}

      <p className="text-muted">
        {buyer.isFirstContact
          ? "This buyer hasn't messaged you before"
          : `${buyer.threadCount} conversations with your shop`}
      </p>

      {/* ── Private note ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-secondary">Private note</h3>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={buyer.note ? 'Edit private note' : 'Add a private note'}
              className="p-1 text-muted hover:text-secondary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Only your shop can see this"
              className="w-full rounded-button border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={savingNote}
                onClick={async () => { await onSaveNote(draft); setEditing(false); }}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setDraft(buyer.note ?? ''); setEditing(false); }}
                className="text-xs text-muted hover:text-secondary"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-muted">{buyer.note ?? 'No note yet.'}</p>
        )}
      </section>

      {/* ── Labels ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-secondary">Labels</h3>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            aria-label="Change labels"
            className="p-1 text-muted hover:text-secondary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {labels.length === 0 && !picking && <p className="text-muted">No labels added.</p>}

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <span key={l.id} className={`rounded px-2 py-0.5 text-xs ${LABEL_CHIP[l.color]}`}>{l.name}</span>
            ))}
          </div>
        )}

        {picking && (
          <ul className="mt-3 space-y-1">
            {allLabels.length === 0 && (
              <li className="text-xs text-muted">No labels yet — create one from the toolbar.</li>
            )}
            {allLabels.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    checked={assigned.has(l.id)}
                    onChange={() => onToggleLabel(l.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className={`rounded px-2 py-0.5 text-xs ${LABEL_CHIP[l.color]}`}>{l.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
