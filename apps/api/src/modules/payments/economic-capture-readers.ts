import axios from 'axios';
import { EconomicProvenance } from '@prisma/client';
import type { CaptureEvidenceReader } from '../finances/economic-capture';

export type StripeCaptureClient = {
  accounts: { retrieve: (id: null, params: Record<string, never>, options: { timeout: number; maxNetworkRetries: number }) => Promise<{ id: string }> };
  paymentIntents: { retrieve: (id: string, params: { expand: string[] }, options: { timeout: number; maxNetworkRetries: number }) => Promise<unknown> };
};

/** Read-only adapter; factory creation performs no I/O. Not registered or scheduled. */
export function stripeEconomicCaptureReader(
  stripe: StripeCaptureClient, accountId: string, provenance: EconomicProvenance,
): CaptureEvidenceReader {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error('Invalid Stripe account identity');
  return {
    scope: { providerAccount: accountId, provenance },
    read: async expected => {
      if (expected.provider !== 'STRIPE' || !/^pi_[A-Za-z0-9]+$/.test(expected.providerPaymentId)) {
        throw new Error('Invalid Stripe payment binding');
      }
      // Credentials must really belong to the configured account. This adapter
      // supports platform charges only; Connect requires an explicit extension.
      const account = await stripe.accounts.retrieve(null, {}, { timeout: 10_000, maxNetworkRetries: 0 });
      if (account.id !== accountId) throw new Error('Stripe credential account mismatch');
      return stripe.paymentIntents.retrieve(expected.providerPaymentId, { expand: ['latest_charge'] }, {
        timeout: 10_000, maxNetworkRetries: 0,
      });
    },
  };
}

/** captureId is a lookup hint, not proof. Payee/order/metadata/amount are rechecked. */
export function paypalEconomicCaptureReader(options: {
  merchantId: string; provenance: EconomicProvenance; captureId: string;
  accessToken: () => Promise<string>;
}): CaptureEvidenceReader {
  if (!/^[A-Za-z0-9]{1,100}$/.test(options.captureId) || !/^[A-Za-z0-9]{1,100}$/.test(options.merchantId)) {
    throw new Error('Invalid PayPal lookup identity');
  }
  const origin = options.provenance === 'LIVE' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  return {
    scope: { providerAccount: options.merchantId, provenance: options.provenance },
    read: async expected => {
      if (expected.provider !== 'PAYPAL') throw new Error('Invalid PayPal payment binding');
      const token = await options.accessToken();
      const response = await axios.get(`${origin}/v2/payments/captures/${options.captureId}`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10_000, maxRedirects: 0,
      });
      if (response.data?.id !== options.captureId) throw new Error('PayPal capture lookup mismatch');
      return response.data;
    },
  };
}
