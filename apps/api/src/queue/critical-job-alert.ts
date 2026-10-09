import * as nodemailer from 'nodemailer';

export interface CriticalJobAlert { jobName: string; jobId: string; queueName: string; attempts: number }

/** Operational alerts bypass BullMQ/Redis. No customer payload or raw errors.
 * SMTP acceptance is not inbox delivery; failures are never auto-retried here. */
export async function sendCriticalJobAlert(alert: CriticalJobAlert): Promise<'SMTP_ACCEPTED' | 'NOT_CONFIGURED'> {
  const host = process.env['SMTP_HOST'];
  const to = process.env['ADMIN_EMAIL'];
  const from = process.env['EMAIL_FROM'];
  const port = Number(process.env['SMTP_PORT'] ?? 587);
  if (!host || !to || !from || !Number.isSafeInteger(port) || port < 1 || port > 65535) return 'NOT_CONFIGURED';
  const transport = nodemailer.createTransport({
    host, port, secure: process.env['SMTP_SECURE'] === 'true',
    ...(process.env['SMTP_USER'] ? { auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] } } : {}),
    connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
    logger: false, debug: false,
  });
  try {
    const result = await transport.sendMail({
      from, to, subject: '[EziHubb] Critical background job exhausted retries',
      text: `A critical job requires investigation.\nJob: ${alert.jobName}\nQueue: ${alert.queueName}\nJob ID: ${alert.jobId}\nAttempts: ${alert.attempts}\nInspect authorized job storage; no customer payload is included.`,
      disableFileAccess: true, disableUrlAccess: true,
    });
    if (!Array.isArray(result.accepted) || !result.accepted.length || (Array.isArray(result.rejected) && result.rejected.length)) {
      throw new Error('CRITICAL_ALERT_NOT_ACCEPTED');
    }
    return 'SMTP_ACCEPTED';
  } finally { transport.close(); }
}
