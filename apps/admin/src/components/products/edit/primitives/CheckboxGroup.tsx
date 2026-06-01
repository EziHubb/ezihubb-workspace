import { Check } from 'lucide-react';

export interface CheckboxOption {
  value:     string;
  label:     string;
  /** Full description paragraph */
  desc?:     string;
  /** Muted italic examples line */
  examples?: string;
  /**
   * If true, selecting this option deselects everything else.
   * Selecting any other option deselects this one.
   * Useful for "None, I don't use tools".
   */
  exclusive?: boolean;
}

interface CheckboxGroupProps {
  values:    string[];
  onChange:  (updated: string[]) => void;
  options:   CheckboxOption[];
  /** "row" = bare label rows | "card" = bordered cards (default) */
  variant?:  'row' | 'card';
}

/**
 * Vertical checkbox list — supports "select all that apply".
 *
 * variant="row"  → bare label rows with description/examples
 * variant="card" → bordered card per option (default, matches Etsy screenshots)
 *
 * Exclusive options (e.g. "None") deselect all others when picked, and are
 * automatically cleared when any non-exclusive option is selected.
 */
export function CheckboxGroup({
  values,
  onChange,
  options,
  variant = 'card',
}: CheckboxGroupProps) {
  const toggle = (opt: CheckboxOption) => {
    const { value, exclusive } = opt;

    if (exclusive) {
      // Exclusive: select only this option
      onChange(values.includes(value) ? [] : [value]);
      return;
    }

    // Non-exclusive: deselect any exclusive options, then toggle this one
    const exclusiveValues = options.filter((o) => o.exclusive).map((o) => o.value);
    const withoutExclusive = values.filter((v) => !exclusiveValues.includes(v));

    if (withoutExclusive.includes(value)) {
      onChange(withoutExclusive.filter((v) => v !== value));
    } else {
      onChange([...withoutExclusive, value]);
    }
  };

  return (
    <div className={variant === 'card' ? 'space-y-2' : 'space-y-3'}>
      {options.map((opt) => {
        const checked = values.includes(opt.value);

        if (variant === 'row') {
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt)}
              className="flex items-start gap-3 w-full text-left"
            >
              <CheckDot checked={checked} className="mt-0.5" />
              <div>
                <span className={`text-sm font-medium ${checked ? 'text-secondary' : 'text-secondary'}`}>
                  {opt.label}
                </span>
                {opt.desc && <p className="text-sm text-secondary mt-0.5 leading-relaxed">{opt.desc}</p>}
                {opt.examples && <p className="text-xs text-muted italic mt-1">{opt.examples}</p>}
              </div>
            </button>
          );
        }

        // Card variant
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt)}
            className={[
              'flex items-start gap-3 px-4 py-4 rounded-lg border-2 text-left w-full transition-all',
              checked ? 'border-primary bg-primary/3' : 'border-border hover:border-primary/40',
            ].join(' ')}
          >
            <CheckDot checked={checked} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug ${checked ? 'text-primary' : 'text-secondary'}`}>
                {opt.label}
              </p>
              {opt.desc && (
                <p className="text-sm text-secondary mt-1 leading-relaxed">{opt.desc}</p>
              )}
              {opt.examples && (
                <p className="text-xs text-muted italic mt-1.5">{opt.examples}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Shared checkbox dot ───────────────────────────────────────────────────────

function CheckDot({ checked, className = '' }: { checked: boolean; className?: string }) {
  return (
    <div
      className={[
        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-muted',
        className,
      ].join(' ')}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
    </div>
  );
}
