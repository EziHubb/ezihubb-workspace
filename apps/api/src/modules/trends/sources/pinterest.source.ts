import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

const GEO_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

export class PinterestSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'pinterest',
    name:           'Pinterest Trends',
    description:    'Trending keywords from Pinterest — great for visual/craft/lifestyle products. Requires a Pinterest App API key.',
    requiresApiKey: true,
    supportsGeo:    true,
    geoOptions:     GEO_OPTIONS,
    keyHint:        'Pinterest App Access Token (v5 API)',
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    if (!cfg.apiKey) return [];
    const geo   = cfg.geo ?? 'US';
    const limit = cfg.limit ?? 20;

    try {
      const res = await fetch(
        `https://api.pinterest.com/v5/trends/keywords/top_trends/now?region=${geo}&limit=${Math.min(limit, 50)}`,
        {
          headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type':  'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return [];

      const data: any = await res.json();
      const items: any[] = data?.trends ?? data?.items ?? [];

      return items.slice(0, limit).map((item: any) => ({
        hashtag:         (item.keyword ?? item.trend_keyword ?? item.name ?? '').toLowerCase().replace(/\s+/g, ''),
        description:     `Pinterest trending: ${item.keyword ?? item.name}`,
        engagementScore: item.volume ?? item.trend_score ?? 0,
        source:          'pinterest',
        url:             `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(item.keyword ?? '')}`,
        category:        item.category ?? 'visual',
        geo,
      })).filter((t: TrendTopic) => t.hashtag.length > 0);
    } catch {
      return [];
    }
  }
}
