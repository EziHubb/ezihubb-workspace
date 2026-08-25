/**
 * What an attachment URL is, decided from the URL alone.
 *
 * Messages carry `attachmentUrls: string[]` and nothing else — no name, no
 * MIME type. Rather than migrate every existing row to a richer shape, the
 * storage key keeps the original extension (see StorageService.generateKey),
 * so the extension is a reliable answer for everything this platform accepts.
 *
 * It has to be reliable, because the renderers used to put every attachment
 * into an <img>. The moment PDFs were allowed, that would have drawn a broken
 * image icon and called it a file.
 */

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Only what the API will actually store — see MESSAGE_ATTACHMENT_MIMETYPES. */
export function isImageAttachment(url: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(url));
}

/** Lower-cased, with the leading dot. Empty string when there is none. */
export function extensionOf(url: string): string {
  // Parsed rather than regexed off the whole string: a query string containing
  // ".png" would otherwise make a PDF look like an image.
  let path = url;
  try {
    path = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    /* not a URL — fall back to treating it as a path */
  }
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot < 0 || dot < slash) return '';
  return path.slice(dot).toLowerCase();
}

/**
 * A readable name for a file chip.
 *
 * The stored key is a UUID, so the buyer's original filename is not in the URL
 * and cannot be recovered. Showing "a3f2…-9c1.pdf" would be worse than saying
 * what kind of file it is, which is the part a reader actually needs.
 */
export function attachmentLabel(url: string): string {
  const ext = extensionOf(url).replace('.', '').toUpperCase();
  return ext ? `${ext} file` : 'File';
}

/** The first http(s) link in a message body, or null. Used to decide whether
 *  to ask the API for a preview card — the API re-validates it either way. */
export function firstLinkIn(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s<>"']+/);
  if (!match) return null;
  // Trailing punctuation is almost always sentence punctuation rather than
  // part of the address: "see https://example.com." should not fetch a URL
  // ending in a full stop.
  return match[0].replace(/[.,;:!?)\]]+$/, '');
}
