'use client';

import { useCountdown } from '../../hooks/useCountdown';

export type CountdownSize = 'sm' | 'md' | 'lg';

interface CountdownTimerProps {
  targetDate:   string | Date;
  size?:        CountdownSize;
  /** Override labels below digits */
  labels?:      [string, string, string];
  className?:   string;
}

const SIZE: Record<CountdownSize, { cell: string; digit: string; label: string; colon: string }> = {
  sm: { cell: 'w-[28px] h-[28px]', digit: 'text-xs',   label: 'text-[9px]',  colon: 'text-xs mx-0.5' },
  md: { cell: 'w-[40px] h-[44px]', digit: 'text-lg',   label: 'text-[10px]', colon: 'text-lg mx-1'   },
  lg: { cell: 'w-[64px] h-[72px]', digit: 'text-3xl',  label: 'text-[11px]', colon: 'text-3xl mx-1.5' },
};

export function CountdownTimer({
  targetDate,
  size     = 'md',
  labels   = ['HRS', 'MIN', 'SEC'],
  className = '',
}: CountdownTimerProps) {
  const { hours, minutes, seconds, expired } = useCountdown(targetDate);
  const s = SIZE[size];
  const pad = (n: number) => String(n).padStart(2, '0');

  const isUrgent = !expired && hours === 0;

  if (expired) {
    return (
      <span className={`inline-flex items-center text-xs font-bold text-muted ${className}`}>
        ENDED
      </span>
    );
  }

  const units = [
    { val: pad(hours),   label: labels[0] },
    { val: pad(minutes), label: labels[1] },
    { val: pad(seconds), label: labels[2] },
  ];

  return (
    <div className={`inline-flex items-end gap-0 ${className}`}>
      {units.map(({ val, label }, i) => (
        <div key={i} className="flex items-end gap-0">
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={[
                `${s.cell} bg-[#1A1A1A] rounded-lg flex items-center justify-center`,
                isUrgent ? 'border border-red-500 animate-pulse' : '',
              ].join(' ')}
            >
              <span
                className={`${s.digit} font-mono font-bold tabular-nums ${
                  isUrgent ? 'text-red-400' : 'text-white'
                }`}
              >
                {val}
              </span>
            </div>
            <span className={`${s.label} text-muted/60 font-medium tracking-widest uppercase`}>
              {label}
            </span>
          </div>
          {i < 2 && (
            <span
              className={`${s.colon} font-bold ${isUrgent ? 'text-red-400' : 'text-[#555]'} mb-[22px]`}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
