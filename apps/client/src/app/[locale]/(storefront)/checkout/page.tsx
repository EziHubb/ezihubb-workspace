'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCart } from '@mlh/api-client';
import type { ShippingAddressInput } from '@mlh/api-client';
import type { ShippingOptionDto, CartDto } from '@mlh/types';
import { StepIndicator } from '../../../../components/checkout/StepIndicator';
import { ShippingForm }   from '../../../../components/checkout/ShippingForm';
import { DeliveryForm }   from '../../../../components/checkout/DeliveryForm';
import { PaymentForm }    from '../../../../components/checkout/PaymentForm';

// ── Sidebar: order summary ────────────────────────────────────────────────────

function OrderSummarySidebar({
  cart,
  shippingCost,
}: {
  cart:         CartDto;
  shippingCost: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const discount  = cart.discountAmount ?? 0;
  const subtotal  = cart.totals.subtotal;
  const total     = subtotal + shippingCost - discount;

  const content = (
    <div className="space-y-4">
      {/* Items */}
      <ul className="space-y-3">
        {cart.items.map((item) => {
          const thumb = item.previewUrl ?? item.productImageUrl;
          return (
            <li key={item.id} className="flex gap-3">
              <div className="relative w-14 h-14 shrink-0 rounded-sm overflow-hidden bg-background border border-border">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={item.productName}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/20" />
                )}
                {item.quantity > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.quantity}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary line-clamp-2 leading-snug">
                  {item.productName}
                </p>
                {item.variantName && (
                  <p className="text-xs text-muted">{item.variantName}</p>
                )}
              </div>
              <p className="text-sm font-semibold text-secondary shrink-0 tabular-nums">
                ${(item.currentPrice * item.quantity).toFixed(2)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Shipping</span>
          <span className="tabular-nums">
            {shippingCost === 0 ? (
              <span className="text-success">FREE</span>
            ) : (
              `$${shippingCost.toFixed(2)}`
            )}
          </span>
        </div>
        {discount > 0 && cart.couponCode && (
          <div className="flex justify-between text-success">
            <span>Discount ({cart.couponCode})</span>
            <span className="tabular-nums">−${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-secondary border-t border-border pt-2">
          <span>Total</span>
          <span className="tabular-nums">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: collapsible toggle */}
      <div className="md:hidden bg-surface border-b border-border">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm"
        >
          <span className="flex items-center gap-2 font-medium text-secondary">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Hide' : 'Show'} order summary
          </span>
          <span className="font-bold text-secondary tabular-nums">
            ${total.toFixed(2)}
          </span>
        </button>
        {expanded && <div className="px-4 pb-4 border-t border-border">{content}</div>}
      </div>

      {/* Desktop: always visible */}
      <aside className="hidden md:block" aria-label="Order summary">
        <div className="bg-surface border border-border rounded-card p-5 sticky top-24">
          <h2 className="font-semibold text-secondary mb-4 text-base">
            Order Summary
          </h2>
          {content}
        </div>
      </aside>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const locale    = useLocale();
  const router    = useRouter();

  const { data: cart, isLoading } = useCart();

  // Check auth — guests are allowed but we detect login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  // ── Checkout state (persists across steps) ─────────────────────────────────
  const [step,             setStep]             = useState<1 | 2 | 3>(1);
  const [completedSteps,   setCompletedSteps]   = useState<number[]>([]);
  const [shippingAddress,  setShippingAddress]  = useState<ShippingAddressInput | null>(null);
  const [guestEmail,       setGuestEmail]       = useState('');
  const [shippingMethod,   setShippingMethod]   = useState<ShippingOptionDto | null>(null);

  // ── Cart empty guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && cart && cart.items.length === 0) {
      router.replace(`/${locale}/cart`);
    }
  }, [cart, isLoading, router, locale]);

  if (isLoading || !cart || cart.items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Price change banner ────────────────────────────────────────────────────
  const priceChangedItems = cart.items.filter((i) => i.priceChanged);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const completeStep1 = (addr: ShippingAddressInput, email: string) => {
    setShippingAddress(addr);
    setGuestEmail(email);
    setCompletedSteps((prev) => [...new Set([...prev, 1])]);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const completeStep2 = (method: ShippingOptionDto) => {
    setShippingMethod(method);
    setCompletedSteps((prev) => [...new Set([...prev, 2])]);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSuccess = (orderNumber: string) => {
    router.push(`/${locale}/checkout/success?order=${orderNumber}`);
  };

  const shippingCost = shippingMethod?.isFree ? 0 : (shippingMethod?.price ?? 0);

  return (
    <div className="bg-background min-h-screen">
      {/* Mobile order summary (above content) */}
      <OrderSummarySidebar cart={cart} shippingCost={shippingCost} />

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">

          {/* ── Left: form area ─────────────────────────────────────────────── */}
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary mb-6">
              Checkout
            </h1>

            <StepIndicator currentStep={step} completedSteps={completedSteps} />

            {/* Price changed banner (shown before step 3) */}
            {step === 3 && priceChangedItems.length > 0 && (
              <div
                role="alert"
                className="mb-6 p-4 bg-warning/8 border border-warning/25 rounded-card"
              >
                <p className="text-sm font-semibold text-warning mb-1.5">
                  ⚠️ Prices have changed since you added items
                </p>
                {priceChangedItems.map((item) => (
                  <p key={item.id} className="text-sm text-secondary">
                    <span className="font-medium">{item.productName}</span>:{' '}
                    <span className="line-through text-muted">${item.unitPrice.toFixed(2)}</span>{' '}
                    →{' '}
                    <span className="font-semibold">${item.currentPrice.toFixed(2)}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Step 1: Shipping address */}
            {step === 1 && (
              <section aria-labelledby="step1-heading">
                <h2 id="step1-heading" className="text-base font-semibold text-secondary mb-5">
                  Shipping Information
                </h2>
                <ShippingForm
                  initialValues={
                    shippingAddress
                      ? { ...shippingAddress, email: guestEmail }
                      : undefined
                  }
                  isLoggedIn={isLoggedIn}
                  onComplete={completeStep1}
                />
              </section>
            )}

            {/* Step 2: Delivery method */}
            {step === 2 && shippingAddress && (
              <section aria-labelledby="step2-heading">
                <h2 id="step2-heading" className="text-base font-semibold text-secondary mb-5">
                  Delivery Method
                </h2>
                <DeliveryForm
                  countryCode={shippingAddress.country}
                  orderTotal={cart.totals.subtotal}
                  onComplete={completeStep2}
                  onBack={() => setStep(1)}
                />
              </section>
            )}

            {/* Step 3: Payment */}
            {step === 3 && shippingAddress && shippingMethod && (
              <section aria-labelledby="step3-heading">
                <h2 id="step3-heading" className="text-base font-semibold text-secondary mb-5">
                  Payment
                </h2>
                <PaymentForm
                  shippingAddress={shippingAddress}
                  shippingMethod={shippingMethod}
                  guestEmail={guestEmail}
                  couponCode={cart.couponCode ?? undefined}
                  cart={cart}
                  locale={locale}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep(2)}
                />
              </section>
            )}
          </div>

          {/* ── Right: order summary sidebar (desktop only) ──────────────────── */}
          <OrderSummarySidebar cart={cart} shippingCost={shippingCost} />
        </div>
      </div>
    </div>
  );
}
