'use client';

/**
 * PaymentForm — Step 3 of checkout.
 *
 * Receives clientSecret (and orderNumber) already created by page.tsx.
 * Renders Stripe Elements declaratively using @stripe/react-stripe-js.
 *
 * On success Stripe redirects to return_url; if payment completes without
 * redirect (no 3DS) onSuccess is called directly.
 */

import { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// ── Stripe promise (singleton per app session) ─────────────────────────────────
const stripePromise = loadStripe(
  process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '',
);

// ── Inner form (uses Stripe hooks — must be inside <Elements>) ─────────────────

function StripeInnerForm({
  orderNumber,
  totalAmount,
  locale,
  onSuccess,
  onBack,
}: {
  orderNumber:  string;
  totalAmount:  number;
  locale:       string;
  onSuccess:    (orderNumber: string) => void;
  onBack:       () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setPaymentError('');

    const returnUrl = `${window.location.origin}/${locale}/checkout/success?order=${orderNumber}`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // Don't force redirect for card payments — let Stripe redirect only if needed
      redirect: 'if_required',
    });

    if (error) {
      setPaymentError(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else {
      // No redirect needed (e.g. card without 3DS) — success
      onSuccess(orderNumber);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe PaymentElement */}
      <div>
        <PaymentElement
          options={{ layout: 'tabs' }}
        />
      </div>

      {paymentError && (
        <p
          className="text-sm text-error text-center p-3 bg-error/5 border border-error/20 rounded-sm"
          role="alert"
        >
          {paymentError}
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="w-3.5 h-3.5 text-success" />
        Payments are encrypted and secure
      </p>

      {/* Navigation — desktop */}
      <div className="hidden md:flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isProcessing ? 'Processing…' : `Place Order — $${totalAmount.toFixed(2)}`}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="w-12 h-12 border border-border rounded-button flex items-center justify-center text-secondary shrink-0 disabled:opacity-50"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="flex-1 py-3.5 bg-primary text-white font-bold text-sm rounded-button disabled:opacity-50 uppercase tracking-wide"
        >
          {isProcessing ? 'Processing…' : `Place Order — $${totalAmount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  clientSecret: string;
  orderNumber:  string;
  totalAmount:  number;
  locale:       string;
  onSuccess:    (orderNumber: string) => void;
  onBack:       () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaymentForm({
  clientSecret,
  orderNumber,
  totalAmount,
  locale,
  onSuccess,
  onBack,
}: PaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme:     'stripe',
          variables: {
            colorPrimary: '#E85D3F',
            borderRadius: '8px',
            fontFamily:   'var(--font-inter), Inter, system-ui, sans-serif',
          },
        },
      }}
    >
      <StripeInnerForm
        orderNumber={orderNumber}
        totalAmount={totalAmount}
        locale={locale}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  );
}
