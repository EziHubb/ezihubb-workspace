'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { StoreCreditBadge } from './StoreCreditBadge';

// ── Stripe promise (singleton per app session) ─────────────────────────────────
const stripePromise = loadStripe(
  process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '',
);

const PAYPAL_CLIENT_ID = process.env['NEXT_PUBLIC_PAYPAL_CLIENT_ID'] ?? '';

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
      redirect: 'if_required',
    });

    if (error) {
      setPaymentError(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else {
      onSuccess(orderNumber);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <PaymentElement options={{ layout: 'tabs' }} />
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

// ── PayPal panel ──────────────────────────────────────────────────────────────

function PaypalPanel({
  orderId,
  orderNumber,
  onSuccess,
  onBack,
}: {
  orderId:     string;
  orderNumber: string;
  onSuccess:   (orderNumber: string) => void;
  onBack:      () => void;
}) {
  const [paypalError, setPaypalError] = useState('');

  return (
    <PayPalScriptProvider
      options={{
        clientId: PAYPAL_CLIENT_ID,
        currency:  'USD',
        intent:    'capture',
      }}
    >
      <div className="space-y-3">
        {paypalError && (
          <p
            className="text-sm text-error text-center p-3 bg-error/5 border border-error/20 rounded-sm"
            role="alert"
          >
            {paypalError}
          </p>
        )}

        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 45 }}
          createOrder={async () => {
            const res = await apiClient.post<{ paypalOrderId: string }>(
              API_ROUTES.PAYMENTS.PAYPAL_CREATE_ORDER,
              { orderId },
            );
            return res.paypalOrderId;
          }}
          onApprove={async (data) => {
            await apiClient.post(API_ROUTES.PAYMENTS.PAYPAL_CAPTURE, {
              paypalOrderId: data.orderID,
            });
            onSuccess(orderNumber);
          }}
          onError={() => {
            setPaypalError(
              'PayPal payment failed. Please try again or use a card.',
            );
          }}
        />

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock className="w-3.5 h-3.5 text-success" />
          Payments are encrypted and secure
        </p>

        <button
          type="button"
          onClick={onBack}
          className="w-full px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
        >
          ← Back
        </button>
      </div>
    </PayPalScriptProvider>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  clientSecret: string;
  orderId:      string;
  orderNumber:  string;
  totalAmount:  number;
  locale:       string;
  onSuccess:    (orderNumber: string) => void;
  onBack:       () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaymentForm({
  clientSecret,
  orderId,
  orderNumber,
  totalAmount,
  locale,
  onSuccess,
  onBack,
}: PaymentFormProps) {
  const [method, setMethod] = useState<'card' | 'paypal'>('card');

  return (
    <div className="space-y-5">
      {/* Store credit — shown when the buyer has available balance */}
      <StoreCreditBadge />

      {/* Payment method tabs */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setMethod('card')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            method === 'card'
              ? 'bg-primary text-white'
              : 'bg-surface text-muted hover:text-secondary'
          }`}
        >
          Credit / Debit Card
        </button>
        {PAYPAL_CLIENT_ID && (
          <button
            type="button"
            onClick={() => setMethod('paypal')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-border ${
              method === 'paypal'
                ? 'bg-[#003087] text-white'
                : 'bg-surface text-muted hover:text-secondary'
            }`}
          >
            PayPal
          </button>
        )}
      </div>

      {method === 'card' ? (
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
      ) : (
        <PaypalPanel
          orderId={orderId}
          orderNumber={orderNumber}
          onSuccess={onSuccess}
          onBack={onBack}
        />
      )}
    </div>
  );
}
