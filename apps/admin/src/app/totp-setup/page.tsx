'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Copy, Check } from 'lucide-react';
import Image from 'next/image';

const API_BASE =
  (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '') + '/api/v1';

interface SetupData {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

type Step = 'loading' | 'scan' | 'confirm' | 'backup' | 'done' | 'error';

export default function TotpSetupPage() {
  const { data: session } = useSession();
  const router            = useRouter();

  const [step,       setStep]       = useState<Step>('loading');
  const [setup,      setSetup]      = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code,       setCode]       = useState('');
  const [copied,     setCopied]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const accessToken = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_BASE}/auth/totp/setup`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const data = body.data as SetupData;
        setSetup(data);
        setStep('scan');
      })
      .catch(() => setStep('error'));
  }, [accessToken]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup || !accessToken) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/auth/totp/confirm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ secret: setup.secret, code }),
    });

    setLoading(false);

    if (!res.ok) {
      setError('Code did not match. Ensure your phone clock is correct and try again.');
      return;
    }

    const body = await res.json();
    const codes = (body.data as { backupCodes: string[] }).backupCodes;
    setBackupCodes(codes);
    setStep('backup');
  };

  const copySecret = async () => {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-4">Failed to load TOTP setup.</p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-primary hover:underline">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-[480px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-secondary">2FA Enabled!</h2>
              <p className="text-sm text-muted">Save your backup codes</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-3">
              Store these backup codes somewhere safe. Each can only be used once if you lose your authenticator.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="bg-white border border-amber-200 rounded px-3 py-1.5 text-sm font-mono text-secondary text-center">
                  {c}
                </code>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            Done — Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary">Set up two-factor authentication</h2>
            <p className="text-sm text-muted">Use Google Authenticator or Authy</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Scan QR code', 'Verify code'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${step === (i === 0 ? 'scan' : 'confirm') ? 'text-primary' : 'text-muted'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === (i === 0 ? 'scan' : 'confirm') ? 'bg-primary text-white' : 'bg-border text-muted'
                }`}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              {i === 0 && <div className="flex-1 h-px bg-border mx-2" />}
            </div>
          ))}
        </div>

        {step === 'scan' && setup && (
          <>
            <p className="text-sm text-secondary mb-4">
              Scan this QR code with your authenticator app, or manually enter the key below.
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white border border-border rounded-lg">
                <Image
                  src={setup.qrCodeDataUrl}
                  alt="TOTP QR code"
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
            </div>

            {/* Manual key */}
            <div className="mb-6">
              <p className="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">Manual entry key</p>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-button px-3 py-2">
                <code className="flex-1 font-mono text-xs text-secondary break-all">{setup.secret}</code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="shrink-0 text-muted hover:text-primary transition-colors"
                  title="Copy secret"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep('confirm')}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
            >
              I've scanned it — Next
            </button>
          </>
        )}

        {step === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-5">
            <p className="text-sm text-secondary">
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-secondary mb-1.5">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-surface border border-border rounded-button text-center text-2xl font-mono tracking-[0.5em] text-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="000000"
                autoFocus
              />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-button px-4 py-3 text-sm text-red-700">
                <span className="shrink-0 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('scan')}
                className="flex-1 py-3 bg-surface border border-border hover:border-secondary text-secondary font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="flex-1 py-3 bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
              >
                {loading ? 'Verifying…' : 'Enable 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
