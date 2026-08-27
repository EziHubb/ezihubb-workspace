'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CornerUpLeft, ImagePlus, MessageSquare, Loader2, X } from 'lucide-react';
import { Avatar } from '../../messages/inbox/Avatar';
import { SnippetMenu } from './SnippetMenu';
import type { PanelMessage } from './types';

/**
 * The conversation about this order, inside the order panel.
 *
 * Deliberately the same thread the Messages inbox shows — one conversation row
 * keyed on (storeId, buyer), not a second private channel. A seller who
 * answers here and a seller who answers in the inbox are answering the same
 * buyer in the same place.
 *
 * Which also means what is listed here is the shop's whole history with this
 * person, not the part of it about this order. There is no per-order thread
 * left to show: that is what produced five identical-looking conversations for
 * a buyer with five orders.
 */

interface Props {
  messages:    PanelMessage[];
  /** The thread this order belongs to, for the link out to the inbox. Null
   *  until anyone has written. */
  conversationId: string | null;
  buyerName:   string;
  buyerAvatar: string | null;
  shopName:    string;
  /** Pre-filled into an empty composer — the buyer's own link to this order. */
  orderUrl:    string;
  sending:     boolean;
  onSend:      (body: string, attachmentUrls: string[]) => void;
  /** Uploads the picked files and resolves to their public URLs. */
  onUpload:    (files: File[]) => Promise<{ name: string; url: string }[]>;
  /** Scopes the snippet library to the right shop. */
  storeQuery:  string;
  /**
   * Opens the composer and scrolls here as soon as this mounts.
   *
   * Set when the seller arrived by the message icon on the queue card rather
   * than by opening the order: they asked for the conversation, so landing
   * them on the order's meta with the thread somewhere below is not what they
   * asked for.
   */
  autoOpen?:   boolean;
}

/**
 * Mirror the API's own limits, so the composer refuses a file rather than
 * letting the seller wait for a request that cannot succeed.
 *
 * The size check matters beyond politeness: multer enforces the same ceiling
 * by aborting mid-stream, and nothing maps its error to an HTTP status, so an
 * oversized file comes back as a bare 500. Catching it here is the difference
 * between "max 10 MB per file" and "Request failed with status code 500".
 */
const MAX_ATTACHMENTS  = 3;
const MAX_FILE_BYTES   = 10 * 1024 * 1024;
const ALLOWED_TYPES    = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** next/image throws during render on a src that is neither absolute nor
 *  root-relative, and a throw here would take the whole panel down. */
const renderable = (url: string): boolean =>
  url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://');

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function OrderMessaging({
  messages, conversationId, buyerName, buyerAvatar, shopName, orderUrl, sending, onSend, onUpload, storeQuery,
  autoOpen = false,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [body, setBody]           = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const bodyRef    = useRef<HTMLTextAreaElement>(null);

  /**
   * `seedUrl` is false when replying to something the buyer wrote: they are
   * already in the thread about this order and do not need the link back to
   * it. Seeded rather than appended server-side so the seller can delete it.
   */
  const open = (seedUrl: boolean) => {
    setComposing(true);
    if (seedUrl && !body) setBody(`${orderUrl}\n\n`);
  };

  /**
   * Runs once, on the mount that follows the thread loading — this component
   * is not rendered while the request is in flight, so there is no earlier
   * mount to fire on.
   *
   * `open(true)` rather than `open(messages.length === 0)`: the icon on the
   * queue card is the same affordance as the "Message buyer" button below,
   * and that one seeds the order link either way. Two entry points that
   * behave differently would be the bug, not the fix.
   */
  useEffect(() => {
    if (!autoOpen) return;
    open(true);
    sectionRef.current?.scrollIntoView({ block: 'center' });
    // Deliberately mount-only: re-running would reopen a composer the seller
    // had closed, every time the parent re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus follows the composer opening, however it was opened. Without it the
  // box appears and the seller still has to click into it.
  useEffect(() => {
    if (composing) bodyRef.current?.focus();
  }, [composing]);

  /**
   * Appended rather than substituted for what is already there.
   *
   * The composer usually opens holding the order link, and a snippet that
   * replaced the whole box would silently delete it — along with anything the
   * seller had already typed. Appending is undoable by hand; overwriting is
   * not.
   */
  const insertSnippet = (snippetBody: string) =>
    setBody((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${snippetBody}` : snippetBody));

  const send = () => {
    const trimmed = body.trim();
    // Also blocked mid-upload: sending now would drop the file the seller is
    // still watching upload, with nothing to say it was left behind.
    if (!trimmed || sending || uploading) return;
    onSend(trimmed, attachments.map((a) => a.url));
    setBody('');
    setAttachments([]);
    setComposing(false);
  };

  const pickFiles = async (picked: FileList | null) => {
    if (!picked?.length) return;
    // A second pick while the first is still uploading would compute its
    // room allowance from a stale `attachments`, and both batches would
    // append. The attach button is disabled while uploading; a paste is
    // not, so the guard belongs here rather than on the button.
    if (uploading) return;
    const files = Array.from(picked);

    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) {
      return setAttachError(
        room === 0
          ? `Up to ${MAX_ATTACHMENTS} files per message.`
          : `Only ${room} more file${room === 1 ? '' : 's'} can be attached.`,
      );
    }

    // Checked before any upload starts, so a bad second file does not leave
    // the first one already uploaded and half the pick applied.
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) return setAttachError(`${tooBig.name} is over 10 MB.`);

    const wrongType = files.find((f) => !ALLOWED_TYPES.has(f.type));
    if (wrongType) return setAttachError(`${wrongType.name} is not a JPEG, PNG or WebP image.`);

    setAttachError(null);
    setUploading(true);
    try {
      const uploaded = await onUpload(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setAttachError((e as Error).message);
    } finally {
      setUploading(false);
      // Cleared so picking the same file again still fires a change event —
      // otherwise a failed upload cannot be retried without choosing
      // something else first.
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section ref={sectionRef} className="rounded-card border border-border bg-surface">
      {messages.length > 0 && (
        <ul className="divide-y divide-border">
          {messages.map((m) => {
            const fromShop = m.senderType === 'SHOP';
            return (
              <li key={m.id} className="flex gap-3 px-4 py-4">
                <Avatar
                  name={fromShop ? shopName : buyerName}
                  src={fromShop ? null : buyerAvatar}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-secondary">
                      {fromShop ? shopName : buyerName}
                    </span>
                    <span className="text-xs text-muted">{fmtDate(m.createdAt)}</span>
                    {!fromShop && (
                      <button
                        type="button"
                        onClick={() => open(false)}
                        className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-secondary hover:bg-background"
                      >
                        <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Reply
                      </button>
                    )}
                  </div>
                  {/* An unsent message shows that it was unsent, not what
                      it said. The panel and the inbox render the same thread,
                      so a seller who takes a message back in one must not
                      still find it here — and the buyer already sees the
                      unsent form. */}
                  {m.deletedAt ? (
                    <p className="mt-1">
                      <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm italic text-muted">
                        You unsent a message
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{m.body}</p>
                  )}
                  {!m.deletedAt && m.attachmentUrls.filter(renderable).length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {m.attachmentUrls.filter(renderable).map((url) => (
                        <li key={url}>
                          <Image
                            src={url}
                            alt=""
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!composing ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <MessageSquare className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          {/* "with this buyer", not "about this order". There is one thread per
              buyer now, so what is counted here is the shop's whole history
              with them — saying "about this order" would promise a filter that
              does not exist. */}
          <p className="min-w-0 flex-1 text-sm text-muted">
            {messages.length === 0
              ? 'No messages with this buyer yet'
              : `${messages.length} message${messages.length === 1 ? '' : 's'} with this buyer`}
          </p>
          {/* The way out to the full thread.
              This panel caps at the newest hundred and has no way back through
              them; the inbox does. Without this the seller had to leave, open
              Messages, and find the buyer by name. */}
          {conversationId && (
            <Link
              href={`/messages?c=${conversationId}`}
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              Open full conversation
            </Link>
          )}
          <button
            type="button"
            onClick={() => open(true)}
            className="shrink-0 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-secondary hover:bg-background"
          >
            Message buyer
          </button>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-4">
          <label className="sr-only" htmlFor="order-message-body">Message to the buyer</label>
          <textarea
            id="order-message-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
            rows={5}
            className="w-full resize-y rounded-card border border-border bg-surface px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {attachments.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {attachments.map((file) => (
                <li
                  key={file.url}
                  className="flex max-w-xs items-center gap-2 rounded-card border border-border px-3 py-1.5 text-sm text-secondary"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.url !== file.url))}
                    aria-label={`Remove ${file.name}`}
                    className="shrink-0 text-muted hover:text-secondary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SnippetMenu
              storeQuery={storeQuery}
              currentBody={body}
              onInsert={insertSnippet}
            />

            <input
              ref={fileInput}
              id="order-message-attachment"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void pickFiles(e.target.files)}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-secondary hover:bg-background disabled:opacity-50"
            >
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Attach a file'}
            </button>

            <button
              type="button"
              onClick={() => { setComposing(false); setAttachError(null); }}
              className="ml-auto rounded-full px-3 py-1.5 text-sm text-muted hover:text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || uploading || !body.trim()}
              className="flex items-center gap-2 rounded-full bg-secondary px-5 py-1.5 text-sm font-medium text-surface disabled:opacity-50"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Send
            </button>
          </div>

          {attachError && <p className="mt-2 text-xs text-error">{attachError}</p>}
        </div>
      )}
    </section>
  );
}
