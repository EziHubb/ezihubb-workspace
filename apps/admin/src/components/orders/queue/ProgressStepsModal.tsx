'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, Lock, Trash2, Plus } from 'lucide-react';
import { ModalPortal } from '../../products/edit/ModalPortal';
import type { ProgressStep } from './types';

/**
 * Editor for a shop's workflow steps.
 *
 * The two ends are shown but not editable — they are what makes the pipeline
 * a pipeline, and "Completed" is the only step the buyer ever hears about.
 * Everything between belongs to the seller.
 *
 * Rows are keyed by a stable local key rather than by array index. Index keys
 * hand a removed row's state to its neighbour, which here would mean deleting
 * one step and watching a different one's text appear to change — the same
 * trap that bit the variations editor.
 */

interface DraftStep {
  /** Local identity, stable across reorder and independent of the server id. */
  key: string;
  /** Server id; absent for a step that has not been saved yet. */
  id?: string;
  name: string;
}

interface Props {
  steps:     ProgressStep[];
  onClose:   () => void;
  onSave:    (steps: { id?: string; name: string }[]) => Promise<void>;
  saving?:   boolean;
}

let keySeq = 0;
const nextKey = () => `draft-${++keySeq}`;

export function ProgressStepsModal({ steps, onClose, onSave, saving }: Props) {
  const first = steps.find((s) => s.kind === 'NEW');
  const last  = steps.find((s) => s.kind === 'COMPLETED');

  const [draft, setDraft] = useState<DraftStep[]>(() =>
    steps.filter((s) => s.kind === 'CUSTOM').map((s) => ({ key: nextKey(), id: s.id, name: s.name })),
  );
  const [error, setError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  // Esc closes, matching every other modal in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rename = (key: string, name: string) =>
    setDraft((d) => d.map((s) => (s.key === key ? { ...s, name } : s)));

  const remove = (key: string) => setDraft((d) => d.filter((s) => s.key !== key));

  const add = () => setDraft((d) => [...d, { key: nextKey(), name: '' }]);

  const move = (from: number, to: number) =>
    setDraft((d) => {
      if (to < 0 || to >= d.length || from === to) return d;
      const next = [...d];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  const submit = async () => {
    const cleaned = draft.map((s) => ({ ...s, name: s.name.trim() }));

    if (cleaned.some((s) => !s.name)) {
      return setError('Every step needs a name.');
    }
    const lowered = cleaned.map((s) => s.name.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      return setError('Two steps cannot share a name.');
    }
    // Checked here as well as on the server: a step named the same as a locked
    // end would produce two identical tabs.
    const reserved = [first?.name, last?.name].filter(Boolean).map((n) => n!.toLowerCase());
    if (lowered.some((n) => reserved.includes(n))) {
      return setError('That name is already used by a required step.');
    }

    setError(null);
    await onSave(cleaned.map((s) => ({ id: s.id, name: s.name })));
  };

  const lockedRow = (label: string) => (
    <div className="flex items-center gap-3 py-3 text-sm text-muted">
      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium text-secondary">{label}</span>
      <span className="text-xs">(required)</span>
    </div>
  );

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="progress-steps-title"
          className="w-full max-w-lg rounded-card bg-surface shadow-xl"
        >
          <div className="px-6 pt-6">
            <h2 id="progress-steps-title" className="text-xl font-semibold text-secondary">
              Customise progress steps
            </h2>
            <p className="mt-2 text-sm text-muted">
              Add, remove or rename the steps your shop works through. Drag a step to move
              it. Buyers are only notified when an order reaches the last step.
            </p>
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
            {first && lockedRow(first.name)}
            <div className="border-t border-border" />

            <ul className="py-2">
              {draft.map((step, i) => (
                <li
                  key={step.key}
                  draggable
                  onDragStart={() => { dragFrom.current = i; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom.current !== null) move(dragFrom.current, i);
                    dragFrom.current = null;
                  }}
                  className="flex items-center gap-2 py-1.5"
                >
                  {/* Focusable and keyboard-operable, not decoration. Drag is
                      the only way to reorder in the design being matched, which
                      leaves anyone not using a mouse unable to reorder at all —
                      and a button that looks interactive but does nothing when
                      pressed reads as broken to everyone. */}
                  <button
                    type="button"
                    aria-label={`Move ${step.name || 'step'}. Use the arrow keys to reorder.`}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp')   { e.preventDefault(); move(i, i - 1); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
                    }}
                    className="cursor-grab p-1 text-muted hover:text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <input
                    value={step.name}
                    onChange={(e) => rename(step.key, e.target.value)}
                    placeholder="Step name"
                    maxLength={60}
                    className="flex-1 rounded-button border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  <button
                    type="button"
                    onClick={() => remove(step.key)}
                    aria-label={`Remove ${step.name || 'step'}`}
                    className="p-2 text-muted hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={add}
              className="flex items-center gap-2 py-2 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a step
            </button>

            <div className="border-t border-border" />
            {last && lockedRow(last.name)}

            {error && <p className="pt-2 text-sm text-error">{error}</p>}
          </div>

          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <button type="button" onClick={onClose} className="text-sm font-medium text-muted hover:text-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
