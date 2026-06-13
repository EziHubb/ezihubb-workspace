import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

const GEO_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'SG', label: 'Singapore' },
];

export class GoogleTrendsSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'google',
    name:           'Google Trends',
    description:    'Daily trending searches from Google. Free — no API key needed.',
    requiresApiKey: false,
    supportsGeo:    true,
    geoOptions:     GEO_OPTIONS,
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    const geo = cfg.geo ?? 'US';
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendBot/1.0)' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const xml   = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    const limit = cfg.limit ?? 20;

    return items.slice(0, limit).map((item) => {
      const title      = this.extractTag(item, 'title');
      const traffic    = this.extractTag(item, 'ht:approx_traffic');
      const link       = this.extractTag(item, 'link');
      const score      = parseInt(traffic.replace(/[^0-9]/g, '') || '0', 10);

      return {
        hashtag:         title.replace(/\s+/g, '').toLowerCase(),
        description:     `Trending on Google: ${title}`,
        engagementScore: score,
        source:          'google',
        url:             link,
        category:        'search',
        geo,
      };
    }).filter(t => t.hashtag.length > 0);
  }

  private extractTag(xml: string, tag: string): string {
    const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
    return (m?.[1] ?? m?.[2] ?? '').trim();
  }
}
