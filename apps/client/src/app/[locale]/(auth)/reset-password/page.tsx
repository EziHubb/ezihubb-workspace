'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowLeft, AlertTriangle } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { useToast, ToastProvider } from '@ezihubb/ui';
import { apiClient } from '../../../../lib/api-client';

// ── Password strength (reused pattern) ────────────────────────────────────────

function calcStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_COLORS  = ['', 'bg-error', 'bg-warning', 'bg-yellow-400', 'bg-success'];
const STRENGTH_TEXT    = ['', 'text-error', 'text-warning', 'text-yellow-500', 'text-success'];
const STRENGTH_LABELS  = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number')
      .regex(/[^A-Za-z0-9]/, 'Include a special character'),
    confirmPw: z.string(),
  })
  .refine((d: { password: string; confirmPw: string }) => d.password === d.confirmPw, {
    message: 'Passwords do not match',
    path:    ['confirmPw'],
  });

type FormValues = z.infer<typeof schema>;

// ── Inner form component ──────────────────────────────────────────────────────

function ResetPasswordForm() {
  const locale       = useLocale();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const token = searchParams.get('token');

  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwValue,     setPwValue]     = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [apiError,    setApiError]    = useState('');
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const strength = calcStrength(pwValue);

  const onSubmit = async (data: FormValues) => {
    if (!token) { setTokenInvalid(true); return; }
    setIsPending(true);
    setApiError('');

    try {
      await apiClient.post(API_ROUTES.AUTH.RESET_PASSWORD, { token, password: data.password });
      toast.success('Password reset successfully. Please sign in.');
      setTimeout(() => router.replace(`/${locale}/login`), 1_500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isExpired =
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid');
      if (isExpired) {
        setTokenInvalid(true);
      } else {
        setApiError(msg || 'Failed to reset password.');
      }
    } finally {
      setIsPending(false);
    }
  };

  // ── Invalid / expired token state ─────────────────────────────────────────

  if (!token || tokenInvalid) {
    return (
      <div className="text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>

        <div>
          <h1 className="font-display text-xl font-bold text-secondary mb-2">
            Link expired or invalid
          </h1>
          <p className="text-muted text-sm max-w-xs mx-auto">
            This password reset link has expired or is invalid.
            Please request a new one.
          </p>
        </div>

        <Link
          href={`/${locale}/forgot-password`}
          className="inline-flex items-center justify-center gap-1.5 w-full py-3 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors uppercase tracking-wide"
        >
          Request New Link
        </Link>

        <Link
          href={`/${locale}/login`}
          className="block text-sm text-primary hover:underline"
        >
          ← Back to Sign In
        </Link>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  const inp = (err?: string) =>
    [
      'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
      err ? 'border-error' : 'border-border',
    ].join(' ');

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/login`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sign In
      </Link>

      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-1">
          Reset password
        </h1>
        <p className="text-muted text-sm">Choose a new secure password.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {apiError && (
          <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
            {apiError}
          </p>
        )}

        {/* New password */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            New Password <span className="text-error">*</span>
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              onChange={(e) => setPwValue(e.target.value)}
              className={inp(errors.password?.message) + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Strength bar */}
          {pwValue && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1 h-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all ${
                      i < strength ? STRENGTH_COLORS[strength] : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${STRENGTH_TEXT[strength]}`}>
                {STRENGTH_LABELS[strength]}
              </p>
            </div>
          )}

          {errors.password && (
            <p className="text-xs text-error mt-0.5">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Confirm New Password <span className="text-error">*</span>
          </label>
          <div className="relative">
            <input
              {...register('confirmPw')}
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className={inp(errors.confirmPw?.message) + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPw && (
            <p className="text-xs text-error mt-0.5">{errors.confirmPw.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {isPending ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const t = useTranslations('common');
  return (
    <ToastProvider dismissLabel={t('dismissNotification')}>
      <ResetPasswordForm />
    </ToastProvider>
  );
}
