'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Shield, Check, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { FormField } from './primitives/FormField';
import type { GpsrInfo } from './types';

interface GPSRFormValues {
  manufacturerName:    string;
  manufacturerAddress: string;
  manufacturerEmail:   string;
  countryOfOrigin:     string;
  safetyWarningsText:  string;
}

interface Props {
  productId: string;
  isOpen:    boolean;
  onClose:   () => void;
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted';

export function GPSRModal({ productId, isOpen, onClose }: Props) {
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<GPSRFormValues>();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen) return null;

  const onSubmit = async (data: GPSRFormValues) => {
    const gpsrInfo: GpsrInfo = {
      manufacturerName:    data.manufacturerName    || undefined,
      manufacturerAddress: data.manufacturerAddress || undefined,
      manufacturerEmail:   data.manufacturerEmail   || undefined,
      countryOfOrigin:     data.countryOfOrigin     || undefined,
      safetyWarnings: data.safetyWarningsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
    };
    setSaving(true);
    try {
      await api.patch(API_ROUTES.ADMIN.PRODUCT_DETAIL(productId), { gpsrInfo });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-secondary">
              GPSR manufacturer and safety information
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted/10 text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Required if you sell to EEA states or Northern Ireland under the
              General Product Safety Regulation (GPSR) for listings added after Dec 13, 2024.
            </p>

            <FormField
              label="Manufacturer name"
              required
              error={errors.manufacturerName ? 'Manufacturer name is required' : undefined}
            >
              <input
                {...register('manufacturerName', { required: true })}
                placeholder="e.g. Daily Daisy Ltd"
                className={inputCls}
              />
            </FormField>

            <FormField
              label="Manufacturer address"
              required
              error={errors.manufacturerAddress ? 'Manufacturer address is required' : undefined}
            >
              <textarea
                {...register('manufacturerAddress', { required: true })}
                rows={3}
                placeholder="123 Daisy St, Portland, OR 97201, US"
                className={`${inputCls} resize-none`}
              />
            </FormField>

            <FormField label="Manufacturer email">
              <input
                type="email"
                {...register('manufacturerEmail')}
                placeholder="contact@manufacturer.com"
                className={inputCls}
              />
            </FormField>

            <FormField label="Country of origin">
              <input
                {...register('countryOfOrigin')}
                placeholder="e.g. United States"
                className={inputCls}
              />
            </FormField>

            <FormField label="Safety warnings (one per line)">
              <textarea
                {...register('safetyWarningsText')}
                rows={3}
                placeholder={'e.g. Not suitable for children under 3\nKeep away from heat sources'}
                className={`${inputCls} resize-none`}
              />
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
            <button
              type="submit"
              disabled={saving || saved}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saved  && <Check   className="w-4 h-4" />}
              {!saving && !saved && <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-lg hover:border-primary/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
