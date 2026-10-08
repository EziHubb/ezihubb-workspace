'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useCartStore } from '../../../../lib/store/cart.store';
import type { ShippingAddressInput } from '@ezihubb/api-client';
import type { ShippingEstimateDto, CartDto } from '@ezihubb/types';
import { StepIndicator }           from '../../../../components/checkout/StepIndicator';
import { ShippingForm }             from '../../../../components/checkout/ShippingForm';
import { DeliveryForm }             from '../../../../components/checkout/DeliveryForm';
import { DigitalContactForm }       from '../../../../components/checkout/DigitalContactForm';
import { GiftOptionsSection }       from '../../../../components/checkout/GiftOptionsSection';
import type { GiftOptions }         from '../../../../components/checkout/GiftOptionsSection';
import { AffiliateDiscountBanner }  from '../../../../components/checkout/AffiliateDiscountBanner';
import { analytics }                from '../../../../lib/analytics';
import { hotjarEvent }              from '../../../../lib/analytics/hotjar';
import { useCurrency }              from '../../../../lib/currency/currency-context';
import { fmtAmount, safeNum, safeArr } from '@ezihubb/utils';
import { useAuthStore }             from '../../../../lib/store/auth.store';
import { useLocaleTransitionState } from '../../../../lib/locale-transition';
import { CHECKOUT_REQUEST_KEY, PENDING_CHECKOUT_KEY, readCheckoutReference, writeCheckoutReference, clearCheckoutReference } from '../../../../lib/checkout-recovery';

// Keep payment-provider SDKs out of the active checkout bundle while the
// server has online payments disabled. This chunk is only loaded if a future
// server response explicitly requires payment again.
const PaymentForm = dynamic(
  () => import('../../../../components/checkout/PaymentForm').then((mod) => mod.PaymentForm),
  { ssr: false },
);

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

interface CheckoutOrderResponse {
  orderId:         string;
  orderNumber:     string;
  clientSecret:    string | null;
  paymentRequired: boolean;
  status:          string;
  total:           number;
}

interface CheckoutCapabilities { version: 'checkout-v1'; onlinePaymentsAvailable: boolean; orderRequestsAvailable: boolean }
interface FrozenCheckout {
  orderId: string; orderNumber: string; currency: 'USD'; amountMinor: string; minorExponent: 2;
  total: number; status: string; paymentStatus: 'VERIFIED' | 'PENDING' | 'CLOSED'; canContinue: boolean;
  boundProvider: 'STRIPE' | 'PAYPAL' | null;
  items: { id: string; productName: string; variantName: string | null; quantity: number }[];
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

  /**
   * Signed in or not, read from the store the whole app reads.
   *
   * This used to be `!!localStorage.getItem('access_token')`, and NOTHING
   * in the codebase has ever written that key — the access token is
   * deliberately in-memory only (see auth.store.ts). It was therefore
   * permanently false, so EVERY order, including one placed by a signed-in
   * customer, was submitted as a guest order carrying a guestEmail and sent
   * the buyer on to a success URL with ?email= appended.
   *
   * isAuthReady, not just `user`: the token is restored asynchronously from
   * the refresh cookie, and `user` is only set once /me has answered with a
   * live token. Treating "not yet" as "guest" is what this is fixing.
   */
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const authUser    = useAuthStore((s) => s.user);
  const isLoggedIn  = isAuthReady && !!authUser;
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

  // Keep the already-created order when navigating steps or changing locale.
  const [clientSecret, setClientSecret] = useState('');
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [frozenOrder, setFrozenOrder] = useState<FrozenCheckout | null>(null);
  const [recoveryState, setRecoveryState] = useState<'loading' | 'none' | 'ready' | 'error'>('loading');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [awaitingCapture, setAwaitingCapture] = useState(false);
  const [creationKey, setCreationKey] = useState('');
  const [capabilities, setCapabilities] = useState<CheckoutCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState('');
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const submitting = useRef(false);
  const submission = useRef<Record<string, unknown> | null>(null);
  const submissionActor = useRef('');
  const vi = locale === 'vi';

  const acceptOrder = useCallback((res: CheckoutOrderResponse) => {
    if (!res || !/^[A-Za-z0-9_-]{1,100}$/.test(res.orderId) || !res.orderNumber
      || !Number.isFinite(res.total) || res.total < 0 || res.total > 99_999_999.99
      || typeof res.paymentRequired !== 'boolean'
      || res.status !== (res.paymentRequired ? 'PENDING_PAYMENT' : 'CONFIRMED')) {
      throw new Error('Invalid original checkout response. Contact support before submitting another order.');
    }
    setOrderId(res.orderId); setOrderNumber(res.orderNumber); setOrderTotal(res.total);
    if (res.paymentRequired) {
      writeCheckoutReference(PENDING_CHECKOUT_KEY, res.orderId);
      setPendingOrderId(res.orderId); setRecoveryState('loading');
      setPaymentRequired(true); setClientSecret('');
    } else {
      clearCheckoutReference(CHECKOUT_REQUEST_KEY);
      submission.current = null;
      clearCart();
      const guestParam = !isLoggedIn && guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : '';
      router.replace(`/${locale}/checkout/success?order=${encodeURIComponent(res.orderNumber)}${guestParam}&mode=request`);
    }
  }, [clearCart, locale, router, isLoggedIn, guestEmail]);

  useEffect(() => {
    let cancelled = false;
    setCapabilities(null); setCapabilityError('');
    apiClient.get<CheckoutCapabilities>('/orders/checkout-capabilities').then(value => {
      if (value.version !== 'checkout-v1' || typeof value.onlinePaymentsAvailable !== 'boolean'
        || typeof value.orderRequestsAvailable !== 'boolean') throw new Error('Invalid checkout availability');
      if (!cancelled) setCapabilities(value);
    }).catch(() => { if (!cancelled) setCapabilityError(vi ? 'Không thể kiểm tra trạng thái đặt hàng. Vui lòng thử lại.' : 'Unable to check checkout availability. Please retry.'); });
    return () => { cancelled = true; };
  }, [capabilityAttempt, vi]);

  useEffect(() => {
    try {
      // Only an opaque reference is persisted. Contact details, amounts,
      // addresses, credentials and provider secrets never enter storage.
      const reference = readCheckoutReference(PENDING_CHECKOUT_KEY);
      const key = readCheckoutReference(CHECKOUT_REQUEST_KEY);
      if (key && !/^[A-Za-z0-9_-]{12,80}$/.test(key)) throw new Error('Invalid checkout request identity');
      setCreationKey(key ?? '');
      setPendingOrderId(reference ?? '');
      setRecoveryState(reference || key ? 'loading' : 'none');
    } catch {
      setRecoveryError(vi ? 'Không thể khôi phục đơn đang chờ. Vui lòng liên hệ hỗ trợ.' : 'Unable to restore pending checkout. Please contact support.');
      setRecoveryState('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!creationKey || pendingOrderId || !isAuthReady) return;
    let cancelled = false;
    setRecoveryState('loading'); setRecoveryError('');
    apiClient.get<CheckoutOrderResponse>(`/orders/checkout-requests/${encodeURIComponent(creationKey)}`)
      .then(result => { if (!cancelled) acceptOrder(result); })
      .catch(failure => {
        if (cancelled) return;
        setRecoveryError(failure instanceof Error ? failure.message : t('errors.createOrderFailed'));
        setRecoveryState('error');
      });
    return () => { cancelled = true; };
  }, [creationKey, pendingOrderId, isAuthReady, recoveryAttempt, acceptOrder, t]);

  useEffect(() => {
    if (!pendingOrderId || !isAuthReady) return;
    let cancelled = false;
    setRecoveryState('loading');
    setRecoveryError('');
    apiClient.get<FrozenCheckout>(`/payments/checkout/${encodeURIComponent(pendingOrderId)}`).then(result => {
      if (cancelled) return;
      if (result.orderId !== pendingOrderId || result.currency !== 'USD' || result.minorExponent !== 2
        || !/^\d{1,8}$/.test(result.amountMinor) || BigInt(result.amountMinor) > BigInt(99_999_999)
        || result.total !== Number(result.amountMinor) / 100 || !Array.isArray(result.items)
        || !['VERIFIED', 'PENDING', 'CLOSED'].includes(result.paymentStatus)
        || ![null, 'STRIPE', 'PAYPAL'].includes(result.boundProvider)) throw new Error('Invalid checkout recovery response');
      if (result.paymentStatus === 'CLOSED' || ['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'].includes(result.status)) {
        throw new Error(vi ? `Đơn ${result.orderNumber} đã đóng hoặc cần hỗ trợ. Không thực hiện thanh toán lại.`
          : `Order ${result.orderNumber} is closed or requires support. Do not pay again.`);
      }
      if (result.paymentStatus === 'VERIFIED') {
        clearCheckoutReference(PENDING_CHECKOUT_KEY);
        clearCheckoutReference(CHECKOUT_REQUEST_KEY);
        clearCheckoutReference(`economic-payment-method:${pendingOrderId}`);
        clearCart();
        router.replace(`/${locale}/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
        return;
      }
      if (!result.canContinue) throw new Error(vi ? 'Đơn này không còn mở để thanh toán. Vui lòng liên hệ hỗ trợ với mã đơn hàng.'
        : 'This order is no longer open for payment. Contact support with your order number.');
      setFrozenOrder(result);
      setOrderNumber(result.orderNumber);
      setOrderTotal(result.total);
      setRecoveryState('ready');
    }).catch(failure => {
      if (cancelled) return;
      setRecoveryError(failure instanceof Error ? failure.message : t('errors.createOrderFailed'));
      setRecoveryState('error');
    });
    return () => { cancelled = true; };
  }, [pendingOrderId, isAuthReady, recoveryAttempt, locale, vi, router, clearCart, t]);

  useEffect(() => {
    if (!awaitingCapture || recoveryState !== 'ready' || recoveryAttempt >= 12) return;
    const timer = setTimeout(() => setRecoveryAttempt(value => value + 1), 2500);
    return () => clearTimeout(timer);
  }, [awaitingCapture, recoveryState, recoveryAttempt]);

  // Most storefront UI is restored generically from its DOM. A checkout
  // wizard also has calculated state that is not mounted in the current step,
  // so register that non-DOM portion with the shared locale transition layer.
  useLocaleTransitionState(
    'checkout',
    { step, completedSteps, shippingAddress, guestEmail, shippingEstimate, giftOptions,
      clientSecret, paymentRequired, orderId, orderNumber, orderTotal },
    (draft) => {
      setStep(draft.step);
      setCompletedSteps(draft.completedSteps);
      setShippingAddress(draft.shippingAddress);
      setGuestEmail(draft.guestEmail);
      setShippingEstimate(draft.shippingEstimate);
      setGiftOptions(draft.giftOptions);
      setClientSecret(draft.clientSecret);
      setPaymentRequired(draft.paymentRequired);
      setOrderId(draft.orderId);
      setOrderNumber(draft.orderNumber);
      setOrderTotal(draft.orderTotal);
    },
  );

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
  }, []);

  // Recompute dollar amount whenever subtotal or coupon discount changes
  useEffect(() => {
    if (!affiliateInfo || !cart?.totals?.subtotal) return;
    const base = Math.max(0, cart.totals.subtotal - (cart.discountAmount ?? 0));
    setAffiliateInfo((prev) =>
      prev ? { ...prev, discountAmount: base * prev.discountRate } : null,
    );
  }, [cart?.totals?.subtotal, cart?.discountAmount, affiliateInfo?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Order creation state. The server decides whether payment is required.
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError,      setOrderError]      = useState('');

  const retrySubmission = async () => {
    if (!submission.current || submitting.current) return;
    if (!isAuthReady || submissionActor.current !== (isLoggedIn ? authUser?.id : 'guest')) {
      setRecoveryError(vi ? 'Tài khoản đã thay đổi. Hãy khôi phục phiên đặt hàng ban đầu hoặc liên hệ hỗ trợ; không gửi yêu cầu thay thế.'
        : 'Your account changed. Restore the original checkout session or contact support; do not submit a replacement request.');
      return;
    }
    submitting.current = true; setIsCreatingOrder(true);
    try { acceptOrder(await apiClient.post<CheckoutOrderResponse>(API_ROUTES.ORDERS.CREATE, submission.current)); }
    catch (failure) { setRecoveryError(failure instanceof Error ? failure.message : t('errors.createOrderFailed')); }
    finally { submitting.current = false; setIsCreatingOrder(false); }
  };

  // ── Cart empty guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (recoveryState === 'none' && !isLoading && cart && safeArr(cart.items).length === 0) {
      router.replace(`/${locale}/cart`);
    }
  }, [cart, isLoading, router, locale, recoveryState]);

  // ── Digital-only cart: no shipping address/method needed at all ───────────
  // (mixed carts are rejected by checkout() server-side and warned about on
  // the cart page — by the time a shopper reaches here the cart is uniform).
  // Declared before the loading early-return since a hook below depends on it.
  const isDigitalOnly =
    !!cart &&
    safeArr(cart.items).length > 0 &&
    safeArr(cart.items).every((i) => (i.productType ?? 'PHYSICAL') === 'DIGITAL');

  /** Digital orders only need a contact email before the final review step. */
  const prepareDigitalOrder = useCallback((email?: string) => {
    setCompletedSteps((prev) => [...new Set([...prev, 1, 2])]);
    setOrderError('');
    if (email) setGuestEmail(email);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Logged-in digital buyers already have a verified contact email.
  useEffect(() => {
    if (!isDigitalOnly || !isLoggedIn || step !== 1) return;
    prepareDigitalOrder();
  }, [isDigitalOnly, isLoggedIn, step, prepareDigitalOrder]);

  if (recoveryState === 'error') {
    return <main className="mx-auto max-w-xl px-4 py-12 space-y-5">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p role="alert" className="rounded-card border border-error/25 p-4 text-error">{recoveryError}</p>
      {pendingOrderId && <p className="break-all text-sm text-muted">{vi ? 'Mã tham chiếu' : 'Order reference'}: {pendingOrderId}</p>}
      <p className="text-sm text-muted">{vi ? 'Không tạo đơn mới hoặc thanh toán lại khi chưa xác nhận trạng thái đơn cũ.' : 'Do not create another order or pay again until the original request is confirmed.'}</p>
      <button type="button" onClick={() => setRecoveryAttempt(value => value + 1)} disabled={(!pendingOrderId && !creationKey) || isCreatingOrder}
        className="min-h-11 rounded-button bg-primary px-5 py-3 text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2">
        {vi ? 'Thử khôi phục lại đơn' : 'Retry order recovery'}
      </button>
      {!pendingOrderId && submission.current && <button type="button" onClick={retrySubmission} disabled={isCreatingOrder}
        className="min-h-11 rounded-button border border-border px-5 py-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2">
        {vi ? 'Gửi lại cùng yêu cầu' : 'Retry the same order request'}
      </button>}
    </main>;
  }

  if (recoveryState === 'ready' && frozenOrder) {
    return <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('stepHeadings.payment')}</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-5" data-hj-suppress>
          <div role="note" className="rounded-card border border-border p-4 text-sm">
            <p className="font-semibold">{frozenOrder.orderNumber}</p>
            <p className="mt-2">{vi ? 'Đơn và số tiền đã được chốt. Quay lại giỏ hàng không sửa đơn này. Khi quay lại checkout, bạn sẽ tiếp tục cùng đơn và phương thức đã chọn.'
              : 'This order and its amount are frozen. Returning to your cart does not edit this order. Checkout resumes the same order and selected method.'}</p>
          </div>
          {awaitingCapture ? <div role="status" className="rounded-card border border-border p-4 space-y-3">
            <p>{vi ? 'Đang chờ xác nhận thanh toán từ server. Không cần thanh toán lại.' : 'Waiting for server payment confirmation. Do not pay again.'}</p>
            <button type="button" onClick={() => setRecoveryAttempt(value => value + 1)}
              className="min-h-11 rounded-button border border-border px-4 py-2 focus-visible:outline focus-visible:outline-2">
              {vi ? 'Kiểm tra lại trạng thái' : 'Check payment status'}
            </button>
          </div> : !capabilities?.onlinePaymentsAvailable ? <div role="status" className="rounded-card border border-border p-4 space-y-3">
            <p>{vi ? 'Thanh toán trực tuyến hiện chưa khả dụng. Đơn gốc được giữ lại; vui lòng liên hệ hỗ trợ, không tạo đơn hoặc thanh toán lại.' : 'Online payments are currently unavailable. Your original order is retained. Contact support; do not create another order or pay again.'}</p>
            <button type="button" onClick={() => setCapabilityAttempt(value => value + 1)} className="min-h-11 rounded-button border border-border px-4 py-2">
              {vi ? 'Kiểm tra lại' : 'Check availability'}
            </button>
          </div> : <PaymentForm key={frozenOrder.orderId} clientSecret="" orderId={frozenOrder.orderId}
            orderNumber={frozenOrder.orderNumber} totalAmount={frozenOrder.total} locale={locale}
            boundProvider={frozenOrder.boundProvider}
            onBack={() => router.push(`/${locale}/cart`)}
            onSuccess={number => {
              // Keep the reference until independent server capture proof is
              // visible, including webhook delay and a page reload.
              if (number === frozenOrder.orderNumber) {
                setAwaitingCapture(true);
                setRecoveryAttempt(value => value + 1);
              }
            }} />}
          <button type="button" onClick={() => router.push(`/${locale}/cart`)}
            className="min-h-11 rounded-button border border-border px-5 py-3 text-sm focus-visible:outline focus-visible:outline-2">
            {vi ? 'Quay lại giỏ hàng' : 'Back to cart'}
          </button>
        </section>
        <aside aria-label={t('orderSummary.title')} className="h-fit min-w-0 rounded-card border border-border p-5">
          <h2 className="mb-4 font-semibold">{t('orderSummary.title')}</h2>
          <ul className="space-y-3">{frozenOrder.items.map(item => <li key={item.id} className="text-sm">
            <p className="break-words font-medium">{item.productName}</p>
            <p className="text-muted">{item.variantName} · {vi ? 'Số lượng' : 'Quantity'}: {item.quantity}</p>
          </li>)}</ul>
          <div className="mt-4 flex justify-between gap-4 border-t border-border pt-4 font-semibold">
            <span>{t('orderSummary.total')}</span><span className="tabular-nums">{fmtAmount(frozenOrder.total)}</span>
          </div>
        </aside>
      </div>
    </main>;
  }

  if (capabilityError || (capabilities && !capabilities.onlinePaymentsAvailable && !capabilities.orderRequestsAvailable)) {
    return <main className="mx-auto max-w-xl px-4 py-12 space-y-5">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p role="alert">{capabilityError || (vi ? 'Đặt hàng hiện tạm ngưng. Vui lòng liên hệ hỗ trợ.' : 'Checkout is temporarily unavailable. Please contact support.')}</p>
      <button type="button" onClick={() => setCapabilityAttempt(value => value + 1)} className="min-h-11 rounded-button border border-border px-5 py-3">
        {vi ? 'Thử lại' : 'Retry checkout availability'}
      </button>
    </main>;
  }

  if (!capabilities || recoveryState === 'loading' || isLoading || !cart || safeArr(cart.items).length === 0) {
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

  /** Preserve the delivery estimate, then let the buyer review the request. */
  const handleProceedToReview = (estimate: ShippingEstimateDto) => {
    if (!shippingAddress || !cart) return;
    setShippingEstimate(estimate);
    setCompletedSteps((prev) => [...new Set([...prev, 2])]);
    analytics.addShippingInfo({
      total:          cart.totals?.total ?? 0,
      shippingMethod: estimate.perStore[0]?.methodName ?? 'Standard Shipping',
    });
    setOrderError('');
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitOrder = async () => {
    if (submitting.current || !capabilities) return;
    if (paymentRequired && orderId) { setStep(3); return; }
    if (!cart || (!isDigitalOnly && (!shippingAddress || !shippingEstimate))) return;
    submitting.current = true;
    setIsCreatingOrder(true);
    setOrderError('');
    try {
      const key = crypto.randomUUID();
      const persisted = writeCheckoutReference(CHECKOUT_REQUEST_KEY, key);
      if (capabilities.onlinePaymentsAvailable && !persisted) throw new Error(vi ? 'Cần bật cookie hoặc lưu trữ phiên để khôi phục thanh toán an toàn.' : 'Enable cookies or session storage to safely resume online checkout.');
      const body = {
        idempotencyKey: key,
        ...(shippingAddress ? { shippingAddress: {
          fullName:     `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
          phone:         shippingAddress.phone,
          addressLine1:  shippingAddress.addressLine1,
          addressLine2:  shippingAddress.addressLine2,
          city:          shippingAddress.city,
          state:         shippingAddress.state,
          postalCode:    shippingAddress.postalCode,
          country:       shippingAddress.country,
        } } : {}),
        couponCode:       cart.couponCode ?? undefined,
        guestEmail:       !isLoggedIn ? guestEmail : undefined,
        isGift:           giftOptions.isGift,
        giftMessage:      giftOptions.isGift ? giftOptions.giftMessage || undefined : undefined,
        giftFrom:         giftOptions.isGift ? giftOptions.giftFrom || undefined : undefined,
        giftReceipt:      giftOptions.giftReceipt,
        giftWrapping:     giftOptions.giftWrapping,
      };
      submission.current = body;
      submissionActor.current = isLoggedIn ? authUser?.id ?? '' : 'guest';
      const res = await apiClient.post<CheckoutOrderResponse>(API_ROUTES.ORDERS.CREATE, body);
      acceptOrder(res);
    } catch (err) {
      if (submission.current) {
        setCreationKey(String(submission.current.idempotencyKey));
        setRecoveryState('loading');
      } else setOrderError(err instanceof Error ? err.message : t('errors.createOrderFailed'));
    } finally {
      submitting.current = false;
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
              labels={isDigitalOnly
                ? [t('steps.contact'), t('steps.review'), t('steps.orderRequest')]
                : [t('steps.shipping'), t('steps.delivery'), t('steps.orderRequest')]}
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
              <section aria-labelledby={isDigitalOnly ? 'digital-contact-heading' : 'shipping-address-heading'}>
                {isDigitalOnly ? (
                  isLoggedIn ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">{t('stepHeadings.preparingOrder')}</p>
                    </div>
                  ) : (
                    <>
                      <h2 id="digital-contact-heading" className="text-base font-semibold text-secondary mb-5">
                        {t('stepHeadings.contactInformation')}
                      </h2>
                      <DigitalContactForm
                        initialEmail={guestEmail}
                        isSubmitting={isCreatingOrder}
                        error={orderError}
                        onSubmit={prepareDigitalOrder}
                      />
                    </>
                  )
                ) : (
                  <>
                    <h2 id="shipping-address-heading" className="text-base font-semibold text-secondary mb-5">
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
                  onComplete={handleProceedToReview}
                  onBack={() => setStep(1)}
                  isCreatingOrder={isCreatingOrder}
                />
              </section>
            )}

            {/* Step 3: review and submit. Payment fields only return when the
                server-side feature flag is deliberately re-enabled. */}
            {step === 3 && (isDigitalOnly || (shippingAddress && shippingEstimate)) && (
              <section aria-labelledby="step3-heading" data-hj-suppress>
                <h2 id="step3-heading" className="text-base font-semibold text-secondary mb-5">
                  {paymentRequired ? t('stepHeadings.payment') : t('stepHeadings.reviewRequest')}
                </h2>
                {paymentRequired ? (
                  <PaymentForm
                    clientSecret={clientSecret}
                    orderId={orderId}
                    orderNumber={orderNumber}
                    totalAmount={orderTotal}
                    locale={locale}
                    onSuccess={handlePaymentSuccess}
                    onBack={() => router.push(`/${locale}/cart`)}
                  />
                ) : (
                  <div className="space-y-5">
                    <div role="note" className="rounded-card border border-primary/25 bg-primary/5 p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <div>
                          <h3 className="font-semibold text-secondary">{t('orderRequest.title')}</h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('orderRequest.description')}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 border-t border-primary/15 pt-4 sm:grid-cols-2">
                        <div className="flex items-start gap-2 text-sm text-secondary">
                          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{t('orderRequest.messagesContact')}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-secondary">
                          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{t('orderRequest.emailContact')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted">
                      <p className="font-medium text-secondary">{t('orderRequest.noCharge')}</p>
                      <p className="mt-1 leading-relaxed">{t('orderRequest.security')}</p>
                    </div>

                    {orderError && (
                      <p className="rounded-sm border border-error/20 bg-error/5 p-3 text-sm text-error" role="alert">
                        {orderError}
                      </p>
                    )}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(isDigitalOnly ? 1 : 2)}
                        disabled={isCreatingOrder}
                        className="rounded-button border border-border px-5 py-3 text-sm font-medium text-secondary hover:border-primary disabled:opacity-50"
                      >
                        {t('orderRequest.back')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitOrder}
                        disabled={isCreatingOrder}
                        className="rounded-button bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCreatingOrder ? t('orderRequest.submitting') : t('orderRequest.submit')}
                      </button>
                    </div>
                  </div>
                )}
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
