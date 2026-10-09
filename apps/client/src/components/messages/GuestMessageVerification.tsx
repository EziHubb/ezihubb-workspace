'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Button, Input } from '@ezihubb/ui';

/** Inline fieldset, not a nested form: reusable in message composer and recovery. */
export function GuestMessageVerification({ email, onVerified }: { email: string; onVerified: (email: string) => void }) {
  const vi = useLocale() === 'vi';
  const id = useId();
  const [challenge, setChallenge] = useState<{ id: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const normalizedEmail = email.trim().toLowerCase();
  const hasChallenge = challenge?.email === normalizedEmail;
  useEffect(() => { if (hasChallenge && !pending) input.current?.focus(); }, [hasChallenge, pending]);

  async function act(verify: boolean) {
    if (inFlight.current) return;
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(vi ? 'Nhập email hợp lệ trước.' : 'Enter a valid email address first.'); return;
    }
    inFlight.current = true; setPending(true); setError('');
    try {
      if (verify && challenge) {
        if (!/^\d{8}$/.test(code.trim())) {
          setError(vi ? 'Nhập mã 8 chữ số trong email.' : 'Enter the 8-digit code from your email.'); return;
        }
        const result = await apiClient.post<{ email: string }>(API_ROUTES.MESSAGES.GUEST_ACCESS_VERIFY,
          { challengeId: challenge.id, code: code.trim() });
        setCode(''); onVerified(result.email);
      } else {
        const result = await apiClient.post<{ challengeId: string }>(API_ROUTES.MESSAGES.GUEST_ACCESS_REQUEST, { email: normalizedEmail });
        setChallenge({ id: result.challengeId, email: normalizedEmail }); setCode('');
      }
    } catch (err) {
      const reason = (err as { code?: string }).code;
      setError(reason === 'ERR_GUEST_PROOF_INVALID'
        ? (vi ? 'Mã không đúng hoặc đã hết hạn. Bạn có thể yêu cầu mã mới.' : 'Invalid or expired code. You can request a new one.')
        : reason === 'ERR_GUEST_PROOF_LIMIT'
          ? (vi ? 'Vui lòng đợi 15 phút trước khi yêu cầu mã mới.' : 'Please wait 15 minutes before requesting another code.')
          : (vi ? 'Chưa thể xác minh email. Hãy thử lại sau.' : 'Unable to verify your email right now. Please try again later.'));
    } finally { inFlight.current = false; setPending(false); }
  }

  return <fieldset disabled={pending} className="space-y-3 rounded-card border border-border bg-surface p-4" aria-busy={pending}>
    <legend className="px-1 text-sm font-semibold">{vi ? 'Xác minh email để nhắn tin' : 'Verify your email for messaging'}</legend>
    <p className="text-sm text-muted">{vi ? 'Chúng tôi sẽ gửi mã xác minh qua email để bảo vệ hội thoại của bạn. Không cần tạo tài khoản.' : 'We will email a code to protect your conversations. No account is required.'}</p>
    {hasChallenge && <>
      <p role="status" className="text-sm">{vi ? 'Đã yêu cầu gửi mã đến' : 'Code requested for'} {challenge.email}. {vi ? 'Mã có hiệu lực 15 phút.' : 'The code is valid for 15 minutes.'}</p>
      <Input label={vi ? 'Mã xác minh email' : 'Email verification code'} ref={input} id={id} value={code} onChange={(e) => setCode(e.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code"
        maxLength={8} error={error} fullWidth className="min-h-11" />
      <Button type="button" onClick={() => void act(true)} disabled={pending}>
        {pending ? (vi ? 'Đang xác minh…' : 'Verifying…') : (vi ? 'Xác minh email' : 'Verify email')}
      </Button>
    </>}
    {!hasChallenge && <p id={`${id}-error`} role="alert" className="text-sm text-error">{error}</p>}
    <Button type="button" variant="secondary" onClick={() => void act(false)} disabled={pending}>
      {pending ? (vi ? 'Đang xử lý…' : 'Please wait…') : hasChallenge ? (vi ? 'Gửi lại mã' : 'Send another code') : (vi ? 'Gửi mã qua email' : 'Email me a code')}
    </Button>
  </fieldset>;
}
