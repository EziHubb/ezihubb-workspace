import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { MessagesService } from './messages.service';

/**
 * The card shown under a message that contains a link.
 *
 * This is the one place in the product where a stranger's text decides what
 * the server connects to, so most of this file is about refusing to be a
 * proxy rather than about parsing HTML.
 *
 * Two independent gates, because either alone is not enough:
 *
 *  1. The URL must already appear in a message of a conversation the caller is
 *     allowed to read. That makes the input real content rather than anything
 *     the caller feels like typing, and it means an attacker must first get
 *     their URL into a thread with a shop that will look at it.
 *  2. Wherever the hostname resolves must be a public address — checked again
 *     after every redirect, because a public host is free to redirect to
 *     169.254.169.254 and a fetch that follows redirects on its own would
 *     never let us look.
 */

export interface LinkPreview {
  url:         string;
  title:       string | null;
  description: string | null;
  image:       string | null;
  siteName:    string | null;
}

/** Long enough that a page's <head> is well inside it, short enough that a
 *  hostile server streaming forever cannot cost us memory. */
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;

/** A week for a hit. Previews are cosmetic and pages rarely change their OG
 *  tags; refetching more often buys nothing and costs an outbound request. */
const CACHE_TTL = 7 * 24 * 60 * 60;
/**
 * Failures are cached too, and for much less time.
 *
 * Without this, a link to a host that is down turns every render of that
 * thread — by either party, on every page load — into another five-second
 * outbound attempt.
 */
const NEGATIVE_TTL = 10 * 60;

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly redis:    RedisService,
    private readonly messages: MessagesService,
  ) {}

  async previewFor(
    conversationId: string,
    rawUrl: string,
    viewer: { storeId?: string; userId?: string | null; forShop: boolean },
  ): Promise<LinkPreview | null> {
    await this.messages.assertThreadAccess(conversationId, viewer);

    const url = this.parseUrl(rawUrl);

    // Gate 1. Cheap enough to run before the cache: it is an indexed lookup,
    // and skipping it for cached entries would let anyone who learned a
    // conversation id read previews of links they were never sent.
    const inThread = await this.prisma.message.count({
      where: {
        conversationId,
        deletedAt: null,
        body: { contains: url.href.slice(0, 200) },
      },
    });
    if (!inThread) {
      throw new BadRequestException({
        code:    'ERR_VALIDATION',
        message: 'That link was not sent in this conversation',
      });
    }

    const key = `linkpreview:${createHash('sha256').update(url.href).digest('hex')}`;
    const cached = await this.redis.get<LinkPreview | { miss: true }>(key);
    // `if (cached)` alone would treat a cached miss as a hit and a cached hit
    // whose fields are all null as a miss. The shape is what distinguishes.
    if (cached) return 'miss' in cached ? null : cached;

    let preview: LinkPreview | null = null;
    try {
      preview = await this.fetchPreview(url);
    } catch (err) {
      // Never thrown to the caller: a link that cannot be unfurled is a
      // message without a card, not a failed request.
      this.logger.debug(`Link preview failed for ${url.host}: ${String(err)}`);
    }

    await this.redis.set(key, preview ?? { miss: true }, preview ? CACHE_TTL : NEGATIVE_TTL);
    return preview;
  }

  /** http(s) only, no embedded credentials, no exotic port. */
  private parseUrl(raw: string): URL {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'Not a URL' });
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'Only http and https links' });
    }
    // user:pass@host is a way to smuggle a different authority past a reader
    // and past naive host checks.
    if (url.username || url.password) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'Credentials are not allowed in a link' });
    }
    if (url.port && url.port !== '80' && url.port !== '443') {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'Only ports 80 and 443' });
    }
    return url;
  }

  /**
   * Every address this host resolves to must be public.
   *
   * All of them, not the first: a name that returns one public and one private
   * address would otherwise pass here and connect to the private one, since
   * which address a socket picks is not ours to decide.
   */
  private async assertPublicHost(host: string): Promise<void> {
    const literal = isIP(host);
    const addresses = literal
      ? [{ address: host, family: literal }]
      : await lookup(host, { all: true, verbatim: true });

    if (!addresses.length) throw new Error('host does not resolve');
    for (const { address } of addresses) {
      if (this.isPrivateAddress(address)) throw new Error(`refusing private address ${address}`);
    }
  }

  private isPrivateAddress(ip: string): boolean {
    if (isIP(ip) === 6) {
      const v6 = ip.toLowerCase();
      // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local, :: unspecified.
      if (v6 === '::1' || v6 === '::') return true;
      if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true;
      if (/^fe[89ab][0-9a-f]:/.test(v6)) return true;
      // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 hat, and the classic
      // way past a check that only looked at dotted quads.
      const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this.isPrivateAddress(mapped[1]);
      return false;
    }

    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unparseable: refuse
    const [a, b] = p;
    return (
      a === 0 ||                                  // this network
      a === 10 ||                                 // private
      a === 127 ||                                // loopback
      (a === 169 && b === 254) ||                 // link-local — the cloud metadata address
      (a === 172 && b >= 16 && b <= 31) ||        // private
      (a === 192 && b === 168) ||                 // private
      (a === 100 && b >= 64 && b <= 127) ||       // carrier-grade NAT
      (a === 192 && b === 0) ||                   // IETF protocol assignments
      a >= 224                                    // multicast and reserved
    );
  }

  /** Follows redirects by hand so every hop is checked, not just the first. */
  private async fetchPreview(start: URL): Promise<LinkPreview | null> {
    let url = start;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.assertPublicHost(url.hostname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url.href, {
          redirect: 'manual',
          signal:   controller.signal,
          headers: {
            // Honest about what we are. A site that would rather not be
            // unfurled can say so, and we would rather be blockable than
            // pretend to be a browser.
            'user-agent': 'EziHubbLinkPreview/1.0 (+https://ezihubb.com)',
            accept:       'text/html,application/xhtml+xml',
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        url = this.parseUrl(new URL(location, url).href);
        continue;
      }
      if (!res.ok) return null;

      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('text/html')) return null;

      const html = await this.readCapped(res);
      return this.parseMeta(html, url);
    }

    return null; // too many hops
  }

  /**
   * Reads at most MAX_BYTES and drops the connection.
   *
   * `res.text()` would buffer whatever the server sends, and content-length is
   * a claim by the same server we are defending against — so the cap has to be
   * enforced on what actually arrives.
   */
  private async readCapped(res: Response): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return '';

    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8').slice(0, MAX_BYTES);
  }

  /** Open Graph first, then Twitter, then the plain document. */
  private parseMeta(html: string, url: URL): LinkPreview | null {
    const head = html.slice(0, MAX_BYTES);

    const meta = (...names: string[]): string | null => {
      for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // property/name in either order, single or double quotes.
        const re = new RegExp(
          `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`
          + `|<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${escaped}["']`,
          'i',
        );
        const m = head.match(re);
        const v = (m?.[1] ?? m?.[2] ?? '').trim();
        if (v) return this.decodeEntities(v).slice(0, 300);
      }
      return null;
    };

    const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const title = meta('og:title', 'twitter:title')
      ?? (titleTag ? this.decodeEntities(titleTag).slice(0, 300) : null);

    const rawImage = meta('og:image', 'og:image:url', 'twitter:image');
    let image: string | null = null;
    if (rawImage) {
      try {
        const abs = new URL(rawImage, url);
        // Only over http(s), so a data: or javascript: value cannot reach an
        // <img src> on either app.
        if (abs.protocol === 'http:' || abs.protocol === 'https:') image = abs.href;
      } catch { /* unusable image URL — the card renders without one */ }
    }

    const preview: LinkPreview = {
      url:         url.href,
      title,
      description: meta('og:description', 'twitter:description', 'description'),
      image,
      siteName:    meta('og:site_name') ?? url.hostname.replace(/^www\./, ''),
    };

    // A card with nothing but a hostname is worse than the bare link the
    // renderer already shows.
    return preview.title || preview.description || preview.image ? preview : null;
  }

  /** The handful that actually show up in titles. Not a full HTML decoder —
   *  the output is rendered as text by React, never as markup. */
  private decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
