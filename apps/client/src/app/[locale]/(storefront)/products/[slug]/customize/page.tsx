'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { X, Eye, Check } from 'lucide-react';
import { useCustomizerStore } from '../../../../../../lib/store/customizer.store';
import { useAuthStore } from '../../../../../../lib/store/auth.store';
import { CustomizerProvider } from '../../../../../../components/customizer/CustomizerProvider';
import { MobileCustomizerCanvas } from '../../../../../../components/customizer/MobileCustomizerCanvas';
import { PreviewModal } from '../../../../../../components/customizer/PreviewModal';
import { Step1BasicInfo } from '../../../../../../components/customizer/steps/Step1BasicInfo';
import { Step2PhotoUpload } from '../../../../../../components/customizer/steps/Step2PhotoUpload';
import { Step3StylePicker } from '../../../../../../components/customizer/steps/Step3StylePicker';
import { useKeyboardVisible } from '../../../../../../lib/hooks/useKeyboardVisible';
import { useCustomizerValidation } from '../../../../../../lib/hooks/useCustomizerValidation';
import { useBeforeLeave } from '../../../../../../lib/hooks/useBeforeLeave';
import { DEMO_TEMPLATE } from '../../../../../../lib/customizer/types';
import type { CustomizationTemplate } from '../../../../../../lib/customizer/types';
import type { ProductDto } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';
import { apiClient } from '../../../../../../lib/api-client';

// ── Extended product type ─────────────────────────────────────────────────────

interface ProductDetailDto extends ProductDto {
  customizationTemplate?: CustomizationTemplate;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS  = 3;
const STEP_NAMES   = ['Add Names & Text', 'Upload a Photo', 'Choose Your Style'] as const;

// ── Unsaved-changes confirm modal ─────────────────────────────────────────────

function UnsavedModal({
  isOpen,
  onStay,
  onLeave,
}: {
  isOpen:   boolean;
  onStay:   () => void;
  onLeave:  () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onStay}
    >
      <div
        className="bg-surface rounded-modal shadow-modal w-full max-w-xs p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-secondary">
          Leave without saving?
        </h3>
        <p className="text-sm text-muted">
          Your customization will be lost if you leave now.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 h-10 border border-border rounded-button text-sm font-medium text-secondary hover:bg-background transition-colors"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 h-10 bg-error text-white rounded-button text-sm font-bold hover:bg-red-700 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Spinner helper ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Inner page — reads Zustand store (must be inside CustomizerProvider) ───────

interface InnerPageProps {
  slug:     string;
  product:  ProductDetailDto;
  locale:   string;
}

function InnerPage({ slug, product, locale }: InnerPageProps) {
  const router = useRouter();

  const [step,        setStep]        = useState(1);
  const [activeAngle, setActiveAngle] = useState('front');
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError,   setCartError]   = useState('');

  const isKeyboardVisible              = useKeyboardVisible();
  const { isValid, missingFields }     = useCustomizerValidation();
  const historyIndex                   = useCustomizerStore((s) => s.historyIndex);
  const template                       = useCustomizerStore((s) => s.template);
  const toPayload                      = useCustomizerStore((s) => s.toCustomizationPayload);
  const generatePreview                = useCustomizerStore((s) => s.generatePreview);

  const user       = useAuthStore((s) => s.user);
  const isLoggedIn = user !== null;

  const isDirty = historyIndex > 0;

  const { guardedNavigate, showConfirmModal, confirmLeave, cancelLeave } =
    useBeforeLeave(isDirty);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll form to top on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Sync activeAngle to template's first angle
  useEffect(() => {
    if (template?.angles?.[0]) {
      setActiveAngle(template.angles[0].id);
    }
  }, [template]);

  // ── Add to cart ─────────────────────────────────────────────────────────

  const handleAddToCart = async () => {
    if (!isValid) {
      setCartError(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setCartLoading(true);
    setCartError('');

    try {
      const payload = toPayload();
      await apiClient.post(API_ROUTES.CART.ADD, {
        productId:         product.id,
        variantId:         payload.variantId,
        quantity:          1,
        customizationData: payload,
        previewUrl:        payload.previewUrl,
      });
      router.replace(`/${locale}/products/${slug}`);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCartLoading(false);
    }
  };

  const angles = template?.angles ?? [];

  return (
    <>
      {/* Full-screen overlay (sits above Navbar/Footer) */}
      <div className="fixed inset-0 z-40 flex flex-col bg-[#1A1A1A] overflow-hidden">

        {/* ── TOP ZONE: canvas area ─────────────────────────────────────────── */}
        <div
          className="relative flex-shrink-0 transition-[height] duration-300"
          style={{ height: isKeyboardVisible ? '28vh' : '46vh' }}
        >
          {/* ── Top bar ──────────────────────────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3">
            {/* Close button */}
            <button
              type="button"
              onClick={() =>
                guardedNavigate(() =>
                  router.replace(`/${locale}/products/${slug}`),
                )
              }
              className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              aria-label="Close customizer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Step label */}
            <span className="text-sm font-medium text-white">
              {STEP_NAMES[step - 1]}
            </span>

            {/* Preview button */}
            <button
              type="button"
              onClick={() => generatePreview()}
              disabled={!isValid}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-button border',
                'text-sm font-medium transition-all',
                isValid
                  ? 'text-white border-white/40 hover:border-white'
                  : 'text-white/40 border-white/20 opacity-40 cursor-not-allowed',
              ].join(' ')}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>

          {/* ── Product canvas (centered) ─────────────────────────────────── */}
          <div className="absolute inset-0 flex items-center justify-center">
            <MobileCustomizerCanvas activeAngle={activeAngle} />
          </div>

          {/* ── Angle tabs ────────────────────────────────────────────────── */}
          {angles.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {angles.map((angle) => {
                const isActive = activeAngle === angle.id;
                return (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => setActiveAngle(angle.id)}
                    className={[
                      'flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-white text-[#1A1A1A]'
                        : 'bg-white/20 text-white hover:bg-white/30',
                    ].join(' ')}
                  >
                    {angle.label}
                    {isActive && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BOTTOM ZONE: white form sheet ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-t-[20px] overflow-hidden relative">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 shrink-0">
            <div className="w-9 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Progress bar */}
          <div className="mt-2 mx-5 h-1 bg-gray-100 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* Step counter + product name */}
          <div className="flex items-center justify-between mt-2 px-5 shrink-0">
            <span className="text-xs text-muted">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-xs text-muted truncate max-w-[50%] text-right">
              {product.name}
            </span>
          </div>

          {/* Scrollable step content */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-24"
          >
            {step === 1 && <Step1BasicInfo isLoggedIn={isLoggedIn} />}
            {step === 2 && <Step2PhotoUpload />}
            {step === 3 && <Step3StylePicker />}
          </div>

          {/* ── Sticky bottom action bar ──────────────────────────────────── */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 py-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            {step < TOTAL_STEPS ? (
              /* Steps 1 & 2 — navigation buttons */
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="w-[40%] h-11 border border-border rounded-button text-sm font-medium text-secondary hover:bg-background transition-colors"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS))}
                  className={[
                    'h-11 rounded-button text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors',
                    step === 1 ? 'w-full' : 'flex-1',
                  ].join(' ')}
                >
                  Continue →
                </button>
              </div>
            ) : (
              /* Step 3 — price + add to cart */
              <>
                <div className="flex items-center gap-3">
                  {/* Price block */}
                  <div className="shrink-0">
                    <p className="text-lg font-bold text-primary leading-none">
                      ${product.basePrice.toFixed(2)}
                    </p>
                    {product.variants?.[0] && (
                      <p className="text-xs text-muted leading-none mt-0.5">
                        {[product.variants[0].size, product.variants[0].color]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Add to Cart button */}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isValid || cartLoading}
                    aria-busy={cartLoading}
                    className={[
                      'flex-1 h-11 rounded-button text-sm font-bold flex items-center justify-center gap-2 transition-colors',
                      isValid && !cartLoading
                        ? 'bg-primary hover:bg-primary-dark text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {cartLoading ? (
                      <>
                        <Spinner />
                        Adding…
                      </>
                    ) : (
                      'Add to Cart 🛍'
                    )}
                  </button>
                </div>

                {cartError && (
                  <p className="text-xs text-error mt-2 text-center" role="alert">
                    {cartError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes guard */}
      <UnsavedModal
        isOpen={showConfirmModal}
        onStay={cancelLeave}
        onLeave={confirmLeave}
      />

      {/* Preview modal — driven by store */}
      <PreviewModal basePrice={product.basePrice} onAddToCart={handleAddToCart} />
    </>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#1A1A1A] overflow-hidden">
      <div className="flex items-center justify-center" style={{ height: '46vh' }}>
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="flex-1 bg-white rounded-t-[20px] px-5 pt-8">
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-border/50 rounded w-3/4" />
          <div className="h-10 bg-border/30 rounded" />
          <div className="h-10 bg-border/30 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Page root — fetch product, desktop redirect, init provider ────────────────

export default function MobileCustomizePage() {
  const params = useParams<{ slug: string }>();
  const slug   = params?.slug ?? '';
  const locale = useLocale();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch product ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;
    apiClient
      .get<ProductDetailDto>(API_ROUTES.PRODUCTS.DETAIL(slug))
      .then((data) => setProduct(data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Desktop redirect (≥768px → product page) ────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 768) {
      router.replace(`/${locale}/products/${slug}`);
    }
  }, [locale, slug, router]);

  // ── No template redirect ────────────────────────────────────────────────

  useEffect(() => {
    if (!product) return;
    if (!product.isPersonalizable) {
      router.replace(`/${locale}/products/${slug}`);
    }
  }, [product, locale, slug, router]);

  if (loading) return <LoadingScreen />;

  if (!product || !product.isPersonalizable) return <LoadingScreen />;

  const template: CustomizationTemplate =
    product.customizationTemplate ?? DEMO_TEMPLATE;

  return (
    <CustomizerProvider
      template={template}
      productId={product.id}
      locale={locale}
    >
      <InnerPage
        slug={slug}
        product={product}
        locale={locale}
      />
    </CustomizerProvider>
  );
}
