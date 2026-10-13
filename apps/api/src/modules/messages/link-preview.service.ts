import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { createHash } from 'crypto';
import { request as httpRequest, IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
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
    viewer: { storeId?: string; userId?: string | null; forShop: boolean; verifiedGuestEmail?: string },
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
  private async assertPublicHost(host: string): Promise<{ address: string; family: number }> {
    host = host.replace(/^\[|\]$/g, '');
    const literal = isIP(host);
    const addresses = literal
      ? [{ address: host, family: literal }]
      : await lookup(host, { all: true, verbatim: true });

    if (!addresses.length) throw new Error('host does not resolve');
    for (const { address } of addresses) {
      if (this.isPrivateAddress(address)) throw new Error('refusing non-public address');
    }
    return addresses[0];
  }

  private isPrivateAddress(ip: string): boolean {
    if (isIP(ip) === 6) {
      const v6 = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
      const [first, second] = v6.split(':').map(value => parseInt(value || '0', 16));
      // Allow native global unicast only. Reject ALL mapped/compatible IPv4,
      // ULA, link-local, NAT64 and tunnel forms, including hexadecimal aliases.
      return first < 0x2000 || first > 0x3fff || first === 0x2002 || first === 0x3fff
        || (first === 0x2001 && (second < 0x200 || second === 0xdb8));
    }

    if (isIP(ip) !== 4) return true;

    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unparseable: refuse
    const [a, b, c] = p;
    return (
      a === 0 ||                                  // this network
      a === 10 ||                                 // private
      a === 127 ||                                // loopback
      (a === 169 && b === 254) ||                 // link-local — the cloud metadata address
      (a === 172 && b >= 16 && b <= 31) ||        // private
      (a === 192 && b === 168) ||                 // private
      (a === 100 && b >= 64 && b <= 127) ||       // carrier-grade NAT
      (a === 192 && b === 0) ||                   // IETF protocol assignments
      (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
      (a === 198 && b === 51 && c === 100) ||     // documentation
      (a === 203 && b === 0 && c === 113) ||      // documentation
      a >= 224                                    // multicast and reserved
    );
  }

  /** Follows redirects by hand so every hop is checked, not just the first. */
  private async fetchPreview(start: URL): Promise<LinkPreview | null> {
    let url = start;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const address = await this.resolveWithinDeadline(url.hostname, controller.signal);
        const res = await this.requestPinned(url, address, controller.signal);
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.location;
          if (!location) return null;
          url = this.parseUrl(new URL(location, url).href);
          continue;
        }
        if (res.status < 200 || res.status >= 300 || !res.headers['content-type']?.includes('text/html')) return null;
        return this.parseMeta(res.html, url);
      }
      return null;
    } finally { clearTimeout(timer); controller.abort(); }
  }

  private async resolveWithinDeadline(host: string, signal: AbortSignal) {
    signal.throwIfAborted();
    return new Promise<{ address: string; family: number }>((resolve, reject) => {
      const abort = () => reject(new Error('Link preview deadline exceeded'));
      signal.addEventListener('abort', abort, { once: true });
      this.assertPublicHost(host).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  /** Connect ONLY to the checked literal IP, while preserving Host and TLS SNI.
   * Native HTTP(S) avoids a second DNS lookup and ambient fetch/proxy dispatchers.
   * The shared abort signal covers DNS, redirects, headers AND streamed body. */
  private async requestPinned(url: URL, address: { address: string; family: number }, signal: AbortSignal) {
    return new Promise<{ status: number; headers: IncomingHttpHeaders; html: string }>((resolve, reject) => {
      const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const req = request({
        protocol: url.protocol, hostname: address.address, family: address.family,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`, agent: false, signal,
        ...(url.protocol === 'https:' && !isIP(host) ? { servername: host } : {}),
        headers: { host: url.host, 'user-agent': 'EziHubbLinkPreview/1.0 (+https://ezihubb.com)', accept: 'text/html,application/xhtml+xml' },
      }, res => {
        const status = res.statusCode ?? 0;
        const finish = (html: string) => { resolve({ status, headers: res.headers, html }); res.destroy(); };
        res.on('error', reject);
        if (status < 200 || status >= 300 || !res.headers['content-type']?.includes('text/html')) { finish(''); return; }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          const retained = chunk.subarray(0, MAX_BYTES - total);
          chunks.push(retained); total += retained.length;
          if (total === MAX_BYTES) finish(Buffer.concat(chunks, total).toString('utf8'));
        });
        res.on('end', () => finish(Buffer.concat(chunks, total).toString('utf8')));
        res.on('aborted', () => reject(new Error('Link preview response interrupted')));
      });
      req.on('error', reject);
      req.end();
    });
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
