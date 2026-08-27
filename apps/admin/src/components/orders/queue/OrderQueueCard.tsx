'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  CalendarClock, ChevronDown, ChevronUp, CircleCheckBig, Copy, Gift,
  MessageSquare, MoreVertical, Printer, Tag, XCircle, Undo2,
} from 'lucide-react';
import { UpdateProgressMenu } from './UpdateProgressMenu';
import type { ProgressStep, QueueOrder } from './types';
import { CompleteOrderModal } from './CompleteOrderModal';
import { OrderStatusBadge } from '../OrderStatusBadge';

/**
 * One store order, as the seller works it.
 *
 * Two columns: what was bought on the left, where and by when it goes on the
 * right. The action rail sits outside both — it belongs to the order, not to
 * either half of it.
 */

/**
 * The left stripe per status.
 *
 * Deliberately the same colour family as OrderStatusBadge's chip, so the
 * stripe and the label never disagree about what a colour means. Anything
 * unmapped gets no stripe rather than a grey one — an unknown status should
 * look unknown, not resolved.
 */
const STATUS_ACCENT: Record<string, string> = {
  PENDING_PAYMENT:  'border-l-yellow-400',
  CONFIRMED:        'border-l-blue-400',
  IN_PRODUCTION:    'border-l-purple-400',
  SHIPPED:          'border-l-cyan-400',
  DELIVERED:        'border-l-teal-400',
  COMPLETED:        'border-l-green-500',
  CANCELLED:        'border-l-red-400',
  REFUND_REQUESTED: 'border-l-orange-400',
  REFUNDED:         'border-l-gray-400',
  DISPUTED:         'border-l-red-500',
};

interface Props {
  order:     QueueOrder;
  steps:     ProgressStep[];
  selected:  boolean;
  onSelect:  (checked: boolean) => void;
  /** Opens the detail panel over the queue. */
  onOpen:    () => void;
  /** The same panel, opened straight onto the buyer conversation. */
  onOpenMessages: () => void;
  onMoveToStep:   (stepId: string) => void;
  /** Fired once an order has been dispatched, so the queue can refetch. The
   *  modal talks to the API itself, so this is the only signal it can send. */
  onCompleted:    () => void;
  onEditShipBy:   () => void;
  onToggleGift:   () => void;
  onCancel:       () => void;
  onRefund:       () => void;
  onPrint:        () => void;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * next/image throws during render for a src that is neither absolute nor
 * root-relative, and a throw here takes the whole Orders page down with it.
 * Item images come from two sources — a stored product image and a generated
 * customisation preview — so one bad row should degrade to a placeholder, not
 * a blank screen.
 */
const isRenderableSrc = (url: string | null): url is string =>
  !!url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'));

/**
 * Renders the option map captured at order time.
 *
 * Empty values are skipped so no blank line appears where a choice was not
 * made. Non-primitive values are skipped too: `variantSnapshot` is untyped
 * JSON written by whatever built the order, and `String({})` would print
 * "[object Object]" on a seller's packing screen.
 */
function variantLines(snapshot: Record<string, unknown> | null): [string, string][] {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  return Object.entries(snapshot)
    .filter(([, v]) => (
      (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      && String(v).trim() !== ''
    ))
    .map(([k, v]) => [k, String(v)] as [string, string]);
}

export function OrderQueueCard({
  order, steps, selected, onSelect, onOpen, onOpenMessages,
  onMoveToStep,
  onCompleted, onEditShipBy, onToggleGift, onCancel, onRefund, onPrint,
}: Props) {
  const [showShipTo, setShowShipTo] = useState(true);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const overdue = order.shipByDate ? new Date(order.shipByDate) < new Date(new Date().toDateString()) : false;

  const copyAddress = async () => {
    const { name, address, city, state, zip, country } = order.shipTo;
    const text = [name, address, [city, state, zip].filter(Boolean).join(', '), country]
      .filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and refuses outright in some contexts.
      // The address is on screen either way, so a silent no-op beats an alert.
    }
  };

  return (
    // The stripe is for peripheral vision and the badge below is for certainty.
    // The queue rendered every order identically, so telling a cancelled order
    // from one waiting to ship meant opening each in turn.
    <div className={`flex flex-col gap-4 border-b border-l-4 border-border px-5 py-5 last:border-b-0 sm:flex-row ${STATUS_ACCENT[order.status] ?? 'border-l-transparent'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        aria-label={`Select order ${order.orderNumber}`}
        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
      />

      {/* ── What was bought ─────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {/* Buttons, not links: the order opens as a sheet over the queue, so
            the seller keeps their filters, scroll position and selection. The
            deep link to /orders/[id] is still in the panel itself, for anyone
            who needs to send one. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="text-sm font-semibold text-secondary underline underline-offset-2 hover:text-primary"
          >
            {order.buyer.name ?? 'Guest'}
          </button>
          {order.isGift && <Gift className="h-4 w-4 text-muted" aria-label="Marked as a gift" />}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={onOpen}
            className="text-muted underline underline-offset-2 hover:text-secondary"
          >
            #{order.orderNumber}
          </button>
          <span className="font-medium text-secondary">{money(order.total)}</span>
          {/* The label the stripe cannot give. A colour alone is a code the
              reader has to learn, and is invisible to anyone who cannot
              separate these hues. */}
          <OrderStatusBadge status={order.status} size="sm" />
        </div>

        {order.couponCode && (
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-secondary">
            <Tag className="h-4 w-4" aria-hidden="true" />
            <span>{order.couponCode}</span>
          </div>
        )}

        <ul className="mt-3 space-y-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              {isRenderableSrc(item.imageUrl) ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded bg-background" />
              )}

              <div className="min-w-0 text-sm">
                <p className="text-secondary">{item.name}</p>
                <dl className="mt-1 space-y-0.5 text-xs text-muted">
                  <div className="flex gap-1.5">
                    <dt>Quantity</dt>
                    <dd className="font-medium text-secondary">{item.quantity}</dd>
                  </div>
                  {item.sku && (
                    <div className="flex gap-1.5">
                      <dt>SKU</dt>
                      <dd className="font-medium text-secondary">{item.sku}</dd>
                    </div>
                  )}
                  {variantLines(item.variantSnapshot).map(([k, v]) => (
                    <div key={k} className="flex gap-1.5">
                      <dt>{k}</dt>
                      <dd className="font-medium text-secondary">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Where and by when ───────────────────────────────────────────── */}
      {/* Under the details on a narrow card rather than beside them: 256px
          held as shrink-0 left the item list almost nothing to occupy. */}
      <div className="w-full shrink-0 text-sm sm:w-64">
        <p className={`font-semibold ${overdue ? 'text-error' : 'text-secondary'}`}>
          Ship by {fmtDate(order.shipByDate) ?? 'no estimate'}
        </p>
        <p className="text-muted">Ordered {fmtDate(order.orderedAt)}</p>

        <p className="mt-3 text-muted">
          {order.shippingMethod ?? 'Standard'}{' '}
          <span className="text-secondary">({money(order.shippingCost)})</span>
        </p>

        <button
          type="button"
          onClick={() => setShowShipTo((v) => !v)}
          aria-expanded={showShipTo}
          className="mt-3 flex w-full items-center justify-between font-semibold text-secondary"
        >
          Ship to
          {showShipTo
            ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>

        {showShipTo && (
          <address className="mt-2 not-italic text-secondary">
            {order.shipTo.name && <div className="font-medium">{order.shipTo.name}</div>}
            {order.shipTo.address && <div>{order.shipTo.address}</div>}
            <div>{[order.shipTo.city, order.shipTo.state, order.shipTo.zip].filter(Boolean).join(', ')}</div>
            {order.shipTo.country && <div>{order.shipTo.country}</div>}
            <button
              type="button"
              onClick={copyAddress}
              className="mt-1.5 flex items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-secondary"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </address>
        )}

        {order.upgradeRequested && (
          <p className="mt-2 text-xs font-medium text-warning">Delivery upgrade requested</p>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="relative flex w-10 shrink-0 flex-col items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setCompleteOpen(true); setMenuOpen(false); setProgressOpen(false); }}
            title="Complete order"
            aria-label="Complete order"
            className="rounded-full p-1.5 text-secondary hover:bg-background"
          >
            <CircleCheckBig className="h-5 w-5" aria-hidden="true" />
          </button>
          {progressOpen && (
            <UpdateProgressMenu
              steps={steps}
              currentStepId={order.step?.id}
              onPick={(id) => { setProgressOpen(false); onMoveToStep(id); }}
              onClose={() => setProgressOpen(false)}
            />
          )}
        </div>

        {/* Dispatching is where the tracking number comes from, so this asks
            for it instead of silently advancing the status the way the check
            icon used to. */}
        {completeOpen && (
          <CompleteOrderModal
            order={{
              id:          order.id,
              orderNumber: order.orderNumber,
              buyerName:   order.buyer.name ?? 'Guest',
              itemCount:   order.items.length,
              total:       money(order.total),
            }}
            onClose={() => setCompleteOpen(false)}
            onDone={() => { setCompleteOpen(false); onCompleted(); }}
          />
        )}

        {/* A button, not a link to /messages?orderId=...
            That href was never handled: the inbox reads a folder, a search and
            a page from the URL and nothing else, so the parameter was dropped
            and the seller landed on an unfiltered inbox — the icon looked like
            it worked and went nowhere useful.

            The conversation already has a working home in the order panel,
            keyed on the same (orderId, storeId) row the inbox shows. Opening
            that beats teaching a second screen how to turn an order into a
            conversation, which would be a second way to create the same
            thread. */}
        <button
          type="button"
          onClick={onOpenMessages}
          title="Message buyer"
          aria-label="Message buyer"
          className="relative rounded-full p-1.5 text-secondary hover:bg-background"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
          {order.note && (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-error"
              aria-label="Has a note from the buyer"
            />
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setMenuOpen((v) => !v); setProgressOpen(false); }}
            aria-label="More actions"
            aria-haspopup="menu"
            className="rounded-full p-1.5 text-secondary hover:bg-background"
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              {/* Click-away layer. A transparent fixed sheet is enough here and
                  costs less than a listener per open menu on a long page. */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-surface py-2 shadow-lg">
                <MenuItem icon={Printer}       label="Print"               onClick={() => { setMenuOpen(false); onPrint(); }} />
                <MenuItem icon={CalendarClock} label="Update ship by date" onClick={() => { setMenuOpen(false); onEditShipBy(); }} />
                <MenuItem icon={Gift}          label={order.isGift ? 'Remove gift mark' : 'Mark as a gift'} onClick={() => { setMenuOpen(false); onToggleGift(); }} />
                <div className="my-1 border-t border-border" />
                <MenuItem icon={XCircle} label="Cancel order" danger onClick={() => { setMenuOpen(false); onCancel(); }} />
                <MenuItem icon={Undo2}   label="Refund"              onClick={() => { setMenuOpen(false); onRefund(); }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof Printer; label: string; onClick: () => void; danger?: boolean;
}) {
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
