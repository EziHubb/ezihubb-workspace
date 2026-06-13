import { Injectable, Logger } from '@nestjs/common';
import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './sources/trend-source.base';
import { GoogleTrendsSource } from './sources/google.source';
import { TikTokSource }       from './sources/tiktok.source';
import { RedditSource }       from './sources/reddit.source';
import { AmazonSource }       from './sources/amazon.source';
import { ShopeeSource }       from './sources/shopee.source';
import { TaobaoSource }       from './sources/taobao.source';
import { PinterestSource }    from './sources/pinterest.source';

export type { TrendSourceMeta, TrendTopic, TrendSourceConfig };

export interface SourceSettings {
  enabled: boolean;
  apiKey?: string;
  geo?:    string;
}

@Injectable()
export class TrendSourceRegistry {
  private readonly logger  = new Logger(TrendSourceRegistry.name);
  private readonly sources = new Map<string, TrendSourceBase>();

  constructor() {
    for (const src of [
      new GoogleTrendsSource(),
      new TikTokSource(),
      new RedditSource(),
      new AmazonSource(),
      new ShopeeSource(),
      new TaobaoSource(),
      new PinterestSource(),
    ]) {
      this.sources.set(src.id, src);
    }
  }

  getSourcesMeta(): TrendSourceMeta[] {
    return Array.from(this.sources.values()).map(s => s.meta);
  }

  getSource(id: string): TrendSourceBase | undefined {
    return this.sources.get(id);
  }

  async fetchFromSources(
    sourceConfigs: Record<string, SourceSettings>,
    sourceFilter?: string[],
    limitPerSource = 15,
  ): Promise<TrendTopic[]> {
    const ids = sourceFilter && sourceFilter.length > 0
      ? sourceFilter
      : Object.entries(sourceConfigs).filter(([, c]) => c.enabled).map(([id]) => id);

    const results: TrendTopic[] = [];
    const seen = new Set<string>();

    await Promise.allSettled(
      ids.map(async (id) => {
        const source = this.sources.get(id);
        if (!source) return;

        const cfg: TrendSourceConfig = {
          apiKey: sourceConfigs[id]?.apiKey ?? undefined,
          geo:    sourceConfigs[id]?.geo    ?? undefined,
          limit:  limitPerSource,
        };

        if (!source.isConfigured(cfg)) {
          this.logger.warn(`Source "${id}" skipped — not configured (missing API key?)`);
          return;
        }

        try {
          const topics = await source.fetch(cfg);
          for (const t of topics) {
            const key = t.hashtag.toLowerCase().trim();
            if (key && !seen.has(key)) {
              seen.add(key);
              results.push(t);
            }
          }
          this.logger.debug(`Source "${id}" returned ${topics.length} topics`);
        } catch (err: any) {
          this.logger.warn(`Source "${id}" failed: ${err?.message ?? err}`);
        }
      }),
    );

    return results.sort((a, b) => b.engagementScore - a.engagementScore);
  }

  getDefaultConfigs(): Record<string, SourceSettings> {
    return {
      google:    { enabled: true,  apiKey: '', geo: 'US' },
      reddit:    { enabled: true,  apiKey: '', geo: '' },
      amazon:    { enabled: true,  apiKey: '', geo: '' },
      tiktok:    { enabled: false, apiKey: '', geo: '' },
      shopee:    { enabled: false, apiKey: '', geo: 'VN' },
      taobao:    { enabled: false, apiKey: '', geo: '' },
      pinterest: { enabled: false, apiKey: '', geo: 'US' },
    };
  }
}
