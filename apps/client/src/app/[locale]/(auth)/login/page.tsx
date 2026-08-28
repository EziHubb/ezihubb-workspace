'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { GoogleSignInButton } from '../../../../components/auth/GoogleSignInButton';
import { resolveAuthRedirect } from '../../../../lib/auth-redirect';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  email:      z.string().email('Enter a valid email'),
  password:   z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const locale       = useLocale();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [showPw,       setShowPw]       = useState(false);
  const [shake,        setShake]        = useState(false);
  const [globalError,  setGlobalError]  = useState('');
  const [isPending,    setIsPending]    = useState(false);
  const redirectTo = resolveAuthRedirect(
    searchParams.get('redirect'),
    `/${locale}/account`,
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setGlobalError('');

    const result = await signIn('credentials', {
      redirect:   false,
      email:      data.email,
      password:   data.password,
      rememberMe: String(data.rememberMe ?? false),
    });

    if (!result?.ok) {
      const code = result?.error ?? 'UNKNOWN';

      if (code === 'ERR_CREDENTIALS_INVALID') {
        setError('email', { message: 'Invalid email or password.' });
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else if (code === 'ERR_ACCOUNT_LOCKED') {
        setGlobalError('Account locked after too many failed attempts. Try again in 15 minutes.');
      } else if (code === 'ERR_EMAIL_NOT_VERIFIED') {
        setGlobalError('Please verify your email address before signing in.');
      } else {
        setGlobalError('Something went wrong. Please try again.');
      }

      setIsPending(false);
      return;
    }

    router.replace(redirectTo);
  };

  const inp = (err?: string) =>
    [
      'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
      err ? 'border-error' : 'border-border',
    ].join(' ');

  return (
    <div className={shake ? '[animation:shake_0.5s_ease-in-out]' : ''}>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-1">
        Welcome back
      </h1>
      <p className="text-muted text-sm mb-8">Sign in to your account to continue</p>

      {/* Google Sign-In (Identity Services — One Tap + button) */}
      <GoogleSignInButton
        redirectTo={redirectTo}
        onError={setGlobalError}
      />

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">or sign in with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Global API error */}
        {globalError && (
          <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
            {globalError}
          </p>
        )}

        {/* Email */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">Email</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inp(errors.email?.message)}
          />
          {errors.email && (
            <p className="text-xs text-error mt-0.5">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className={inp(errors.password?.message) + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-error mt-0.5">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('rememberMe')}
              type="checkbox"
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs text-secondary">Remember me</span>
          </label>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-xs text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isPending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center text-sm text-muted mt-6">
        New to EziHubb?{' '}
        <Link
          href={`/${locale}/register?redirect=${encodeURIComponent(redirectTo)}`}
          className="text-primary font-medium hover:underline"
        >
          Create an account →
        </Link>
      </p>
    </div>
  );
}
