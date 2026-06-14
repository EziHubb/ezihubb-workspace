interface ProgressFillProps {
  /** 0–100 */
  pct:        number;
  size?:      'thin' | 'thick';
  label?:     string;
  className?: string;
  color?:     string;
}

export function ProgressFill({
  pct,
  size      = 'thin',
  label,
  className = '',
  color     = 'var(--color-primary, #E85D3F)',
}: ProgressFillProps) {
  const height = size === 'thin' ? 'h-2' : 'h-4';
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full ${height} rounded-full overflow-hidden bg-[#E8E4DF]`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      {label && (
        <p className="text-xs text-muted mt-1 text-right font-medium">{label}</p>
      )}
    </div>
  );
}
