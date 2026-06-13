import { ReloadButton } from '../ui/ReloadButton';

interface AdminPageHeaderProps {
  title:     string;
  subtitle?: string;
  actions?:  React.ReactNode;
  /** Query key prefix to pass to ReloadButton. Pass false to hide reload button. */
  queryKey?: unknown[] | false;
}

export function AdminPageHeader({ title, subtitle, actions, queryKey }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-secondary leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1 leading-snug">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
        {actions}
        {queryKey !== false && <ReloadButton queryKey={queryKey} />}
      </div>
    </div>
  );
}
