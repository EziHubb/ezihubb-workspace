import { ExternalLink } from 'lucide-react';

export interface TabSectionProps {
  /** Optional card title — bold, sits above description */
  title?:       string;
  /** Muted sub-text below title */
  description?: string;
  /** Right-aligned element (button, link, etc.) */
  action?:      React.ReactNode;
  /** Inline text link appended after description */
  link?:        { label: string; href: string };
  children:     React.ReactNode;
  /** Extra class on the outer wrapper */
  className?:   string;
}

/**
 * White padded section card used inside every product-edit tab.
 * Matches Etsy's ~px-8 py-6 whitespace rhythm.
 *
 * Usage:
 *   <TabSection title="Variations" action={<ManageButton />}>
 *     …content…
 *   </TabSection>
 */
export function TabSection({
  title,
  description,
  action,
  link,
  children,
  className = '',
}: TabSectionProps) {
  const hasHeader = title || description || link || action;

  return (
    <div className={`px-8 py-6 ${className}`}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-6 mb-6">
          {/* Text block */}
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-secondary leading-snug">{title}</h3>
            )}
            {(description || link) && (
              <p className="text-sm text-muted mt-1 leading-relaxed max-w-2xl">
                {description}
                {link && (
                  <>
                    {description && ' '}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5"
                    >
                      {link.label}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Action slot */}
          {action && <div className="shrink-0 mt-0.5">{action}</div>}
        </div>
      )}

      {children}
    </div>
  );
}
