'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Gift, Info, NotebookPen, Plus } from 'lucide-react';
import { Avatar } from '../../messages/inbox/Avatar';
import { OrderMessaging } from './OrderMessaging';
import { useAdminMode } from '../../../lib/store-context';
import type { OrderPanelDetail, OrderPanelThread, PanelItem } from './types';

/**
 * The panel's Order details tab: who it is for, where it goes, what is in it,
 * and what the buyer paid.
 */

const money = (n: number) => `$${n.toFixed(2)}`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    hour: '2-digit', minute: '2-digit', weekday: 'short',
    month: 'short', day: 'numeric', year: 'numeric',
  });

/**
 * A delivery window reads as one date when both ends land on the same day,
 * and drops the repeated month when they share one — "31 Aug – 11 Sept", not
 * "31 Aug 2026 – 11 Sept 2026".
 */
function fmtWindow(min: string, max: string): string {
  const a = new Date(min);
  const b = new Date(max);
  const day   = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const full  = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (a.toDateString() === b.toDateString()) return full(b);
  return `${day(a)} – ${full(b)}`;
}

/** next/image throws during render on a src that is neither absolute nor
 *  root-relative; one bad image must not take the panel down. */
const renderable = (url: string | null): url is string =>
  !!url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'));

interface Props {
  detail:      OrderPanelDetail;
  thread:      OrderPanelThread | undefined;
  threadLoading: boolean;
  threadError: string | null;
  sending:     boolean;
  savingNote:  boolean;
  onSendMessage: (body: string, attachmentUrls: string[]) => void;
  onSaveNote:    (note: string | null) => void;
  onUploadAttachments: (files: File[]) => Promise<{ name: string; url: string }[]>;
  /** Scopes the snippet library to the right shop. */
  storeQuery:  string;
  /** Opens the composer straight away — see OrderMessaging. */
  autoOpenMessaging?: boolean;
}

export function OrderDetailsTab({
  detail, thread, threadLoading, threadError, sending, savingNote,
  onSendMessage, onSaveNote, onUploadAttachments, storeQuery, autoOpenMessaging,
}: Props) {
  const { isPlatformContext } = useAdminMode();
  const buyerName = detail.buyer.name ?? 'Guest';

  return (
    <div className="space-y-4">
      {/* ── Meta ──────────────────────────────────────────────────────────── */}
      <div className="text-sm text-secondary">
        <p>
          <Link
            href={`/orders/${detail.orderId}`}
            className="underline underline-offset-2 hover:text-primary"
          >
            #{detail.orderNumber}
          </Link>
          {' · '}
          <span className="text-muted">{detail.shop.name}</span>
        </p>
        <p className="text-muted">Ordered {fmtDateTime(detail.orderedAt)}</p>
        <p>
          {detail.itemCount} item{detail.itemCount === 1 ? '' : 's'},{' '}
          <span className="font-medium">{money(detail.total)}</span>
        </p>
        {(detail.shipTo.city || detail.shipTo.state) && (
          <p className="text-muted">
            Deliver to {[detail.shipTo.city, detail.shipTo.state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      {/* ── Buyer ─────────────────────────────────────────────────────────── */}
      <section className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3.5">
        <Avatar name={buyerName} src={detail.buyer.avatarUrl} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-secondary">{buyerName}</p>
          {detail.buyer.email && (
            <p className="truncate text-xs text-muted">{detail.buyer.email}</p>
          )}
          {/* Only for an account. A guest has no order history to show, and a
              link that lands on an empty list is worse than no link.

              Platform context only: /customers is PLATFORM_ONLY, so offering
              it to a shop owner sends them to a page the route guard blocks
              and whose API would 403 anyway. They keep the name and email;
              they just are not handed a door that is locked. */}
          {detail.buyer.id && isPlatformContext ? (
            <Link
              href={`/customers/${detail.buyer.id}`}
              className="text-xs text-muted underline underline-offset-2 hover:text-secondary"
            >
              Order history
            </Link>
          ) : detail.buyer.id ? null : (
            <span className="text-xs text-muted">Guest checkout</span>
          )}
        </div>
        {detail.isGift && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-secondary">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" />
            Gift
          </span>
        )}
      </section>

      {detail.giftMessage && (
        <section className="rounded-card border border-border bg-surface px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Gift message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{detail.giftMessage}</p>
        </section>
      )}

      {detail.buyerNote && (
        <section className="rounded-card border border-border bg-surface px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Note from the buyer</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{detail.buyerNote}</p>
        </section>
      )}

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      {threadError ? (
        <p className="rounded-card border border-border bg-surface px-4 py-3.5 text-sm text-error">
          Could not load messages. {threadError}
        </p>
      ) : threadLoading ? (
        // Said out loud rather than falling through to the composer's empty
        // state: "No messages about this order yet" while the thread is still
        // in flight is a claim about the data, and it is often wrong.
        <p className="rounded-card border border-border bg-surface px-4 py-3.5 text-sm text-muted">
          Loading messages…
        </p>
      ) : (
        <OrderMessaging
          messages={thread?.messages ?? []}
          conversationId={thread?.conversationId ?? null}
          buyerName={buyerName}
          buyerAvatar={detail.buyer.avatarUrl}
          shopName={detail.shop.name}
          // The buyer's own view of the order on the storefront, not the
          // admin path — the seller is pasting this into a message the buyer
          // will click, and an /orders/... admin route would 404 for them.
          orderUrl={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/orders/${detail.orderNumber}`}
          sending={sending}
          onSend={onSendMessage}
          onUpload={onUploadAttachments}
          storeQuery={storeQuery}
          autoOpen={autoOpenMessaging}
        />
      )}

      {/* ── Private note ──────────────────────────────────────────────────── */}
      <PrivateNote value={detail.privateNote} saving={savingNote} onSave={onSaveNote} />

      {/* ── Delivery ──────────────────────────────────────────────────────── */}
      {detail.delivery.window && (
        <h3 className="pt-2 font-semibold text-secondary">
          Buyer expects delivery by:{' '}
          {fmtWindow(detail.delivery.window.min, detail.delivery.window.max)}
          {detail.delivery.window.source === 'profile' && (
            // Named so the seller knows whether they are repeating the
            // carrier's estimate or their own published one.
            <span className="ml-2 text-xs font-normal text-muted">from your delivery profile</span>
          )}
        </h3>
      )}

      <section className="grid gap-6 rounded-card border border-border bg-surface px-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Deliver to</p>
          <address className="mt-2 not-italic text-sm text-secondary">
            {detail.shipTo.name && <div className="font-medium">{detail.shipTo.name}</div>}
            {detail.shipTo.address && <div>{detail.shipTo.address}</div>}
            <div>{[detail.shipTo.city, detail.shipTo.state, detail.shipTo.zip].filter(Boolean).join(', ')}</div>
            {detail.shipTo.country && <div>{detail.shipTo.country}</div>}
            {detail.shipTo.phone && <div className="mt-1 text-muted">{detail.shipTo.phone}</div>}
          </address>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected by buyer</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-sm text-secondary">{detail.delivery.methodName ?? 'Standard delivery'}</span>
            <span className="text-sm text-secondary">{money(detail.delivery.cost)}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {detail.items.map((item) => (
              <li key={item.id} className="flex gap-2">
                <Thumb url={item.imageUrl} size={32} />
                <p className="min-w-0 flex-1 text-xs text-muted line-clamp-3">{item.name}</p>
                <span className="shrink-0 text-xs text-muted">Qty {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Items ─────────────────────────────────────────────────────────── */}
      <h3 className="pt-2 font-semibold text-secondary">
        {detail.items.length} Item{detail.items.length === 1 ? '' : 's'}
      </h3>
      <section className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="flex-1">Item</span>
          <span className="w-20 text-right">Quantity</span>
          <span className="w-24 text-right">Total</span>
        </div>
        {detail.items.map((item) => <ItemRow key={item.id} item={item} />)}
      </section>

      {/* ── Receipt ───────────────────────────────────────────────────────── */}
      <h3 className="pt-2 font-semibold text-secondary">Receipt #{detail.orderNumber}</h3>
      <section className="rounded-card border border-border bg-surface px-4 py-4">
        {!detail.receipt.paidAt && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Order request — online payment not collected</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                Contact the buyer through Messages or email to confirm availability, the final amount, and next steps before processing this order.
              </p>
            </div>
          </div>
        )}
        <ReceiptRow label="Item total" value={money(detail.receipt.itemTotal)} />
        {detail.receipt.discount > 0 && (
          <ReceiptRow
            label={detail.receipt.couponCode ? `Shop discount (${detail.receipt.couponCode})` : 'Shop discount'}
            value={`-${money(detail.receipt.discount)}`}
            negative
          />
        )}
        <ReceiptRow label="Subtotal" value={money(detail.receipt.subtotal)} divider strong />
        <ReceiptRow label="Postage price" value={money(detail.receipt.postage)} />
        {detail.receipt.shippingSubsidy > 0 && (
          <ReceiptRow
            label="Platform shipping support"
            value={`-${money(detail.receipt.shippingSubsidy)}`}
            negative
          />
        )}
        <ReceiptRow label="Order total" value={money(detail.receipt.total)} divider strong />
        {detail.receipt.paidAt && (
          <p className="mt-3 text-right text-xs text-muted">
            Paid{detail.receipt.paidVia ? ` via ${detail.receipt.paidVia}` : ''} on {fmtDate(detail.receipt.paidAt)}
          </p>
        )}
      </section>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Thumb({ url, size }: { url: string | null; size: number }) {
  if (!renderable(url)) {
    return <div className="shrink-0 rounded bg-background" style={{ width: size, height: size }} />;
  }
  return (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function ItemRow({ item }: { item: PanelItem }) {
  return (
    <div className="flex gap-4 border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex min-w-0 flex-1 gap-3">
        <Thumb url={item.imageUrl} size={48} />
        <div className="min-w-0">
          {/* The storefront listing, not an admin route. /products/<slug> does
              not exist in this app — the only admin product page is
              /products/[id]/edit, and this is a slug, not an id — so the old
              link 404'd on every row. Same shape ProductEditShell's "View"
              already uses; the locale prefix is added by the storefront's own
              middleware. */}
          {item.slug ? (
            <a
              href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/products/${item.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-secondary underline underline-offset-2 hover:text-primary"
            >
              {item.name}
            </a>
          ) : (
            <p className="text-sm font-medium text-secondary">{item.name}</p>
          )}

          {/* The id of the line itself — what support asks for when a buyer
              queries one item out of a multi-item order. */}
          <p className="mt-0.5 text-xs text-muted">Transaction ID: {item.id}</p>
          {item.sku && <p className="text-xs text-muted">SKU: {item.sku}</p>}
          {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}

          {item.personalization.length > 0 && (
            <dl className="mt-2 text-sm">
              {item.personalization.map((p) => (
                <div key={p.label} className="flex gap-1.5">
                  <dt className="font-semibold text-secondary">{p.label}:</dt>
                  <dd className="text-secondary">{p.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {item.files.length > 0 && (
            <>
              <p className="mt-2 text-sm font-semibold text-secondary">
                Files: {item.files.length}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {item.files.map((file) => (
                  <li
                    key={file.url}
                    className="flex items-center gap-3 rounded-card border border-border px-3 py-2"
                  >
                    {/* Only an own-storage file is fetched or linked. Anything
                        else is a buyer-supplied string, and loading it would
                        make this browser call an address they chose. */}
                    {file.isOwn ? (
                      <>
                        <Thumb url={file.url} size={40} />
                        <span className="min-w-0 flex-1 truncate text-xs text-secondary">{file.name}</span>
                        <a
                          href={file.url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Download ${file.name}`}
                          className="shrink-0 rounded-full p-1.5 text-muted hover:bg-background hover:text-secondary"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="h-10 w-10 shrink-0 rounded bg-background" />
                        <span className="min-w-0 flex-1 break-all text-xs text-muted">{file.url}</span>
                        <span className="shrink-0 text-xs text-muted">Not a stored file</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <span className="w-20 shrink-0 text-right text-sm text-secondary">{item.quantity}</span>
      <span className="w-24 shrink-0 text-right text-sm text-secondary">{money(item.lineTotal)}</span>
    </div>
  );
}

function ReceiptRow({
  label, value, negative, strong, divider,
}: { label: string; value: string; negative?: boolean; strong?: boolean; divider?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 ${divider ? 'mt-1 border-t border-border pt-2' : ''}`}>
      <span className={`text-sm ${strong ? 'font-semibold text-secondary' : 'text-secondary'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${
        negative ? 'text-error' : strong ? 'font-semibold text-secondary' : 'text-secondary'
      }`}>
        {value}
      </span>
    </div>
  );
}

/**
 * The seller's own note.
 *
 * Stored per store order, so on a basket split across shops one seller's note
 * stays invisible to the other — `Order.privateNote` is shared and would not
 * be.
 */
function PrivateNote({
  value, saving, onSave,
}: { value: string | null; saving: boolean; onSave: (note: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? '');

  const start = () => { setDraft(value ?? ''); setEditing(true); };

  const save = () => {
    onSave(draft.trim() || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <section className="rounded-card border border-border bg-surface px-4 py-3.5">
        <label className="sr-only" htmlFor="order-private-note">Your private note</label>
        <textarea
          id="order-private-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Only you can see this note"
          className="w-full resize-y rounded-card border border-border bg-surface px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="ml-auto rounded-full px-3 py-1.5 text-sm text-muted hover:text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-secondary px-5 py-1.5 text-sm font-medium text-surface disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3.5">
      <NotebookPen className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-secondary">
        {value ?? <span className="text-muted">Only you can see this note</span>}
      </p>
      <button
        type="button"
        onClick={start}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-secondary hover:bg-background"
      >
        {value ? 'Edit note' : <><Plus className="h-4 w-4" aria-hidden="true" /> Add a private note</>}
      </button>
    </section>
  );
}
