'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react';
import { API_ROUTES } from '@mlh/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

const COOLDOWN_SECS = 60;

export default function ForgotPasswordPage() {
  const locale = useLocale();

  const [submitted,  setSubmitted]  = useState(false);
  const [sentEmail,  setSentEmail]  = useState('');
  const [isPending,  setIsPending]  = useState(false);
  const [apiError,   setApiError]   = useState('');
  const [cooldown,   setCooldown]   = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ── Cleanup interval on unmount ─────────────────────────────────────────────
  useEffect(() => () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECS);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1_000);
  };

  const apiBase = () =>
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const sendLink = async (email: string) => {
    setIsPending(true);
    setApiError('');
    try {
      const res = await fetch(
        `${apiBase()}/api/v1${API_ROUTES.AUTH.FORGOT_PASSWORD}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setApiError(body.message ?? 'Failed to send reset link.');
        return;
      }
      setSentEmail(email);
      setSubmitted(true);
      startCooldown();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsPending(false);
    }
  };

  const onSubmit = (data: FormValues) => sendLink(data.email);

  const handleResend = () => {
    if (cooldown > 0) return;
    sendLink(sentEmail);
  };

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="text-center space-y-5">
        {/* Envelope illustration */}
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-10 h-10 text-primary" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-secondary mb-2">
            Check your inbox!
          </h1>
          <p className="text-muted text-sm max-w-xs mx-auto">
            We sent a password reset link to{' '}
            <span className="font-semibold text-secondary">{sentEmail}</span>.
            The link expires in <strong>1 hour</strong>.
          </p>
        </div>

        <Link
          href={`/${locale}/login`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-5 py-2.5 hover:border-primary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        <p className="text-xs text-muted">
          Didn&apos;t receive it?{' '}
          {cooldown > 0 ? (
            <span className="text-secondary">
              Resend in <span className="font-mono font-semibold">{cooldown}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isPending}
              className="text-primary hover:underline font-medium disabled:opacity-50"
            >
              {isPending ? 'Sending…' : 'Resend'}
            </button>
          )}
        </p>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/${locale}/login`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sign In
      </Link>

      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-1">
          Forgot password?
        </h1>
        <p className="text-muted text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {apiError && (
          <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
            {apiError}
          </p>
        )}

        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Email address
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={[
              'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
              errors.email ? 'border-error' : 'border-border',
            ].join(' ')}
          />
          {errors.email && (
            <p className="text-xs text-error mt-0.5">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {isPending ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}
