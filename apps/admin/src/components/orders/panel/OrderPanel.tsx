'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock, Gift, Loader2, MoreHorizontal, Printer, Undo2, X, XCircle,
} from 'lucide-react';
import { API_ROUTES, newClientMessageId } from '@ezihubb/constants';
import { api } from '../../../lib/api-client';
import { toast } from '../../../lib/store/toast.store';
import { useDialog } from '../../../contexts/DialogContext';
import { OrderDetailsTab } from './OrderDetailsTab';
import { OrderEarningsTab } from './OrderEarningsTab';
import type { OrderPanelDetail, OrderPanelEarnings, OrderPanelThread } from './types';

/**
 * The order, as a sheet over the queue.
 *
 * Over the list rather than on its own route on purpose: working a queue is a
 * sequence of orders, and a full page navigation loses the scroll position,
 * the filters and the selection every time one is opened. `/orders/[id]`
 * still exists for a link someone was sent.
 */

interface Props {
  /** StoreOrder id — this shop's part of the order, never the Order id. */
  storeOrderId: string;
  /** Appended to every request; undefined for a shop owner, who is scoped
   *  server-side regardless of what they send. */
  storeQuery:   string;
  completeStepId: string | undefined;
  onClose:      () => void;
  onChanged:    () => void;
  onEditShipBy: (storeOrderId: string) => void;
  onToggleGift: (storeOrderId: string, isGift: boolean) => void;
  onCancel:     (orderId: string, orderNumber: string) => void;
  onRefund:     () => void;
  onPrint:      (orderId: string, orderNumber: string) => void;
  /**
   * Set when the panel was opened by the message icon rather than by the card
   * itself: the composer opens and scrolls into view instead of leaving the
   * seller at the top of the order.
   */
  focusMessaging?: boolean;
}

const QK = {
  detail:   (id: string) => ['order-panel', id] as const,
  earnings: (id: string) => ['order-panel-earnings', id] as const,
  thread:   (id: string) => ['order-panel-thread', id] as const,
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

/** The stages this control may show as its own value without lying. */
const STAGE_OPTIONS = ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'];
export function OrderPanel({
  storeOrderId, storeQuery, completeStepId,
  onClose, onChanged, onEditShipBy, onToggleGift, onCancel, onRefund, onPrint,
  focusMessaging,
}: Props) {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [tab, setTab]           = useState<'details' | 'earnings'>('details');
  const [menuOpen, setMenuOpen] = useState(false);

  // Read through a ref so the Escape listener does not have to be torn down
  // and rebound every time a dialog opens or closes.
  const dialogOpenRef = useRef(dialog.isOpen);
  dialogOpenRef.current = dialog.isOpen;

  // Escape closes. Bound to the document rather than the panel so it works
  // before anything inside has taken focus.
  //
  // Skipped while a dialog is up: DialogContext handles Escape on `window`
  // without preventDefault, so this handler sees the same keypress. Cancelling
  // a confirm — or the prompt that names a snippet — would otherwise close the
  // whole sheet underneath it and discard the message being written.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dialogOpenRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const detailQuery = useQuery({
    queryKey: QK.detail(storeOrderId),
    queryFn:  () => api.get<OrderPanelDetail>(`${API_ROUTES.ADMIN.ORDER_PANEL(storeOrderId)}${storeQuery}`),
  });

  const threadQuery = useQuery({
    queryKey: QK.thread(storeOrderId),
    queryFn:  () => api.get<OrderPanelThread>(`${API_ROUTES.ADMIN.ORDER_PANEL_MESSAGES(storeOrderId)}${storeQuery}`),
  });

  const earningsQuery = useQuery({
    queryKey: QK.earnings(storeOrderId),
    // Not fetched until the tab is opened: most of the time the seller is
    // packing an order, not auditing what it paid.
    enabled:  tab === 'earnings',
    queryFn:  () => api.get<OrderPanelEarnings>(`${API_ROUTES.ADMIN.ORDER_PANEL_EARNINGS(storeOrderId)}${storeQuery}`),
  });

  /**
   * Clears the buyer's unread messages once the panel has shown them.
   *
   * The panel and the Messages inbox render the same thread, so a message
   * demonstrably read here must not still count towards the inbox badge —
   * two places disagreeing about what has been read is how a seller learns to
   * distrust the number.
   *
   * Reuses the inbox's own route rather than adding a second way to mark a
   * thread read. Guarded by a ref so a refetch that re-delivers the same
   * conversation cannot fire it twice.
   */
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    const thread = threadQuery.data;
    if (!thread?.conversationId) return;
    if (markedRef.current === thread.conversationId) return;
    if (!thread.messages.some((m) => m.senderType === 'CUSTOMER' && !m.isRead)) return;

    markedRef.current = thread.conversationId;
    api.post(`${API_ROUTES.ADMIN.CONVERSATION_READ(thread.conversationId)}${storeQuery}`, {})
      .then(() => {
        qc.invalidateQueries({ queryKey: ['messages-list'] });
        qc.invalidateQueries({ queryKey: ['message-folders'] });
      })
      // Deliberately silent. Failing to clear a badge is not worth an error
      // toast over an order the seller is in the middle of working, and the
      // inbox still clears it the moment they open the thread there.
      .catch(() => { markedRef.current = null; });
  }, [threadQuery.data, storeQuery, qc]);

  const sendMessage = useMutation({
    mutationFn: (payload: { body: string; attachmentUrls: string[] }) =>
      api.post(`${API_ROUTES.ADMIN.ORDER_PANEL_MESSAGES(storeOrderId)}${storeQuery}`, {
        ...payload,
        // The same idempotency key every other send path uses — this endpoint
        // reaches MessagesService.sendMessage like the rest of them.
        clientMessageId: newClientMessageId(),
      }),
    onSuccess: () => {
      toast.success('Message sent');
      qc.invalidateQueries({ queryKey: QK.thread(storeOrderId) });
      // The inbox shows this exact thread — these are its own query keys from
      // the Messages page, so a reply sent here does not leave the inbox
      // showing the conversation as unanswered.
      qc.invalidateQueries({ queryKey: ['messages-list'] });
      qc.invalidateQueries({ queryKey: ['message-folders'] });
      qc.invalidateQueries({ queryKey: ['message-thread'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Not a mutation: the composer awaits the URLs and shows a chip per file, so
   * it needs the result in hand rather than through cache invalidation. The
   * api client strips its JSON content-type for a FormData body, which is what
   * lets multer see a multipart request at all.
   */
  const uploadAttachments = async (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return api.post<{ name: string; url: string }[]>(
      `${API_ROUTES.ADMIN.ORDER_PANEL_ATTACHMENTS(storeOrderId)}${storeQuery}`,
      form,
    );
  };

  const saveNote = useMutation({
    mutationFn: (note: string | null) =>
      api.patch(`${API_ROUTES.ADMIN.ORDER_PANEL_NOTE(storeOrderId)}${storeQuery}`, { note }),
    onSuccess: () => {
      toast.success('Note saved');
      qc.invalidateQueries({ queryKey: QK.detail(storeOrderId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeOrder = useMutation({
    mutationFn: () =>
      api.post(`${API_ROUTES.ADMIN.ORDER_PROGRESS_MOVE}${storeQuery}`, {
        storeOrderIds: [storeOrderId],
        stepId:        completeStepId,
      }),
    onSuccess: () => {
      toast.success('Order completed');
      qc.invalidateQueries({ queryKey: QK.detail(storeOrderId) });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * The buyer-facing stage, which nothing else in the seller's tools could
   * move. SHIPPED arrived from the dispatch form, DELIVERED from the carrier
   * webhook, COMPLETED from the step machine — and IN_PRODUCTION from
   * nowhere at all. Going backwards after a mistake was impossible.
   */
  const setOrderStatus = useMutation({
    // The id travels with the call rather than being asserted off the query
    // above it. A non-null assertion there would compile and then throw if
    // this were ever fired before the detail had loaded; this cannot be
    // called without an id at all.
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(API_ROUTES.ADMIN.ORDER_STATUS(orderId), { status }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: QK.detail(storeOrderId) });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detail = detailQuery.data;
  const isCompleted = detail?.step?.kind === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Click-away. Transparent rather than dimmed: the queue stays readable
          behind the sheet, which is how the seller keeps track of which order
          they are on. The close button lives in here, at the sheet's outside
          edge — positioned against this element, which is why it is relative. */}
      <div className="relative flex-1" onClick={onClose}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 hidden rounded-full p-2 text-muted hover:bg-surface hover:text-secondary lg:block"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={detail ? `Order from ${detail.buyer.name ?? 'Guest'}` : 'Order'}
        className="flex w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl"
      >
        <div className="px-6 py-6">
          {detailQuery.isLoading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading order…
            </div>
          ) : detailQuery.isError || !detail ? (
            <div className="py-16">
              <p className="text-sm text-error">
                Could not load this order. {(detailQuery.error as Error | null)?.message}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-full border border-border px-4 py-1.5 text-sm text-secondary"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* ── Header ────────────────────────────────────────────────── */}
              <header className="mb-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-secondary">
                      Order from {detail.buyer.name ?? 'Guest'}
                    </h2>
                    <p className="text-sm text-secondary">
                      {detail.shipByDate
                        ? `Dispatches by ${fmtDate(detail.shipByDate)}`
                        : 'No dispatch estimate set'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-full p-2 text-muted hover:bg-surface hover:text-secondary lg:hidden"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* The buyer-facing stage. Deliberately NOT offering
                      COMPLETED: that belongs to the step machine, and the
                      API refuses it here anyway, so listing it would be a
                      button that only ever errors.

                      SHIPPED is present but never selectable forward. The
                      dispatch form is what sets it, and that form also
                      stores the tracking number, registers the carrier
                      tracker and emails the buyer — none of which a bare
                      status write does. Offering it here would be a quiet
                      way to tell a buyer their parcel is moving with
                      nothing behind it. */}
                  <label className="sr-only" htmlFor="order-stage">Order stage</label>
                  <select
                    id="order-stage"
                    value={detail.orderStatus}
                    disabled={setOrderStatus.isPending}
                    onChange={(e) => setOrderStatus.mutate({ orderId: detail.orderId, status: e.target.value })}
                    className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  >
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PRODUCTION">In production</option>
                    <option value="SHIPPED" disabled={detail.orderStatus !== 'SHIPPED'}>
                      Shipped — use Mark as dispatched
                    </option>
                    <option value="DELIVERED">Delivered</option>
                    {/* Present so the control can show the truth when the
                        order is past this point, never as a choice. */}
                    {!STAGE_OPTIONS.includes(detail.orderStatus) && (
                      <option value={detail.orderStatus} disabled>
                        {detail.orderStatus}
                      </option>
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => completeOrder.mutate()}
                    // No completed step means the shop's pipeline has not
                    // loaded yet — the request would have nowhere to move to.
                    disabled={!completeStepId || isCompleted || completeOrder.isPending}
                    className="flex items-center gap-2 rounded-full bg-background px-6 py-2.5 text-sm font-medium text-secondary ring-1 ring-inset ring-border hover:bg-surface disabled:opacity-50"
                  >
                    {completeOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isCompleted ? 'Completed' : 'Complete order'}
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="More actions"
                      aria-haspopup="menu"
                      className="rounded-full p-2 text-secondary hover:bg-surface"
                    >
                      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div
                          role="menu"
                          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-card border border-border bg-surface py-2 shadow-lg"
                        >
                          <MenuItem
                            icon={Printer}
                            label="Print"
                            onClick={() => { setMenuOpen(false); onPrint(detail.orderId, detail.orderNumber); }}
                          />
                          <MenuItem
                            icon={CalendarClock}
                            label="Update dispatch by date"
                            onClick={() => { setMenuOpen(false); onEditShipBy(detail.id); }}
                          />
                          <MenuItem
                            icon={Gift}
                            label={detail.isGift ? 'Remove gift mark' : 'Mark as a gift'}
                            onClick={() => { setMenuOpen(false); onToggleGift(detail.id, !detail.isGift); }}
                          />
                          <div className="my-1 border-t border-border" />
                          <MenuItem
                            icon={XCircle}
                            label="Cancel order"
                            danger
                            onClick={() => { setMenuOpen(false); onCancel(detail.orderId, detail.orderNumber); }}
                          />
                          <MenuItem
                            icon={Undo2}
                            label="Refund"
                            onClick={() => { setMenuOpen(false); onRefund(); }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </header>

              {/* ── Tabs ──────────────────────────────────────────────────── */}
              <div className="mb-5 flex items-center gap-1 border-b border-border">
                <Tab label="Order details" active={tab === 'details'}  onClick={() => setTab('details')} />
                <Tab label="Earnings"      active={tab === 'earnings'} onClick={() => setTab('earnings')} />
              </div>

              {/* Hidden rather than unmounted. Switching to Earnings and back
                  used to throw away a half-written message and any file
                  already uploaded to it — the seller checks what an order paid
                  mid-reply all the time. Earnings stays conditional so its
                  request is still only made when the tab is opened. */}
              <div className={tab === 'details' ? undefined : 'hidden'}>
                <OrderDetailsTab
                  detail={detail}
                  thread={threadQuery.data}
                  threadLoading={threadQuery.isPending}
                  threadError={threadQuery.isError ? (threadQuery.error as Error).message : null}
                  sending={sendMessage.isPending}
                  savingNote={saveNote.isPending}
                  onSendMessage={(body, attachmentUrls) => sendMessage.mutate({ body, attachmentUrls })}
                  onSaveNote={(note) => saveNote.mutate(note)}
                  onUploadAttachments={uploadAttachments}
                  storeQuery={storeQuery}
                  autoOpenMessaging={focusMessaging}
                />
              </div>

              {tab === 'earnings' && (
                <OrderEarningsTab
                  data={earningsQuery.data}
                  // isPending, not isLoading: on the first switch the query has
                  // only just been enabled, and isLoading is briefly false with
                  // no data yet — which rendered "Could not load earnings" for
                  // a frame before the request had even been made.
                  loading={earningsQuery.isPending}
                  error={earningsQuery.isError ? (earningsQuery.error as Error).message : null}
                />
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`border-b-2 px-3 py-2.5 text-sm ${
        active
          ? 'border-secondary font-semibold text-secondary'
          : 'border-transparent text-muted hover:text-secondary'
      }`}
    >
      {label}
    </button>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: { icon: typeof Printer; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-background ${
        danger ? 'text-error' : 'text-secondary'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}
