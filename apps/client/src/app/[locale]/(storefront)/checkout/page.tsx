'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { useCartStore } from '../../../../lib/store/cart.store';
import type { ShippingAddressInput } from '@mlh/api-client';
import type { ShippingOptionDto, CartDto } from '@mlh/types';
import { StepIndicator }           from '../../../../components/checkout/StepIndicator';
import { ShippingForm }             from '../../../../components/checkout/ShippingForm';
import { DeliveryForm }             from '../../../../components/checkout/DeliveryForm';
import { PaymentForm }              from '../../../../components/checkout/PaymentForm';
import { GiftOptionsSection }       from '../../../../components/checkout/GiftOptionsSection';
import type { GiftOptions }         from '../../../../components/checkout/GiftOptionsSection';
import { AffiliateDiscountBanner }  from '../../../../components/checkout/AffiliateDiscountBanner';
import { analytics }                from '../../../../lib/analytics';
import { hotjarEvent }              from '../../../../lib/analytics/hotjar';
import { useCurrency }              from '../../../../lib/currency/currency-context';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

// ── Sidebar: order summary ────────────────────────────────────────────────────

function OrderSummarySidebar({
  cart,
  shippingCost,
  taxAmount,
  taxJurisdiction,
  giftWrapping,
  affiliateDiscountAmount,
  pointsDiscountAmount,
}: {
  cart:                     CartDto;
  shippingCost:             number;
  taxAmount?:               number;
  taxJurisdiction?:         string;
  giftWrapping?:            boolean;
  affiliateDiscountAmount?: number;
  pointsDiscountAmount?:    number;
}) {
  const [expanded, setExpanded] = useState(false);

  const discount          = cart.discountAmount ?? 0;
  const subtotal          = cart.totals.subtotal;
  const tax               = taxAmount ?? 0;
  const giftWrappingCost  = giftWrapping ? 4.99 : 0;
  const affiliateDiscount = affiliateDiscountAmount ?? 0;
  const pointsDiscount    = pointsDiscountAmount ?? 0;
  const total             = subtotal + shippingCost - discount + tax + giftWrappingCost - affiliateDiscount - pointsDiscount;

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
        {affiliateDiscount > 0.01 && (
          <div className="flex justify-between text-sm text-green-700">
            <span className="flex items-center gap-1">
              <i className="ti ti-gift text-xs" />
              Referral discount
            </span>
            <span className="font-medium tabular-nums">−${affiliateDiscount.toFixed(2)}</span>
          </div>
        )}
        {pointsDiscount > 0.01 && (
          <div className="flex justify-between text-sm text-amber-700">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              Loyalty points
            </span>
            <span className="font-medium tabular-nums">−${pointsDiscount.toFixed(2)}</span>
          </div>
        )}
        {giftWrappingCost > 0 && (
          <div className="flex justify-between text-muted">
            <span>Gift wrapping</span>
            <span className="tabular-nums">+$4.99</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-muted">
            <span>Tax {taxJurisdiction ? `(${taxJurisdiction})` : ''}</span>
            <span className="tabular-nums">${tax.toFixed(2)}</span>
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
  const { currency } = useCurrency();

  const cart      = useCartStore((s) => s.cart);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const clearCart = useCartStore((s) => s.clearCart);
  const isLoading = useCartStore((s) => s.isLoading) && !cart;

  // Ensure cart is loaded
  useEffect(() => { fetchCart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Gift options ───────────────────────────────────────────────────────────
  const [giftOptions, setGiftOptions] = useState<GiftOptions>({
    isGift: false, giftMessage: '', giftReceipt: false, giftWrapping: false, giftFrom: '',
  });

  // ── Tax preview (fetched after step 1 when address is known) ─────────────
  const [taxAmount,       setTaxAmount]       = useState(0);
  const [taxJurisdiction, setTaxJurisdiction] = useState('');

  // ── Affiliate discount (resolved from cookie on mount) ─────────────────────
  const [affiliateInfo, setAffiliateInfo] = useState<{
    code:           string;
    discountRate:   number;
    affiliateName?: string;
    discountAmount: number;
  } | null>(null);

  useEffect(() => {
    const refCode = getCookie('mlh_affiliate');
    if (!refCode) return;
    apiClient
      .get<{ discountRate: number; affiliateName?: string } | null>('/affiliates/resolve', {
        params: { code: refCode },
      })
      .then((data) => {
        if (!data) return;
        setAffiliateInfo({
          code:          refCode,
          discountRate:  data.discountRate,
          affiliateName: data.affiliateName,
          discountAmount: 0, // recomputed once cart subtotal is known
        });
      })
      .catch(() => {}); // non-critical
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute dollar amount whenever subtotal or coupon discount changes
  useEffect(() => {
    if (!affiliateInfo || !cart?.totals?.subtotal) return;
    const base = Math.max(0, cart.totals.subtotal - (cart.discountAmount ?? 0));
    setAffiliateInfo((prev) =>
      prev ? { ...prev, discountAmount: base * prev.discountRate } : null,
    );
  }, [cart?.totals?.subtotal, cart?.discountAmount, affiliateInfo?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loyalty points ─────────────────────────────────────────────────────────
  const [loyaltyBalance,  setLoyaltyBalance]  = useState(0);
  const [pointsToRedeem,  setPointsToRedeem]  = useState(0);
  const pointsDiscount = Math.round(pointsToRedeem * 0.01 * 100) / 100;

  useEffect(() => {
    if (!isLoggedIn) return;
    apiClient
      .get<{ pointsBalance: number }>('/loyalty/me', { token: localStorage.getItem('access_token') ?? undefined })
      .then((d) => { setLoyaltyBalance(d.pointsBalance ?? 0); })
      .catch(() => {});
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Order creation state (set when proceeding to Stripe) ──────────────────
  const [clientSecret,    setClientSecret]    = useState('');
  const [orderId,         setOrderId]         = useState('');
  const [orderNumber,     setOrderNumber]     = useState('');
  const [orderTotal,      setOrderTotal]      = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError,      setOrderError]      = useState('');

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
    analytics.beginCheckout({
      total:     cart.totals?.total ?? 0,
      itemCount: cart.itemCount ?? 0,
      coupon:    cart.couponCode ?? undefined,
    });
    hotjarEvent('checkout_step_shipping');
    // Fetch tax estimate early (no shipping cost yet — will be refined on order creation)
    if (addr.country === 'US' && addr.postalCode) {
      apiClient
        .post<{ taxAmount: number; taxRate: number; jurisdiction: string }>('/orders/tax-preview', {
          postalCode:   addr.postalCode,
          state:        addr.state,
          country:      addr.country,
          subtotal:     cart.totals.subtotal - (cart.discountAmount ?? 0),
          shippingCost: 0,
        })
        .then((res) => {
          setTaxAmount(res.taxAmount ?? 0);
          setTaxJurisdiction(res.jurisdiction ?? '');
        })
        .catch(() => { /* non-blocking */ });
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Called from DeliveryForm when user selects a method and clicks Continue.
   *  Creates the order + payment intent before showing Stripe Elements. */
  const handleProceedToPayment = async (method: ShippingOptionDto) => {
    if (!shippingAddress || !cart) return;
    setShippingMethod(method);
    setCompletedSteps((prev) => [...new Set([...prev, 2])]);
    analytics.addShippingInfo({
      total:          cart.totals?.total ?? 0,
      shippingMethod: method.name,
    });
    setIsCreatingOrder(true);
    setOrderError('');

    try {
      const res = await apiClient.post<{
        orderId:      string;
        orderNumber:  string;
        clientSecret: string;
        total:        number;
        taxAmount:    number;
      }>('/orders', {
        cartId: cart.id,
        shippingAddress: {
          fullName:     `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
          phone:         shippingAddress.phone,
          addressLine1:  shippingAddress.addressLine1,
          addressLine2:  shippingAddress.addressLine2,
          city:          shippingAddress.city,
          state:         shippingAddress.state,
          postalCode:    shippingAddress.postalCode,
          country:       shippingAddress.country,
        },
        shippingMethodId: method.methodId,
        couponCode:       cart.couponCode ?? undefined,
        guestEmail:       !isLoggedIn ? guestEmail : undefined,
        isGift:           giftOptions.isGift,
        giftMessage:      giftOptions.isGift ? giftOptions.giftMessage || undefined : undefined,
        giftFrom:         giftOptions.isGift ? giftOptions.giftFrom || undefined : undefined,
        giftReceipt:      giftOptions.giftReceipt,
        giftWrapping:     giftOptions.giftWrapping,
        // Cookie is also read server-side from req.cookies — this is a fallback
        affiliateCode:    affiliateInfo?.code,
        pointsToRedeem:   pointsToRedeem > 0 ? pointsToRedeem : undefined,
      });

      setOrderId(res.orderId);
      setOrderNumber(res.orderNumber);
      setClientSecret(res.clientSecret);
      setOrderTotal(res.total);
      if (res.taxAmount != null) setTaxAmount(res.taxAmount);
      hotjarEvent('checkout_step_payment');
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to create order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handlePaymentSuccess = (num: string) => {
    analytics.addPaymentInfo({ total: orderTotal, paymentType: 'credit_card' });
    hotjarEvent('checkout_complete');
    clearCart();
    router.push(`/${locale}/checkout/success?order=${num}`);
  };

  const shippingCost = shippingMethod?.isFree ? 0 : (shippingMethod?.price ?? 0);

  return (
    <div className="bg-background min-h-screen">
      {/* Mobile order summary (above content) */}
      <OrderSummarySidebar
        cart={cart}
        shippingCost={shippingCost}
        taxAmount={taxAmount}
        taxJurisdiction={taxJurisdiction}
        giftWrapping={giftOptions.giftWrapping}
        affiliateDiscountAmount={affiliateInfo?.discountAmount}
        pointsDiscountAmount={pointsDiscount > 0 ? pointsDiscount : undefined}
      />

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">

          {/* ── Left: form area ─────────────────────────────────────────────── */}
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary mb-6">
              Checkout
            </h1>

            {currency !== 'USD' && (
              <div role="note" className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-800">
                Prices shown are approximate conversions for reference. Your card will be charged in <strong>USD</strong>.
              </div>
            )}

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
                {orderError && (
                  <p className="mb-4 text-sm text-error p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
                    {orderError}
                  </p>
                )}
                <div className="mb-5">
                  <GiftOptionsSection value={giftOptions} onChange={setGiftOptions} />
                </div>

                {/* Loyalty points redemption — logged-in users with a balance */}
                {isLoggedIn && loyaltyBalance >= 100 && (
                  <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-secondary">
                        Use Loyalty Points ({loyaltyBalance.toLocaleString()} pts available)
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="range"
                          min={0}
                          max={Math.min(loyaltyBalance, Math.floor((cart.totals.subtotal * 0.5) / 0.01))}
                          step={100}
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                          className="flex-1 accent-amber-600"
                        />
                        <span className="text-sm font-bold text-secondary tabular-nums w-20 text-right">
                          {pointsToRedeem.toLocaleString()} pts
                        </span>
                      </div>
                      {pointsToRedeem > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-amber-700">
                            −${pointsDiscount.toFixed(2)} off
                          </span>
                          <button
                            type="button"
                            onClick={() => setPointsToRedeem(0)}
                            className="text-xs text-muted hover:text-secondary underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted">100 pts = $1 off</p>
                      )}
                    </div>
                  </div>
                )}

                <DeliveryForm
                  countryCode={shippingAddress.country}
                  orderTotal={cart.totals.subtotal}
                  onComplete={handleProceedToPayment}
                  onBack={() => setStep(1)}
                  isCreatingOrder={isCreatingOrder}
                />
              </section>
            )}

            {/* Step 3: Payment — data-hj-suppress prevents Hotjar from recording card fields */}
            {step === 3 && shippingAddress && shippingMethod && clientSecret && (
              <section aria-labelledby="step3-heading" data-hj-suppress>
                <h2 id="step3-heading" className="text-base font-semibold text-secondary mb-5">
                  Payment
                </h2>
                <PaymentForm
                  clientSecret={clientSecret}
                  orderNumber={orderNumber}
                  totalAmount={orderTotal}
                  locale={locale}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep(2)}
                />
              </section>
            )}
          </div>

          {/* ── Right: order summary sidebar (desktop only) ──────────────────── */}
          <div>
            {affiliateInfo && affiliateInfo.discountAmount > 0.01 && (
              <AffiliateDiscountBanner
                discountRate={affiliateInfo.discountRate}
                affiliateName={affiliateInfo.affiliateName}
                discountAmount={affiliateInfo.discountAmount}
              />
            )}
            <OrderSummarySidebar
              cart={cart}
              shippingCost={shippingCost}
              taxAmount={taxAmount}
              taxJurisdiction={taxJurisdiction}
              giftWrapping={giftOptions.giftWrapping}
              affiliateDiscountAmount={affiliateInfo?.discountAmount}
              pointsDiscountAmount={pointsDiscount > 0 ? pointsDiscount : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
