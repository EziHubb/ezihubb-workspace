'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { MessageAttachments } from './MessageAttachments';
import { LinkPreviewCard, useLinkPreview } from './LinkPreviewCard';
import type { AttachedProduct, ConversationDetail, ThreadMessage } from './types';
import { buyerNameOf } from './types';
import { firstLinkIn, isOnlyLink } from '@ezihubb/utils';
import { TypingIndicator } from '@ezihubb/ui';
import { useTyping } from '../../../lib/realtime';

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
   * A message that is nothing but a link becomes the card alone.
   *
   * The address and the card said the same thing twice, and the address was
   * the half that broke the layout: a hundred unbroken characters is what a
   * product URL looks like. Held until the preview actually arrives, so a
   * link that turns out to have no card still shows the link.
   */
  const { data: preview } = useLinkPreview(conversationId, link);
  // Attachments and the product card live inside the bubble, so dropping it
  // would take them with it — a message can be a bare link AND carry a file.
  const cardReplacesBody =
    !!preview && isOnlyLink(message.body, link)
    && !message.attachmentUrls?.length && !message.attachedProduct;

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
        {/* The real picture, not a spacer.
            It was a blank of the same size, which lined the pill up correctly
            and lost the one thing the row still has to say: who this was
            from. A message being unsent does not make it anonymous. */}
        {!fromShop && <Avatar name={buyerName} src={buyerAvatar} size={28} />}
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
      <div className={`min-w-0 max-w-[36rem] ${fromShop ? 'text-right' : ''}`}>
        {/* The bubble goes away entirely when the card has replaced its text.
            Keeping it would leave a bordered shape holding nothing, floating
            above the card it was meant to introduce. */}
        {!cardReplacesBody && (
          <div
            className={`inline-block max-w-full rounded-card border px-4 py-3 text-left text-sm ${
              fromShop
                ? 'border-primary/20 bg-primary/5 text-secondary'
                : message.senderType === 'SYSTEM'
                  ? 'border-border bg-background text-muted'
                  : 'border-border bg-surface text-secondary'
            }`}
          >
            {/* [overflow-wrap:anywhere], not break-words. They look alike and
                differ in the one way that matters here: break-word leaves the
                element's min-content width at the full length of the longest
                unbreakable run, so a bare URL still forced this column wide
                enough to push the whole thread sideways. anywhere lets the
                break count toward min-content, which is what stops it. */}
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{withLinks(message.body)}</p>
            {/* Images were carried on every message but never drawn here, so a
                design sent to a buyer for approval was visible to them and
                invisible to the seller who sent it. */}
            <MessageAttachments urls={message.attachmentUrls} />
            {message.attachedProduct && <ProductCard product={message.attachedProduct} />}
          </div>
        )}
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
          <span className="whitespace-nowrap">
            {timeLabel(message.createdAt)}
            {/* Shop messages only. A tick on the buyer's own message would
                be telling the seller that the seller has read it, which is
                something they can see by looking at it.

                Live without a refetch of its own: markCustomerRead emits a
                read receipt, useConversationStream routes it through the
                same callback as a new message, and the window that comes
                back replaces this row by id in the merge map. */}
            {fromShop && message.isRead && (
              <>
                <span className="ml-1" aria-hidden="true">✓✓</span>
                {/* The glyph alone says nothing to a screen reader, and a
                    title attribute is not read out either. */}
                <span className="sr-only">Seen by the buyer</span>
              </>
            )}
          </span>
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
  /**
   * The newest message is on screen — the reader is at the foot of the thread.
   *
   * Fires on every scroll that ends up there, and again whenever a new message
   * arrives while the reader is already there. Deliberately chatty: the caller
   * knows which message it last acted on and can tell a repeat from news,
   * which this component cannot.
   */
  onSeenLatest?: () => void;
  /** Replies drawn ahead of the server's confirmation. */
  pending?: PendingReply[];
}

/** A reply on screen that the server has not confirmed yet. */
export interface PendingReply {
  clientMessageId: string;
  body:            string;
  attachmentUrls:  string[];
}

export function ThreadView({
  conversation, sending, onSend, onUpload, onDeleteMessage,
  messages, hasMoreOlder, loadingOlder, onLoadOlder, onSeenLatest, pending = [],
}: Props) {
  const [draft, setDraft] = useState('');
  const { someoneTyping } = useTyping(conversation.id, draft, sending);

  /**
   * Report when the foot of the thread is actually on screen.
   *
   * Opening a thread used to be what marked it read, which claimed the seller
   * had seen a message the moment the row was clicked — including when they
   * immediately scrolled up into history, or when a new one arrived while they
   * were reading further back. Reaching the newest message is the thing that
   * means "read", so that is what gets reported.
   *
   * Re-runs on messages.length so a message arriving while the reader is
   * already at the foot counts too, without them having to move.
   */
  useEffect(() => {
    const pane = paneRef.current;
    // Not gated on onSeenLatest: the listener also records whether the
    // reader is at the foot, which the scroll behaviour needs whether or not
    // anyone asked to be told about it.
    if (!pane) return;

    const check = () => {
      wasNearBottom.current =
        pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 96;
      // A few pixels of slack. A programmatic scroll to the bottom often lands
      // a fraction short, and sub-pixel layout means an exact comparison is
      // false as often as it is true — while a reader that close is plainly
      // looking at the last message.
      if (pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 24) onSeenLatest?.();
    };

    // Once now, because opening a thread scrolls to the bottom on its own and
    // that may already have happened by the time this runs.
    check();
    pane.addEventListener('scroll', check, { passive: true });
    return () => pane.removeEventListener('scroll', check);
  }, [onSeenLatest, messages.length]);
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
  useLayoutEffect(() => {
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
  // Whether the reader was at the foot before the list last changed. Read in
  // the layout effect, which runs after the DOM has already grown and so
  // cannot measure this for itself.
  const wasNearBottom = useRef(true);

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
    if (before !== null) {
      heightBeforeLoad.current = null;
      pane.scrollTop += pane.scrollHeight - before;
      return;
    }

    // An arriving message follows the reader down only if they were already
    // at the foot. Someone who has scrolled up to find an order number does
    // not want the thread yanked away mid-sentence.
    if (wasNearBottom.current) pane.scrollTop = pane.scrollHeight;
    // pending.length too: the optimistic bubble is what makes a reply feel
    // instant, and it is not part of `messages`. someoneTyping as well, now
    // that the indicator lives in the thread and can be scrolled past — the
    // wasNearBottom gate above already keeps it from yanking a reader who
    // has scrolled up.
  }, [messages, pending.length, someoneTyping]);

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
    // A second pick while the first is still uploading would compute its
    // room allowance from a stale `attachments`, and both batches would
    // append. The attach button is disabled while uploading; a paste is
    // not, so the guard belongs here rather than on the button.
    if (uploading) return;
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
    //
    // No `|| sending` guard. It used to be safe because the button was greyed
    // out for the whole round trip; without that, a seller typing a second
    // reply straight after the first would have had it silently swallowed by a
    // button that looked ready. Two sends in flight is fine — each carries its
    // own clientMessageId, which is what the server dedupes on.
    if (!body && attachments.length === 0) return;
    const urls = attachments.map((a) => a.url);
    // Cleared before the request, not after. The reply is already on screen as
    // a pending bubble by the time this returns, and a box that stayed full
    // until the round trip finished was the whole reason replying felt slow.
    // A failure restores it below.
    setDraft('');
    setAttachments([]);
    // Armed before the request, not after it. The pending bubble is on
    // screen the moment onSend is called, so waiting for the server to
    // answer before arming meant the thread sat still while the reply the
    // seller had just written was below the fold.
    stickToBottom.current = true;
    try {
      await onSend(body, urls);
    } catch {
      setDraft(body);
      setAttachments(attachments);
      return;
    }
    // Nothing to do on success: the pending bubble already carried the view
    // down, and the layout effect runs again when the confirmed message
    // replaces it.
  };

  /*
   * min-w-0 for the same reason the storefront needs it: a flex item defaults
   * to min-width:auto and refuses to shrink below its content's min-content
   * width, and a link preview card's title carries `truncate` — so its
   * min-content width is the WHOLE title. Without this the column grows past
   * its frame and the conversation gets clipped at the right edge.
   * Truncation cannot rescue a container nothing is constraining.
   */
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={paneRef} className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
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

        {/* Sent, not yet confirmed. Always the newest thing in the thread, so
            it goes last; dimmed so "on your screen" stays distinguishable from
            "delivered" — a bubble that looked identical would be a claim this
            side cannot make until the server answers. */}
        {pending.map((p) => (
          <div key={p.clientMessageId} className="flex justify-end">
            <div className="min-w-0 max-w-[80%] opacity-60">
              {p.body && (
                <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-white [overflow-wrap:anywhere]">
                  {p.body}
                </div>
              )}
              {p.attachmentUrls.length > 0 && (
                <MessageAttachments urls={p.attachmentUrls} />
              )}
              <p className="mt-1 text-right text-xs text-muted">Sending…</p>
            </div>
          </div>
        ))}

        {/* In the thread, not a strip above the composer. Outside the pane it
            sat over the newest message's clock and read as an overlay; a
            placeholder should occupy the spot the message will land in, so
            the thread does not jump when it arrives. Same row shape as an
            incoming message, avatar and all. */}
        {someoneTyping && (
          <div className="flex gap-2">
            <Avatar name={buyerName} src={conversation.user?.avatarUrl ?? null} size={28} />
            <TypingIndicator label={buyerName} />
          </div>
        )}
      </div>

      {/* Deliberately outside the scrolling pane above. Inside it, the
          indicator appearing only made the content taller than the viewport,
          below wherever the reader happened to be — and nothing scrolls them
          to it, so a shop sitting at the newest message never saw it. */}
      <div className="border-t border-border px-4 py-4 sm:px-6">
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
          // Paste an image straight into the box. A screenshot from the OS
          // clipboard arrives here as a File and goes through exactly the
          // same size and type checks the attach button uses.
          onPaste={(e) => {
            if (e.clipboardData.files.length === 0) return;
            // Rich text often travels with a picture of itself (Word, Excel, a
            // copied web selection). That paste is meant to type the text, so
            // anything carrying real text is left to the browser.
            if (e.clipboardData.getData('text/plain')) return;
            // No preventDefault: a textarea has nothing to insert for a file,
            // so the default is already a no-op and suppressing it would only
            // risk swallowing text arriving in the same event.
            void pickFiles(e.clipboardData.files);
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
            // Not disabled while sending. The reply is already on screen as a
            // pending bubble and the box is empty, so there is nothing to send
            // twice — and a button that greys out for the length of a round
            // trip is what made replying here feel slower than the storefront,
            // where the same wait is a 32px spinner nobody notices.
            disabled={uploading || (!draft.trim() && attachments.length === 0)}
            className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send
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
