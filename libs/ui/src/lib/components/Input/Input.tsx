import React, { useId } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?:      string;
  helperText?: string;
  error?:      string;
  leftIcon?:   React.ReactNode;
  showCount?:  boolean;
  maxLength?:  number;
  fullWidth?:  boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      showCount = false,
      maxLength,
      fullWidth = false,
      className = '',
      id,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasError = Boolean(error);

    const [internalValue, setInternalValue] = React.useState(
      String(defaultValue ?? value ?? ''),
    );

    const displayValue = value !== undefined ? String(value) : internalValue;
    const charCount = displayValue.length;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) setInternalValue(e.target.value);
      props.onChange?.(e);
    };

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-secondary mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            value={value}
            defaultValue={defaultValue}
            maxLength={maxLength}
            onChange={handleChange}
            className={[
              'block rounded-sm border bg-surface px-3 py-2.5 text-sm text-secondary',
              'placeholder:text-muted/60',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              hasError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary focus:ring-primary/20',
              'disabled:bg-background disabled:text-muted disabled:cursor-not-allowed',
              leftIcon ? 'pl-9' : '',
              fullWidth ? 'w-full' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={hasError || undefined}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-hint`
                  : undefined
            }
            {...props}
          />
        </div>

        <div className="flex items-start justify-between mt-1 min-h-[1.25rem]">
          <span>
            {hasError && (
              <p id={`${inputId}-error`} className="text-xs text-error" role="alert">
                {error}
              </p>
            )}
            {!hasError && helperText && (
              <p id={`${inputId}-hint`} className="text-xs text-muted">
                {helperText}
              </p>
            )}
          </span>
          {(showCount || maxLength) && (
            <span
              className={`text-xs ml-auto ${
                maxLength && charCount > maxLength ? 'text-error' : 'text-muted'
              }`}
            >
              {charCount}
              {maxLength ? `/${maxLength}` : ''}
            </span>
          )}
        </div>
      </div>
    );
  },
);

Input.displayName = 'Input';
