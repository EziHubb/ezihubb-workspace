import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  fullWidth?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark focus-visible:ring-primary/40 shadow-sm',
  secondary:   'bg-surface text-secondary border border-border hover:bg-background active:bg-border focus-visible:ring-secondary/20',
  ghost:       'text-secondary hover:bg-background active:bg-border focus-visible:ring-secondary/20',
  destructive: 'bg-error text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-error/40 shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8  px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const Spinner = ({ size }: { size: ButtonSize }) => (
  <svg
    className={`animate-spin ${iconSizeClasses[size]} shrink-0`}
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = 'primary',
      size      = 'md',
      loading   = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium rounded-button',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'select-none whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner size={size} />
      ) : leftIcon ? (
        <span className={`${iconSizeClasses[size]} shrink-0`} aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      {children}

      {!loading && rightIcon ? (
        <span className={`${iconSizeClasses[size]} shrink-0`} aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </button>
  ),
);

Button.displayName = 'Button';
