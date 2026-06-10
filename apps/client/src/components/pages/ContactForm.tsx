'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Schema ────────────────────────────────────────────────────────────────────

const SUBJECT_VALUES = ['general', 'order', 'personalization', 'returns', 'custom', 'other'] as const;

const schema = z.object({
  name:        z.string().min(2,  'Name must be at least 2 characters').max(100),
  email:       z.string().email('Enter a valid email address'),
  subject:     z.enum(SUBJECT_VALUES, { error: 'Please select a topic' }),
  orderNumber: z.string().max(50).optional(),
  message:     z.string().min(20, 'Please provide more detail (min 20 characters)').max(2000),
});

type FormValues = z.infer<typeof schema>;

const SUBJECTS: { value: FormValues['subject']; label: string }[] = [
  { value: 'general',         label: 'General question'            },
  { value: 'order',           label: 'Order issue or question'     },
  { value: 'personalization', label: 'Personalization help'        },
  { value: 'returns',         label: 'Returns & exchanges'         },
  { value: 'custom',          label: 'Custom / bulk order inquiry' },
  { value: 'other',           label: 'Other'                       },
];

// ── Input style helper ────────────────────────────────────────────────────────

const inp = (hasError?: boolean) =>
  [
    'w-full px-4 py-2.5 text-sm border rounded-xl bg-background text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
    hasError ? 'border-red-400' : 'border-border',
  ].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [apiError,  setApiError]  = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-secondary mb-2">Message sent!</h3>
        <p className="text-muted mb-4 text-sm max-w-xs">
          We&apos;ll reply to your email within 2 hours during business hours.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-primary text-sm hover:underline"
        >
          Send another message
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
            Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            autoComplete="name"
            placeholder="Your full name"
            className={inp(!!errors.name)}
          />
          {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-secondary block mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inp(!!errors.email)}
          />
          {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="text-sm font-medium text-secondary block mb-1.5">
          Subject <span className="text-red-500">*</span>
        </label>
        <select {...register('subject')} className={inp(!!errors.subject)}>
          <option value="">Select a topic…</option>
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
            Order Number
          </label>
          <input
            {...register('orderNumber')}
            placeholder="e.g. MLH-2024-04521"
            className={`${inp()} font-mono`}
          />
          <p className="text-xs text-muted mt-0.5">
            Find this in your confirmation email or Account → My Orders.
          </p>
        </div>
      )}

      {/* Message */}
      <div>
        <label className="text-sm font-medium text-secondary block mb-1.5">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('message')}
          rows={5}
          placeholder="Tell us how we can help…"
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
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Message
          </>
        )}
      </button>
    </form>
  );
}
