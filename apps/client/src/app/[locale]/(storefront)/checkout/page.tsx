'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCartStore } from '../../../../lib/store/cart.store';
import type { ShippingAddressInput } from '@ezihubb/api-client';
import type { ShippingOptionDto, CartDto } from '@ezihubb/types';
import { StepIndicator }           from '../../../../components/checkout/StepIndicator';
import { ShippingForm }             from '../../../../components/checkout/ShippingForm';
import { DeliveryForm }             from '../../../../components/checkout/DeliveryForm';
import { PaymentForm }              from '../../../../components/checkout/PaymentForm';
import { GiftOptionsSection }       from '../../../../components/checkout/GiftOptionsSection';
import type { GiftOptions }         from '../../../../components/checkout/GiftOptionsSection';
import { AffiliateDiscountBanner }  from '../../../../components/checkout/AffiliateDiscountBanner';
import { ExpressPayStrip }          from '../../../../components/checkout/ExpressPayStrip';
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

  const discount          = cart.discountAmount ?? 0;
  const subtotal          = cart.totals.subtotal;
  const giftWrappingCost  = giftWrapping ? 4.99 : 0;
  const affiliateDiscount = affiliateDiscountAmount ?? 0;
  const total             = subtotal + shippingCost - discount + giftWrappingCost - affiliateDiscount;

  const content = (
    <div className="space-y-4">
      {/* Items */}
      <ul className="space-y-3">
        {cart.items.map((item) => {
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
                ${(item.currentPrice * item.quantity).toFixed(2)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>{t('orderSummary.subtotal')}</span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t('orderSummary.shipping')}</span>
          <span className="tabular-nums">
            {shippingCost === 0 ? (
              <span className="text-success">{t('orderSummary.free')}</span>
            ) : (
              `$${shippingCost.toFixed(2)}`
            )}
          </span>
        </div>
        {discount > 0 && cart.couponCode && (
          <div className="flex justify-between text-success">
            <span>{t('orderSummary.discount', { couponCode: cart.couponCode })}</span>
            <span className="tabular-nums">−${discount.toFixed(2)}</span>
          </div>
        )}
        {affiliateDiscount > 0.01 && (
          <div className="flex justify-between text-sm text-green-700">
            <span className="flex items-center gap-1">
              <i className="ti ti-gift text-xs" />
              {t('orderSummary.referralDiscount')}
            </span>
            <span className="font-medium tabular-nums">−${affiliateDiscount.toFixed(2)}</span>
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
            {expanded ? t('orderSummary.hide') : t('orderSummary.show')}
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
  const [shippingMethod,   setShippingMethod]   = useState<ShippingOptionDto | null>(null);

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
      });

      setOrderId(res.orderId);
      setOrderNumber(res.orderNumber);
      setClientSecret(res.clientSecret);
      setOrderTotal(res.total);
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

  const shippingCost = shippingMethod?.isFree ? 0 : (shippingMethod?.price ?? 0);

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

            <StepIndicator currentStep={step} completedSteps={completedSteps} />

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
                {/* Express pay shortcut */}
                <ExpressPayStrip total={cart.totals.subtotal} />

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
              </section>
            )}

            {/* Step 2: Delivery method */}
            {step === 2 && shippingAddress && (
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
                  {t('stepHeadings.payment')}
                </h2>
                <PaymentForm
                  clientSecret={clientSecret}
                  orderId={orderId}
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
              giftWrapping={giftOptions.giftWrapping}
              affiliateDiscountAmount={affiliateInfo?.discountAmount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
