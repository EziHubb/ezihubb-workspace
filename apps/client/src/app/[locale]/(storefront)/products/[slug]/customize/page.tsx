'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { X, Eye, ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCustomizerStore } from '../../../../../../lib/store/customizer.store';
import { CustomizerProvider } from '../../../../../../components/customizer/CustomizerProvider';
import { TextFieldInput } from '../../../../../../components/customizer/TextFieldInput';
import { ImageUploadField } from '../../../../../../components/customizer/ImageUploadField';
import { StylePickerGrid } from '../../../../../../components/customizer/StylePickerGrid';
import { PreviewModal } from '../../../../../../components/customizer/PreviewModal';
import { DEMO_TEMPLATE } from '../../../../../../lib/customizer/types';
import type { CustomizationTemplate, TextField, DateField, ImageField, SelectField } from '../../../../../../lib/customizer/types';
import type { ProductDetailDto } from '../page';
import { API_ROUTES } from '@mlh/constants';

// Dynamic import Fabric canvas (no SSR)
const Canvas = dynamic(
  () => import('../../../../../../components/customizer/Canvas').then((m) => ({ default: m.Canvas })),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#1A1A1A]" /> },
);

// ── Step definitions ──────────────────────────────────────────────────────────

function getSteps(template: CustomizationTemplate) {
  const textFields  = template.fields.filter((f) => f.type === 'text' || f.type === 'date');
  const imageFields = template.fields.filter((f) => f.type === 'image');
  const styleFields = template.fields.filter((f) => f.type === 'select');

  const steps: { label: string; fieldIds: string[] }[] = [];
  if (textFields.length > 0)  steps.push({ label: 'Your Text',  fieldIds: textFields.map((f) => f.id) });
  if (imageFields.length > 0) steps.push({ label: 'Your Photo', fieldIds: imageFields.map((f) => f.id) });
  if (styleFields.length > 0) steps.push({ label: 'Choose Style', fieldIds: styleFields.map((f) => f.id) });
  if (steps.length === 0)     steps.push({ label: 'Customize', fieldIds: template.fields.map((f) => f.id) });

  return steps;
}

// ── Inner page content (inside CustomizerProvider) ────────────────────────────

function MobileCustomizerContent({
  product,
  template,
  locale,
}: {
  product:  ProductDetailDto;
  template: CustomizationTemplate;
  locale:   string;
}) {
  const router = useRouter();

  const storedTemplate    = useCustomizerStore((s) => s.template);
  const isValid           = useCustomizerStore((s) => s.isValid);
  const generatePreview   = useCustomizerStore((s) => s.generatePreview);
  const toPayload         = useCustomizerStore((s) => s.toCustomizationPayload);

  const [step,           setStep]          = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartError,      setCartError]     = useState('');
  // Keyboard visibility: shrink canvas when input is focused
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const steps = storedTemplate ? getSteps(storedTemplate) : getSteps(template);
  const totalSteps = steps.length;
  const currentStep = steps[step];

  // Detect soft keyboard on mobile
  useEffect(() => {
    const onResize = () => {
      const visualViewport = window.visualViewport;
      if (visualViewport) {
        const heightRatio = visualViewport.height / window.innerHeight;
        setKeyboardVisible(heightRatio < 0.75);
      }
    };
    window.visualViewport?.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, []);

  const handleAddToCart = async () => {
    if (!isValid()) return;
    setIsAddingToCart(true);
    setCartError('');
    try {
      const payload = toPayload();
      const base    = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
      const res = await fetch(`${base}/api/v1${API_ROUTES.CART.ADD}`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: product.id,
          variantId: payload.variantId,
          quantity:  1,
          customizationData: payload,
          previewUrl:        payload.previewUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Failed to add to cart');
      }
      // Navigate back to product page after success
      router.push(`/${locale}/products/${product.slug}?added=1`);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const canProceed = step < totalSteps - 1;
  const canGoBack  = step > 0;

  // Canvas height: 46% of viewport normally, 30% when keyboard is open
  const canvasHeightClass = keyboardVisible
    ? 'h-[30dvh]'
    : 'h-[46dvh]';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1A1A1A] overflow-hidden">

      {/* ── Top zone: canvas ─────────────────────────────────────────────────── */}
      <div className={`${canvasHeightClass} relative flex-shrink-0 transition-all duration-300`}>
        <Canvas />

        {/* Close button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close customizer"
          className="absolute top-3 left-3 z-10 w-9 h-9 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Preview button */}
        <button
          type="button"
          onClick={() => generatePreview()}
          aria-label="Preview"
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 h-9 px-3 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>

        {/* Step progress indicator at bottom of canvas */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` } as React.CSSProperties}
          />
        </div>
      </div>

      {/* ── Bottom zone: scrollable white sheet ──────────────────────────────── */}
      <div className="flex-1 bg-surface rounded-t-[20px] overflow-hidden flex flex-col min-h-0">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Step header */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              Step {step + 1} of {totalSteps}
            </p>
            <p className="text-xs text-muted">{currentStep?.label}</p>
          </div>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {storedTemplate &&
            currentStep?.fieldIds.map((fieldId) => {
              const field = storedTemplate.fields.find((f) => f.id === fieldId);
              if (!field) return null;

              if (field.type === 'text' || field.type === 'date') {
                return <TextFieldInput key={fieldId} field={field as TextField | DateField} />;
              }
              if (field.type === 'image') {
                return <ImageUploadField key={fieldId} field={field as ImageField} />;
              }
              if (field.type === 'select') {
                return <StylePickerGrid key={fieldId} field={field as SelectField} />;
              }
              return null;
            })}

          {cartError && (
            <p className="text-sm text-error" role="alert">{cartError}</p>
          )}
        </div>

        {/* Sticky bottom bar */}
        <div className="shrink-0 px-5 py-4 border-t border-border bg-surface flex items-center gap-3">
          {/* Back */}
          {canGoBack ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center border border-border rounded-button text-secondary"
              aria-label="Previous step"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center border border-border rounded-button text-secondary"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Price + Next or Add to Cart */}
          {canProceed ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isValid() || isAddingToCart}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
            >
              <ShoppingBag className="w-4 h-4" />
              {isAddingToCart
                ? 'Adding…'
                : `Add to Cart — $${product.basePrice.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>

      {/* Preview modal */}
      <PreviewModal basePrice={product.basePrice} onAddToCart={handleAddToCart} />
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const params = useParams<{ locale: string; slug: string }>();
  const locale = params.locale;
  const slug   = params.slug;

  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
    fetch(`${base}/api/v1/products/${slug}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((body) => setProduct(body?.data ?? null))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface text-center px-6">
        <p className="text-lg font-bold text-secondary mb-4">Product not found</p>
        <button
          type="button"
          onClick={() => history.back()}
          className="text-primary underline text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const template: CustomizationTemplate =
    product.customizationTemplate ?? DEMO_TEMPLATE;

  return (
    <CustomizerProvider
      template={template}
      productId={product.id}
      locale={locale}
    >
      <MobileCustomizerContent
        product={product}
        template={template}
        locale={locale}
      />
    </CustomizerProvider>
  );
}
