'use client';

import { useState } from 'react';
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

function Bubble({ message, buyerName }: { message: ThreadMessage; buyerName: string }) {
  const fromShop = message.senderType === 'SHOP';

  return (
    <div className={`flex gap-2 ${fromShop ? 'flex-row-reverse' : ''}`}>
      {!fromShop && <Avatar name={buyerName} size={28} />}
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
        <p className="mt-1 text-xs text-muted">{timeLabel(message.createdAt)}</p>
      </div>
    </div>
  );
}

interface Props {
  conversation: ConversationDetail;
  sending:      boolean;
  onSend:       (body: string) => Promise<void>;
}

export function ThreadView({ conversation, sending, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const buyerName = buyerNameOf(conversation);

  const groups: { label: string; messages: ThreadMessage[] }[] = [];
  for (const m of conversation.messages) {
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
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {groups.map((g) => (
          <section key={g.label}>
            <h3 className="mb-4 text-center text-xs font-medium text-muted">{dayLabel(g.messages[0].createdAt)}</h3>
            <div className="space-y-4">
              {g.messages.map((m) => <Bubble key={m.id} message={m} buyerName={buyerName} />)}
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

        <div className="mt-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Messages are scanned for fraud and policy enforcement.
          </p>
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
      </div>
    </div>
  );
}
