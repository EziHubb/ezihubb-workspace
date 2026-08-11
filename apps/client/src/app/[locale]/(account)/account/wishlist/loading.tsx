import { getTranslations } from 'next-intl/server';
import { ProductGridSkeleton } from '../../../../../components/skeletons/ProductGridSkeleton';
import { Skeleton } from '@ezihubb/ui';
export default async function WishlistLoading() {
  const t = await getTranslations('common');
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('loadingWishlist')}>
      <Skeleton variant="rect" className="h-8 w-40" />
      <ProductGridSkeleton count={8} cols={2} />
    </div>
  );
}
