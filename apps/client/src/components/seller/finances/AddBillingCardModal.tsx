'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Lock } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCreateBillingSetupIntent, useConfirmBillingCard } from '@ezihubb/api-client';

const stripePromise = loadStripe(process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '');

function InnerForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations('seller.finances.paymentSettings.billing');
  const stripe = useStripe();
  const elements = useElements();
  const confirmCard = useConfirmBillingCard();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError('');

    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (stripeError || !setupIntent?.payment_method) {
      setError(stripeError?.message ?? t('cardError'));
      setSubmitting(false);
      return;
    }

    try {
      await confirmCard.mutateAsync(
        typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method.id,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cardError'));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p className="text-sm text-error text-center p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
          {error}
        </p>
      )}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="w-3.5 h-3.5 text-success" />
        {t('secureNote')}
      </p>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary/40 transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
        >
          {submitting ? t('saving') : t('addCard')}
        </button>
      </div>
    </form>
  );
}

export function AddBillingCardModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('seller.finances.paymentSettings.billing');
  const createIntent = useCreateBillingSetupIntent();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    createIntent.mutate(undefined, {
      onSuccess: (res) => setClientSecret(res.clientSecret),
      onError:   (err) => setInitError(err instanceof Error ? err.message : t('cardError')),
    });
    // Only ever create one SetupIntent per modal open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-secondary">{t('addCard')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="text-muted hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {initError ? (
          <p className="text-sm text-error text-center py-6">{initError}</p>
        ) : !clientSecret ? (
          <div className="py-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <InnerForm onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
