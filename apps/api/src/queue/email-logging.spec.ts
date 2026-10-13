import { Job } from 'bullmq';
import { EmailProcessor } from './email.processor';
import { JOBS, SendEmailJobData } from './queue.constants';

describe('email worker private-data logging boundary', () => {
  it('keeps recipient, subject, redemption code and raw SMTP errors out of logs', async () => {
    const logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const sendMail = jest.fn(async () => ({}));
    const processor: EmailProcessor = Object.assign(Object.create(EmailProcessor.prototype), {
      logger, transporter: { sendMail }, config: { get: () => 'synthetic' },
      renderTemplate: () => 'Private rendered email',
    });
    const job = {
      id: 'synthetic-job', name: JOBS.SEND_EMAIL, attemptsMade: 1,
      data: { to: 'private@ezihubb.test', subject: 'Private gift subject',
        template: 'gift-card-delivery', data: { code: 'PRIVATE-REDEEM-CODE' } },
    } as unknown as Job<SendEmailJobData>;
    await processor.process(job);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: job.data.to, subject: job.data.subject, html: 'Private rendered email',
    }));
    processor.onCompleted(job);
    processor.onFailed(job, new Error(`SMTP failure ${job.data.to} ${job.data.data.code}`));
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('id=synthetic-job'));
    const logs = JSON.stringify([logger.log.mock.calls, logger.error.mock.calls, logger.debug.mock.calls]);
    for (const value of [job.data.to, job.data.subject, job.data.data.code, 'Private rendered email', 'SMTP failure']) {
      expect(logs).not.toContain(value);
    }
  });
});
