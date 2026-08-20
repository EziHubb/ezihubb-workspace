import { useLocale, useTranslations } from 'next-intl';
import type { ProductCardLabels, ProductBadgeVariant } from '@ezihubb/ui';

/** Builds the translated `locale`/`labels`/badge-label lookup for `@ezihubb/ui`'s <ProductCard>. */
export function useProductCardLabels() {
  const locale   = useLocale();
  const tCommon  = useTranslations('common');
  const tActions = useTranslations('product.actions');
  const tBadge   = useTranslations('search.badge');
  const tSearch  = useTranslations('search');

  const labels: ProductCardLabels = {
    addToWishlist:      tCommon('addToWishlist'),
    removeFromWishlist: tCommon('removeFromWishlist'),
    personalizeNow:     tActions('personalize'),
    addToCart:          tActions('addToCart'),
    // .raw() keeps this a plain string — ProductCard substitutes {name}.
    // Kept identical to the two Server Components that build the same object;
    // a closure here cannot cross a Server -> Client boundary.
    byStore:            tCommon.raw('byStore') as string,
    fromPrice:          tCommon('fromPrice'),
    digitalDownload:    tSearch('digitalDownload'),
  };

  const badgeLabels: Record<ProductBadgeVariant, string> = {
    bestseller: tBadge('bestseller'),
    new:        tBadge('new'),
    sale:       tBadge('sale'),
    hot:        tBadge('editorsPick'),
  };

  return { locale, labels, badgeLabels };
}
