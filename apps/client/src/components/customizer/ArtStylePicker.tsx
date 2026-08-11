'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { ArtStyle, ImageField } from '../../lib/customizer/types';
import { hotjarEvent } from '../../lib/analytics/hotjar';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface ArtStyleOption {
  id: string;
  label: string;
  description: string;
  previewUrl: string;
}

interface ArtStylePickerProps {
  fieldId: string;
  field: ImageField;
}

export function ArtStylePicker({ fieldId, field }: ArtStylePickerProps) {
  const t               = useTranslations('customizer.artStyle');
  const fieldValue      = useCustomizerStore((s) => s.fieldValues[fieldId]);
  const applyArtStyle   = useCustomizerStore((s) => s.applyArtStyle);
  const revertToOriginal = useCustomizerStore((s) => s.revertToOriginal);

  const [styles,       setStyles]       = useState<ArtStyleOption[]>([]);
  const [fetchError,   setFetchError]   = useState(false);

  const activeStyle = fieldValue?.artStyle ?? null;
  const isProcessing = fieldValue?.isUploading ?? false;
  const hasImage = Boolean(fieldValue?.imageUrl || fieldValue?.processedImageUrl);

  useEffect(() => {
    if (!field.allowArtStyle) return;
    apiClient
      .get<ArtStyleOption[]>(API_ROUTES.CUSTOMIZATION.ART_STYLES)
      .then((list) => {
        const allowed = field.artStyles ? new Set(field.artStyles) : null;
        setStyles(allowed ? list.filter((s) => allowed.has(s.id as ArtStyle)) : list);
      })
      .catch(() => setFetchError(true));
  }, [field.allowArtStyle, field.artStyles]);

  if (!field.allowArtStyle || fetchError || styles.length === 0 || !hasImage) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-secondary">{t('label')}</span>
        {isProcessing && (
          <span className="flex items-center gap-1 text-xs text-primary animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('processing')}
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {/* None — revert to original */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => revertToOriginal(fieldId)}
          className={[
            'flex flex-col items-center gap-1 p-1 rounded-lg border-2 transition-all',
            !activeStyle
              ? 'border-primary'
              : 'border-transparent hover:border-border',
            isProcessing ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
        >
          <div className="w-12 h-12 rounded-md bg-background border border-border flex items-center justify-center">
            <span className="text-[9px] font-medium text-muted text-center leading-tight">
              {t('none')}
            </span>
          </div>
          <span className="text-[10px] text-muted">{t('original')}</span>
        </button>

        {styles.map((style) => {
          const isCurrent  = activeStyle === style.id;
          const isSpinning = isProcessing && isCurrent;

          return (
            <button
              key={style.id}
              type="button"
              disabled={isProcessing}
              title={style.description}
              onClick={() => { applyArtStyle(fieldId, style.id as ArtStyle); hotjarEvent('customizer_style_applied'); }}
              className={[
                'flex flex-col items-center gap-1 p-1 rounded-lg border-2 transition-all',
                isCurrent
                  ? 'border-primary'
                  : 'border-transparent hover:border-border',
                isProcessing && !isCurrent ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-background border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={style.previewUrl}
                  alt={style.label}
                  className="w-full h-full object-cover"
                />
                {isSpinning && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted text-center leading-tight max-w-[52px] truncate">
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
