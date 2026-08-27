'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../../lib/api-client';
import { toast } from '../../../lib/store/toast.store';

/**
 * Completing an order, as a decision rather than a status flip.
 *
 * The check icon used to open a step picker, which moved the order along
 * without ever asking for the one thing the buyer is waiting for: a tracking
 * number. Dispatching is the moment that information exists, so it is the
 * moment to collect it — and the API behind this sets SHIPPED, stores the
 * tracking, registers the carrier tracker and emails the buyer in one call.
 */

/** Carriers the shop actually ships with. Free text would put typos into the
 *  tracking URL the buyer clicks. */
const CARRIERS = [
  'Vietnam Post',
  'Giao Hang Nhanh (GHN)',
  'Giao Hang Tiet Kiem (GHTK)',
  'Viettel Post',
  'J&T Express',
  'DHL',
  'FedEx',
  'UPS',
  'USPS',
] as const;

/** `yyyy-mm-dd` in the viewer's own timezone. `toISOString` would be UTC and
 *  can name yesterday for anyone east of it. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CompleteOrderModal({ order, onClose, onDone }: {
  order: { id: string; orderNumber: string; buyerName: string; itemCount: number; total: string };
  onClose: () => void;
  onDone:  () => void;
}) {
  const [dispatchedOn, setDispatchedOn] = useState(todayLocal());
  const [carrier, setCarrier]           = useState<string>(CARRIERS[0]);
  const [trackingNumber, setTracking]   = useState('');
  const [note, setNote]                 = useState('');
  const [noteOpen, setNoteOpen]         = useState(false);
  const [busy, setBusy]                 = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, busy]);

  const submit = async () => {
    if (!trackingNumber.trim() || busy) return;
    setBusy(true);
    try {
      await api.patch(API_ROUTES.ADMIN.ORDER_SHIP(order.id), {
        trackingNumber: trackingNumber.trim(),
        carrier,
        note: note.trim() || undefined,
        // Sent as an instant so the server stores a real point in time. The
        // input is a date, so it would otherwise arrive as midnight UTC and
        // read as the previous day for anyone ahead of it.
        dispatchedAt: new Date(`${dispatchedOn}T12:00:00`).toISOString(),
      });
      toast.success(`Order #${order.orderNumber} marked as dispatched`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark as dispatched"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            {/* Dispatched, not completed: this form takes a tracking number
                and a carrier and marks the order SHIPPED. Completing an order
                is moving it to the pipeline's final step, elsewhere. The old
                heading sent sellers looking for a finished order in a queue
                that had only just handed it to the courier. */}
            <h2 className="text-xl font-semibold text-secondary">Mark as dispatched</h2>
            <p className="mt-1 text-sm text-muted">
              Make sure the carrier receives any orders you plan to dispatch by your dispatch date
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-background disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="dispatch-date" className="block text-sm font-semibold text-secondary">
                Dispatch date
              </label>
              <p className="mb-2 text-xs text-muted">
                This is the date the carrier will receive your order(s)
              </p>
              <input
                id="dispatch-date"
                type="date"
                value={dispatchedOn}
                onChange={(e) => setDispatchedOn(e.target.value)}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-secondary">Note to buyer</p>
              <p className="mb-2 text-xs text-muted">
                We&apos;ll add this to the email that tells your buyer their order is dispatched.
              </p>
              {noteOpen ? (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Thanks for your order…"
                  className="w-full resize-none rounded-button border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="rounded-full bg-background px-4 py-2 text-sm font-medium text-secondary hover:bg-border/40"
                >
                  + Add note
                </button>
              )}
            </div>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-secondary">Order</h3>
          <p className="mb-3 text-sm text-muted">Add package details so buyers can track their order.</p>

          <div className="grid gap-4 rounded-card border border-border p-4 md:grid-cols-3">
            <div className="text-sm">
              <p className="font-medium text-secondary">{order.buyerName}</p>
              <p className="mt-1 text-muted">
                {order.itemCount} item{order.itemCount === 1 ? '' : 's'}, {order.total}
              </p>
            </div>

            <div>
              <label htmlFor="carrier" className="mb-1 block text-sm font-medium text-secondary">
                Delivery company <span className="text-error">*</span>
              </label>
              <select
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm"
              >
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="tracking" className="mb-1 block text-sm font-medium text-secondary">
                Tracking number <span className="text-error">*</span>
              </label>
              <input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Enter tracking number"
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {!trackingNumber.trim() && (
                <p className="mt-1 text-xs text-muted">This order doesn&apos;t have tracking</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm text-muted hover:text-secondary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            // Tracking is what the whole modal exists to collect, so the
            // button stays out of reach until there is one — rather than
            // accepting the click and failing on the server.
            disabled={busy || !trackingNumber.trim()}
            className="flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Saving…' : 'Mark as dispatched'}
          </button>
        </div>
      </div>
    </div>
  );
}
