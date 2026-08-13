'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Pencil } from 'lucide-react';
import { useFinancesTaxInfo, useUpdateTaxInfo } from '@ezihubb/api-client';
import { FinancesSubNav } from '../../../../../../components/seller/FinancesSubNav';

type SellerType = 'INDIVIDUAL' | 'BUSINESS';

interface FormState {
  sellerType:    SellerType;
  fullLegalName: string;
  taxpayerId:    string;
  dateOfBirth:   string;
  country:       string;
  streetAddress: string;
  flatOther:     string;
  city:          string;
  province:      string;
  postCode:      string;
  phone:         string;
}

const EMPTY_FORM: FormState = {
  sellerType: 'INDIVIDUAL', fullLegalName: '', taxpayerId: '', dateOfBirth: '',
  country: 'VN', streetAddress: '', flatOther: '', city: '', province: '', postCode: '', phone: '',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

export default function TaxInformationPage() {
  const t = useTranslations('seller.finances.taxInfo');
  const { data: taxInfo, isLoading } = useFinancesTaxInfo();
  const updateTaxInfo = useUpdateTaxInfo();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!taxInfo) return;
    setForm({
      sellerType:    taxInfo.sellerType,
      fullLegalName: taxInfo.fullLegalName,
      // The API only ever returns a masked last4 — leaving this blank on
      // submit keeps the existing encrypted value server-side (see
      // updateTaxInfo), it does not clear it.
      taxpayerId:    '',
      dateOfBirth:   taxInfo.dateOfBirth ? taxInfo.dateOfBirth.slice(0, 10) : '',
      country:       taxInfo.country,
      streetAddress: taxInfo.streetAddress,
      flatOther:     taxInfo.flatOther ?? '',
      city:          taxInfo.city,
      province:      taxInfo.province ?? '',
      postCode:      taxInfo.postCode ?? '',
      phone:         taxInfo.phone ?? '',
    });
  }, [taxInfo]);

  const startEdit = () => {
    if (!taxInfo) setForm(EMPTY_FORM);
    setEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTaxInfo.mutateAsync({
      sellerType:    form.sellerType,
      fullLegalName: form.fullLegalName,
      taxpayerId:    form.taxpayerId || undefined,
      dateOfBirth:   form.dateOfBirth || undefined,
      country:       form.country,
      streetAddress: form.streetAddress,
      flatOther:     form.flatOther || undefined,
      city:          form.city,
      province:      form.province || undefined,
      postCode:      form.postCode || undefined,
      phone:         form.phone || undefined,
    });
    setEditing(false);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-button bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div>
      <h1 className="text-xl font-bold text-secondary mb-1">{t('title')}</h1>
      <FinancesSubNav />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : editing ? (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="w-3.5 h-3.5" /> {t('encryptNote')}
          </p>

          <div>
            <p className="text-sm font-bold text-secondary mb-1">{t('sellerTypeQuestion')}</p>
            <p className="text-xs text-muted mb-3">{t('sellerTypeNote')}</p>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio" name="sellerType" className="mt-1"
                  checked={form.sellerType === 'INDIVIDUAL'}
                  onChange={() => setForm((f) => ({ ...f, sellerType: 'INDIVIDUAL' }))}
                />
                <span>
                  <span className="block text-sm text-secondary font-medium">{t('individual')}</span>
                  <span className="block text-xs text-muted">{t('individualNote')}</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio" name="sellerType" className="mt-1"
                  checked={form.sellerType === 'BUSINESS'}
                  onChange={() => setForm((f) => ({ ...f, sellerType: 'BUSINESS' }))}
                />
                <span className="block text-sm text-secondary font-medium">{t('business')}</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <div>
              <p className="text-sm font-bold text-secondary">{t('taxpayerIdTitle')}</p>
              <p className="text-xs text-muted mt-0.5">{t('taxpayerIdNote')}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('fullLegalName')}</label>
              <input required value={form.fullLegalName} onChange={(e) => setForm((f) => ({ ...f, fullLegalName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('taxpayerId')}</label>
              <input
                value={form.taxpayerId}
                onChange={(e) => setForm((f) => ({ ...f, taxpayerId: e.target.value }))}
                placeholder={taxInfo?.taxpayerIdLast4 ? t('taxpayerIdPlaceholderExisting', { last4: taxInfo.taxpayerIdLast4 }) : ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('dateOfBirth')}</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <p className="text-sm font-bold text-secondary">{t('contactInfoTitle')}</p>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('country')}</label>
              <input required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }))} className={inputCls} maxLength={2} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('streetAddress')}</label>
              <input required value={form.streetAddress} onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('flatOther')}</label>
              <input value={form.flatOther} onChange={(e) => setForm((f) => ({ ...f, flatOther: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('city')}</label>
              <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">{t('province')}</label>
                <input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">{t('postCode')}</label>
                <input value={form.postCode} onChange={(e) => setForm((f) => ({ ...f, postCode: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">{t('phone')}</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(false)}
              className="px-5 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary/40 transition-colors">
              {t('cancel')}
            </button>
            <button type="submit" disabled={updateTaxInfo.isPending}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50">
              {updateTaxInfo.isPending ? t('saving') : t('submit')}
            </button>
          </div>
        </form>
      ) : taxInfo ? (
        <div className="max-w-2xl bg-surface border border-border rounded-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted mb-0.5">{t('sellerTypeQuestion')}</p>
              <p className="text-sm text-secondary font-medium">{t(taxInfo.sellerType === 'INDIVIDUAL' ? 'individual' : 'business')}</p>
            </div>
            <button type="button" onClick={startEdit} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <Pencil className="w-3.5 h-3.5" /> {t('edit')}
            </button>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted mb-0.5">{t('fullLegalName')}</p>
            <p className="text-sm text-secondary">{taxInfo.fullLegalName}</p>
          </div>
          {taxInfo.taxpayerIdLast4 && (
            <div>
              <p className="text-xs text-muted mb-0.5">{t('taxpayerId')}</p>
              <p className="text-sm text-secondary">•••• {taxInfo.taxpayerIdLast4}</p>
            </div>
          )}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted mb-0.5">{t('contactInfoTitle')}</p>
            <p className="text-sm text-secondary">{taxInfo.streetAddress}</p>
            {taxInfo.flatOther && <p className="text-sm text-secondary">{taxInfo.flatOther}</p>}
            <p className="text-sm text-secondary">{[taxInfo.city, taxInfo.province, taxInfo.postCode].filter(Boolean).join(', ')}</p>
            <p className="text-sm text-secondary">{taxInfo.country}</p>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl bg-surface border border-border rounded-card p-6 text-center">
          <p className="text-sm text-muted mb-3">{t('noTaxInfo')}</p>
          <button type="button" onClick={startEdit}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors">
            {t('addTaxInfo')}
          </button>
        </div>
      )}
    </div>
  );
}
