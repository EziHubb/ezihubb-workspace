'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters'),
  email:       z.string().email('Enter a valid email address'),
  subject:     z.enum(['General', 'Order Issue', 'Personalization', 'Returns', 'Other']),
  orderNumber: z.string().optional(),
  message:     z.string().min(10, 'Please provide more detail (min 10 characters)').max(2000),
});

type FormValues = z.infer<typeof schema>;

const SUBJECTS = [
  { value: 'General',         label: 'General Inquiry'   },
  { value: 'Order Issue',     label: 'Order Issue'       },
  { value: 'Personalization', label: 'Personalization Help' },
  { value: 'Returns',         label: 'Returns & Exchanges' },
  { value: 'Other',           label: 'Other'             },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [apiError,  setApiError]  = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: 'General' },
  });

  const selectedSubject = watch('subject');
  const showOrderField  = selectedSubject === 'Order Issue';

  const apiBase = () =>
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setApiError('');
    try {
      const res = await fetch(`${apiBase()}/api/v1/notifications/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Failed to send message');
      }
      setSubmitted(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsPending(false);
    }
  };

  const inp = (err?: string) =>
    [
      'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
      err ? 'border-error' : 'border-border',
    ].join(' ');

  // ── Success ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="w-8 h-8 text-success" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-secondary mb-2">
            Message sent!
          </h3>
          <p className="text-muted text-sm max-w-xs">
            We&apos;ll reply to your message within 2 hours during business hours.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {apiError && (
        <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
          {apiError}
        </p>
      )}

      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Your Name <span className="text-error">*</span>
        </label>
        <input
          {...register('name')}
          autoComplete="name"
          placeholder="Jane Doe"
          className={inp(errors.name?.message)}
        />
        {errors.name && <p className="text-xs text-error mt-0.5">{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Email Address <span className="text-error">*</span>
        </label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="jane@example.com"
          className={inp(errors.email?.message)}
        />
        {errors.email && <p className="text-xs text-error mt-0.5">{errors.email.message}</p>}
      </div>

      {/* Subject */}
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Subject <span className="text-error">*</span>
        </label>
        <select {...register('subject')} className={inp(errors.subject?.message)}>
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Order number — conditional */}
      {showOrderField && (
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Order Number
          </label>
          <input
            {...register('orderNumber')}
            placeholder="MLH-2024-00001"
            className={inp(errors.orderNumber?.message)}
          />
          <p className="text-xs text-muted mt-0.5">
            Find this in your confirmation email or Account → My Orders.
          </p>
        </div>
      )}

      {/* Message */}
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Message <span className="text-error">*</span>
        </label>
        <textarea
          {...register('message')}
          rows={5}
          placeholder="Describe your question or issue in detail…"
          className={inp(errors.message?.message) + ' resize-none'}
        />
        {errors.message && <p className="text-xs text-error mt-0.5">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
      >
        {isPending ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
