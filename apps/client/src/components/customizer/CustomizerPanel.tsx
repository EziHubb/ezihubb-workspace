'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_ROUTES } from '@ezihubb/constants';
import { CustomizerProvider } from './CustomizerProvider';
import { BundleCustomizerPanel } from './BundleCustomizerPanel';
import { Canvas } from './Canvas';
import { AutoFillBanner } from './AutoFillBanner';
import { TextFieldInput } from './TextFieldInput';
import { ImageUploadField } from './ImageUploadField';
import { StylePickerGrid } from './StylePickerGrid';
import { PreviewModal } from './PreviewModal';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { apiClient } from '../../lib/api-client';
import { fmtAmount } from '@ezihubb/utils';
import type {
  CustomizationTemplate,
  TextField,
  DateField,
  ImageField,
  SelectField,
} from '../../lib/customizer/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface CustomizerPanelProps {
  template:      CustomizationTemplate;
  productId:     string;
  productName:   string;
  basePrice:     number;
  locale:        string;
  variantId?:    string | null;
  isLoggedIn?:   boolean;
  onCartSuccess: () => void;
}

// ── Inner content (accesses the Zustand store) ────────────────────────────────

interface InnerProps {
  productId:     string;
  basePrice:     number;
  isLoggedIn:    boolean;
  onCartSuccess: () => void;
}

function CustomizerPanelInner({
  productId,
  basePrice,
  isLoggedIn,
  onCartSuccess,
}: InnerProps) {
  const t               = useTranslations('customizer.panel');
  const template        = useCustomizerStore((s) => s.template);
  const isValid         = useCustomizerStore((s) => s.isValid);
  const generatePreview = useCustomizerStore((s) => s.generatePreview);
  const toPayload       = useCustomizerStore((s) => s.toCustomizationPayload);

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartError,      setCartError]      = useState('');

  const handleAddToCart = async () => {
    if (!isValid()) return;
    setIsAddingToCart(true);
    setCartError('');

    try {
      const payload = toPayload();

      await apiClient.post(API_ROUTES.CART.ADD, {
        productId,
        variantId:         payload.variantId,
        quantity:          1,
        customizationData: payload,
        previewUrl:        payload.previewUrl,
      });

      onCartSuccess();
    } catch (err) {
      setCartError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Guard until initTemplate runs (first render may have null template)
  if (!template) {
    return (
      <div className="border-2 border-primary/20 rounded-card bg-primary/5 p-5">
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const valid = isValid();

  return (
    <div className="border-2 border-primary/20 rounded-card bg-primary/5 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-secondary text-base">
          {t('title')}
        </h3>
        <span className="text-xs text-muted">
          <span className="text-error font-semibold">*</span> {t('required')}
        </span>
      </div>

      {/* Auto-fill banner (only when user has previous customization) */}
      <AutoFillBanner isLoggedIn={isLoggedIn} />

      {/* Fabric.js canvas */}
      <Canvas />

      {/* ── Field renderers ──────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {template.fields.map((field) => {
          if (field.type === 'text' || field.type === 'date') {
            return (
              <TextFieldInput
                key={field.id}
                field={field as TextField | DateField}
              />
            );
          }
          if (field.type === 'image') {
            return (
              <ImageUploadField key={field.id} field={field as ImageField} />
            );
          }
          if (field.type === 'select') {
            return (
              <StylePickerGrid key={field.id} field={field as SelectField} />
            );
          }
          return null;
        })}
      </div>

      {/* Generate Preview */}
      <button
        type="button"
        onClick={() => generatePreview()}
        className="w-full py-2.5 border border-primary/50 text-primary text-sm font-medium rounded-button hover:bg-primary/5 transition-colors"
      >
        {t('generatePreview')}
      </button>

      {/* Cart error */}
      {cartError && (
        <p className="text-xs text-error text-center" role="alert">
          {cartError}
        </p>
      )}

      {/* Add to Cart */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!valid || isAddingToCart}
        className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        aria-busy={isAddingToCart}
      >
        {isAddingToCart
          ? t('addingToCart')
          : t('addToCart', { amount: fmtAmount(basePrice) })}
      </button>

      {/* Completion hint */}
      {!valid && (
        <p className="text-xs text-muted text-center">
          {t('fillRequired')}
          <span className="text-error font-semibold">*</span>{t('toContinue')}
        </p>
      )}

      {/* Trust strip */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 border-t border-primary/10 text-xs text-muted">
        <span>{t('trust.shipping')}</span>
        <span>{t('trust.cancel')}</span>
        <span>{t('trust.secure')}</span>
      </div>

      {/* Preview modal (renders itself when isPreviewOpen = true in store) */}
      <PreviewModal basePrice={basePrice} onAddToCart={handleAddToCart} />
    </div>
  );
}

// ── Public export — wraps CustomizerProvider ──────────────────────────────────

export function CustomizerPanel({
  template,
  productId,
  productName: _productName,
  basePrice,
  locale,
  variantId,
  isLoggedIn = false,
  onCartSuccess,
}: CustomizerPanelProps) {
  return (
    <CustomizerProvider
      template={template}
      productId={productId}
      variantId={variantId ?? undefined}
      locale={locale}
    >
      <CustomizerPanelInner
        productId={productId}
        basePrice={basePrice}
        isLoggedIn={isLoggedIn}
        onCartSuccess={onCartSuccess}
      />
    </CustomizerProvider>
  );
}
