import { AlertCircle, ExternalLink } from 'lucide-react';

export interface FormFieldProps {
  label:        string;
  required?:    boolean;
  /** Short helper text directly below the label */
  hint?:        string;
  /** Longer muted description (shown as paragraph) */
  description?: string;
  /** Inline text link appended to description */
  link?:        { label: string; href: string };
  /** Red error message shown below children */
  error?:       string;
  children:     React.ReactNode;
  className?:   string;
}

/**
 * Consistent label → hint/description → children → error wrapper
 * used on every form field across the product-edit tabs.
 *
 * Usage:
 *   <FormField label="Price" required error={errors.basePrice?.message}>
 *     <input … />
 *   </FormField>
 */
export function FormField({
  label,
  required,
  hint,
  description,
  link,
  error,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      {/* Label row */}
      <p className="text-sm font-semibold text-secondary mb-0.5">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
      </p>

      {/* Hint (tight, directly under label) */}
      {hint && (
        <p className="text-xs text-muted mb-1.5">{hint}</p>
      )}

      {/* Description paragraph + optional link */}
      {(description || link) && (
        <p className="text-sm text-muted mb-3 leading-relaxed">
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

      {/* Field content */}
      {children}

      {/* Validation error */}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600" role="alert">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
