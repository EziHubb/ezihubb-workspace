import axios from 'axios';
import { paypalEconomicCaptureReader, stripeEconomicCaptureReader } from './economic-capture-readers';
import { CaptureExpectation } from './economic-capture-evidence';

jest.mock('axios');
const expected: CaptureExpectation = { operationId: 'op1', orderId: 'order1', quoteHash: 'a'.repeat(64),
  provider: 'STRIPE', providerAccount: 'acct_test', provenance: 'TEST', providerPaymentId: 'pi_test', currency: 'USD', minorExponent: 2, amountMinor: '100' };

describe('read-only capture transports (mocked)', () => {
  beforeEach(() => jest.clearAllMocks());
  it('checks actual Stripe credential account before retrieving payment evidence', async () => {
    const client = { accounts: { retrieve: jest.fn().mockResolvedValue({ id: 'acct_test' }) },
      paymentIntents: { retrieve: jest.fn().mockResolvedValue({ id: 'pi_test' }) } };
    const reader = stripeEconomicCaptureReader(client, 'acct_test', 'TEST');
    expect(client.accounts.retrieve).not.toHaveBeenCalled();
    await reader.read(expected);
    expect(client.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test', { expand: ['latest_charge'] }, { timeout: 10000, maxNetworkRetries: 0 });
    client.accounts.retrieve.mockResolvedValue({ id: 'acct_foreign' });
    client.paymentIntents.retrieve.mockClear();
    await expect(reader.read(expected)).rejects.toThrow('account mismatch');
    expect(client.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
  it('uses a fixed sandbox host, disables redirects and only reads the capture', async () => {
    jest.mocked(axios.get).mockResolvedValue({ data: { id: 'capture1' } });
    const token = jest.fn().mockResolvedValue('synthetic-test-token');
    const reader = paypalEconomicCaptureReader({ merchantId: 'merchant1', provenance: 'TEST', captureId: 'capture1', accessToken: token });
    expect(token).not.toHaveBeenCalled();
    await reader.read({ ...expected, provider: 'PAYPAL' });
    expect(axios.get).toHaveBeenCalledWith('https://api-m.sandbox.paypal.com/v2/payments/captures/capture1', {
      headers: { Authorization: 'Bearer synthetic-test-token' }, timeout: 10000, maxRedirects: 0,
    });
    expect(axios.post).not.toHaveBeenCalled();
    expect(() => paypalEconomicCaptureReader({ merchantId: 'merchant1', provenance: 'TEST', captureId: '../refund', accessToken: token })).toThrow();
  });
});
