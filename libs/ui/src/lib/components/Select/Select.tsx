import React from 'react';

export interface SelectOption {
  value:    string;
  label:    string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options:   SelectOption[];
  /** Rendered as the first, disabled, unselectable option when set. */
  placeholder?: string;
  error?:    boolean;
  size?:     'sm' | 'md';
}

/**
 * A real, native `<select>` — Etsy itself styles only the closed trigger
 * (border, padding, chevron, focus ring) and accepts native OS rendering
 * for the open dropdown list, rather than building a custom listbox for
 * every simple single-value picker (discount %, currency, country,
 * processing time, etc). Use `Combobox` instead only for search-and/or
 * multi-select pickers, which Etsy *does* build custom.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, error, size = 'md', className = '', disabled, ...props }, ref) => {
    const sizeClasses = size === 'sm' ? 'h-9 pl-3 pr-8 text-sm' : 'h-11 pl-3.5 pr-9 text-sm';
    return (
      <div className="relative inline-block w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={[
            'w-full appearance-none rounded-input border bg-surface text-secondary',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            error ? 'border-error' : 'border-border hover:border-secondary/30',
            sizeClasses,
            className,
          ].join(' ')}
          {...props}
        >
          {placeholder && <option value="" disabled hidden>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
          ))}
        </select>
        <svg
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  },
);
Select.displayName = 'Select';
