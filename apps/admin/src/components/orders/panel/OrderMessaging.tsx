'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { CornerUpLeft, ImagePlus, MessageSquare, Loader2, X } from 'lucide-react';
import { Avatar } from '../../messages/inbox/Avatar';
import { SnippetMenu } from './SnippetMenu';
import type { PanelMessage } from './types';

/**
 * The conversation about this order, inside the order panel.
 *
 * Deliberately the same thread the Messages inbox shows — it is one
 * conversation row keyed on (orderId, storeId), not a second private channel.
 * A seller who answers here and a seller who answers in the inbox are
 * answering the same buyer in the same place.
 */

interface Props {
  messages:    PanelMessage[];
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
  messages, buyerName, buyerAvatar, shopName, orderUrl, sending, onSend, onUpload, storeQuery,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [body, setBody]           = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
    <section className="rounded-card border border-border bg-surface">
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
                  <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{m.body}</p>
                  {m.attachmentUrls.filter(renderable).length > 0 && (
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
        <div className="flex items-center gap-3 px-4 py-4">
          <MessageSquare className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-muted">
            {messages.length === 0
              ? 'No messages about this order yet'
              : `${messages.length} message${messages.length === 1 ? '' : 's'} about this order`}
          </p>
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
