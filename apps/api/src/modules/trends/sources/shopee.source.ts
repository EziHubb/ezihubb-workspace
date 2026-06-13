import { TrendSourceBase, TrendSourceConfig, TrendSourceMeta, TrendTopic } from './trend-source.base';

const GEO_TO_DOMAIN: Record<string, string> = {
  VN: 'shopee.vn',
  SG: 'shopee.sg',
  TH: 'shopee.co.th',
  PH: 'shopee.ph',
  ID: 'shopee.co.id',
  MY: 'shopee.com.my',
  TW: 'shopee.tw',
};

export class ShopeeSource extends TrendSourceBase {
  readonly meta: TrendSourceMeta = {
    id:             'shopee',
    name:           'Shopee Trending',
    description:    'Trending search keywords from Shopee across Southeast Asian markets. Free — no API key needed.',
    requiresApiKey: false,
    supportsGeo:    true,
    geoOptions:     [
      { value: 'VN', label: 'Vietnam' },
      { value: 'SG', label: 'Singapore' },
      { value: 'TH', label: 'Thailand' },
      { value: 'PH', label: 'Philippines' },
      { value: 'ID', label: 'Indonesia' },
      { value: 'MY', label: 'Malaysia' },
      { value: 'TW', label: 'Taiwan' },
    ],
  };

  async fetch(cfg: TrendSourceConfig): Promise<TrendTopic[]> {
    const geo    = cfg.geo ?? 'VN';
    const domain = GEO_TO_DOMAIN[geo] ?? 'shopee.vn';
    const limit  = cfg.limit ?? 20;

    // Shopee unofficial trending keyword endpoint
    const url = `https://${domain}/api/v4/search/get_trending_search_keyword?limit=${limit}&page_type=trending_search`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer':     `https://${domain}/`,
          'Accept':      'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return this.getShopeeKeywordsFallback(geo, limit);

      const data: any = await res.json();

      // Response shape: { data: { keywords: string[] } } or { keywords: [...] }
      const keywords: string[] = (
        data?.data?.keywords ??
        data?.keywords ??
        data?.data?.trending_search_list?.map((k: any) => k?.keyword ?? k) ??
        []
      );

      if (!keywords.length) return this.getShopeeKeywordsFallback(geo, limit);

      return keywords.slice(0, limit).map((kw: string) => ({
        hashtag:         kw.toLowerCase().replace(/\s+/g, ''),
        description:     `Shopee trending search (${geo}): ${kw}`,
        engagementScore: 100_000 + Math.floor(Math.random() * 200_000),
        source:          'shopee',
        url:             `https://${domain}/search?keyword=${encodeURIComponent(kw)}`,
        category:        'ecommerce',
        geo,
      }));
    } catch {
      return this.getShopeeKeywordsFallback(geo, limit);
    }
  }

  // Fallback keywords by region when API is unavailable
  private getShopeeKeywordsFallback(geo: string, limit: number): TrendTopic[] {
    const byGeo: Record<string, string[]> = {
      VN: ['ao-thun-nu', 'dam-vay-nu', 'giay-the-thao', 'balo', 'my-pham-han', 'do-noi-that', 'phu-kien-dien-thoai'],
      SG: ['streetwear', 'skincare', 'stationery', 'minimals', 'tote-bags', 'joggers', 'sneakers'],
      TH: ['เสื้อยืด', 'กระเป๋า', 'รองเท้า', 'ของตกแต่งบ้าน', 'สกินแคร์'],
      PH: ['korean-fashion', 'aesthetic-clothing', 'muji-style', 'linen-set', 'tumblers'],
      ID: ['kaos-oversize', 'tas-wanita', 'skincare-korea', 'hijab-style', 'sneakers'],
      MY: ['baju-kurung', 'batik-modern', 'sneakers', 'minimalist-homedecor', 'korean-skincare'],
    };
    const kws = byGeo[geo] ?? byGeo['VN'];
    return kws.slice(0, limit).map(kw => ({
      hashtag:         kw,
      description:     `Shopee trending (${geo} fallback): ${kw}`,
      engagementScore: 80_000,
      source:          'shopee',
      url:             `https://${GEO_TO_DOMAIN[geo] ?? 'shopee.vn'}/search?keyword=${encodeURIComponent(kw)}`,
      category:        'ecommerce',
      geo,
    }));
  }
}
