'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, Clock, PowerOff } from 'lucide-react';
import type { AutoReply } from './types';

/**
 * The away-message control.
 *
 * The button states what is true right now rather than what it would do, so a
 * shop can tell at a glance whether buyers are getting an automatic reply.
 *
 * The weekly schedule the reference also offers is not built: the screenshot
 * never opens it, and guessing at office-hours semantics would put a guess in
 * front of sellers. It is listed as unavailable rather than hidden, so nobody
 * spends time looking for it.
 */

const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

/** Local noon — a plain date string parses as UTC midnight and renders as the
 *  previous day west of Greenwich. */
const toIso = (value: string) => new Date(`${value}T12:00:00`).toISOString();

const toDateInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface Props {
  value:  AutoReply;
  saving: boolean;
  onSave: (message: string, activeUntilIso: string | null) => Promise<void>;
}

export function AutoReplyMenu({ value, saving, onSave }: Props) {
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(value.message);
  const [until, setUntil]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return toDateInput(d);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMessage(value.message), [value.message]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setEditing(false); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const minDate = toDateInput(new Date(Date.now() + 86_400_000));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm font-medium text-secondary"
      >
        {value.isActive ? 'Auto-reply on' : 'Auto-reply off'}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-80 rounded-card border border-border bg-surface py-2 shadow-lg">
          <p className="flex items-center gap-2 px-4 py-2 text-sm text-muted">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {value.isActive
              ? `Auto-reply on until ${dateLabel(value.activeUntil)}`
              : 'Auto-reply is off'}
          </p>

          <div className="my-1 border-t border-border" />

          {value.isActive && (
            <button
              type="button"
              role="menuitem"
              disabled={saving}
              onClick={async () => { await onSave(value.message, null); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-secondary hover:bg-background disabled:opacity-50"
            >
              <PowerOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              Turn off temporary auto-reply
            </button>
          )}

          {!editing ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => setEditing(true)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-secondary hover:bg-background"
            >
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {value.isActive ? 'Change message or end date' : 'Set a temporary auto-reply'}
            </button>
          ) : (
            <div className="px-4 py-2">
              <label className="block text-xs font-medium text-secondary">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="We're away until next week — we'll reply as soon as we're back."
                className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <label className="mt-3 block text-xs font-medium text-secondary">On until</label>
              <input
                type="date"
                value={until}
                min={minDate}
                onChange={(e) => setUntil(e.target.value)}
                className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={saving || !message.trim()}
                  onClick={async () => { await onSave(message, toIso(until)); setEditing(false); setOpen(false); }}
                  className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Turn on'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="my-1 border-t border-border" />
          <p className="px-4 py-2 text-xs text-muted">
            Weekly auto-reply isn&apos;t available yet.
          </p>
        </div>
      )}
    </div>
  );
}
