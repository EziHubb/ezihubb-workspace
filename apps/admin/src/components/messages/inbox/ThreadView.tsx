'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Send, ShieldCheck } from 'lucide-react';
import { Avatar } from './Avatar';
import type { AttachedProduct, ConversationDetail, ThreadMessage } from './types';
import { buyerNameOf } from './types';

/**
 * One conversation, oldest message first.
 *
 * Messages are grouped under the day they were sent. Grouped here rather than
 * server-side for the same reason the orders queue is: a page boundary through
 * the middle of a day would otherwise produce two headings for it.
 */

const dayKey = (iso: string) => new Date(iso).toDateString();

/** next/image throws during render on a src that is neither absolute nor
 *  root-relative, and a throw here would take the whole inbox down. */
const renderableSrc = (url: string): boolean =>
  url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');

/**
 * Images attached to a message.
 *
 * Each opens full size in a new tab: the thumbnail is enough to recognise a
 * design, not enough to approve one.
 */
function MessageAttachments({ urls }: { urls: string[] | undefined }) {
  const usable = (urls ?? []).filter(renderableSrc);
  if (!usable.length) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {usable.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Image
              src={url}
              alt="Attachment"
              width={80}
              height={80}
              className="h-20 w-20 rounded object-cover hover:opacity-80"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const renderable = (url: string | null): url is string =>
  !!url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'));

/** Turns bare URLs into links, escaping everything else by letting React
 *  render the segments as text rather than building an HTML string. */
function withLinks(body: string) {
  return body.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">{part}</a>
      : <span key={i}>{part}</span>,
  );
}

function ProductCard({ product }: { product: AttachedProduct }) {
  return (
    <Link
      href={`/products/${product.id}/edit`}
      className="mt-2 flex gap-3 rounded-card border border-border bg-surface p-2 hover:bg-background"
    >
      {renderable(product.imageUrl) ? (
        <Image src={product.imageUrl} alt="" width={72} height={72} className="h-18 w-18 rounded object-cover" style={{ width: 72, height: 72 }} />
      ) : (
        <div className="h-18 w-18 rounded bg-background" style={{ width: 72, height: 72 }} />
      )}
      <div className="min-w-0 text-sm">
        <p className="truncate text-secondary">{product.name}</p>
        <p className="mt-1 font-semibold text-success">${product.price.toFixed(2)}</p>
        {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
          <p className="text-xs text-muted line-through">${product.compareAtPrice.toFixed(2)}</p>
        )}
      </div>
    </Link>
  );
}

function Bubble({ message, buyerName, buyerAvatar, onDelete, viewerIsShop }: {
  message: ThreadMessage;
  buyerName: string;
  /** The buyer's real picture. Avatar already supported it; only this caller
   *  never passed it, so every bubble fell back to initials. */
  buyerAvatar: string | null;
  /** Absent when withdrawing is not available — a platform-context admin
   *  reading someone else's shop, for instance. */
  onDelete?: (messageId: string) => void;
  /** False for a platform admin reading another shop's inbox — changes who
   *  a withdrawal is attributed to. */
  viewerIsShop: boolean;
}) {
  const fromShop = message.senderType === 'SHOP';

  /**
   * A withdrawn message keeps its place in the thread.
   *
   * The body is not rendered, but the bubble stays: the buyer may already have
   * read it, and quietly closing the gap would rewrite a conversation they
   * were part of. Saying "withdrawn" is the honest version of deleting.
   */
  if (message.deletedAt) {
    return (
      <div className={`flex gap-2 ${fromShop ? 'flex-row-reverse' : ''}`}>
        {/* Holds the avatar's column so the pill lines up with the bubbles
            around it rather than sliding left into where the picture was. */}
        {!fromShop && <div className="h-7 w-7 shrink-0" aria-hidden="true" />}
        <div className={`max-w-[36rem] ${fromShop ? 'text-right' : ''}`}>
          {/* An outline pill, not a filled bubble. A withdrawal is a note
              about the conversation rather than part of it, and giving an
              absence the same solid shape as a real message makes it read as
              content. */}
          <span className="inline-block rounded-full border border-border px-4 py-2 text-left text-sm italic text-muted">
            {/* Only the shop can withdraw, and only its own — so "you" is
                accurate wherever this can be triggered. A platform admin
                reading someone else's inbox gets the third person, because
                there it would not be. */}
            {viewerIsShop ? 'You withdrew a message' : 'The shop withdrew a message'}
          </span>
          <p className="mt-1 text-xs text-muted">{timeLabel(message.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex gap-2 ${fromShop ? 'flex-row-reverse' : ''}`}>
      {!fromShop && <Avatar name={buyerName} src={buyerAvatar} size={28} />}
      <div className={`max-w-[36rem] ${fromShop ? 'text-right' : ''}`}>
        <div
          className={`inline-block rounded-card border px-4 py-3 text-left text-sm ${
            fromShop
              ? 'border-primary/20 bg-primary/5 text-secondary'
              : message.senderType === 'SYSTEM'
                ? 'border-border bg-background text-muted'
                : 'border-border bg-surface text-secondary'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{withLinks(message.body)}</p>
          {/* Images were carried on every message but never drawn here, so a
              design sent to a buyer for approval was visible to them and
              invisible to the seller who sent it. */}
          <MessageAttachments urls={message.attachmentUrls} />
          {message.attachedProduct && <ProductCard product={message.attachedProduct} />}
        </div>
        <p className={`mt-1 flex items-center gap-2 text-xs text-muted ${fromShop ? 'justify-end' : ''}`}>
          {/* Shop messages only, and only where a handler was supplied. The
              server enforces the same rule — a seller editing what the buyer
              wrote would be rewriting the other party's side of the record. */}
          {fromShop && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              // Revealed on hover rather than always shown: withdrawing is
              // rare and irreversible, and a delete button beside every line
              // invites the click it should discourage.
              className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-error"
            >
              Withdraw
            </button>
          )}
          <span>{timeLabel(message.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}

interface Props {
  conversation: ConversationDetail;
  sending:      boolean;
  onSend:       (body: string) => Promise<void>;
  /** Withdraws one of the shop's own messages. Omitted where the viewer may
   *  not write to this shop, which hides the control entirely. */
  onDeleteMessage?: (messageId: string) => void;
  /**
   * What to render, oldest first.
   *
   * Separate from `conversation.messages`, which is only the newest page: the
   * page above merges that with whatever older pages the reader has asked
   * for, and this is the result.
   */
  messages:     ThreadMessage[];
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder:  () => Promise<void>;
}

export function ThreadView({
  conversation, sending, onSend, onDeleteMessage,
  messages, hasMoreOlder, loadingOlder, onLoadOlder,
}: Props) {
  const [draft, setDraft] = useState('');
  const buyerName = buyerNameOf(conversation);
  const paneRef = useRef<HTMLDivElement>(null);

  /**
   * Opening a thread shows its end, not its beginning.
   *
   * Keyed on the conversation, not on how many messages there are: growing the
   * list is also what loading older ones does, and sharing a trigger would
   * answer "show me what came before" by throwing the reader back to the
   * bottom.
   */
  useEffect(() => {
    const pane = paneRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [conversation.id]);

  /**
   * Keeps the reader in place when a page is prepended.
   *
   * Content added above the viewport pushes everything below it down by
   * exactly the height added while the browser leaves scrollTop alone, so the
   * message being read jumps off screen. Adding the delta back puts it under
   * the same pixel. Measured before the fetch and applied before paint —
   * useEffect would be one frame late and the jump would be visible.
   */
  const heightBeforeLoad = useRef<number | null>(null);
  const loadOlder = async () => {
    heightBeforeLoad.current = paneRef.current?.scrollHeight ?? null;
    try {
      await onLoadOlder();
    } catch {
      heightBeforeLoad.current = null;
    }
  };
  useLayoutEffect(() => {
    const pane = paneRef.current;
    const before = heightBeforeLoad.current;
    if (!pane || before === null) return;
    heightBeforeLoad.current = null;
    pane.scrollTop += pane.scrollHeight - before;
  }, [messages]);

  const groups: { label: string; messages: ThreadMessage[] }[] = [];
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === key) last.messages.push(m);
    else groups.push({ label: key, messages: [m] });
  }

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    // Cleared only after the send resolves, so a failure leaves the text in
    // the box to try again rather than losing what was typed.
    await onSend(body);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={paneRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Explicit, not infinite scroll on reaching the top. Reaching the top
            is also what a hard flick does, and paging on that turns an
            overshoot into a fetch nobody asked for. */}
        {hasMoreOlder && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted hover:bg-background disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.label}>
            <h3 className="mb-4 text-center text-xs font-medium text-muted">{dayLabel(g.messages[0].createdAt)}</h3>
            <div className="space-y-4">
              {g.messages.map((m) => (
                <Bubble
                  key={m.id}
                  message={m}
                  buyerName={buyerName}
                  buyerAvatar={conversation.user?.avatarUrl ?? null}
                  onDelete={onDeleteMessage}
                  viewerIsShop={Boolean(onDeleteMessage)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-border px-6 py-4">
        <label className="sr-only" htmlFor="reply">Reply to {buyerName}</label>
        <textarea
          id="reply"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line — the convention every
            // messaging tool uses, so muscle memory works.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
          }}
          rows={3}
          placeholder="Type your reply"
          className="w-full rounded-card border border-border bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        {/* Send on its own row, the notice on the one below.
            Side by side they competed for the same line: the notice is a full
            sentence, so it wrapped to four or five lines and then ran under
            the button. Stacking costs one row and cannot collide at any
            width. */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={sending || !draft.trim()}
            className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>

        <div className="mt-2">
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Messages are scanned for fraud and policy enforcement.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
