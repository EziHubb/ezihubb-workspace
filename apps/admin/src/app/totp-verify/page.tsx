'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

function TotpVerifyForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const email        = searchParams.get('email') ?? '';
  const partialToken = searchParams.get('pt') ?? '';

  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      partialToken,
      totpCode: code.replace(/\s/g, ''),
      redirect: false,
    });

    setLoading(false);

    if (result?.ok) {
      router.push('/dashboard');
    } else {
      setError('Invalid code. Check your authenticator app and try again.');
      setCode('');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">M</span>
          </div>
          <span className="font-bold text-xl text-secondary">EziHubb</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-secondary">Verify your identity</h2>
        </div>

        <p className="text-muted text-sm mb-8">
          Open your authenticator app and enter the 6-digit code for{' '}
          <span className="font-medium text-secondary">{email || 'your account'}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-secondary mb-1.5">
              Authentication code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Fa-f\s]/g, ''))}
              className="w-full px-4 py-3 bg-surface border border-border rounded-button text-center text-2xl font-mono tracking-[0.5em] text-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              placeholder="000000"
              autoFocus
            />
            <p className="mt-2 text-xs text-muted">
              Can also use a backup code if you lost access to your authenticator app.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-button px-4 py-3 text-sm text-red-700"
            >
              <span className="shrink-0 mt-0.5">⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.replace(/\s/g, '').length < 6}
            className="w-full py-3 bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            {loading ? 'Verifying…' : 'Verify & Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mt-6 w-full text-center text-sm text-muted hover:text-secondary transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}

export default function TotpVerifyPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Brand panel ──────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-10 py-12"
        style={{ background: 'linear-gradient(135deg, #E85D3F 0%, #C44A2E 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <span className="text-white font-bold text-xl">EziHubb</span>
        </div>

        <div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Two-Factor Authentication
          </h1>
          <p className="text-white/75 text-base leading-relaxed">
            Your account is protected with Google Authenticator for an extra layer of security.
          </p>
        </div>

        <p className="text-white/50 text-xs">
          © {new Date().getFullYear()} EziHubb. Admin access only.
        </p>
      </div>

      {/* ── Right: TOTP form ───────────────────────────────────────────────── */}
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }>
        <TotpVerifyForm />
      </Suspense>
    </div>
  );
}
