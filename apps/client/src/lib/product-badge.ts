import type { ProductListItemDto } from '@ezihubb/types';
import type { ProductBadgeVariant } from '@ezihubb/ui';

/**
 * Picks the badge variant for a listing card from fields the API actually
 * sends.
 *
 * There used to be a `badge` field on the client's `ProductListItemDto` that
 * every card read directly. The API has never sent it — it is not on
 * `product-list-item.dto.ts` and no mapper emits it — so `product.badge` was
 * `undefined` everywhere. On the search card that only disabled half of each
 * condition, because the real fields were OR'd in alongside it; on the shop and
 * not-found grids, which passed `badge={product.badge}` straight through, no
 * badge could ever render at all.
 *
 * Order matters: the first match wins, so the list runs strongest claim first.
 * "Bestseller" outranks "on sale" because a discount is the seller's choice
 * while sales volume is not.
 *
 * There is deliberately no `new` variant here. The old code had one, reachable
 * only through `product.badge === 'new'` — so it was unreachable in practice.
 * Deriving it would mean picking how many days counts as new, which is a
 * merchandising decision, not a mechanical one.
 */
export function deriveProductBadge(
  product: Pick<ProductListItemDto, 'soldCount' | 'compareAtPrice' | 'isFeatured'>,
): ProductBadgeVariant | undefined {
  if ((product.soldCount ?? 0) > 1000) return 'bestseller';
  if (product.compareAtPrice)          return 'sale';
  if (product.isFeatured)              return 'hot';
  return undefined;
}
