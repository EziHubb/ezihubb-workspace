'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface FormState {
  firstName:           string;
  lastName:            string;
  email:               string;
  website:             string;
  promoDescription:    string;
  desiredReferralCode: string;
}

const INITIAL: FormState = {
  firstName:           '',
  lastName:            '',
  email:               '',
  website:             '',
  promoDescription:    '',
  desiredReferralCode: '',
};

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
  description = '',
  textarea = false,
  rows = 4,
  maxLength,
}: {
  label:        string;
  name:         string;
  value:        string;
  onChange:     (v: string) => void;
  type?:        string;
  required?:    boolean;
  placeholder?: string;
  description?: string;
  textarea?:    boolean;
  rows?:        number;
  maxLength?:   number;
}) {
  const baseClass =
    'w-full border border-border rounded-button px-4 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors';

  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1.5">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`${baseClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={maxLength}
          placeholder={placeholder}
          className={baseClass}
        />
      )}
      {description && (
        <p className="text-xs text-muted mt-1">{description}</p>
      )}
    </div>
  );
}

export default function AffiliateRegisterPage() {
  const locale = useLocale();
  const t      = useTranslations('affiliate.register');

  const [form,      setForm]      = useState<FormState>(INITIAL);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [sent,      setSent]      = useState(false);

  const set = (k: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await apiClient.post(API_ROUTES.AFFILIATES.APPLY, {
        firstName:           form.firstName,
        lastName:            form.lastName,
        email:               form.email,
        website:             form.website,
        promoDescription:    form.promoDescription,
        desiredReferralCode: form.desiredReferralCode || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-8 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="font-display text-3xl font-bold text-secondary mb-3">
          {t('successTitle')}
        </h1>
        <p className="text-muted mb-2">
          {t.rich('successBody', {
            email: form.email,
            strong: (chunks) => <strong className="text-secondary">{chunks}</strong>,
          })}
        </p>
        <p className="text-sm text-muted mb-8">
          {t('successNote')}
        </p>
        <Link
          href={`/${locale}/affiliate`}
          className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToProgram')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 md:px-8 py-12">

      {/* Back link */}
      <Link
        href={`/${locale}/affiliate`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToProgram')}
      </Link>

      {/* Header */}
      <h1 className="font-display text-3xl font-bold text-secondary mb-2">
        {t('title')}
      </h1>
      <p className="text-muted text-sm mb-8">
        {t('subtitle')}
      </p>

      {error && (
        <div role="alert" className="mb-6 p-3 bg-error/5 border border-error/20 rounded-sm text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t('firstName')}
            name="firstName"
            value={form.firstName}
            onChange={set('firstName')}
            required
          />
          <Field
            label={t('lastName')}
            name="lastName"
            value={form.lastName}
            onChange={set('lastName')}
            required
          />
        </div>

        <Field
          label={t('email')}
          name="email"
          type="email"
          value={form.email}
          onChange={set('email')}
          required
          placeholder={t('emailPlaceholder')}
        />

        <Field
          label={t('website')}
          name="website"
          type="url"
          value={form.website}
          onChange={set('website')}
          required
          placeholder={t('websitePlaceholder')}
          description={t('websiteDescription')}
        />

        <Field
          label={t('promo')}
          name="promoDescription"
          value={form.promoDescription}
          onChange={set('promoDescription')}
          required
          textarea
          rows={4}
          maxLength={500}
          placeholder={t('promoPlaceholder')}
          description={t('promoCount', { count: form.promoDescription.length })}
        />

        <Field
          label={t('referralCode')}
          name="desiredReferralCode"
          value={form.desiredReferralCode}
          onChange={(v) => set('desiredReferralCode')(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder={t('referralCodePlaceholder')}
          description={t('referralCodeDescription')}
          maxLength={20}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold text-sm px-6 py-3.5 rounded-button transition-colors uppercase tracking-wide"
        >
          {isLoading ? t('submitting') : t('submit')}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        {t('alreadyApproved')}{' '}
        <Link href={`/${locale}/affiliate/dashboard`} className="text-primary hover:underline">
          {t('goToDashboard')}
        </Link>
      </p>
    </div>
  );
}
