'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { MessageAttachments } from './MessageAttachments';
import { LinkPreviewCard } from './LinkPreviewCard';
import type { AttachedProduct, ConversationDetail, ThreadMessage } from './types';
import { buyerNameOf } from './types';
import { firstLinkIn } from '@ezihubb/utils';

/**
 * One conversation, oldest message first.
 *
 * Messages are grouped under the day they were sent. Grouped here rather than
 * server-side for the same reason the orders queue is: a page boundary through
 * the middle of a day would otherwise produce two headings for it.
 */

const dayKey = (iso: string) => new Date(iso).toDateString();

/** Mirrors MESSAGE_ATTACHMENT_MIMETYPES and MAX_MESSAGE_ATTACHMENTS on the
 *  API. Duplicated rather than shared because the server is the authority and
 *  this copy exists only to fail fast in the browser. */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf';
const MAX_ATTACHMENTS = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

function Bubble({ message, conversationId, buyerName, buyerAvatar, onDelete, viewerIsShop }: {
  message: ThreadMessage;
  conversationId: string;
  buyerName: string;
  /** The buyer's real picture. Avatar already supported it; only this caller
   *  never passed it, so every bubble fell back to initials. */
  buyerAvatar: string | null;
  /** Absent when unsending is not available — a platform-context admin
   *  reading someone else's shop, for instance. */
  onDelete?: (messageId: string) => void;
  /** False for a platform admin reading another shop's inbox — changes who
   *  an unsend is attributed to. */
  viewerIsShop: boolean;
}) {
  const fromShop = message.senderType === 'SHOP';
  // Only the first link gets a card. Five links in one message would otherwise
  // be five outbound fetches and a wall of cards taller than the thread.
  const link = message.deletedAt ? null : firstLinkIn(message.body);

  /**
   * An unsent message keeps its place in the thread.
   *
   * The body is not rendered, but the bubble stays: the buyer may already have
   * read it, and quietly closing the gap would rewrite a conversation they
   * were part of. Saying "unsent" is the honest version of deleting.
   */
  if (message.deletedAt) {
    return (
      <div className={`flex gap-2 ${fromShop ? 'flex-row-reverse' : ''}`}>
        {/* Holds the avatar's column so the pill lines up with the bubbles
            around it rather than sliding left into where the picture was. */}
        {!fromShop && <div className="h-7 w-7 shrink-0" aria-hidden="true" />}
        <div className={`max-w-[36rem] ${fromShop ? 'text-right' : ''}`}>
          {/* An outline pill, not a filled bubble. An unsend is a note
              about the conversation rather than part of it, and giving an
              absence the same solid shape as a real message makes it read as
              content. */}
          <span className="inline-block rounded-full border border-border px-4 py-2 text-left text-sm italic text-muted">
            {/* Only the shop can unsend, and only its own — so "you" is
                accurate wherever this can be triggered. A platform admin
                reading someone else's inbox gets the third person, because
                there it would not be. */}
            {viewerIsShop ? 'You unsent a message' : 'The shop unsent a message'}
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
        {/* Under the bubble, not inside it: the card is about the link rather
            than part of what was typed, and a preview that grew the bubble
            would make a one-line message look like a paragraph. */}
        {link && <LinkPreviewCard conversationId={conversationId} url={link} />}
        <p className={`mt-1 flex items-center gap-2 text-xs text-muted ${fromShop ? 'justify-end' : ''}`}>
          {/* Shop messages only, and only where a handler was supplied. The
              server enforces the same rule — a seller editing what the buyer
              wrote would be rewriting the other party's side of the record. */}
          {fromShop && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              // Revealed on hover rather than always shown: unsending is
              // rare and irreversible, and a delete button beside every line
              // invites the click it should discourage.
              className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-error"
            >
              Unsend
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
  onSend:       (body: string, attachmentUrls: string[]) => Promise<void>;
  /** Uploads the picked files and resolves to their public URLs. */
  onUpload:     (files: File[]) => Promise<{ name: string; url: string }[]>;
  /** Unsends one of the shop's own messages. Omitted where the viewer may
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
  conversation, sending, onSend, onUpload, onDeleteMessage,
  messages, hasMoreOlder, loadingOlder, onLoadOlder,
}: Props) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
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
   * Set by submit(), consumed by the layout effect that watches `messages`.
   *
   * A flag rather than a scroll call, because the two events are a render
   * apart: the send resolves, then the refetch arrives, then the list grows.
   */
  const stickToBottom = useRef(false);

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
    if (!pane) return;

    // Checked first: the two are mutually exclusive, and a reply sent while an
    // older page happened to be loading must still land at the bottom.
    if (stickToBottom.current) {
      stickToBottom.current = false;
      heightBeforeLoad.current = null;
      pane.scrollTop = pane.scrollHeight;
      return;
    }

    const before = heightBeforeLoad.current;
    if (before === null) return;
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

  /**
   * Mirrors the API's own limits, so the composer refuses a file rather than
   * letting the seller wait for a request that cannot succeed.
   *
   * The size check matters beyond politeness: multer enforces the same ceiling
   * by aborting mid-stream, and nothing maps its error to an HTTP status, so
   * an oversized file comes back as a bare 500.
   */
  const pickFiles = async (picked: FileList | null) => {
    if (!picked?.length) return;
    const files = Array.from(picked);
    if (fileInput.current) fileInput.current.value = '';

    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) {
      return setAttachError(
        room === 0
          ? `Up to ${MAX_ATTACHMENTS} files per message.`
          : `Only ${room} more file${room === 1 ? '' : 's'} can be attached.`,
      );
    }

    // Checked before any upload starts, so a bad second file does not leave
    // the first already uploaded and half the pick applied.
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) return setAttachError(`${tooBig.name} is over 10 MB.`);
    const wrongType = files.find((f) => !ALLOWED_TYPES.has(f.type));
    if (wrongType) return setAttachError(`${wrongType.name} is not an image or a PDF.`);

    setAttachError(null);
    setUploading(true);
    try {
      const uploaded = await onUpload(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setAttachError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const body = draft.trim();
    // Attachments alone are a message — a proof does not need a covering note.
    if ((!body && attachments.length === 0) || sending) return;
    // Cleared only after the send resolves, so a failure leaves the text in
    // the box to try again rather than losing what was typed.
    await onSend(body, attachments.map((a) => a.url));
    setDraft('');
    setAttachments([]);
    /**
     * Land on what was just sent.
     *
     * Armed rather than scrolled here: onSend resolves when the server has the
     * message, and the refetch that puts it in the list has not rendered yet —
     * scrolling now would move to the bottom of a thread that is still one
     * message short. The layout effect below fires once the list grows.
     */
    stickToBottom.current = true;
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
                  conversationId={conversation.id}
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

        {attachError && <p className="mt-2 text-xs text-error">{attachError}</p>}

        {/* Uploaded before the message is sent, so the seller sees each file
            land and a failed send does not take the upload with it. */}
        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li
                key={a.url}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-secondary"
              >
                <span className="max-w-[12rem] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
                  aria-label={`Remove ${a.name}`}
                  className="text-muted hover:text-error"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Send on its own row, the notice on the one below.
            Side by side they competed for the same line: the notice is a full
            sentence, so it wrapped to four or five lines and then ran under
            the button. Stacking costs one row and cannot collide at any
            width. */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => void pickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-secondary hover:bg-background disabled:opacity-50"
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Paperclip className="h-4 w-4" aria-hidden="true" />}
            {uploading ? 'Uploading…' : 'Attach'}
          </button>

          <button
            type="button"
            onClick={submit}
            // Attachments alone are a message. Requiring text as well would
            // make sending a proof mean typing something first.
            disabled={sending || uploading || (!draft.trim() && attachments.length === 0)}
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
