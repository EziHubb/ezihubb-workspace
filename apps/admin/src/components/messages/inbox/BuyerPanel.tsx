'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Plus } from 'lucide-react';
import { fmtAmount, fmtDate } from '@ezihubb/utils';
import { Avatar } from './Avatar';
import { LABEL_CHIP, type BuyerPanel as BuyerPanelData, type ConversationLabel } from './types';

/**
 * Who the shop is talking to.
 *
 * Everything here is private to the shop. The note especially: it is about the
 * buyer, follows them across every thread, and is never shown to them.
 */

/**
 * Every OrderStatus, not the five the store-detail page happens to colour.
 * A status with no entry falls through to neutral grey, which reads as "no
 * information" — the wrong thing to say about an order that was REFUNDED.
 */
const ORDER_STATUS_CHIP: Record<string, string> = {
  PENDING_PAYMENT:  'bg-gray-100 text-gray-600',
  CONFIRMED:        'bg-blue-100 text-blue-700',
  IN_PRODUCTION:    'bg-amber-100 text-amber-700',
  SHIPPED:          'bg-purple-100 text-purple-700',
  DELIVERED:        'bg-green-100 text-green-700',
  COMPLETED:        'bg-green-100 text-green-700',
  CANCELLED:        'bg-red-100 text-red-700',
  REFUND_REQUESTED: 'bg-orange-100 text-orange-700',
  REFUNDED:         'bg-orange-100 text-orange-700',
  DISPUTED:         'bg-red-100 text-red-700',
};

/** How many order rows show before "Show all". */
const ORDERS_COLLAPSED = 3;

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
  const [allOrders, setAllOrders] = useState(false);

  // Reset when the panel switches buyer, otherwise one buyer's half-typed note
  // appears under the next one's name.
  useEffect(() => {
    setDraft(buyer?.note ?? '');
    setEditing(false);
    setPicking(false);
    setAllOrders(false);
  }, [buyer?.buyerKey, buyer?.note]);

  if (!buyer) return null;

  const assigned = new Set(labels.map((l) => l.id));
  // Defensive: this panel is rendered from cached API data, and a client left
  // open across the deploy that added `orders` still holds a payload without
  // it. `.map` on undefined would blank the whole thread, not just this list.
  const orders  = buyer.orders ?? [];
  const shown   = allOrders ? orders : orders.slice(0, ORDERS_COLLAPSED);
  // The buyer's real total. Falls back to what was actually sent so a cached
  // payload from before this field existed still counts what it can see.
  const total   = buyer.orderCount ?? orders.length;

  return (
    // Shown from xl up. It was 2xl while the list still shared this row and
    // 288px here came straight out of the conversation; now the list steps
    // aside when a thread opens, so the space is there. Still hidden on a
    // genuinely narrow window, where the thread needs every pixel — nothing
    // here is unavailable elsewhere, the buyer's name and note also being on
    // the thread and the order.
    <aside
      className="hidden w-72 shrink-0 space-y-5 border-l border-border px-5 py-5 text-sm xl:block"
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

      {buyer.isFirstContact && (
        <p className="text-muted">This buyer hasn&apos;t messaged you before</p>
      )}

      {/* ── Orders ────────────────────────────────────────────────────────────
          There is one thread per buyer now, so "which order is this about?"
          has no single answer — it is this list. Each row goes to the order,
          so a seller answering "where is my parcel?" is one click from the
          tracking rather than hunting the Orders page for a number the buyer
          may not have quoted. */}
      <section>
        <h3 className="mb-2 font-semibold text-secondary">
          Orders{total > 0 && ` (${total})`}
        </h3>

        {orders.length === 0 ? (
          <p className="text-muted">No orders with your shop yet.</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {shown.map((o) => (
                <li key={o.storeOrderId}>
                  <Link
                    href={`/orders/${o.orderId}`}
                    className="block rounded-button border border-border px-2.5 py-2 hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-medium text-secondary">
                        {o.orderNumber}
                      </span>
                      <span
                        className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${
                          ORDER_STATUS_CHIP[o.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {fmtDate(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} · {fmtAmount(o.total)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {orders.length > ORDERS_COLLAPSED && (
              <button
                type="button"
                onClick={() => setAllOrders((v) => !v)}
                aria-expanded={allOrders}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                {allOrders ? 'Show less' : `Show ${orders.length - ORDERS_COLLAPSED} more`}
              </button>
            )}

            {/* Said out loud rather than left as a silent truncation, so a
                seller looking at ten rows under a heading that says forty is
                not left wondering where the other thirty went. */}
            {total > orders.length && allOrders && (
              <p className="mt-2 text-xs text-muted">
                Showing the {orders.length} most recent.
              </p>
            )}
          </>
        )}
      </section>

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
