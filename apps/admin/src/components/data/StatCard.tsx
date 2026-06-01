import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ColorKey = 'coral' | 'amber' | 'blue' | 'green';

const COLOR_MAP: Record<ColorKey, { bg: string; text: string }> = {
  coral: { bg: 'bg-primary/10',  text: 'text-primary'  },
  amber: { bg: 'bg-amber-50',    text: 'text-amber-500' },
  blue:  { bg: 'bg-blue-50',     text: 'text-blue-500'  },
  green: { bg: 'bg-green-50',    text: 'text-green-500' },
};

export interface StatCardProps {
  label:   string;
  value:   string | number;
  icon:    LucideIcon;
  color?:  ColorKey;
  trend?:  { direction: 'up' | 'down'; percent: number };
  prefix?: string;
  suffix?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color   = 'coral',
  trend,
  prefix  = '',
  suffix  = '',
}: StatCardProps) {
  const { bg, text } = COLOR_MAP[color];

  return (
    <div className="bg-surface rounded-card p-5 shadow-card border border-border">
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${text}`} />
        </div>

        {/* Trend */}
        {trend && (
          <span
            className={[
              'flex items-center gap-1 text-xs font-semibold rounded-pill px-2 py-0.5',
              trend.direction === 'up'
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-500',
            ].join(' ')}
          >
            {trend.direction === 'up'
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            {trend.percent.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-3xl font-bold text-secondary mt-4 leading-none tabular-nums">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>

      {/* Label + period */}
      <p className="text-sm text-muted mt-1.5">{label}</p>
      {trend && (
        <p className="text-xs text-muted/60 mt-0.5">vs last period</p>
      )}
    </div>
  );
}
