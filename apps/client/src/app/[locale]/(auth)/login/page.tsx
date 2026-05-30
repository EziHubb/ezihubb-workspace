'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, api } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import type { UserDto } from '@mlh/types';
import { useAuthStore } from '../../../../lib/store/auth.store';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  email:      z.string().email('Enter a valid email'),
  password:   z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Google SVG icon ───────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const locale       = useLocale();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const qc           = useQueryClient();
  const authStore    = useAuthStore();

  const [showPw,    setShowPw]    = useState(false);
  const [shake,     setShake]     = useState(false);
  const [apiError,  setApiError]  = useState('');
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const apiBase = () =>
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setApiError('');

    try {
      const res = await fetch(`${apiBase()}/api/v1${API_ROUTES.AUTH.LOGIN}`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          email:      data.email,
          password:   data.password,
          rememberMe: data.rememberMe,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        const msg  = body.message ?? 'Invalid email or password';
        setApiError(msg);
        // Shake animation
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }

      const body  = await res.json();
      const token = body?.data?.accessToken ?? body?.accessToken as string;
      const user  = body?.data?.user        ?? body?.user        as UserDto;

      // Store token in memory + update user state
      authStore.setUser(user, token);
      qc.setQueryData(queryKeys.profile(), user);

      // Merge guest cart into the new session
      try {
        await api.post(API_ROUTES.CART.MERGE);
        qc.invalidateQueries({ queryKey: queryKeys.cart() });
      } catch {
        // Non-critical — cart merge failure shouldn't block sign-in
      }

      const redirect = searchParams.get('redirect') ?? `/${locale}/account`;
      router.replace(redirect);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
      setShake(true);
      setTimeout(() => setShake(false), 600);
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
    <div
      className={shake ? '[animation:shake_0.5s_ease-in-out]' : ''}
      style={shake ? { animation: 'shake 0.5s ease-in-out' } : undefined}
    >
      {/* Heading */}
      <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-1">
        Welcome back
      </h1>
      <p className="text-muted text-sm mb-8">Sign in to your account to continue</p>

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
        <span className="text-xs text-muted">or sign in with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* API error */}
        {apiError && (
          <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2" role="alert">
            {apiError}
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
        New to Maple Loom Handmade?{' '}
        <Link
          href={`/${locale}/register`}
          className="text-primary font-medium hover:underline"
        >
          Create an account →
        </Link>
      </p>
    </div>
  );
}
