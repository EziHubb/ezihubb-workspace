'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useToast, ToastProvider } from '@ezihubb/ui';
import { useAuthStore } from '../../../../lib/store/auth.store';
import { GoogleSignInButton } from '../../../../components/auth/GoogleSignInButton';

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
    firstName:    z.string().min(1, 'Required'),
    lastName:     z.string().min(1, 'Required'),
    email:        z.string().email('Enter a valid email'),
    password:     z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number')
      .regex(/[^A-Za-z0-9]/, 'Include a special character'),
    confirmPw:    z.string(),
    agreeTerms:   z.boolean().refine((v) => v === true, {
      message: 'You must agree to the terms',
    }),
  })
  .refine((d: { password: string; confirmPw: string }) => d.password === d.confirmPw, {
    message: 'Passwords do not match',
    path:    ['confirmPw'],
  });

type FormValues = z.infer<typeof schema>;

// ── Inner component (needs toast context) ─────────────────────────────────────

function RegisterForm() {
  const locale       = useLocale();
  const router       = useRouter();
  const toast        = useToast();

  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwValue,     setPwValue]     = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [apiError,    setApiError]    = useState('');

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const agreeTerms = watch('agreeTerms');

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setApiError('');

    try {
      await useAuthStore.getState().register({
        email:        data.email,
        password:     data.password,
        firstName:    data.firstName,
        lastName:     data.lastName,
      });

      toast.success('Account created! Check your email to verify. 📧');
      router.replace(`/${locale}/login?registered=1`);
    } catch (err: unknown) {
      const apiErr = err as { code?: string };
      if (apiErr.code === 'ERR_EMAIL_ALREADY_EXISTS') {
        setError('email', { message: 'An account with this email already exists.' });
      } else {
        setApiError(
          err instanceof Error ? err.message : 'Registration failed. Please try again.',
        );
      }
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
        Create your account to start personalizing gifts
      </p>

      {/* Google Sign-In (Identity Services — One Tap + button) */}
      <GoogleSignInButton
        redirectTo={`/${locale}/account`}
        onError={setApiError}
      />

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
  const t = useTranslations('common');
  return (
    <ToastProvider dismissLabel={t('dismissNotification')}>
      <RegisterForm />
    </ToastProvider>
  );
}
