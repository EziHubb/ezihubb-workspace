import { Skeleton } from '@ezihubb/ui';
export default function ProfileLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading profile">
      <Skeleton variant="rect" className="h-8 w-40" />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" width={80} height={80} />
          <div className="space-y-2">
            <Skeleton variant="rect" className="h-9 w-32 rounded-button" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton variant="rect" className="h-3.5 w-24" />
            <Skeleton variant="rect" className="h-10 w-full" />
          </div>
        ))}
        <Skeleton variant="rect" className="h-11 w-36 rounded-button" />
      </div>
    </div>
  );
}
