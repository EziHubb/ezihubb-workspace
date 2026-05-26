import React, { useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:      string;
  helperText?: string;
  error?:      string;
  showCount?:  boolean;
  maxLength?:  number;
  rows?:       number;
  fullWidth?:  boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      showCount  = false,
      maxLength,
      rows       = 4,
      fullWidth  = false,
      className  = '',
      id,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hasError = Boolean(error);

    const [internalValue, setInternalValue] = React.useState(
      String(defaultValue ?? value ?? ''),
    );

    const displayValue = value !== undefined ? String(value) : internalValue;
    const charCount = displayValue.length;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (value === undefined) setInternalValue(e.target.value);
      props.onChange?.(e);
    };

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-secondary mb-1.5"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          onChange={handleChange}
          className={[
            'block w-full rounded-sm border bg-surface px-3 py-2.5 text-sm text-secondary',
            'placeholder:text-muted/60 resize-y',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            hasError
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-border focus:border-primary focus:ring-primary/20',
            'disabled:bg-background disabled:text-muted disabled:cursor-not-allowed',
            fullWidth ? 'w-full' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError
              ? `${textareaId}-error`
              : helperText
                ? `${textareaId}-hint`
                : undefined
          }
          {...props}
        />

        <div className="flex items-start justify-between mt-1 min-h-[1.25rem]">
          <span>
            {hasError && (
              <p id={`${textareaId}-error`} className="text-xs text-error" role="alert">
                {error}
              </p>
            )}
            {!hasError && helperText && (
              <p id={`${textareaId}-hint`} className="text-xs text-muted">
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

Textarea.displayName = 'Textarea';
