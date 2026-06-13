import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

const CATEGORY_FEEDS: { id: string; label: string; url: string }[] = [
  { id: 'clothing',   label: 'Clothing',       url: 'https://www.amazon.com/gp/bestsellers/fashion/rss' },
  { id: 'home',       label: 'Home & Kitchen',  url: 'https://www.amazon.com/gp/bestsellers/home-garden/rss' },
  { id: 'sports',     label: 'Sports & Outdoors', url: 'https://www.amazon.com/gp/bestsellers/sporting-goods/rss' },
  { id: 'books',      label: 'Books',           url: 'https://www.amazon.com/gp/bestsellers/books/rss' },
  { id: 'toys',       label: 'Toys & Games',    url: 'https://www.amazon.com/gp/bestsellers/toys-and-games/rss' },
];

export class AmazonSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'amazon',
    name:           'Amazon Best Sellers',
    description:    'Best-selling products from Amazon across key POD categories. Free — no API key needed.',
    requiresApiKey: false,
    supportsGeo:    false,
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    const limit  = cfg.limit ?? 20;
    const topics: TrendTopic[] = [];

    for (const feed of CATEGORY_FEEDS.slice(0, 2)) {
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendBot/1.0)' },
          signal:  AbortSignal.timeout(8_000),
        });
        if (!res.ok) continue;

        const xml   = await res.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

        for (const item of items.slice(0, 5)) {
          const title = this.extractTag(item, 'title');
          if (!title) continue;

          // Condense product name → hashtag-style keyword
          const hashtag = title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .slice(0, 3)
            .join('');

          if (!hashtag) continue;

          topics.push({
            hashtag,
            description:     `Amazon Best Seller: ${title.slice(0, 80)}`,
            engagementScore: 50_000 + Math.floor(Math.random() * 50_000),
            source:          'amazon',
            url:             this.extractTag(item, 'link'),
            category:        feed.label,
          });
        }
      } catch { /* ignore per-feed failures */ }

      if (topics.length >= limit) break;
    }

    return topics.slice(0, limit);
  }

  private extractTag(xml: string, tag: string): string {
    const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
    return (m?.[1] ?? m?.[2] ?? '').trim();
  }
}
