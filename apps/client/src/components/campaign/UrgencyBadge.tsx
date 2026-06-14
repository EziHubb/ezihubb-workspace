import { Zap } from 'lucide-react';

export type UrgencyVariant = 'flash' | 'vip' | 'soldout' | 'remaining' | 'endstoday';

interface UrgencyBadgeProps {
  variant:    UrgencyVariant;
  count?:     number;
  className?: string;
}

export function UrgencyBadge({ variant, count, className = '' }: UrgencyBadgeProps) {
  const base = 'inline-flex items-center gap-1 font-bold text-[11px] uppercase tracking-wide px-2 py-1 select-none';

  switch (variant) {
    case 'flash':
      return (
        <span className={`${base} bg-primary text-white rounded-br-xl rounded-tl-lg ${className}`}>
          <Zap className="w-3 h-3 fill-white" /> Flash Deal
        </span>
      );

    case 'vip':
      return (
        <span
          className={`${base} rounded-full text-yellow-900 ${className}`}
          style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
        >
          ★ VIP Only
        </span>
      );

    case 'soldout':
      return (
        <span className={`${base} bg-[#9CA3AF] text-white rounded-full ${className}`}>
          Sold Out
        </span>
      );

    case 'remaining':
      return (
        <span className={`${base} bg-primary/10 text-primary rounded-full ${className}`}>
          {count ?? '—'} left
        </span>
      );

    case 'endstoday':
      return (
        <span
          className={`${base} bg-[#DC2626] text-white rounded-full ${className}`}
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white mr-0.5 inline-block" />
          Ends Today
        </span>
      );

    default:
      return null;
  }
}
