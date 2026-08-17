'use client';

/**
 * Etsy-style toggle switch.
 *
 * Visual states:
 *   ON  — black track + white knob showing a ✓
 *   OFF — medium-gray track + white knob showing a ×
 *
 * Etsy's track is always black/near-black regardless of the seller's chosen
 * admin accent color — this is a fixed platform-chrome color, not `primary`.
 */

export interface ToggleProps {
  checked:    boolean;
  onChange:   (v: boolean) => void;
  disabled?:  boolean;
  /** Accessible label for screen readers (use when no visible label nearby) */
  ariaLabel?: string;
}

export function Toggle({ checked, onChange, disabled, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex w-11 h-[26px] shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-secondary' : 'bg-[#9CA3AF]',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none inline-flex items-center justify-center',
          'absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm',
          'transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        ].join(' ')}
      >
        {checked ? (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-secondary" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4 L4 7 L9 1" />
          </svg>
        ) : (
          <svg viewBox="0 0 8 8" className="w-2 h-2" fill="none" stroke="#9CA3AF" strokeWidth={1.8} strokeLinecap="round">
            <path d="M1 1 L7 7 M7 1 L1 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** Labelled toggle row — label on the left, toggle on the right. */
export interface ToggleRowProps extends ToggleProps {
  label:        string;
  description?: string;
}

export function ToggleRow({ label, description, checked, onChange, disabled, ariaLabel }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="max-w-lg">
        <span className="text-sm font-semibold text-secondary">{label}</span>
        {description && (
          <p className="text-sm text-muted mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0 mt-0.5">
        <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel ?? label} />
      </div>
    </div>
  );
}
