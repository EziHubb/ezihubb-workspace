export type ConversionBucket = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * Shape of items in TermAnalysisDto.bestsellers, as actually sent by
 * MarketplaceInsightsService (which forwards SearchService.search() results
 * — apps/api/src/modules/products/dto/product-list-item.dto.ts). Deliberately
 * NOT the frontend ProductListItemDto in product.types.ts — that's a
 * differently-shaped type for a different set of endpoints (e.g. it has
 * `rating: {avg,count}`, this has flat `averageRating`/`reviewCount`) and
 * reusing it here silently breaks at runtime instead of at compile time.
 */
export interface InsightsBestsellerDto {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  primaryImageUrl: string | null;
  primaryImage: string | null;
  images: { url: string }[];
  averageRating: number | null;
  reviewCount: number;
}

export interface TrendingTermDto {
  term: string;
  searches: number;
  changePercent: number | null;
  imageUrl: string | null;
}

export interface TermTimeSeriesPoint {
  date: string;
  searches: number;
}

export interface TermDetailDto {
  term: string;
  searches: number;
  resultsCount: number;
  conversionRate: number;
  conversionBucket: ConversionBucket;
  timeSeries: TermTimeSeriesPoint[];
  relatedTerms: string[];
}

export interface PriceRangeDto {
  min: number;
  max: number;
  typicalLow: number;
  typicalHigh: number;
}

export interface TermAnalysisDto {
  term: string;
  priceRange: PriceRangeDto | null;
  bestsellers: InsightsBestsellerDto[];
  yourPrices: { min: number; max: number; count: number } | null;
}

export interface SavedSearchTermDto {
  id: string;
  userId: string;
  term: string;
  createdAt: string;
}

export interface InsightsQuotaDto {
  used:      number;
  limit:     number;
  remaining: number;
  resetsAt:  string;
}
