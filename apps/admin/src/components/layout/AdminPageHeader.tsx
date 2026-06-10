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
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1 leading-snug">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-4">
        {actions}
        {queryKey !== false && <ReloadButton queryKey={queryKey} />}
      </div>
    </div>
  );
}
