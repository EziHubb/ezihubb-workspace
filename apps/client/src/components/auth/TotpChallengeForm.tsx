'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import type { UserDto } from '@ezihubb/types';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../lib/api-client';

export type CompletedSignIn = { accessToken: string; user: UserDto };
export type SignInResponse = CompletedSignIn | { requiresTOTP: true; partialToken: string };

/** Keep the short-lived challenge in component memory, never persistent storage. */
export function TotpChallengeForm({ partialToken, onComplete, onCancel }: {
  partialToken: string;
  onComplete: (result: CompletedSignIn) => Promise<void>;
  onCancel: () => void;
}) {
  const vi = useLocale() === 'vi';
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // If establishing the frontend session fails, retry that step only, not
  // the already-consumed challenge or backup code.
  const completed = useRef<CompletedSignIn | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    // Focus after React has re-enabled the input, not during the pending render.
    if (!busy && !completed.current) input.current?.focus();
  }, [busy]);

  return (
    <form className="space-y-4 rounded-card border border-border p-5 text-secondary" aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true); setError('');
        try {
          completed.current ??= await api.post<CompletedSignIn>(API_ROUTES.AUTH.TOTP_VERIFY, {
            partialToken, code: code.replace(/\s/g, ''),
          });
          await onComplete(completed.current);
        } catch (err) {
          const reason = (err as { code?: string }).code;
          setError(reason === 'ERR_TOTP_CODE_INVALID'
            ? (vi ? 'Mã không đúng. Hãy kiểm tra và thử lại.' : 'That code is not valid. Check it and try again.')
            : reason === 'ERR_TOTP_TOKEN_INVALID' || reason === 'ERR_TOTP_NOT_ENABLED'
              ? (vi ? 'Phiên xác thực đã hết hiệu lực. Hãy quay lại đăng nhập.' : 'This verification has expired. Please return to sign-in.')
              : reason === 'ERR_ACCOUNT_LOCKED'
                ? (vi ? 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.' : 'Too many attempts. Please try again in 15 minutes.')
                : (vi ? 'Chưa thể hoàn tất đăng nhập. Vui lòng thử lại.' : 'Unable to finish signing in. Please try again.'));
        } finally { submitting.current = false; setBusy(false); }
      }}>
      <h2 className="text-lg font-semibold">{vi ? 'Xác minh hai bước' : 'Two-step verification'}</h2>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {vi ? 'Nhập mã từ ứng dụng xác thực hoặc một mã dự phòng chưa sử dụng.' : 'Enter the code from your authenticator app or an unused backup code.'}
      </p>
      <label htmlFor={id} className="block space-y-2 text-sm font-medium"><span>{vi ? 'Mã xác thực' : 'Authentication code'}</span>
      <input ref={input} id={id} value={code} onChange={(e) => setCode(e.target.value)}
        autoComplete="one-time-code" type="text" required={!completed.current} minLength={6} maxLength={16}
        disabled={busy || !!completed.current} aria-invalid={!!error} aria-describedby={`${id}-hint ${id}-error`}
        className="min-h-11 w-full rounded-button border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      </label>
      <p id={`${id}-error`} role="alert" className="text-sm text-error">{error}</p>
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-button bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {busy ? (vi ? 'Đang xác minh…' : 'Verifying…') : (vi ? 'Xác minh và đăng nhập' : 'Verify and sign in')}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 w-full rounded-button border border-border px-4 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary">
        {vi ? 'Quay lại đăng nhập' : 'Back to sign-in'}
      </button>
    </form>
  );
}
