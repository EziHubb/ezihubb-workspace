'use client';

export interface TypingIndicatorProps {
  /** Rendered under the dots — e.g. the shop name. Omit for a bare bubble. */
  label?: string;
  className?: string;
}

/** Delays that turn one shared keyframe into a left-to-right wave. */
const DOT_DELAYS_MS = [0, 160, 320];

/**
 * The three-dot "someone is composing" bubble.
 *
 * Shaped like an incoming message rather than as a status line, because that
 * is what it is a placeholder for: it occupies the spot the message will land
 * in, so the thread does not jump when it arrives.
 *
 * The dots are decorative and are hidden from assistive tech; the same fact is
 * announced once as text through a live region instead. Three bouncing dots
 * read aloud as nothing at all, and a live region that re-announced on every
 * animation frame would be worse than silence.
 */
export function TypingIndicator({ label, className }: TypingIndicatorProps) {
  return (
    <div
      className={['flex items-end gap-2', className].filter(Boolean).join(' ')}
      data-testid="typing-indicator"
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted/10 px-3.5 py-2.5"
      >
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            // motion-reduce drops the movement but keeps the dots visible, so
            // the indicator still says what it says to someone who has asked
            // the system for less animation.
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-typing-dot motion-reduce:animate-none"
          />
        ))}
      </div>

      {/* polite, not assertive: this interrupts nothing and is obsolete the
          moment the actual message arrives. */}
      <span className="sr-only" aria-live="polite">
        {label ? `${label} is typing` : 'Typing'}
      </span>
    </div>
  );
}
