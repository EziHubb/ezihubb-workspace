interface AdminPageHeaderProps {
  title:     string;
  subtitle?: string;
  actions?:  React.ReactNode;
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}
