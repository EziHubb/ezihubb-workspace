'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router   = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result?.ok) {
      setError('Invalid credentials or insufficient permissions.');
      return;
    }

    // Fetch session to check whether TOTP is required
    const session = await getSession();
    const user = session?.user as Record<string, unknown> | undefined;

    if (user?.['requiresTOTP']) {
      const partialToken = encodeURIComponent(String(user['partialToken'] ?? ''));
      router.push(`/totp-verify?email=${encodeURIComponent(email)}&pt=${partialToken}`);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Brand panel ──────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-10 py-12"
        style={{ background: 'linear-gradient(135deg, #E85D3F 0%, #C44A2E 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <span className="text-white font-bold text-xl">Maple Handmade</span>
        </div>

        {/* Center copy */}
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Admin Dashboard
          </h1>
          <p className="text-white/75 text-base leading-relaxed">
            Manage products, orders, customers, and analytics — all in one place.
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[
              'Real-time order management',
              'Product catalog & inventory',
              'Customer analytics & reports',
              'Promotions & discount codes',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/80 text-sm">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-white text-xs">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-white/50 text-xs">
          © {new Date().getFullYear()} Maple Handmade. Admin access only.
        </p>
      </div>

      {/* ── Right: Login form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="font-bold text-xl text-secondary">Maple Handmade</span>
          </div>

          <h2 className="text-2xl font-bold text-secondary mb-1">Sign in to Admin</h2>
          <p className="text-muted text-sm mb-8">
            Enter your admin credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-button text-sm text-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="admin@mapleloomhandmade.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-button text-sm text-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-button px-4 py-3 text-sm text-red-700"
              >
                <span className="shrink-0 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
            >
              {loading ? 'Signing in…' : 'Sign In to Admin'}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            Admin accounts are managed by the platform team.
            <br />
            Contact support if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
