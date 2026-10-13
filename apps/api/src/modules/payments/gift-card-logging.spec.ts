import { PaymentsService } from './payments.service';

describe('gift-card purchase logging', () => {
  it('logs only the record reference, while preserving private delivery data', async () => {
    const code = 'SYNTHETIC-PRIVATE-CODE';
    const recipientEmail = 'recipient@ezihubb.test';
    const logger = { log: jest.fn() };
    const emailQueue = { add: jest.fn() };
    const service: PaymentsService = Object.assign(
      Object.create(PaymentsService.prototype),
      {
        stripe: { paymentIntents: { create: jest.fn(async () => ({
          id: 'synthetic-intent', status: 'succeeded',
        })) } },
        prisma: { giftCard: { create: jest.fn(async () => ({
          id: 'synthetic-card', code, expiresAt: new Date('2027-01-01'),
        })) } },
        generateGiftCardCode: () => code,
        config: { get: () => 'https://ezihubb.test' },
        logger,
        emailQueue,
      },
    );

    await expect(service.purchaseGiftCard({
      amount: 25, recipientEmail, paymentMethodId: 'synthetic-method',
    })).resolves.toEqual({ giftCardCode: code, amount: 25, recipientEmail });
    expect(emailQueue.add).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ to: recipientEmail, data: expect.objectContaining({ code }) }),
      expect.any(Object));
    expect(logger.log).toHaveBeenCalledWith('Gift card purchased: id=synthetic-card');
    const logs = JSON.stringify(logger.log.mock.calls);
    expect(logs).not.toContain(code);
    expect(logs).not.toContain(recipientEmail);
  });
});
