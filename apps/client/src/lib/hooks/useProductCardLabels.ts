import { useLocale, useTranslations } from 'next-intl';
import type { ProductCardLabels, ProductBadgeVariant } from '@ezihubb/ui';

/** Builds the translated `locale`/`labels`/badge-label lookup for `@ezihubb/ui`'s <ProductCard>. */
export function useProductCardLabels() {
  const locale   = useLocale();
  const tCommon  = useTranslations('common');
  const tActions = useTranslations('product.actions');
  const tBadge   = useTranslations('search.badge');

  const labels: ProductCardLabels = {
    addToWishlist:      tCommon('addToWishlist'),
    removeFromWishlist: tCommon('removeFromWishlist'),
    personalizeNow:     tActions('personalize'),
    addToCart:          tActions('addToCart'),
    byStore:            (name: string) => tCommon('byStore', { name }),
    fromPrice:          tCommon('fromPrice'),
  };

  const badgeLabels: Record<ProductBadgeVariant, string> = {
    bestseller: tBadge('bestseller'),
    new:        tBadge('new'),
    sale:       tBadge('sale'),
    hot:        tBadge('editorsPick'),
  };

  return { locale, labels, badgeLabels };
}
