import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@ezihubb/ui';
const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default async function AddressesLoading() {
  const t = await getTranslations('common');
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('loadingAddresses')}>
      <div className="flex items-center justify-between">
        <Skeleton variant="rect" className="h-8 w-40" />
        <div className={`h-9 w-32 rounded-button ${S}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-card p-4 space-y-3">
            <Skeleton variant="rect" className="h-4 w-20" />
            <Skeleton variant="text" lines={3} />
            <div className="flex gap-2 pt-1">
              <div className={`h-8 w-16 rounded-button ${S}`} />
              <div className={`h-8 w-16 rounded-button ${S}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
