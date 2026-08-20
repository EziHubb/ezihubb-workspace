import type { ProductVideoDto } from './dto/product-response.dto';

/** The columns any caller must select to build a `ProductVideoDto`. */
export interface ProductVideoRow {
  id: string;
  url: string;
  posterUrl: string | null;
  posterSquareUrl: string | null;
  durationSeconds: number | null;
  createdAt: Date;
}

/**
 * Seconds -> ISO 8601 duration (`10.4` becomes `PT10.4S`).
 *
 * The number is what we store, because it is comparable; this string is
 * produced only at the response boundary, where it is the shape
 * schema.org/VideoObject expects for video markup.
 */
export function toIso8601Duration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const rounded = Math.round(seconds * 10) / 10;
  return `PT${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}S`;
}

/**
 * Maps one `ProductVideo` row to its wire shape.
 *
 * Deliberately a free function in its own module rather than a private method
 * on ProductsService: the same mapping is needed by ProductsService (detail +
 * list) and SearchService (list), and the three list mappers in this codebase
 * have a documented history of drifting apart when a field is added to one and
 * forgotten in the others. One implementation cannot drift from itself.
 *
 * `thumbnailUrls` is ordered by intent — the full-size gallery poster first,
 * the card-sized square second — and may be EMPTY. Clips that predate poster
 * extraction, and clips whose opening frames would not decode, have no poster.
 * An empty list is the honest answer; callers fall back to the product image
 * rather than rendering a URL that would 404.
 */
export function toProductVideoDto(v: ProductVideoRow): ProductVideoDto {
  return {
    id:            v.id,
    url:           v.url,
    thumbnailUrls: [v.posterUrl, v.posterSquareUrl].filter((u): u is string => !!u),
    duration:      toIso8601Duration(v.durationSeconds),
    uploadedAt:    v.createdAt.toISOString(),
  };
}
