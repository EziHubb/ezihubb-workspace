'use client';

/**
 * PaymentForm — Step 3 of checkout.
 *
 * Dependencies:
 *   @stripe/stripe-js         — loadStripe
 *   @stripe/react-stripe-js  — Elements, PaymentElement, useStripe, useElements
 *
 * Two-phase UX:
 *   Phase 1 "review":  Gift card + billing address review + order creation
 *   Phase 2 "stripe":  Stripe PaymentElement + Place Order button
 *
 * Order creation happens when the user clicks "Continue to Payment" (phase 1 → 2).
 * This ensures gift card is known before the PaymentIntent is created server-side.
 */

import { useState, useEffect, useRef } from 'react';
import { Gift, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useCheckout } from '@mlh/api-client';
import type { ShippingAddressInput, SubmitCheckoutInput } from '@mlh/api-client';
import type { ShippingOptionDto, CartDto } from '@mlh/types';

// ── Stripe types (imported lazily to avoid SSR issues) ────────────────────────

type StripeInstance = import('@stripe/stripe-js').Stripe;
type StripeElements = import('@stripe/stripe-js').StripeElements;

// ── Stripe lazy loader ────────────────────────────────────────────────────────

let _stripePromise: Promise<StripeInstance | null> | null = null;

async function getStripe(): Promise<StripeInstance | null> {
  if (typeof window === 'undefined') return null;
  if (!_stripePromise) {
    const { loadStripe } = await import('@stripe/stripe-js');
    _stripePromise = loadStripe(
      process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '',
    );
  }
  return _stripePromise;
}

// ── Sub-component: gift card ──────────────────────────────────────────────────

function GiftCardSection({
  onApply,
  appliedCode,
  appliedAmount,
}: {
  onApply:       (code: string, amount: number) => void;
  appliedCode?:  string;
  appliedAmount: number;
}) {
  const [open,  setOpen]  = useState(false);
  const [code,  setCode]  = useState('');
  const [error, setError] = useState('');

  const { validateGiftCard } = useCheckout();

  const handleApply = async () => {
    if (!code.trim()) return;
    setError('');

    validateGiftCard.mutate(code.trim().toUpperCase(), {
      onSuccess: (res) => {
        if (!res.isValid) {
          setError(res.errorMessage ?? 'Invalid or expired gift card');
          return;
        }
        onApply(code.trim().toUpperCase(), res.maxApplied);
        setCode('');
        setOpen(false);
      },
      onError: (err) =>
        setError(
          err instanceof Error ? err.message : 'Could not validate gift card',
        ),
    });
  };

  return (
    <div className="border border-border rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-secondary hover:bg-muted/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          🎁 Have a gift card?
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border">
          {appliedCode ? (
            <div className="mt-3 flex items-center justify-between p-3 bg-success/8 border border-success/20 rounded-sm">
              <p className="text-sm font-semibold text-success">
                {appliedCode} applied — saving ${appliedAmount.toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => onApply('', 0)}
                className="text-xs text-error hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApply(); } }}
                placeholder="Gift card code"
                autoCapitalize="characters"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={!code.trim() || validateGiftCard.isPending}
                className="px-4 py-2 text-sm font-semibold border border-primary text-primary rounded-button hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {validateGiftCard.isPending ? '…' : 'Apply'}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-error mt-1.5" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Stripe payment form ────────────────────────────────────────

function StripePaymentForm({
  clientSecret,
  locale,
  orderNumber,
  totalAmount,
  onSuccess,
  onBack,
}: {
  clientSecret: string;
  locale:       string;
  orderNumber:  string;
  totalAmount:  number;
  onSuccess:    (orderNumber: string) => void;
  onBack:       () => void;
}) {
  const stripeRef    = useRef<StripeInstance | null>(null);
  const elementsRef  = useRef<StripeElements | null>(null);
  const mountRef     = useRef<HTMLDivElement>(null);

  const [isReady,   setIsReady]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stripeErr, setStripeErr] = useState('');

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const stripe = await getStripe();
      if (!stripe || cancelled || !mountRef.current) return;

      stripeRef.current = stripe;

      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme:     'stripe',
          variables: {
            colorPrimary: '#E85D3F',
            borderRadius: '8px',
            fontFamily:   'var(--font-inter), Inter, system-ui, sans-serif',
          },
        },
      });
      elementsRef.current = elements;

      const paymentEl = elements.create('payment', { layout: 'tabs' });
      paymentEl.mount(mountRef.current);
      paymentEl.on('ready', () => { if (!cancelled) setIsReady(true); });
    };

    init().catch(console.error);

    return () => {
      cancelled = true;
      elementsRef.current?.getElement('payment')?.unmount();
    };
  }, [clientSecret]);

  const handlePlace = async () => {
    const stripe   = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || isLoading) return;

    setIsLoading(true);
    setStripeErr('');

    const returnUrl = `${window.location.origin}/${locale}/checkout/success?order=${orderNumber}`;

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (stripeError) {
      setStripeErr(
        stripeError.message ?? 'Payment failed. Please try again.',
      );
      setIsLoading(false);
      return;
    }

    // If we get here Stripe didn't redirect, meaning the PaymentIntent was
    // already confirmed (e.g. for card payments with no 3DS).
    onSuccess(orderNumber);
  };

  return (
    <div className="space-y-5">
      {/* Stripe PaymentElement mount target */}
      <div>
        <div
          ref={mountRef}
          className={`min-h-[120px] transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Payment details"
        />
        {!isReady && (
          <div className="h-[120px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {stripeErr && (
        <p className="text-sm text-error text-center p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
          {stripeErr}
        </p>
      )}

      {/* Secure checkout indicator */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="w-3.5 h-3.5 text-success" />
        Payments are encrypted and secure
      </p>

      {/* Navigation — desktop */}
      <div className="hidden md:flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handlePlace}
          disabled={!isReady || isLoading}
          className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isLoading ? 'Processing…' : `Place Order — $${totalAmount.toFixed(2)}`}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-12 h-12 border border-border rounded-button flex items-center justify-center text-secondary shrink-0"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handlePlace}
          disabled={!isReady || isLoading}
          className="flex-1 py-3.5 bg-primary text-white font-bold text-sm rounded-button disabled:opacity-50 uppercase tracking-wide"
        >
          {isLoading ? 'Processing…' : `Place Order — $${totalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  shippingAddress:  ShippingAddressInput;
  shippingMethod:   ShippingOptionDto;
  guestEmail:       string;
  couponCode?:      string;
  cart:             CartDto;
  locale:           string;
  onSuccess:        (orderNumber: string) => void;
  onBack:           () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaymentForm({
  shippingAddress,
  shippingMethod,
  guestEmail,
  couponCode,
  cart,
  locale,
  onSuccess,
  onBack,
}: PaymentFormProps) {
  const [phase,         setPhase]         = useState<'review' | 'stripe'>('review');
  const [giftCardCode,  setGiftCardCode]  = useState('');
  const [giftCardAmt,   setGiftCardAmt]   = useState(0);
  const [billingSame,   setBillingSame]   = useState(true);
  const [isCreating,    setIsCreating]    = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [orderNumber,   setOrderNumber]   = useState('');
  const [orderTotal,    setOrderTotal]    = useState(0);

  const { submitOrder, createPaymentIntent } = useCheckout();

  const shippingCost = shippingMethod.isFree ? 0 : shippingMethod.price;
  const subtotal     = cart.totals.subtotal;
  const couponDisc   = cart.discountAmount ?? 0;
  const totalBeforeGC = subtotal + shippingCost - couponDisc;
  const grandTotal   = Math.max(0, totalBeforeGC - giftCardAmt);

  const handleGiftCard = (code: string, amount: number) => {
    setGiftCardCode(code);
    setGiftCardAmt(amount);
  };

  const handleContinueToPayment = async () => {
    setIsCreating(true);
    setCreateError('');

    const input: SubmitCheckoutInput = {
      email:           guestEmail || undefined,
      shippingAddress,
      shippingMethodId: shippingMethod.methodId,
      couponCode,
      giftCardCode:     giftCardCode || undefined,
    };

    submitOrder.mutate(input, {
      onSuccess: async (orderData) => {
        setOrderNumber(orderData.orderNumber);
        setOrderTotal(orderData.total ?? grandTotal);

        createPaymentIntent.mutate(
          { orderId: orderData.orderId, giftCardCode: giftCardCode || undefined },
          {
            onSuccess: (intentData) => {
              setClientSecret(intentData.clientSecret);
              setPhase('stripe');
              setIsCreating(false);
            },
            onError: (err) => {
              setCreateError(
                err instanceof Error ? err.message : 'Failed to initialize payment',
              );
              setIsCreating(false);
            },
          },
        );
      },
      onError: (err) => {
        setCreateError(
          err instanceof Error ? err.message : 'Failed to create order',
        );
        setIsCreating(false);
      },
    });
  };

  // ── Phase: review ──────────────────────────────────────────────────────────

  if (phase === 'review') {
    return (
      <div className="space-y-5">
        {/* Gift card */}
        <GiftCardSection
          onApply={handleGiftCard}
          appliedCode={giftCardCode || undefined}
          appliedAmount={giftCardAmt}
        />

        {/* Billing address */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-secondary">Billing address</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={billingSame}
              onChange={(e) => setBillingSame(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-secondary">Same as shipping address</span>
          </label>
        </div>

        {/* Price summary preview */}
        <div className="bg-surface border border-border rounded-card p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Shipping ({shippingMethod.name})</span>
            {shippingMethod.isFree ? (
              <span className="text-success font-medium">FREE</span>
            ) : (
              <span>${shippingCost.toFixed(2)}</span>
            )}
          </div>
          {couponDisc > 0 && (
            <div className="flex justify-between text-success">
              <span>Coupon ({couponCode})</span>
              <span>−${couponDisc.toFixed(2)}</span>
            </div>
          )}
          {giftCardAmt > 0 && (
            <div className="flex justify-between text-success">
              <span>Gift card</span>
              <span>−${giftCardAmt.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-secondary border-t border-border pt-2 mt-1">
            <span>Total due</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {createError && (
          <p className="text-sm text-error p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
            {createError}
          </p>
        )}

        {/* Navigation — desktop */}
        <div className="hidden md:flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary hover:text-primary transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleContinueToPayment}
            disabled={isCreating}
            className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
          >
            {isCreating ? 'Preparing payment…' : `Continue to Payment →`}
          </button>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-12 h-12 border border-border rounded-button flex items-center justify-center text-secondary shrink-0"
            aria-label="Back"
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleContinueToPayment}
            disabled={isCreating}
            className="flex-1 py-3.5 bg-primary text-white font-bold text-sm rounded-button disabled:opacity-50 uppercase tracking-wide"
          >
            {isCreating ? 'Preparing…' : 'Continue to Payment →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: stripe ──────────────────────────────────────────────────────────

  return (
    <StripePaymentForm
      clientSecret={clientSecret}
      locale={locale}
      orderNumber={orderNumber}
      totalAmount={orderTotal}
      onSuccess={onSuccess}
      onBack={() => setPhase('review')}
    />
  );
}
