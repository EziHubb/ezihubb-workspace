import * as nodemailer from 'nodemailer';
import { sendCriticalJobAlert } from './critical-job-alert';
import { reportDeadJob } from './dead-job-alert';
import { JOBS } from './queue.constants';
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('Critical job alerts are independent of Redis', () => {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'ADMIN_EMAIL'];
  let saved: Record<string, string | undefined>;
  const sendMail = jest.fn(), close = jest.fn();
  beforeEach(() => {
    saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASS: 'PRIVATE-CANARY',
      EMAIL_FROM: 'system@example.test', ADMIN_EMAIL: 'operator@example.test' });
    jest.clearAllMocks(); jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail, close } as never);
    sendMail.mockResolvedValue({ accepted: ['operator@example.test'], rejected: [] });
  });
  afterEach(() => {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  });
  const alert = { jobName: 'job', jobId: 'id', queueName: 'queue', attempts: 3 };
  it('sends bounded SMTP directly and distinguishes acceptance from delivery', async () => {
    await expect(sendCriticalJobAlert(alert)).resolves.toBe('SMTP_ACCEPTED');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ connectionTimeout: 3000, socketTimeout: 5000, debug: false }));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('never needs Redis or includes raw job payload/error in the alert', async () => {
    const emailQueue = { add: jest.fn().mockRejectedValue(new Error('Redis unavailable')) }, logger = { error: jest.fn() };
    await reportDeadJob({ name: JOBS.CONFIRM_STORE_ORDERS, id: 'job-id', queueName: 'orders', attemptsMade: 3, opts: { attempts: 3 },
      data: { email: 'PII-CANARY', token: 'SECRET-CANARY' } } as never, new Error('PRIVATE-ERROR'), { logger: logger as never, emailQueue: emailQueue as never });
    expect(sendMail).toHaveBeenCalledTimes(1); expect(emailQueue.add).not.toHaveBeenCalled();
    const output = JSON.stringify([sendMail.mock.calls, logger.error.mock.calls]);
    expect(output).not.toMatch(/PII-CANARY|SECRET-CANARY|PRIVATE-ERROR|PRIVATE-CANARY/);
  });
  it('does not swallow the job failure into a successful alert when SMTP fails', async () => {
    sendMail.mockRejectedValueOnce(new Error('PRIVATE-CANARY SMTP reply'));
    const logger = { error: jest.fn() };
    await reportDeadJob({ name: JOBS.CONFIRM_STORE_ORDERS, id: 'id', queueName: 'orders', attemptsMade: 3, opts: { attempts: 3 } } as never,
      new Error('PRIVATE'), { logger: logger as never });
    expect(logger.error).toHaveBeenCalledWith('[CRITICAL-ALERT] SMTP_FAILED_OR_UNKNOWN');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('PRIVATE'); expect(close).toHaveBeenCalled();
  });
  it('reports absent configuration without attempting delivery', async () => {
    delete process.env['ADMIN_EMAIL']; await expect(sendCriticalJobAlert(alert)).resolves.toBe('NOT_CONFIGURED');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
  it.each([{ accepted: [], rejected: ['operator@example.test'] }, { accepted: ['operator@example.test'], rejected: ['other@example.test'] }])('does not report rejected/partial SMTP as accepted', async result => {
    sendMail.mockResolvedValueOnce(result); await expect(sendCriticalJobAlert(alert)).rejects.toThrow('NOT_ACCEPTED');
    expect(close).toHaveBeenCalled();
  });
  it('does not alert while retries remain', async () => {
    await reportDeadJob({ name: JOBS.CONFIRM_STORE_ORDERS, attemptsMade: 1, opts: { attempts: 3 } } as never,
      new Error('PRIVATE'), { logger: { error: jest.fn() } as never });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
