// ── Option shapes ────────────────────────────────────────────────────────────

export interface RadioOption<T extends string = string> {
  value:    T;
  label:    string;
  /** Short muted text below label (simple variant) */
  sub?:     string;
}

export interface RadioOptionRich<T extends string = string> extends RadioOption<T> {
  /** Full description paragraph */
  desc?:     string;
  /** Muted italic examples line */
  examples?: string;
}

// ── Simple radio group ────────────────────────────────────────────────────────

interface RadioGroupProps<T extends string> {
  value:    T;
  onChange: (v: T) => void;
  options:  RadioOption<T>[];
  /** "compact" = label only row | "card" = bordered card per option (default) */
  variant?: 'row' | 'card';
}

/**
 * Vertical radio list — label only (+ optional sub-text).
 *
 * variant="row"  → bare text rows (used in Who made it?)
 * variant="card" → bordered card rows (used in Renewal options)
 */
export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  variant = 'row',
}: RadioGroupProps<T>) {
  return (
    <div className={variant === 'card' ? 'space-y-2' : 'space-y-3'}>
      {options.map((opt) => {
        const selected = value === opt.value;

        if (variant === 'card') {
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'flex items-start gap-3 px-4 py-3.5 rounded-lg border-2 text-left w-full transition-all',
                selected ? 'border-primary bg-primary/3' : 'border-border hover:border-primary/40',
              ].join(' ')}
            >
              <RadioDot selected={selected} />
              <div>
                <p className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
                  {opt.label}
                </p>
                {opt.sub && (
                  <p className="text-sm text-muted mt-0.5">{opt.sub}</p>
                )}
              </div>
            </button>
          );
        }

        // Row variant — bare text
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <RadioDot selected={selected} hover />
            <div>
              <span className={`text-sm ${selected ? 'font-semibold text-secondary' : 'text-secondary'}`}>
                {opt.label}
              </span>
              {opt.sub && (
                <p className="text-xs text-muted mt-0.5">{opt.sub}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Rich radio group (label + desc + examples) ────────────────────────────────

interface RadioGroupRichProps<T extends string> {
  value:    T;
  onChange: (v: T) => void;
  options:  RadioOptionRich<T>[];
}

/**
 * Bordered card radio group with full description and examples.
 * Used in "What is it?" (HowItsMadeTab) and similar sections.
 */
export function RadioGroupRich<T extends string>({
  value,
  onChange,
  options,
}: RadioGroupRichProps<T>) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-start gap-3 px-4 py-4 rounded-lg border-2 text-left w-full transition-all',
              selected ? 'border-primary bg-primary/3' : 'border-border hover:border-primary/40',
            ].join(' ')}
          >
            <RadioDot selected={selected} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug ${selected ? 'text-primary' : 'text-secondary'}`}>
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

// ── Shared radio dot ──────────────────────────────────────────────────────────

function RadioDot({
  selected,
  hover,
  className = '',
}: {
  selected:  boolean;
  hover?:    boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
        selected
          ? 'border-primary'
          : hover
            ? 'border-muted group-hover:border-primary/50'
            : 'border-muted',
        className,
      ].join(' ')}
    >
      {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
    </div>
  );
}
