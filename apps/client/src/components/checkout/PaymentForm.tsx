'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { readCheckoutReference, writeCheckoutReference } from '../../lib/checkout-recovery';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Appearance } from '@stripe/stripe-js';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount } from '@ezihubb/utils';

// ── Stripe promise (singleton per app session) ─────────────────────────────────
const STRIPE_PUBLIC_KEY = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '';

const PAYPAL_CLIENT_ID = process.env['NEXT_PUBLIC_PAYPAL_CLIENT_ID'] ?? '';

// ── Stripe appearance ─────────────────────────────────────────────────────────

/** Fallback accent — mirrors `--c-primary` in global.css. */
const DEFAULT_ACCENT = '#E85D3F';

/**
 * Reads a theme colour out of the document as a literal hex.
 *
 * Stripe Elements render inside a cross-origin iframe, so the app's CSS custom
 * properties never reach them — the accent has to be handed over as a value. It
 * was hard-coded before, which pinned every store to the default orange even
 * after `--c-primary` had been overridden server-side from that store's own
 * theme settings (see global.css). Reading it keeps the two in step.
 *
 * `--c-primary` holds space-separated RGB channels ("232 93 63") because
 * Tailwind composes it with an alpha; the `--color-*` vars hold plain hex.
 * Both shapes are accepted so either var can be passed.
 */
function readThemeColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;

  const channels = raw.split(/[\s,]+/).slice(0, 3).map(Number);
  if (channels.length < 3 || channels.some((n) => !Number.isFinite(n))) return fallback;

  return `#${channels
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Dresses Stripe's own widget in this checkout's form styling.
 *
 * Only `variables` and rule selectors documented by Stripe are used: an
 * unrecognised selector in `rules` is an integration error, and this widget is
 * the last step before payment — not a place to find out a guess was wrong.
 */
function buildAppearance(accent: string): Appearance {
  // Stripe takes plain CSS colours, so 8-digit hex carries the focus-ring alpha.
  const accentFaint = `${accent}1F`;

  return {
    theme: 'stripe',
    variables: {
      colorPrimary:       accent,
      colorBackground:    '#FFFFFF',
      colorText:          '#2D2D2D',
      colorTextSecondary: '#6B6B6B',
      colorDanger:        '#DC2626',
      borderRadius:       '8px',
      spacingUnit:        '4px',
      fontSizeBase:       '15px',
      fontFamily:         'var(--font-inter), Inter, system-ui, sans-serif',
    },
    rules: {
      // Stripe's stock look leans on drop shadows; this checkout's own inputs
      // are flat with a single hairline border, so the two sat badly together.
      '.Input':         { boxShadow: 'none', borderColor: '#E8E4DF' },
      '.Input:focus':   { borderColor: accent, boxShadow: `0 0 0 3px ${accentFaint}` },
      '.Block':         { boxShadow: 'none', borderColor: '#E8E4DF' },
      '.AccordionItem': { boxShadow: 'none', borderColor: '#E8E4DF' },
      // The accordion is the layout in use, so the selected row is what has to
      // read as chosen — by its border, not by a filled background.
      '.AccordionItem--selected': { borderColor: accent, boxShadow: `0 0 0 3px ${accentFaint}` },
      '.Tab':           { boxShadow: 'none', borderColor: '#E8E4DF' },
      '.Tab:hover':     { borderColor: '#E8E4DF' },
      '.Tab--selected': { borderColor: accent, boxShadow: `0 0 0 3px ${accentFaint}` },
      '.Label':         { fontWeight: '500', color: '#6B6B6B' },
    },
  };
}

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
  const t = useTranslations('checkout.paymentForm');
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
      setPaymentError(error.message ?? t('paymentFailed'));
      setIsProcessing(false);
    } else {
      onSuccess(orderNumber);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        {/* An accordion of radio rows rather than a row of tabs.
            'tabs' gives every method an equal-weight tile carrying its own
            brand colour and promotional badge, so the block reads as a strip
            of adverts. Radio rows put the choice in one restrained column and
            keep the fields for the selected method open beneath it.

            paymentMethodOrder only reorders what Stripe already offers — WHICH
            methods appear at all is decided by the PaymentIntent and the Stripe
            Dashboard, not here. Naming card first stops a wallet or a BNPL
            option taking the expanded slot. */}
        <PaymentElement
          options={{
            layout: {
              type:                 'accordion',
              defaultCollapsed:     false,
              // 'always', not 'if_multiple': with a single method the radio is
              // still what marks the row as the chosen one rather than a header.
              radios:               'always',
              spacedAccordionItems: false,
              // Radio at the start, brand mark at the end. Leading logos are
              // what make the list read as a row of adverts; trailing ones sit
              // as a quiet identifier and let the method names line up.
              paymentMethodLogoPosition: 'end',
            },
            paymentMethodOrder: ['card'],
          }}
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
        {t('securePayments')}
      </p>

      {/* Navigation — desktop */}
      <div className="hidden md:flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {t('back')}
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isProcessing ? t('processing') : t('placeOrder', { amount: fmtAmount(totalAmount) })}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="w-12 h-12 border border-border rounded-button flex items-center justify-center text-secondary shrink-0 disabled:opacity-50"
          aria-label={t('backAria')}
        >
          ←
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="flex-1 py-3.5 bg-primary text-white font-bold text-sm rounded-button disabled:opacity-50 uppercase tracking-wide"
        >
          {isProcessing ? t('processing') : t('placeOrder', { amount: fmtAmount(totalAmount) })}
        </button>
      </div>
    </form>
  );
}

// ── PayPal panel ──────────────────────────────────────────────────────────────

function PaypalPanel({
  paypalOrderId,
  orderNumber,
  onSuccess,
  onBack,
}: {
  paypalOrderId: string;
  orderNumber: string;
  onSuccess:   (orderNumber: string) => void;
  onBack:      () => void;
}) {
  const t = useTranslations('checkout.paymentForm');
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
          createOrder={async () => paypalOrderId}
          onApprove={async (data) => {
            await apiClient.post(API_ROUTES.PAYMENTS.PAYPAL_CAPTURE, {
              paypalOrderId: data.orderID,
            });
            onSuccess(orderNumber);
          }}
          onError={() => {
            setPaypalError(t('paypalFailed'));
          }}
        />

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock className="w-3.5 h-3.5 text-success" />
          {t('securePayments')}
        </p>

        <button
          type="button"
          onClick={onBack}
          className="w-full px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
        >
          {t('back')}
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
  boundProvider?: 'STRIPE' | 'PAYPAL' | null;
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
  boundProvider,
}: PaymentFormProps) {
  const t = useTranslations('checkout.paymentForm');
  const [method, setMethod] = useState<'card' | 'paypal'>(STRIPE_PUBLIC_KEY ? 'card' : 'paypal');
  const [locked, setLocked] = useState(!!clientSecret);
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState(clientSecret);
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const storageKey = `economic-payment-method:${orderId}`;
  const vi = locale === 'vi';
  const stripePromise = useMemo(() => secret && STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null, [secret]);

  useEffect(() => {
    try {
      const saved = readCheckoutReference(storageKey);
      if (saved !== null && saved !== 'card' && saved !== 'paypal') throw new Error('Invalid method');
      const bound = boundProvider === 'STRIPE' ? 'card' : boundProvider === 'PAYPAL' ? 'paypal' : null;
      if (saved || clientSecret || bound) {
        const restored = bound ?? (clientSecret ? 'card' : saved as 'card' | 'paypal');
        if (bound && saved && bound !== saved) throw new Error('Payment choice does not match the frozen order');
        setMethod(restored);
        if (!writeCheckoutReference(storageKey, restored)) throw new Error('Payment choice persistence is unavailable');
        setLocked(true);
      }
      setReady(true);
    } catch {
      setError(vi ? 'Không thể khôi phục lựa chọn thanh toán. Vui lòng liên hệ hỗ trợ với mã đơn hàng.'
        : 'Unable to restore the payment choice. Contact support with your order number.');
    }
  }, [storageKey, clientSecret, boundProvider, vi]);

  const beginPayment = async () => {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      // Persist before sending: a timeout must not offer a new provider.
      const saved = readCheckoutReference(storageKey);
      if (saved && saved !== method) throw new Error('Payment method is already selected. Reload to recover it.');
      if (!writeCheckoutReference(storageKey, method)) throw new Error('Enable cookies or session storage to safely resume payment.');
      setLocked(true);
      if (method === 'card') {
        const result = await apiClient.post<{ clientSecret: string }>(API_ROUTES.PAYMENTS.INTENT, { orderId });
        if (!result.clientSecret) throw new Error('Payment requires reconciliation. Contact support with your order number.');
        setSecret(result.clientSecret);
      } else {
        const result = await apiClient.post<{ paypalOrderId: string }>(API_ROUTES.PAYMENTS.PAYPAL_CREATE_ORDER, { orderId });
        if (!result.paypalOrderId) throw new Error('Payment requires reconciliation. Contact support with your order number.');
        setPaypalOrderId(result.paypalOrderId);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('paymentFailed'));
    } finally { inFlight.current = false; setBusy(false); }
  };

  // Computed once: the theme colour cannot change while the buyer is paying,
  // and a fresh object on every render would make react-stripe-js reapply the
  // appearance on each keystroke in the card field.
  const appearance = useMemo(
    () => buildAppearance(readThemeColor('--c-primary', DEFAULT_ACCENT)),
    [],
  );

  return (
    <div className="space-y-5">
      {/* Payment method selector.
          A segmented control, not two saturated filled tabs. At the moment of
          paying, a full-width block of brand colour reads as an advert rather
          than as a choice; surface, weight and a hairline border carry the
          selection just as clearly, and survive a store overriding the theme
          colour — the old PayPal tab hard-coded #003087 straight past the tokens.

          Hidden entirely when PayPal is not configured: a control offering one
          option is decoration, and it used to render as a solid coloured bar
          with nothing to switch to. */}
      {!secret && !paypalOrderId && (
        <fieldset
          disabled={locked || busy || !ready}
          className="flex gap-1 p-1 bg-background border border-border rounded-lg"
        >
          <legend className="px-2 text-sm font-medium">{t('methodLabel')}</legend>
          {(['card', 'paypal'] as const).map((option) => {
            if (option === 'card' ? !STRIPE_PUBLIC_KEY : !PAYPAL_CLIENT_ID) return null;
            const selected = method === option;
            return (
              <label
                key={option}
                htmlFor={`payment-provider-${option}`}
                className={`flex flex-1 items-center justify-center gap-2 min-h-11 px-3 text-sm rounded-md transition-colors ${
                  selected
                    ? 'bg-surface text-secondary font-semibold border border-border shadow-sm'
                    : 'border border-transparent text-muted font-medium hover:text-secondary'
                }`}
              >
                <input id={`payment-provider-${option}`} type="radio" name="payment-provider" value={option} checked={selected}
                  onChange={() => setMethod(option)} className="accent-primary" />
                {option === 'card' ? t('cardTab') : t('paypalTab')}
              </label>
            );
          })}
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {locked && <p className="text-sm text-muted">{vi
        ? 'Phương thức đã được chọn cho đơn này. Nếu có lỗi, thử lại cùng phương thức hoặc liên hệ hỗ trợ.'
        : 'This order is bound to the selected method. If an error occurs, retry the same method or contact support.'}</p>}
      {!secret && !paypalOrderId && <button type="button" onClick={beginPayment}
        disabled={busy || !ready || (method === 'card' ? !STRIPE_PUBLIC_KEY : !PAYPAL_CLIENT_ID)}
        className="w-full min-h-11 rounded-button bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? t('processing') : vi ? 'Tiếp tục với phương thức đã chọn' : 'Continue with selected method'}
      </button>}
      {secret && method === 'card' && (
        <Elements stripe={stripePromise} options={{ clientSecret: secret, appearance }}>
          <StripeInnerForm
            orderNumber={orderNumber}
            totalAmount={totalAmount}
            locale={locale}
            onSuccess={onSuccess}
            onBack={onBack}
          />
        </Elements>
      )}
      {paypalOrderId && method === 'paypal' && (
        <PaypalPanel
          paypalOrderId={paypalOrderId}
          orderNumber={orderNumber}
          onSuccess={onSuccess}
          onBack={onBack}
        />
      )}
    </div>
  );
}
