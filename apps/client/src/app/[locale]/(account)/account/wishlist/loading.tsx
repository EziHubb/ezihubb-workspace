import { ProductGridSkeleton } from '../../../../../components/skeletons/ProductGridSkeleton';
import { Skeleton } from '@mlh/ui';
export default function WishlistLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading wishlist">
      <Skeleton variant="rect" className="h-8 w-40" />
      <ProductGridSkeleton count={8} cols={2} />
    </div>
  );
}
