import { RefreshCw, Wifi } from 'lucide-react';

export interface NetworkErrorProps {
  onRetry:    () => void;
  message?:   string;
  className?: string;
}

export function NetworkError({
  onRetry,
  message   = 'Check your internet connection and try again.',
  className = '',
}: NetworkErrorProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 text-center ${className}`}>
      <Wifi className="w-12 h-12 text-muted/30 mb-1" aria-hidden="true" />
      <p className="text-sm font-bold text-secondary">Connection error</p>
      <p className="text-xs text-muted max-w-[200px]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 border border-border text-secondary text-xs font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  );
}
