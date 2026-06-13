export interface TrendTopic {
  hashtag:         string;
  description:     string;
  engagementScore: number;
  source:          string;
  url?:            string;
  category?:       string;
  geo?:            string;
}

export interface TrendSourceConfig {
  apiKey?: string;
  geo?:    string;
  limit?:  number;
}

export interface TrendSourceMeta {
  id:             string;
  name:           string;
  description:    string;
  requiresApiKey: boolean;
  supportsGeo:    boolean;
  geoOptions?:    { value: string; label: string }[];
  keyHint?:       string; // label for the API key input
}

export abstract class TrendSourceBase {
  abstract readonly meta: TrendSourceMeta;

  get id()   { return this.meta.id; }
  get name() { return this.meta.name; }

  isConfigured(cfg: TrendSourceConfig): boolean {
    return !this.meta.requiresApiKey || !!cfg.apiKey;
  }

  abstract fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]>;
}
