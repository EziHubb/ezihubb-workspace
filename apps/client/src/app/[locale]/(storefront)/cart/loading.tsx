import { getTranslations } from 'next-intl/server';
import { CartItemSkeleton } from '../../../../components/skeletons/CartItemSkeleton';

const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export default async function CartLoading() {
  const t = await getTranslations('common');
  return (
    <div
      className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12"
      aria-busy="true"
      aria-label={t('loadingCart')}
    >
      {/* Header */}
      <div className={`h-8 w-32 mb-8 ${S}`} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Cart items */}
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <CartItemSkeleton key={i} />
          ))}
        </div>

        {/* Order summary card */}
        <div className="border border-border rounded-card p-6 space-y-4">
          <div className={`h-5 w-32 ${S}`} />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className={`h-4 w-24 ${S}`} />
                <div className={`h-4 w-16 ${S}`} />
              </div>
            ))}
          </div>
          <div className={`h-px w-full bg-border`} />
          <div className="flex justify-between">
            <div className={`h-5 w-16 ${S}`} />
            <div className={`h-5 w-20 ${S}`} />
          </div>
          <div className={`h-12 w-full rounded-button ${S}`} />
        </div>
      </div>
    </div>
  );
}
