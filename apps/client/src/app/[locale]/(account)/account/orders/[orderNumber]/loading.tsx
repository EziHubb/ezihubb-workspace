import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@ezihubb/ui';
const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default async function OrderDetailLoading() {
  const t = await getTranslations('common');
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('loadingOrder')}>
      <div className={`h-4 w-24 ${S}`} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={`h-7 w-48 ${S}`} />
          <div className={`h-4 w-36 ${S}`} />
        </div>
        <div className={`h-6 w-24 rounded-pill ${S}`} />
      </div>
      <div className="border border-border rounded-card p-5">
        <Skeleton variant="rect" className="h-16 w-full rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border border-border rounded-card">
            <div className={`w-16 h-16 shrink-0 ${S}`} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-3/4" />
              <Skeleton variant="text" className="w-1/4" />
            </div>
            <div className={`h-5 w-16 ${S}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
