'use client';

import { CornerUpLeft, Star } from 'lucide-react';
import { Avatar } from './Avatar';
import {
  LABEL_CHIP, buyerNameOf, relativeTime,
  type ConversationRow,
} from './types';

/**
 * The message list.
 *
 * One row per thread: pick, star, who, what they said, when, and two marks —
 * a dot when there is something unread and a return arrow when the shop has
 * already replied. Both come from the row's own data, so the list never has to
 * ask the server what it already knows.
 */

interface Props {
  rows:       ConversationRow[];
  selected:   Set<string>;
  activeId:   string | null;
  onSelect:   (id: string, checked: boolean) => void;
  onOpen:     (id: string) => void;
  onToggleStar: (row: ConversationRow) => void;
  /** Compact hides the preview column — used when a thread is open beside it. */
  compact?:   boolean;
}

export function ConversationList({
  rows, selected, activeId, onSelect, onOpen, onToggleStar, compact,
}: Props) {
  if (!rows.length) {
    return <p className="px-5 py-16 text-center text-sm text-muted">Nothing in this folder.</p>;
  }

  return (
    <ul>
      {rows.map((row) => {
        const name   = buyerNameOf(row);
        const unread = row.unreadByAdmin > 0;
        const active = row.id === activeId;

        return (
          <li
            key={row.id}
            className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
              active ? 'bg-background' : 'hover:bg-background/60'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              onChange={(e) => onSelect(row.id, e.target.checked)}
              aria-label={`Select conversation with ${name}`}
              className="h-4 w-4 shrink-0 rounded border-border"
            />

            <button
              type="button"
              onClick={() => onToggleStar(row)}
              aria-pressed={row.isStarred}
              aria-label={row.isStarred ? `Unstar ${name}` : `Star ${name}`}
              className="shrink-0 p-0.5 text-muted hover:text-warning"
            >
              <Star
                className={`h-4 w-4 ${row.isStarred ? 'fill-warning text-warning' : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* The row itself opens the thread. A button, not a div with a
                click handler, so the keyboard reaches it for free. */}
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <Avatar name={name} src={row.user?.avatarUrl} />

              <span className={`w-40 shrink-0 truncate text-sm ${unread ? 'font-semibold text-secondary' : 'text-secondary'}`}>
                {name}
              </span>

              {!compact && (
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${unread ? 'font-medium text-secondary' : 'text-muted'}`}>
                    {row.lastMessage ?? row.subject ?? 'No messages yet'}
                  </span>
                  {(row.labels.length > 0 || row.orderId) && (
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {row.orderId && (
                        <span className="rounded px-1.5 py-0.5 text-xs bg-warning/10 text-warning">
                          Order help
                        </span>
                      )}
                      {row.labels.map((l) => (
                        <span key={l.id} className={`rounded px-1.5 py-0.5 text-xs ${LABEL_CHIP[l.color]}`}>
                          {l.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
            </button>

            <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
              {relativeTime(row.lastMessageAt)}
              {unread
                ? <span className="h-2 w-2 rounded-full bg-error" aria-label="Unread" />
                : row.hasSellerReplied
                  ? <CornerUpLeft className="h-3.5 w-3.5" aria-label="You replied" />
                  : <span className="h-2 w-2" />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
