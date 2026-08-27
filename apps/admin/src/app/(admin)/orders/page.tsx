'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CircleCheckBig, Pencil, Search, Loader2 } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { api, adminApi } from '../../../lib/api-client';
import { useAdminMode } from '../../../lib/store-context';
import { useDialog } from '../../../contexts/DialogContext';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { OrderQueueCard } from '../../../components/orders/queue/OrderQueueCard';
import { QueueFilters } from '../../../components/orders/queue/QueueFilters';
import { ProgressStepsModal } from '../../../components/orders/queue/ProgressStepsModal';
import { UpdateProgressMenu } from '../../../components/orders/queue/UpdateProgressMenu';
import { OrderPanel } from '../../../components/orders/panel/OrderPanel';
import {
  EMPTY_FILTERS,
  type ProgressStep,
  type QueueFilterState,
  type QueueOrder,
  type QueueResponse,
} from '../../../components/orders/queue/types';

/**
 * The seller's order queue.
 *
 * Tabs are the shop's own workflow steps, not order statuses. Cancellation and
 * refunds stay off the pipeline and live in each order's menu — a seller can
 * rename a step, and the record of a refund is not theirs to rename.
 *
 * SUPER_ADMIN in platform context has no shop of their own to show, so the
 * page asks them to pick one rather than merging every shop's steps into a
 * meaningless set of tabs.
 */

/**
 * The platform's pagination ceiling, from PaginationDto on the API side.
 *
 * Named here rather than written as a literal at each call site: the page-size
 *selector and the shop picker both have to stay under it, and a bare number
 * gives the next person nothing to check against.
 */
const MAX_PAGE_LIMIT = 48;

const QK = {
  steps:        (storeId?: string) => ['order-progress-steps', storeId] as const,
  queue:        (storeId: string | undefined, q: unknown) => ['order-queue', storeId, q] as const,
  destinations: (storeId?: string) => ['order-destinations', storeId] as const,
};

/**
 * Downloads the packing slip.
 *
 * Not `window.open` on the route: these constants are API paths, so the
 * browser would resolve them against the admin app's own origin and arrive
 * without the bearer token. Fetching as a blob goes through the same
 * authenticated client as everything else on the page.
 */
async function printPackingSlip(orderId: string, orderNumber: string, onError: (msg: string) => void) {
  try {
    const res  = await adminApi.get(API_ROUTES.ADMIN.ORDER_PACKING_SLIP(orderId), { responseType: 'blob' });
    const url  = URL.createObjectURL(res.data as Blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `packing-slip-${orderNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    onError((e as Error).message);
  }
}

/**
 * Ship-by dates are handled as calendar days in the viewer's own timezone.
 *
 * `new Date('2026-09-05')` is parsed as UTC midnight, which renders as the 4th
 * anywhere west of Greenwich — type a date, save it, watch the day before come
 * back. Anchoring at local noon keeps the intended day intact in every zone
 * and on both sides of a DST switch.
 */
const isoToDateInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dateInputToIso = (value: string) => new Date(`${value}T12:00:00`).toISOString();

/** Groups consecutive orders under one ship-by heading, the way the list reads
 *  when scrolled. Server-side sorting guarantees they arrive adjacent. */
function groupByShipBy(orders: QueueOrder[]): { label: string; orders: QueueOrder[] }[] {
  const groups: { label: string; orders: QueueOrder[] }[] = [];
  for (const order of orders) {
    const label = order.shipByDate
      ? `Ship by ${new Date(order.shipByDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'No ship-by estimate';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.orders.push(order);
    else groups.push({ label, orders: [order] });
  }
  return groups;
}

export default function OrdersPage() {
  const { isPlatformContext, isReady } = useAdminMode();
  const dialog = useDialog();
  const qc = useQueryClient();

  const [storeId,  setStoreId]  = useState<string>('');
  const [stepId,   setStepId]   = useState<string>('');
  const [filters,  setFilters]  = useState<QueueFilterState>(EMPTY_FILTERS);
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [limit,    setLimit]    = useState(24);
  const [sort,     setSort]     = useState<'shipBy' | 'newest' | 'oldest' | 'total'>('shipBy');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  /** StoreOrder id of the open detail panel, or null when none is. */
  const [panelId,      setPanelId]      = useState<string | null>(null);
  /** Whether the panel was opened by the message icon, which lands on the
   *  conversation rather than the top of the order. Always set alongside
   *  panelId so the two can never disagree about why the panel is open. */
  const [focusMessaging, setFocusMessaging] = useState(false);

  // A shop owner never sends storeId — the server ignores it for them anyway.
  const scope = isPlatformContext && storeId ? storeId : undefined;
  const canLoad = isReady && (!isPlatformContext || Boolean(storeId));

  const qs = (extra: Record<string, string | number | boolean | undefined> = {}) => {
    const p = new URLSearchParams();
    if (scope) p.set('storeId', scope);
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const stepsQuery = useQuery({
    queryKey: QK.steps(scope),
    enabled:  canLoad,
    queryFn:  () => api.get<ProgressStep[]>(`${API_ROUTES.ADMIN.ORDER_PROGRESS_STEPS}${qs()}`),
  });

  const destinationsQuery = useQuery({
    queryKey: QK.destinations(scope),
    enabled:  canLoad,
    queryFn:  () => api.get<{ country: string; count: number }[]>(
      `${API_ROUTES.ADMIN.ORDER_PROGRESS_DESTINATIONS}${qs()}`,
    ),
  });

  const queueParams = { stepId, page, limit, sort, search, ...filters };
  const queueQuery = useQuery({
    queryKey: QK.queue(scope, queueParams),
    enabled:  canLoad,
    queryFn:  () => api.get<QueueResponse>(
      `${API_ROUTES.ADMIN.ORDER_PROGRESS_QUEUE}${qs({
        stepId, page, limit, sort, search,
        shipBy:      filters.shipBy === 'all' ? undefined : filters.shipBy,
        destination: filters.destination,
        hasNote:          filters.hasNote,
        isGift:           filters.isGift,
        isPersonalized:   filters.isPersonalized,
        upgradeRequested: filters.upgradeRequested,
      })}`,
    ),
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['order-queue'] });
    qc.invalidateQueries({ queryKey: ['order-progress-steps'] });
    // Cancelling or completing changes which orders are in the queue, and the
    // destination counts are drawn from exactly that set.
    qc.invalidateQueries({ queryKey: ['order-destinations'] });
    // The detail panel can be open on an order this just moved — a bulk
    // "Complete order" over a selection that includes it, say. Left alone it
    // would keep offering to complete an order that is already done.
    qc.invalidateQueries({ queryKey: ['order-panel'] });
  };

  /**
   * Every change to what the list shows goes through here.
   *
   * Selection is by id and the bulk bar acts on whatever is in it — including
   * rows scrolled off, filtered out, or on another tab. Leaving a selection
   * behind after the view changes means the count reads one thing while
   * "Update progress" does another, which is how a seller moves orders they
   * cannot see. Page resets for the same reason: page 3 of the old filter is
   * rarely page 3 of the new one.
   */
  /** Same reasoning, but keeps the page number the caller asked for. */
  const goToPage = (next: number) => {
    setPage(next);
    setSelected(new Set());
    setBulkMenuOpen(false);
  };

  const changeView = (apply: () => void) => {
    apply();
    setPage(1);
    setSelected(new Set());
    setBulkMenuOpen(false);
  };

  const saveSteps = useMutation({
    mutationFn: (steps: { id?: string; name: string }[]) =>
      api.put(`${API_ROUTES.ADMIN.ORDER_PROGRESS_STEPS}${qs()}`, { steps }),
    onSuccess: () => { setEditorOpen(false); refetchAll(); },
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const moveOrders = useMutation({
    mutationFn: ({ ids, toStepId }: { ids: string[]; toStepId: string }) =>
      api.post(`${API_ROUTES.ADMIN.ORDER_PROGRESS_MOVE}${qs()}`, { storeOrderIds: ids, stepId: toStepId }),
    onSuccess: () => { setSelected(new Set()); refetchAll(); },
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const setShipBy = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string | null }) =>
      api.patch(`${API_ROUTES.ADMIN.ORDER_PROGRESS_SHIP_BY(id)}${qs()}`, { shipByDate: date }),
    onSuccess: refetchAll,
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const setGift = useMutation({
    mutationFn: ({ id, isGift }: { id: string; isGift: boolean }) =>
      api.patch(`${API_ROUTES.ADMIN.ORDER_PROGRESS_GIFT(id)}${qs()}`, { isGift }),
    onSuccess: refetchAll,
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const steps   = useMemo(() => stepsQuery.data ?? [], [stepsQuery.data]);
  const orders  = queueQuery.data?.data ?? [];
  const groups  = useMemo(() => groupByShipBy(orders), [orders]);
  const totalPages = queueQuery.data?.pagination.totalPages ?? 1;

  /** The end of the pipeline. Undefined until the steps have loaded, which is
   *  what disables "Complete order" rather than firing a move with no target. */
  const completeStepId = steps.find((s) => s.kind === 'COMPLETED')?.id;

  const allOnPageSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));

  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of orders) { if (allOnPageSelected) next.delete(o.id); else next.add(o.id); }
      return next;
    });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const selectGroup = (groupOrders: QueueOrder[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = groupOrders.every((o) => next.has(o.id));
      for (const o of groupOrders) { if (allOn) next.delete(o.id); else next.add(o.id); }
      return next;
    });

  const editShipBy = async (order: QueueOrder) => {
    const current = order.shipByDate ? isoToDateInput(order.shipByDate) : '';
    const answer = await dialog.prompt(
      'Ship by date — use YYYY-MM-DD, or leave it empty to clear the estimate.',
      { title: 'Update ship by date', defaultValue: current, placeholder: 'YYYY-MM-DD' },
    );
    if (answer === null) return;
    const trimmed = answer.trim();
    if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return dialog.alert('Enter the date as YYYY-MM-DD.');
    }
    setShipBy.mutate({ id: order.id, date: trimmed ? dateInputToIso(trimmed) : null });
  };

  const cancelOrder = async (order: QueueOrder) => {
    const ok = await dialog.confirm(
      `Cancel order #${order.orderNumber}? The buyer is notified, and this cannot be undone from here.`,
      { title: 'Cancel order', confirmLabel: 'Cancel order', destructive: true },
    );
    if (!ok) return;
    try {
      await api.post(API_ROUTES.ADMIN.ORDER_CANCEL(order.orderId), {});
      refetchAll();
    } catch (e) {
      dialog.alert((e as Error).message);
    }
  };

  if (!isReady) {
    return <div className="p-8 text-sm text-muted">Loading…</div>;
  }

  if (isPlatformContext && !storeId) {
    return (
      <div className="p-8">
        <AdminPageHeader title="Orders" subtitle="Pick a shop to see its order queue" />
        <StorePicker onPick={setStoreId} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <AdminPageHeader title="Orders" />
        <label className="relative w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <span className="sr-only">Search your orders</span>
          <input
            value={search}
            onChange={(e) => changeView(() => setSearch(e.target.value))}
            placeholder="Search your orders"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      {/* ── Bulk bar ─────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-3">
        {/* Sort and page size sit here rather than in the filter rail: they
            change how the same set of orders is presented, not which orders
            are in it. */}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Sort by
          <select
            value={sort}
            onChange={(e) => changeView(() => setSort(e.target.value as typeof sort))}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="shipBy">Ship by date</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total">Order total</option>
          </select>
        </label>

        <select
          value={limit}
          aria-label="Orders per page"
          onChange={(e) => changeView(() => setLimit(Number(e.target.value)))}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {[12, 24, MAX_PAGE_LIMIT].map((n) => (
            <option key={n} value={n}>{n} orders per page</option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-secondary">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={toggleAllOnPage}
            disabled={orders.length === 0}
            aria-label="Select every order on this page"
            className="h-4 w-4 rounded border-border"
          />
          {selected.size}
        </label>

        <button
          type="button"
          disabled={selected.size === 0 || !completeStepId || moveOrders.isPending}
          onClick={() => completeStepId && moveOrders.mutate({ ids: [...selected], toStepId: completeStepId })}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-secondary disabled:opacity-50"
        >
          <CircleCheckBig className="h-4 w-4" aria-hidden="true" />
          Complete order
        </button>

        {/* The remaining steps live behind this rather than beside "Complete
            order": completing is the move a seller makes all day, and the rest
            are the exceptions. */}
        <div className="relative">
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setBulkMenuOpen((v) => !v)}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm text-secondary disabled:opacity-50"
          >
            More actions
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          {bulkMenuOpen && selected.size > 0 && (
            <UpdateProgressMenu
              steps={steps}
              align="left"
              onPick={(toStepId) => {
                setBulkMenuOpen(false);
                moveOrders.mutate({ ids: [...selected], toStepId });
              }}
              onClose={() => setBulkMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── Pipeline tabs ────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        <TabButton label="All" count={undefined} active={stepId === ''} onClick={() => changeView(() => setStepId(''))} />
        {steps.map((s) => (
          <TabButton
            key={s.id}
            label={s.name}
            count={s.orderCount}
            active={stepId === s.id}
            onClick={() => changeView(() => setStepId(s.id))}
          />
        ))}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          aria-label="Customise progress steps"
          className="ml-2 rounded-full p-1.5 text-muted hover:bg-background hover:text-secondary"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Stacked below lg, side by side above. The orders come first in the
          DOM, so on a phone they stay first and the filters fall underneath
          rather than pushing the list off the bottom of the screen. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="min-w-0 flex-1">
          {queueQuery.isLoading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading orders…
            </div>
          ) : queueQuery.isError ? (
            <p className="py-16 text-sm text-error">Could not load orders. {(queueQuery.error as Error).message}</p>
          ) : groups.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No orders match these filters.</p>
          ) : (
            groups.map((group, gi) => (
              <section key={`${group.label}-${gi}`} className="mb-6 overflow-hidden rounded-card border border-border bg-surface">
                <header className="flex items-center gap-3 bg-background px-5 py-3">
                  <h2 className="text-sm font-semibold text-secondary">{group.label}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{group.orders.length}</span>
                  <button
                    type="button"
                    onClick={() => selectGroup(group.orders)}
                    className="text-sm text-muted underline underline-offset-2 hover:text-secondary"
                  >
                    Select all
                  </button>
                </header>

                {group.orders.map((order) => (
                  <OrderQueueCard
                    key={order.id}
                    order={order}
                    steps={steps}
                    selected={selected.has(order.id)}
                    onSelect={(on) => toggle(order.id, on)}
                    onOpen={() => { setPanelId(order.id); setFocusMessaging(false); }}
                    onOpenMessages={() => { setPanelId(order.id); setFocusMessaging(true); }}
                    onMoveToStep={(toStepId) => moveOrders.mutate({ ids: [order.id], toStepId })}
                    onCompleted={() => { setSelected(new Set()); refetchAll(); }}
                    onEditShipBy={() => editShipBy(order)}
                    onToggleGift={() => setGift.mutate({ id: order.id, isGift: !order.isGift })}
                    onCancel={() => cancelOrder(order)}
                    onRefund={() => dialog.alert('Refunds are issued from the order page.')}
                    onPrint={() => printPackingSlip(order.orderId, order.orderNumber, dialog.alert)}
                  />
                ))}
              </section>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-muted">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <QueueFilters
          value={filters}
          destinations={destinationsQuery.data ?? []}
          onChange={(next) => changeView(() => setFilters(next))}
        />
      </div>

      {panelId && (
        <OrderPanel
          // Keyed on the id so opening a different order remounts rather than
          // showing the previous order's tab and scroll position while the new
          // one loads.
          key={panelId}
          storeOrderId={panelId}
          storeQuery={qs()}
          completeStepId={completeStepId}
          focusMessaging={focusMessaging}
          onClose={() => { setPanelId(null); setFocusMessaging(false); }}
          onChanged={refetchAll}
          // Both look the order up in the current page of the queue, because
          // both reuse the list's own handlers. The order can be missing —
          // the list refetches while the panel stays open, and a filter or
          // page change can drop it. Saying so beats a button that does
          // nothing: an earlier version of this returned silently.
          onEditShipBy={(id) => {
            const target = orders.find((o) => o.id === id);
            if (target) void editShipBy(target);
            else void dialog.alert('This order is no longer in the list below — clear the filters to edit its dispatch date.');
          }}
          onToggleGift={(id, isGift) => setGift.mutate({ id, isGift })}
          onCancel={(orderId, orderNumber) => {
            const target = orders.find((o) => o.orderId === orderId);
            if (target) void cancelOrder(target);
            else void dialog.alert(`Order #${orderNumber} is no longer in the list below — clear the filters to cancel it.`);
          }}
          onRefund={() => dialog.alert('Refunds are issued from the order page.')}
          onPrint={(orderId, orderNumber) => printPackingSlip(orderId, orderNumber, dialog.alert)}
        />
      )}

      {editorOpen && (
        <ProgressStepsModal
          steps={steps}
          saving={saveSteps.isPending}
          onClose={() => setEditorOpen(false)}
          onSave={async (next) => { await saveSteps.mutateAsync(next); }}
        />
      )}
    </div>
  );
}

function TabButton({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${
        active
          ? 'border-secondary font-semibold text-secondary'
          : 'border-transparent text-muted hover:text-secondary'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && <span className="text-xs text-muted">{count}</span>}
    </button>
  );
}

/**
 * SUPER_ADMIN store chooser. A pipeline belongs to one shop, so the queue
 * cannot render until one is named.
 *
 * `limit` is the platform ceiling from PaginationDto, not a number picked to
 * feel large. Asking for more is rejected outright — this asked for 100 and
 * got a validation error, which the page then reported as "No shops yet":
 * a failed request and an empty list looked identical.
 */
function StorePicker({ onPick }: { onPick: (id: string) => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stores-for-order-queue'],
    queryFn:  () => api.get<{
      data: { id: string; name: string }[];
      pagination?: { total: number };
    }>(`${API_ROUTES.ADMIN.STORES}?limit=${MAX_PAGE_LIMIT}`),
  });

  if (isLoading) return <p className="mt-6 text-sm text-muted">Loading shops…</p>;

  // Distinct from the empty case on purpose. Reporting a broken request as
  // "no shops" sends someone looking for missing data instead of a bug.
  if (isError) {
    return <p className="mt-6 text-sm text-error">Could not load shops. {(error as Error).message}</p>;
  }

  const stores = data?.data ?? [];
  if (!stores.length) return <p className="mt-6 text-sm text-muted">No shops yet.</p>;

  const total = data?.pagination?.total ?? stores.length;

  return (
    <ul className="mt-6 max-w-md divide-y divide-border rounded-card border border-border bg-surface">
      {stores.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onPick(s.id)}
            className="w-full px-4 py-3 text-left text-sm text-secondary hover:bg-background"
          >
            {s.name}
          </button>
        </li>
      ))}
      {total > stores.length && (
        // Said out loud rather than silently truncated: a SUPER_ADMIN looking
        // for a shop that is not listed needs to know the list is partial.
        <li className="px-4 py-3 text-xs text-muted">
          Showing the first {stores.length} of {total} shops.
        </li>
      )}
    </ul>
  );
}
