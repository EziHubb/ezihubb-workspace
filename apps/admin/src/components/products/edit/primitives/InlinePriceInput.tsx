import { useRef, useState, useCallback, useEffect } from 'react';

interface InlinePriceInputProps {
  /** Current value (null = no price override) */
  value:         number | null;
  /** Called when the user commits a change (blur or Enter) */
  onChange:      (value: number | null) => void;
  /** Placeholder shown when value is null / 0 */
  placeholder?:  string;
  /** Prefix symbol — defaults to "$" */
  prefix?:       string;
  /** Minimum allowed value — defaults to 0 */
  min?:          number;
  /** Disabled state */
  disabled?:     boolean;
  /** Called when Enter is pressed — useful for moving to the next row */
  onEnter?:      () => void;
  className?:    string;
}

/**
 * Compact inline price input used in the Variations summary table (Image 5-6).
 *
 * Visual:   [$ 29.39_______]
 *   – dollar prefix locked inside left edge
 *   – highlighted blue border on focus
 *   – blur or Enter commits the value
 *   – empty = null (no price override)
 */
export function InlinePriceInput({
  value,
  onChange,
  placeholder = '—',
  prefix = '$',
  min = 0,
  disabled,
  onEnter,
  className = '',
}: InlinePriceInputProps) {
  // Local string state so the user can type freely without rounding
  const [draft, setDraft] = useState<string>(
    value != null ? String(value) : '',
  );
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Resync when `value` changes from outside this input (e.g. a bulk-edit
  // action in a parent grid sets several rows' prices at once) — `draft`
  // otherwise only ever initializes once at mount and would keep showing
  // stale/empty text even though the underlying value actually changed.
  // Skipped while focused so it can't clobber in-progress typing.
  useEffect(() => {
    if (focused) return;
    setDraft(value != null ? String(value) : '');
  }, [value, focused]);

  const commit = useCallback(() => {
    if (draft.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed < min) {
      // Reset to previous committed value
      setDraft(value != null ? String(value) : '');
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    setDraft(String(rounded));
    onChange(rounded);
  }, [draft, min, onChange, value]);

  return (
    <div
      className={[
        'inline-flex items-center gap-0.5 border rounded-lg px-2.5 py-1.5 transition-all bg-background',
        focused
          ? 'border-primary ring-2 ring-primary/15'
          : 'border-border hover:border-primary/40',
        disabled ? 'opacity-50 pointer-events-none' : 'cursor-text',
        className,
      ].join(' ')}
      onClick={() => ref.current?.focus()}
    >
      {/* Prefix */}
      <span className="text-sm text-muted select-none">{prefix}</span>

      {/* Input */}
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        min={min}
        step={0.01}
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setFocused(true);
          // Select all on focus for quick replace
          ref.current?.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            onEnter?.();
          }
          if (e.key === 'Escape') {
            setDraft(value != null ? String(value) : '');
            ref.current?.blur();
          }
        }}
        className={[
          'w-20 bg-transparent text-sm text-secondary tabular-nums',
          'focus:outline-none placeholder:text-muted/60',
          // Hide native number spinners
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        ].join(' ')}
      />
    </div>
  );
}
