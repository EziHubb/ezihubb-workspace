import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

const SUBREDDITS = ['all', 'pics', 'art', 'design', 'crafts', 'DIY', 'funny', 'mildlyinteresting'];

export class RedditSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'reddit',
    name:           'Reddit Trending',
    description:    'Top posts from Reddit across popular subreddits. Free — no API key needed.',
    requiresApiKey: false,
    supportsGeo:    false,
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    const limit  = cfg.limit ?? 20;
    const topics: TrendTopic[] = [];
    const seen   = new Set<string>();

    for (const sub of SUBREDDITS.slice(0, 3)) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/top.json?limit=10&t=day`,
          {
            headers: { 'User-Agent': 'TrendBot/1.0 (by /u/trendbot)' },
            signal:  AbortSignal.timeout(8_000),
          },
        );
        if (!res.ok) continue;

        const json: any = await res.json();
        const posts      = (json.data?.children ?? []) as any[];

        for (const { data: post } of posts) {
          const title   = (post.title as string) ?? '';
          const hashtag = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
          if (!hashtag || seen.has(hashtag)) continue;
          seen.add(hashtag);

          topics.push({
            hashtag,
            description:     title.slice(0, 120),
            engagementScore: (post.score as number) ?? 0,
            source:          'reddit',
            url:             `https://reddit.com${post.permalink}`,
            category:        post.subreddit,
          });
        }
      } catch { /* ignore per-subreddit failures */ }

      if (topics.length >= limit) break;
    }

    return topics.slice(0, limit);
  }
}
