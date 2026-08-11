'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ── Schema ────────────────────────────────────────────────────────────────────

const SUBJECT_VALUES = ['general', 'order', 'personalization', 'returns', 'custom', 'other'] as const;

// Validation messages injected at call time via a factory, since useTranslations
// can only be called inside a component/hook body.
function buildSchema(t: ReturnType<typeof useTranslations<'pages.contact.form.validation'>>) {
  return z.object({
    name:        z.string().min(2, t('nameMin')).max(100),
    email:       z.string().email(t('emailInvalid')),
    subject:     z.enum(SUBJECT_VALUES, { error: t('subjectRequired') }),
    orderNumber: z.string().max(50).optional(),
    message:     z.string().min(20, t('messageMin')).max(2000),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

// ── Input style helper ────────────────────────────────────────────────────────

const inp = (hasError?: boolean) =>
  [
    'w-full px-4 py-2.5 text-sm border rounded-xl bg-background text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
    hasError ? 'border-red-400' : 'border-border',
  ].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactForm() {
  const t           = useTranslations('pages.contact.form');
  const tValidation  = useTranslations('pages.contact.form.validation');

  const [submitted, setSubmitted] = useState(false);
  const [apiError,  setApiError]  = useState('');

  const SUBJECTS: { value: FormValues['subject']; label: string }[] = [
    { value: 'general',         label: t('subjects.general')         },
    { value: 'order',           label: t('subjects.order')           },
    { value: 'personalization', label: t('subjects.personalization') },
    { value: 'returns',         label: t('subjects.returns')         },
    { value: 'custom',          label: t('subjects.custom')          },
    { value: 'other',           label: t('subjects.other')           },
  ];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(tValidation)),
  });

  const subject       = watch('subject');
  const showOrderField = subject === 'order';

  const onSubmit = async (data: FormValues) => {
    setApiError('');
    try {
      await apiClient.post(API_ROUTES.NOTIFICATIONS.CONTACT, data);
      setSubmitted(true);
      reset();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t('genericError'));
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-secondary mb-2">{t('successTitle')}</h3>
        <p className="text-muted mb-4 text-sm max-w-xs">
          {t('successDesc')}
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-primary text-sm hover:underline"
        >
          {t('sendAnother')}
        </button>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {apiError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5" role="alert">
          {apiError}
        </p>
      )}

      {/* Name + Email */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-secondary block mb-1.5">
            {t('nameLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            autoComplete="name"
            placeholder={t('namePlaceholder')}
            className={inp(!!errors.name)}
          />
          {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-secondary block mb-1.5">
            {t('emailLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className={inp(!!errors.email)}
          />
          {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="text-sm font-medium text-secondary block mb-1.5">
          {t('subjectLabel')} <span className="text-red-500">*</span>
        </label>
        <select {...register('subject')} className={inp(!!errors.subject)}>
          <option value="">{t('subjectPlaceholder')}</option>
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {errors.subject && <p className="text-xs text-red-500 mt-0.5">{errors.subject.message}</p>}
      </div>

      {/* Order number — conditional */}
      {showOrderField && (
        <div>
          <label className="text-sm font-medium text-secondary block mb-1.5">
            {t('orderNumberLabel')}
          </label>
          <input
            {...register('orderNumber')}
            placeholder={t('orderNumberPlaceholder')}
            className={`${inp()} font-mono`}
          />
          <p className="text-xs text-muted mt-0.5">
            {t('orderNumberHint')}
          </p>
        </div>
      )}

      {/* Message */}
      <div>
        <label className="text-sm font-medium text-secondary block mb-1.5">
          {t('messageLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('message')}
          rows={5}
          placeholder={t('messagePlaceholder')}
          className={`${inp(!!errors.message)} resize-none`}
        />
        {errors.message && <p className="text-xs text-red-500 mt-0.5">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary-dark text-white rounded-full py-3 font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('submitting')}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {t('submit')}
          </>
        )}
      </button>
    </form>
  );
}
