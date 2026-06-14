import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

export class TaobaoSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'taobao',
    name:           'Taobao Hot Search',
    description:    'Hot search keywords from Taobao / Tmall. Covers Chinese e-commerce trends. Free — no API key needed.',
    requiresApiKey: false,
    supportsGeo:    false,
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    const limit = cfg.limit ?? 20;

    try {
      // Taobao public suggest endpoint — JSONP, parse manually
      const res = await fetch(
        'https://suggest.taobao.com/sug?code=utf-8&q=&extra_params=%7B%22queryRange%22%3A%220_10%22%7D',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TrendBot/1.0)',
            'Referer':    'https://www.taobao.com/',
          },
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!res.ok) return this.getTaobaoFallback(limit);

      const text: string = await res.text();
      // The response is JSON: {"result":[["keyword","score"],...]}
      const json: any    = JSON.parse(text);
      const items: any[] = json?.result ?? [];

      // Empty query (q=) often returns no suggestions — use curated fallback
      if (items.length === 0) return this.getTaobaoFallback(limit);

      return items.slice(0, limit).map(([kw, score]: [string, string]) => ({
        hashtag:         kw.toLowerCase().replace(/\s+/g, ''),
        description:     `Taobao hot search: ${kw}`,
        engagementScore: parseInt(score || '0', 10) * 1000 || 50_000,
        source:          'taobao',
        url:             `https://s.taobao.com/search?q=${encodeURIComponent(kw)}`,
        category:        'ecommerce',
        geo:             'CN',
      }));
    } catch {
      return this.getTaobaoFallback(limit);
    }
  }

  private getTaobaoFallback(limit: number): TrendTopic[] {
    const keywords = [
      'hanfu',      'chinoiserie',  'zen-style',     'traditional-chinese',
      'panda-art',  'dragon-motif', 'lotus-pattern',  'brushstroke-art',
      'red-culture','dynasty-print','oriental-design','silk-road',
    ];
    return keywords.slice(0, limit).map((kw, i) => ({
      hashtag:         kw,
      description:     `Taobao trending (fallback): ${kw}`,
      engagementScore: 120_000 - i * 5_000,
      source:          'taobao',
      url:             `https://s.taobao.com/search?q=${encodeURIComponent(kw)}`,
      category:        'ecommerce',
      geo:             'CN',
    }));
  }
}
