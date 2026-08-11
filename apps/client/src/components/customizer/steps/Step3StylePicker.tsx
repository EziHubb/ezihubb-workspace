'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Check, RefreshCw } from 'lucide-react';
import { useCustomizerStore } from '../../../lib/store/customizer.store';
import type { SelectField } from '../../../lib/customizer/types';

export function Step3StylePicker() {
  const t                  = useTranslations('customizer.step3');
  const tCommon            = useTranslations('common');
  const template           = useCustomizerStore((s) => s.template);
  const fieldValues        = useCustomizerStore((s) => s.fieldValues);
  const setField           = useCustomizerStore((s) => s.setFieldValue);
  const generatePreview    = useCustomizerStore((s) => s.generatePreview);
  const isGenerating       = useCustomizerStore((s) => s.isGeneratingPreview);
  const previewImageUrl    = useCustomizerStore((s) => s.previewImageUrl);
  const previewError       = useCustomizerStore((s) => s.previewError);

  if (!template) return null;

  const selectFields = template.fields.filter(
    (f): f is SelectField => f.type === 'select',
  );

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-bold text-secondary">{t('title')}</h4>
        <p className="text-sm text-muted mt-1">
          {t('desc')}
        </p>
      </div>

      {selectFields.map((field) => {
        const selected = fieldValues[field.id]?.selectValue ?? '';

        return (
          <div key={field.id} className="space-y-2">
            <p className="text-sm font-medium text-secondary">
              {field.label}
              {field.required && <span className="text-error ml-0.5">*</span>}
            </p>

            {/* 2-column style grid */}
            <div className="grid grid-cols-2 gap-3">
              {field.options.map((opt) => {
                const isActive = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField(field.id, { selectValue: opt.value })}
                    aria-pressed={isActive}
                    className={[
                      'relative rounded-xl border-2 overflow-hidden text-left transition-all',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      isActive
                        ? 'border-primary shadow-sm'
                        : 'border-border hover:border-primary/40',
                    ].join(' ')}
                  >
                    {/* Swatch — 60% of card height */}
                    <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                      {opt.previewUrl ? (
                        <Image
                          src={opt.previewUrl}
                          alt={opt.label}
                          fill
                          sizes="150px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-background flex items-center justify-center">
                          <span className="text-xs text-muted">{opt.label[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* Label — bottom 40% */}
                    <div className="px-3 py-2 bg-surface">
                      <span className="text-xs font-semibold text-secondary line-clamp-1">
                        {opt.label}
                      </span>
                    </div>

                    {/* Active checkmark */}
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {field.helpText && (
              <p className="text-xs text-muted">{field.helpText}</p>
            )}
          </div>
        );
      })}

      {/* ── Generate Preview ─────────────────────────────────────────────────── */}
      <div className="mt-4">
        {/* Default: generate prompt */}
        {!isGenerating && !previewImageUrl && (
          <button
            type="button"
            onClick={() => generatePreview()}
            className="w-full h-[60px] flex flex-col items-center justify-center gap-0.5 border-2 border-dashed border-primary/40 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <span className="text-sm font-bold text-primary">{t('generatePreview')}</span>
            <span className="text-xs text-muted">{t('generateHint')}</span>
          </button>
        )}

        {/* Loading */}
        {isGenerating && (
          <div className="space-y-3">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-primary via-primary-light to-primary bg-[length:200%_100%]" />
            </div>
            <p className="text-sm text-center text-secondary font-medium">
              {t('generating')}
            </p>
            <p className="text-xs text-center text-muted">
              {t('generatingHint')}
            </p>
          </div>
        )}

        {/* Result */}
        {!isGenerating && previewImageUrl && (
          <div className="space-y-3">
            <div className="relative w-full h-[200px] rounded-xl overflow-hidden bg-background">
              <Image
                src={previewImageUrl}
                alt={t('previewAlt')}
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                className="object-cover"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-success font-medium">{t('lookingGood')}</span>
              <button
                type="button"
                onClick={() => generatePreview()}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('regenerate')}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {!isGenerating && previewError && (
          <div className="text-center space-y-2">
            <p className="text-xs text-error">{previewError}</p>
            <button
              type="button"
              onClick={() => generatePreview()}
              className="text-xs text-primary hover:underline"
            >
              {tCommon('retry')}
            </button>
          </div>
        )}
      </div>

      {selectFields.length === 0 && (
        <p className="text-sm text-muted text-center py-2">
          {t('noStyleOptions')}
        </p>
      )}
    </div>
  );
}
