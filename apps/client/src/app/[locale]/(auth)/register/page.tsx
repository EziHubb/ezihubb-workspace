'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { API_ROUTES } from '@mlh/constants';
import { useToast, ToastProvider } from '@mlh/ui';

// ── Password strength ─────────────────────────────────────────────────────────

function calcStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS  = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_COLORS  = ['', 'bg-error', 'bg-warning', 'bg-yellow-400', 'bg-success'];
const STRENGTH_TEXTCOL = ['', 'text-error', 'text-warning', 'text-yellow-500', 'text-success'];

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const score = calcStrength(password);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1 h-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all ${
              i < score ? STRENGTH_COLORS[score] : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${STRENGTH_TEXTCOL[score]}`}>
        {STRENGTH_LABELS[score]}
      </p>
    </div>
  );
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z
  .object({
    firstName:   z.string().min(1, 'Required'),
    lastName:    z.string().min(1, 'Required'),
    email:       z.string().email('Enter a valid email'),
    password:    z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number')
      .regex(/[^A-Za-z0-9]/, 'Include a special character'),
    confirmPw:   z.string(),
    agreeTerms:  z.boolean().refine((v) => v === true, {
      message: 'You must agree to the terms',
    }),
  })
  .refine((d: { password: string; confirmPw: string }) => d.password === d.confirmPw, {
    message: 'Passwords do not match',
    path:    ['confirmPw'],
  });

type FormValues = z.infer<typeof schema>;

// ── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" fill="#4285F4"/>
      <path d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.92-2.26a5.43 5.43 0 0 1-8.09-2.85H.99v2.33A9 9 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.99a9 9 0 0 0 0 8.08l2.96-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .99 4.96L3.95 7.3A5.43 5.43 0 0 1 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Inner component (needs toast context) ─────────────────────────────────────

function RegisterForm() {
  const locale  = useLocale();
  const router  = useRouter();
  const toast = useToast();

  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwValue,     setPwValue]     = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [apiError,    setApiError]    = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const agreeTerms = watch('agreeTerms');

  const apiBase = () =>
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setApiError('');

    try {
      const res = await fetch(`${apiBase()}/api/v1${API_ROUTES.AUTH.REGISTER}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firstName: data.firstName,
          lastName:  data.lastName,
          email:     data.email,
          password:  data.password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setApiError(body.message ?? 'Registration failed. Please try again.');
        return;
      }

      toast.success('Check your email to verify your account 📧');
      setTimeout(() => router.replace(`/${locale}/login`), 1_500);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
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

  return (
    <div>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-1">
        Create account
      </h1>
      <p className="text-muted text-sm mb-8">
        Join 50,000+ people who love personalized gifts
      </p>

      {/* Google OAuth */}
      <a
        href={`${apiBase()}/api/v1${API_ROUTES.AUTH.GOOGLE}`}
        className="flex items-center justify-center gap-3 w-full py-2.5 border border-border rounded-button text-sm font-medium text-secondary hover:bg-muted/5 hover:border-primary/40 transition-colors"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">or sign up with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {apiError && (
          <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
            {apiError}
          </p>
        )}

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              First Name <span className="text-error">*</span>
            </label>
            <input {...register('firstName')} autoComplete="given-name" className={inp(errors.firstName?.message)} />
            {errors.firstName && <p className="text-xs text-error mt-0.5">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Last Name <span className="text-error">*</span>
            </label>
            <input {...register('lastName')} autoComplete="family-name" className={inp(errors.lastName?.message)} />
            {errors.lastName && <p className="text-xs text-error mt-0.5">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Email <span className="text-error">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inp(errors.email?.message)}
          />
          {errors.email && <p className="text-xs text-error mt-0.5">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Password <span className="text-error">*</span>
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
          <PasswordStrengthBar password={pwValue} />
          {errors.password && <p className="text-xs text-error mt-0.5">{errors.password.message}</p>}
        </div>

        {/* Confirm password */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Confirm Password <span className="text-error">*</span>
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
          {errors.confirmPw && <p className="text-xs text-error mt-0.5">{errors.confirmPw.message}</p>}
        </div>

        {/* Terms checkbox */}
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              {...register('agreeTerms')}
              type="checkbox"
              className="w-4 h-4 mt-0.5 accent-primary shrink-0"
            />
            <span className="text-xs text-secondary">
              I agree to the{' '}
              <Link href={`/${locale}/pages/terms`} className="text-primary underline underline-offset-2" target="_blank">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href={`/${locale}/pages/privacy`} className="text-primary underline underline-offset-2" target="_blank">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="text-xs text-error mt-0.5">{errors.agreeTerms.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !agreeTerms}
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isPending ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        Already have an account?{' '}
        <Link href={`/${locale}/login`} className="text-primary font-medium hover:underline">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

// ── Page wrapper with ToastProvider ──────────────────────────────────────────

export default function RegisterPage() {
  return (
    <ToastProvider>
      <RegisterForm />
    </ToastProvider>
  );
}
