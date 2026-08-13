'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCartStore } from '../../../../lib/store/cart.store';
import type { ShippingAddressInput } from '@ezihubb/api-client';
import type { ShippingEstimateDto, CartDto } from '@ezihubb/types';
import { StepIndicator }           from '../../../../components/checkout/StepIndicator';
import { ShippingForm }             from '../../../../components/checkout/ShippingForm';
import { DeliveryForm }             from '../../../../components/checkout/DeliveryForm';
import { DigitalContactForm }       from '../../../../components/checkout/DigitalContactForm';
import { PaymentForm }              from '../../../../components/checkout/PaymentForm';
import { GiftOptionsSection }       from '../../../../components/checkout/GiftOptionsSection';
import type { GiftOptions }         from '../../../../components/checkout/GiftOptionsSection';
import { AffiliateDiscountBanner }  from '../../../../components/checkout/AffiliateDiscountBanner';
import { ExpressPayStrip }          from '../../../../components/checkout/ExpressPayStrip';
import { analytics }                from '../../../../lib/analytics';
import { hotjarEvent }              from '../../../../lib/analytics/hotjar';
import { useCurrency }              from '../../../../lib/currency/currency-context';
import { fmtAmount, safeNum, safeArr } from '@ezihubb/utils';

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
  giftWrapping,
  affiliateDiscountAmount,
}: {
  cart:                     CartDto;
  shippingCost:             number;
  giftWrapping?:            boolean;
  affiliateDiscountAmount?: number;
}) {
  const t = useTranslations('checkout');
  const [expanded, setExpanded] = useState(false);

  const discount          = safeNum(cart.discountAmount);
  const subtotal          = safeNum(cart.totals?.subtotal);
  const giftWrappingCost  = giftWrapping ? 4.99 : 0;
  const affiliateDiscount = safeNum(affiliateDiscountAmount);
  const total             = subtotal + safeNum(shippingCost) - discount + giftWrappingCost - affiliateDiscount;

  const content = (
    <div className="space-y-4">
      {/* Items */}
      <ul className="space-y-3">
        {safeArr(cart.items).map((item) => {
          const thumb = item.previewUrl ?? item.productImageUrl;
          return (
            <li key={item.id} className="flex gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <div className="w-full h-full rounded-sm overflow-hidden bg-muted/20 border border-border">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={item.productName || 'Product'}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                {item.quantity > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {item.quantity}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary line-clamp-2 leading-snug">
                  {item.productName}
                </p>
                {item.variantOptions && Object.keys(item.variantOptions).length > 0 ? (
                  <p className="text-xs text-muted">
                    {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                ) : item.variantName ? (
                  <p className="text-xs text-muted">{item.variantName}</p>
                ) : null}
              </div>
              <p className="text-sm font-semibold text-secondary shrink-0 tabular-nums">
                {fmtAmount(safeNum(item.currentPrice) * safeNum(item.quantity))}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>{t('orderSummary.subtotal')}</span>
          <span className="tabular-nums">{fmtAmount(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t('orderSummary.shipping')}</span>
          <span className="tabular-nums">
            {shippingCost === 0 ? (
              <span className="text-success">{t('orderSummary.free')}</span>
            ) : (
              fmtAmount(shippingCost)
            )}
          </span>
        </div>
        {discount > 0 && cart.couponCode && (
          <div className="flex justify-between text-success">
            <span>{t('orderSummary.discount', { couponCode: cart.couponCode })}</span>
            <span className="tabular-nums">−{fmtAmount(discount)}</span>
          </div>
        )}
        {affiliateDiscount > 0.01 && (
          <div className="flex justify-between text-sm text-green-700">
            <span className="flex items-center gap-1">
              <i className="ti ti-gift text-xs" />
              {t('orderSummary.affiliateDiscount')}
            </span>
            <span className="font-medium tabular-nums">−{fmtAmount(affiliateDiscount)}</span>
          </div>
        )}
        {giftWrappingCost > 0 && (
          <div className="flex justify-between text-muted">
            <span>{t('orderSummary.giftWrapping')}</span>
            <span className="tabular-nums">+$4.99</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-secondary border-t border-border pt-2">
          <span>{t('orderSummary.total')}</span>
          <span className="tabular-nums">{fmtAmount(total)}</span>
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
            {expanded ? t('orderSummary.hide') : t('orderSummary.show')}
          </span>
          <span className="font-bold text-secondary tabular-nums">
            {fmtAmount(total)}
          </span>
        </button>
        {expanded && <div className="px-4 pb-4 border-t border-border">{content}</div>}
      </div>

      {/* Desktop: always visible */}
      <aside className="hidden md:block" aria-label={t('orderSummary.title')}>
        <div className="bg-surface border border-border rounded-card p-5 sticky top-24">
          <h2 className="font-semibold text-secondary mb-4 text-base">
            {t('orderSummary.title')}
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
  const t = useTranslations('checkout');

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
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimateDto | null>(null);

  // ── Gift options ───────────────────────────────────────────────────────────
  const [giftOptions, setGiftOptions] = useState<GiftOptions>({
    isGift: false, giftMessage: '', giftReceipt: false, giftWrapping: false, giftFrom: '',
  });

  // ── Affiliate discount (resolved from cookie on mount) ─────────────────────
  const [affiliateInfo, setAffiliateInfo] = useState<{
    code:           string;
    discountRate:   number;
    affiliateName?: string;
    discountAmount: number;
  } | null>(null);

  useEffect(() => {
    const refCode = getCookie('ezihubb_affiliate');
    if (!refCode) return;
    apiClient
      .get<{ discountRate: number; affiliateName?: string } | null>(API_ROUTES.AFFILIATES.RESOLVE, {
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
      // eslint-disable-next-line @typescript-eslint/no-empty-function
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

  // ── Order creation state (set when proceeding to Stripe) ──────────────────
  const [clientSecret,    setClientSecret]    = useState('');
  const [orderId,         setOrderId]         = useState('');
  const [orderNumber,     setOrderNumber]     = useState('');
  const [orderTotal,      setOrderTotal]      = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError,      setOrderError]      = useState('');

  // ── Cart empty guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && cart && safeArr(cart.items).length === 0) {
      router.replace(`/${locale}/cart`);
    }
  }, [cart, isLoading, router, locale]);

  // ── Digital-only cart: no shipping address/method needed at all ───────────
  // (mixed carts are rejected by checkout() server-side and warned about on
  // the cart page — by the time a shopper reaches here the cart is uniform).
  // Declared before the loading early-return since a hook below depends on it.
  const isDigitalOnly =
    !!cart &&
    safeArr(cart.items).length > 0 &&
    safeArr(cart.items).every((i) => (i.productType ?? 'PHYSICAL') === 'DIGITAL');

  /** Creates the order directly, skipping the shipping-address/delivery-method
   *  steps entirely — used for a digital-only cart. Guests still supply an
   *  email (needed to look the order up later); logged-in users need nothing
   *  at all, so this fires automatically for them (see effect below). */
  const handleCreateDigitalOrder = useCallback(async (email?: string) => {
    if (!cart) return;
    setCompletedSteps((prev) => [...new Set([...prev, 1, 2])]);
    setIsCreatingOrder(true);
    setOrderError('');
    try {
      const res = await apiClient.post<{
        orderId:      string;
        orderNumber:  string;
        clientSecret: string;
        total:        number;
      }>(API_ROUTES.ORDERS.CREATE, {
        couponCode:    cart.couponCode ?? undefined,
        guestEmail:    !isLoggedIn ? email : undefined,
        affiliateCode: affiliateInfo?.code,
      });
      if (email) setGuestEmail(email);
      setOrderId(res.orderId);
      setOrderNumber(res.orderNumber);
      setClientSecret(res.clientSecret);
      setOrderTotal(safeNum(res.total));
      hotjarEvent('checkout_step_payment');
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : t('errors.createOrderFailed'));
    } finally {
      setIsCreatingOrder(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, isLoggedIn, affiliateInfo?.code]);

  // Logged-in + digital-only needs no user input at all — fire immediately.
  // If the order was already created (e.g. shopper hit "back" from payment),
  // there's nothing to edit here — just return to payment instead of getting
  // stuck on a spinner with no way forward.
  useEffect(() => {
    if (!isDigitalOnly || !isLoggedIn || step !== 1) return;
    if (clientSecret) { setStep(3); return; }
    if (!isCreatingOrder) void handleCreateDigitalOrder();
  }, [isDigitalOnly, isLoggedIn, step, clientSecret, isCreatingOrder, handleCreateDigitalOrder]);

  if (isLoading || !cart || safeArr(cart.items).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Price change banner ────────────────────────────────────────────────────
  const priceChangedItems = safeArr(cart.items).filter((i) => i.priceChanged);

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
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Called from DeliveryForm once the automatic delivery estimate resolves
   *  and the shopper clicks Continue. Creates the order + payment intent
   *  before showing Stripe Elements — the server independently re-resolves
   *  the same seller Delivery-profile cost, this estimate is only used to
   *  drive the UI in the meantime. */
  const handleProceedToPayment = async (estimate: ShippingEstimateDto) => {
    if (!shippingAddress || !cart) return;
    setShippingEstimate(estimate);
    setCompletedSteps((prev) => [...new Set([...prev, 2])]);
    analytics.addShippingInfo({
      total:          cart.totals?.total ?? 0,
      shippingMethod: estimate.perStore[0]?.methodName ?? 'Standard Shipping',
    });
    setIsCreatingOrder(true);
    setOrderError('');

    try {
      const res = await apiClient.post<{
        orderId:      string;
        orderNumber:  string;
        clientSecret: string;
        total:        number;
      }>(API_ROUTES.ORDERS.CREATE, {
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
        couponCode:       cart.couponCode ?? undefined,
        guestEmail:       !isLoggedIn ? guestEmail : undefined,
        isGift:           giftOptions.isGift,
        giftMessage:      giftOptions.isGift ? giftOptions.giftMessage || undefined : undefined,
        giftFrom:         giftOptions.isGift ? giftOptions.giftFrom || undefined : undefined,
        giftReceipt:      giftOptions.giftReceipt,
        giftWrapping:     giftOptions.giftWrapping,
        // Cookie is also read server-side from req.cookies — this is a fallback
        affiliateCode:    affiliateInfo?.code,
      });

      setOrderId(res.orderId);
      setOrderNumber(res.orderNumber);
      setClientSecret(res.clientSecret);
      setOrderTotal(safeNum(res.total));
      hotjarEvent('checkout_step_payment');
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : t('errors.createOrderFailed'));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handlePaymentSuccess = (num: string) => {
    analytics.addPaymentInfo({ total: orderTotal, paymentType: 'credit_card' });
    hotjarEvent('checkout_complete');
    clearCart();
    const guestParam = !isLoggedIn && guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : '';
    router.push(`/${locale}/checkout/success?order=${num}${guestParam}`);
  };

  const shippingCost = shippingEstimate?.totalCost ?? 0;

  return (
    <div className="bg-background min-h-screen">
      {/* Mobile order summary (above content) */}
      <OrderSummarySidebar
        cart={cart}
        shippingCost={shippingCost}
        giftWrapping={giftOptions.giftWrapping}
        affiliateDiscountAmount={affiliateInfo?.discountAmount}
      />

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">

          {/* ── Left: form area ─────────────────────────────────────────────── */}
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary mb-6">
              {t('title')}
            </h1>

            {currency !== 'USD' && (
              <div role="note" className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-800">
                {t('currencyNote', { currency: 'USD' })}
              </div>
            )}

            <StepIndicator
              currentStep={step}
              completedSteps={completedSteps}
              labels={isDigitalOnly ? [t('steps.contact'), t('steps.review'), t('steps.payment')] : undefined}
            />

            {/* Price changed banner (shown before step 3) */}
            {step === 3 && priceChangedItems.length > 0 && (
              <div
                role="alert"
                className="mb-6 p-4 bg-warning/8 border border-warning/25 rounded-card"
              >
                <p className="text-sm font-semibold text-warning mb-1.5">
                  ⚠️ {t('priceChanged.title')}
                </p>
                {priceChangedItems.map((item) => (
                  <p key={item.id} className="text-sm text-secondary">
                    <span className="font-medium">{item.productName}</span>:{' '}
                    <span className="line-through text-muted">{fmtAmount(item.unitPrice)}</span>{' '}
                    →{' '}
                    <span className="font-semibold">{fmtAmount(item.currentPrice)}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Step 1: Shipping address (physical) / Contact email (digital-only) */}
            {step === 1 && (
              <section aria-labelledby="step1-heading">
                {isDigitalOnly ? (
                  isLoggedIn ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">{t('stepHeadings.preparingOrder')}</p>
                    </div>
                  ) : (
                    <>
                      <h2 id="step1-heading" className="text-base font-semibold text-secondary mb-5">
                        {t('stepHeadings.contactInformation')}
                      </h2>
                      <DigitalContactForm
                        initialEmail={guestEmail}
                        isSubmitting={isCreatingOrder}
                        error={orderError}
                        onSubmit={(email) => handleCreateDigitalOrder(email)}
                      />
                    </>
                  )
                ) : (
                  <>
                    {/* Express pay shortcut */}
                    <ExpressPayStrip total={safeNum(cart.totals?.subtotal)} />

                    <h2 id="step1-heading" className="text-base font-semibold text-secondary mb-5">
                      {t('stepHeadings.shippingInformation')}
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
                  </>
                )}
              </section>
            )}

            {/* Step 2: Delivery method — physical only, digital skips straight to payment */}
            {step === 2 && shippingAddress && !isDigitalOnly && (
              <section aria-labelledby="step2-heading">
                <h2 id="step2-heading" className="text-base font-semibold text-secondary mb-5">
                  {t('stepHeadings.deliveryMethod')}
                </h2>
                {orderError && (
                  <p className="mb-4 text-sm text-error p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
                    {orderError}
                  </p>
                )}
                <div className="mb-5">
                  <GiftOptionsSection value={giftOptions} onChange={setGiftOptions} />
                </div>

                <DeliveryForm
                  countryCode={shippingAddress.country}
                  onComplete={handleProceedToPayment}
                  onBack={() => setStep(1)}
                  isCreatingOrder={isCreatingOrder}
                />
              </section>
            )}

            {/* Step 3: Payment — data-hj-suppress prevents Hotjar from recording card fields */}
            {step === 3 && clientSecret && (isDigitalOnly || (shippingAddress && shippingEstimate)) && (
              <section aria-labelledby="step3-heading" data-hj-suppress>
                <h2 id="step3-heading" className="text-base font-semibold text-secondary mb-5">
                  {t('stepHeadings.payment')}
                </h2>
                <PaymentForm
                  clientSecret={clientSecret}
                  orderId={orderId}
                  orderNumber={orderNumber}
                  totalAmount={orderTotal}
                  locale={locale}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep(isDigitalOnly ? 1 : 2)}
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
              giftWrapping={giftOptions.giftWrapping}
              affiliateDiscountAmount={affiliateInfo?.discountAmount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
