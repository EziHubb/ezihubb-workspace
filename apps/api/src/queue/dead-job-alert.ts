import type { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, JOBS } from './queue.constants';
import { jobIdOf } from './domain-events';

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
 * KNOWN LIMIT: the alert is queued as an email, so a failure caused by Redis
 * being down takes the alert with it. Covering that needs an out-of-band
 * channel and is not solved here — the marker in the log still ships to the
 * log backend independently, which is the fallback.
 */
export async function reportDeadJob(
  job: Job,
  error: Error,
  ctx: { logger: Logger; emailQueue?: Queue; isCritical?: boolean },
): Promise<void> {
  if (!isFinalAttempt(job)) return;

  const critical = ctx.isCritical ?? CRITICAL_JOBS.has(job.name);
  const detail =
    `${DEAD_JOB_MARKER} job=${job.name} id=${job.id} ` +
    `queue=${job.queueName} attempts=${job.attemptsMade} ` +
    `data=${JSON.stringify(job.data)} — ${error.message}`;

  ctx.logger.error(detail);

  if (!critical || !ctx.emailQueue) return;

  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@ezihubb.com';
  await ctx.emailQueue
    .add(
      JOBS.SEND_EMAIL,
      {
        to:       adminEmail,
        template: 'system-alert',
        subject:  `Job failed permanently: ${job.name}`,
        data: {
          jobName:   job.name,
          jobId:     String(job.id ?? ''),
          queueName: job.queueName,
          attempts:  job.attemptsMade,
          payload:   JSON.stringify(job.data),
          error:     error.message,
          year:      new Date().getFullYear(),
        },
      },
      // Its own jobId, so a job failing repeatedly across deploys does not
      // mail the same alert again and again.
      // Same ':' trap as the event bus — and worse here, because a throw while
      // reporting a dead job would hide the failure it was sent to report.
      { ...DEFAULT_JOB_OPTIONS, jobId: jobIdOf('dead-job-alert', job.queueName, job.id ?? '') },
    )
    // Never let alerting failure mask the original failure — that error is the
    // one worth keeping, and throwing here would replace it.
    .catch((e: Error) =>
      ctx.logger.error(`Failed to queue dead-job alert for ${job.name}: ${e.message}`),
    );
}
