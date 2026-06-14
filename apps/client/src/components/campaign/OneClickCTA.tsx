'use client';

import { Loader2, Check } from 'lucide-react';

export type CTAState = 'idle' | 'loading' | 'success' | 'disabled';

interface OneClickCTAProps {
  label:       string;
  loadingLabel?: string;
  successLabel?: string;
  state?:      CTAState;
  onClick?:    () => void;
  className?:  string;
  icon?:       React.ReactNode;
  fullWidth?:  boolean;
}

export function OneClickCTA({
  label,
  loadingLabel = 'Adding...',
  successLabel = 'Added!',
  state        = 'idle',
  onClick,
  className    = '',
  icon,
  fullWidth    = true,
}: OneClickCTAProps) {
  const base = [
    'flex items-center justify-center gap-2',
    'h-[52px] rounded-full font-bold text-sm uppercase tracking-wide',
    'transition-all duration-200 select-none',
    fullWidth ? 'w-full' : 'min-w-[200px] px-8',
    className,
  ].join(' ');

  if (state === 'disabled') {
    return (
      <button type="button" disabled className={`${base} bg-[#D1D5DB] text-[#9CA3AF] cursor-not-allowed`}>
        {label}
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <button type="button" disabled className={`${base} bg-primary/70 text-white cursor-wait`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        {loadingLabel}
      </button>
    );
  }

  if (state === 'success') {
    return (
      <button type="button" disabled
        className={`${base} bg-primary text-white`}
        style={{ animation: 'none' }}
      >
        <Check className="w-5 h-5" style={{ animation: 'bounceIn 0.3s ease-out' }} />
        {successLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} bg-primary hover:bg-primary-dark text-white shadow-md hover:shadow-lg active:scale-[0.98]`}
    >
      {icon}
      {label}
    </button>
  );
}
