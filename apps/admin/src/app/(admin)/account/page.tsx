'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { Loader2, LogOut, KeyRound } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { api } from '../../../lib/api-client';
import { toast } from '../../../lib/store/toast.store';
import { useDialog } from '../../../contexts/DialogContext';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';

/** Matches the API's own rule, so the form fails before the request does. */
const MIN_PASSWORD = 8;

/**
 * The signed-in person's own account, as opposed to the shop's or the
 * platform's.
 *
 * At /account rather than under /settings on purpose: everything in Store
 * Settings is scoped to a shop and hidden from a platform-context
 * SUPER_ADMIN, while these two actions belong to whoever is logged in,
 * whatever they happen to be looking at.
 */
export default function AccountPage() {
  const dialog = useDialog();

  // hasPassword, because a Google-only account has never had one and asking it
  // to prove the current password would be asking for something that does not
  // exist. The API draws the same distinction; this only stops the form
  // demanding a field the request would then reject.
  const { data: me, isLoading } = useQuery<{ email: string; hasPassword: boolean }>({
    queryKey: ['me'],
    queryFn:  () => api.get(API_ROUTES.USERS.ME),
  });
  const hasPassword = me?.hasPassword ?? true;

  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');

  const changePassword = useMutation({
    mutationFn: () =>
      api.post(API_ROUTES.AUTH.CHANGE_PASSWORD, {
        currentPassword: hasPassword ? current : undefined,
        newPassword:     next,
      }),
    onSuccess: async () => {
      toast.success(hasPassword ? 'Password changed' : 'Password set');
      // Not a courtesy redirect. Changing a password revokes every refresh
      // token on the account, this one included, so the session in this tab is
      // already dead. Staying would look signed in until the first request
      // that needed a refresh, then fail in a way nobody could explain.
      await signOut({ callbackUrl: '/login' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOutEverywhere = useMutation({
    mutationFn: () => api.post<{ revoked: number }>(API_ROUTES.AUTH.LOGOUT_ALL),
    onSuccess: async () => {
      await signOut({ callbackUrl: '/login' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave =
    next.length >= MIN_PASSWORD &&
    confirm === next &&
    (!hasPassword || current.length > 0) &&
    !changePassword.isPending;

  const field =
    'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-xl space-y-6">
      <AdminPageHeader title="Account" subtitle={me?.email ?? ''} />

      {/* Password */}
      <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {hasPassword ? 'Change password' : 'Set a password'}
        </h2>

        {!hasPassword && !isLoading && (
          <p className="mt-1 text-xs text-muted">
            This account signs in with Google and has no password yet. Setting one
            does not remove Google sign-in; it adds a second way in.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {hasPassword && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={field}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={field}
            />
            {tooShort && (
              <span className="mt-1 block text-xs text-error">
                At least {MIN_PASSWORD} characters.
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={field}
            />
            {mismatch && (
              <span className="mt-1 block text-xs text-error">These do not match.</span>
            )}
          </label>
        </div>

        {/* Said before the button is pressed, not after: this tab is signed
            out the moment it succeeds, and someone mid-shift should know that
            in advance. It does NOT say "every device" — see the note in the
            section below for why that would not be true here. */}
        <p className="mt-3 text-xs text-muted">
          You will be signed out of this tab and asked to sign in again.
        </p>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => changePassword.mutate()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {hasPassword ? 'Change password' : 'Set password'}
        </button>
      </section>

      {/* Sessions */}
      <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out everywhere
        </h2>
        <p className="mt-1 text-xs text-muted">
          Revokes the stored sessions on this account and signs this tab out.
        </p>
        {/*
          Deliberately not called an immediate lockout, because for this app it
          is not one.

          What this revokes is the account's refresh tokens. The storefront
          uses them, so a shopper session on this account really does end. The
          seller hub does not: it holds a NextAuth cookie carrying an API
          access token, never calls /auth/refresh, and so has nothing here to
          revoke. Another seller-hub device stays usable until its own cookie
          expires — up to 24 hours — and changing the password does not shorten
          that either, for exactly the same reason.

          Closing that gap needs a watermark on the user that the session
          callback checks, which costs a database read per check and is a
          decision with a price rather than a line to slip in here. Until then
          the text says what actually happens.
        */}
        <p className="mt-2 text-xs text-muted">
          Another seller-hub device that is already signed in is not locked out
          straight away — it stays usable until its session expires, up to 24
          hours. If a device is lost, treat that as the window.
        </p>

        <button
          type="button"
          disabled={signOutEverywhere.isPending}
          onClick={async () => {
            const ok = await dialog.confirm(
              'Every device signed in to this account will be signed out, including this one.',
              { title: 'Sign out everywhere', destructive: true },
            );
            if (ok) signOutEverywhere.mutate();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-error px-5 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:opacity-50"
        >
          {signOutEverywhere.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sign out everywhere
        </button>
      </section>
    </div>
  );
}
