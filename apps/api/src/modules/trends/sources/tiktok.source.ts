import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

export class TikTokSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'tiktok',
    name:           'TikTok Trending',
    description:    'Trending hashtags from TikTok via RapidAPI. Requires a RapidAPI key.',
    requiresApiKey: true,
    supportsGeo:    false,
    keyHint:        'RapidAPI Key (tiktok-api6.p.rapidapi.com)',
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    if (!cfg.apiKey) return [];

    const res = await fetch(
      'https://tiktok-api6.p.rapidapi.com/hashtags/trending',
      {
        headers: {
          'X-RapidAPI-Key':  cfg.apiKey,
          'X-RapidAPI-Host': 'tiktok-api6.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];

    const data: any = await res.json();
    const limit     = cfg.limit ?? 20;

    return ((data.data ?? []) as any[]).slice(0, limit).map((t: any) => ({
      hashtag:         t.name ?? t.hashtag_name ?? '',
      description:     t.description ?? `Trending on TikTok: #${t.name}`,
      engagementScore: t.video_views ?? t.engagement ?? 0,
      source:          'tiktok',
      url:             `https://www.tiktok.com/tag/${t.name}`,
      category:        'social',
    })).filter((t: TrendTopic) => t.hashtag.length > 0);
  }
}
