import type { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { JOBS } from './queue.constants';
import { sendCriticalJobAlert } from './critical-job-alert';

/**
 * Marker for a job that has exhausted every retry.
 *
 * Deliberately a fixed, unusual string: it is what an alert rule matches on.
 * Log text drifts, job names get renamed, but this token exists for no other
 * purpose, so nothing will change it by accident.
 */
export const DEAD_JOB_MARKER = '[DEAD-JOB]';

/**
 * True once BullMQ will not try this job again.
 *
 * The 'failed' worker event fires on EVERY attempt, so without this check a
 * handler treats the first transient blip exactly like permanent loss. That is
 * how a real failure ends up buried in a stream of identical lines that were
 * all going to retry successfully.
 */
export function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

/**
 * Jobs whose permanent failure costs money or leaves an order half-processed.
 *
 * These get a mail to whoever runs the platform, not just a log line. The rest
 * still get the marker, which is enough for a dashboard but not worth waking
 * anyone for.
 */
const CRITICAL_JOBS = new Set<string>([
  // Seller order stays unconfirmed and their revenue uncredited.
  JOBS.CONFIRM_STORE_ORDERS,
  // Affiliate never gets paid; nobody notices until they ask.
  JOBS.CREATE_ORDER_COMMISSION,
]);

/**
 * Reports a job that has run out of retries.
 *
 * Returns immediately while attempts remain, so callers can invoke it from a
 * plain 'failed' handler without repeating the arithmetic.
 *
 * Critical alerts go straight to SMTP, not to the failed Redis queue. The log
 * marker remains when SMTP is absent/unavailable. A process that cannot run
 * this handler still needs an independent external monitor (M5 acceptance).
 */
export async function reportDeadJob(
  job: Job,
  _error: Error,
  ctx: { logger: Logger; emailQueue?: Queue; isCritical?: boolean },
): Promise<void> {
  if (!isFinalAttempt(job)) return;

  const critical = ctx.isCritical ?? CRITICAL_JOBS.has(job.name);
  const detail =
    `${DEAD_JOB_MARKER} job=${job.name} id=${job.id} ` +
    `queue=${job.queueName} attempts=${job.attemptsMade} ` +
    'error=JOB_FAILED';

  ctx.logger.error(detail);

  if (!critical) return;
  try {
    const result = await sendCriticalJobAlert({ jobName: job.name, jobId: String(job.id ?? ''), queueName: job.queueName, attempts: job.attemptsMade });
    if (result === 'NOT_CONFIGURED') ctx.logger.error('[CRITICAL-ALERT] SMTP_NOT_CONFIGURED');
  } catch {
    // Never emit credentials/provider replies or mask the original job failure.
    ctx.logger.error('[CRITICAL-ALERT] SMTP_FAILED_OR_UNKNOWN');
  }
}
