import { ConsoleLogger, LogLevel } from '@nestjs/common';

interface AxiomEvent {
  _time: string;
  level: LogLevel;
  message: string;
  context?: string;
  trace?: string;
}

/**
 * Extends Nest's default console logger to also ship error/warn entries to
 * Axiom (AXIOM_TOKEN/AXIOM_DATASET — previously defined in .env.example but
 * never wired to any code, so nothing was ever actually shipped). Console
 * output is unchanged either way; Axiom ingestion is best-effort and never
 * blocks or throws into the caller.
 */
export class AxiomLoggerService extends ConsoleLogger {
  private readonly token = process.env['AXIOM_TOKEN'];
  private readonly dataset = process.env['AXIOM_DATASET'] || 'ezihubb-dev';
  private queue: AxiomEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  private readonly enabled = !!this.token;

  constructor(context?: string) {
    super(context ?? 'App');
    if (this.enabled) {
      this.flushTimer = setInterval(() => void this.flush(), 5_000);
      this.flushTimer.unref?.();
    }
  }

  override error(message: unknown, stack?: string, context?: string): void {
    super.error(message, stack, context);
    this.enqueue('error', message, context, stack);
  }

  override warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.enqueue('warn', message, context);
  }

  private enqueue(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    if (!this.enabled) return;
    this.queue.push({
      _time: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      trace,
    });
    if (this.queue.length >= 50) void this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.enabled || this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      const res = await fetch(`https://api.axiom.co/v1/datasets/${this.dataset}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        // Deliberately uses the parent console logger, not this.error(), to avoid
        // an infinite loop of failed-shipping-attempts re-triggering shipping.
        super.warn(`Axiom ingest failed: HTTP ${res.status}`, 'AxiomLoggerService');
      }
    } catch (err) {
      super.warn(`Axiom ingest error: ${(err as Error).message}`, 'AxiomLoggerService');
    }
  }
}
