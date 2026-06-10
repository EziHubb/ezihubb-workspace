'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Eye, EyeOff } from 'lucide-react';
import { queryKeys, useMutateProfile, apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useToast } from '@mlh/ui';
import type { UserDto } from '@mlh/types';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';
import { useAuthStore } from '../../../../../lib/store/auth.store';

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

const STRENGTH_COLORS = [
  'bg-error',   // 0
  'bg-error',   // 1
  'bg-warning', // 2
  'bg-primary', // 3
  'bg-success', // 4
];

const STRENGTH_TEXT = [
  'text-error',   // 0
  'text-error',   // 1
  'text-warning', // 2
  'text-primary', // 3
  'text-success', // 4
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  phone:     z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword:     z.string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number')
      .regex(/[^A-Za-z0-9]/, 'Include a special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  });

type ProfileForm   = z.infer<typeof profileSchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;

// ── Input helper ──────────────────────────────────────────────────────────────

const inp = (err?: string, disabled?: boolean) =>
  [
    'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
    err      ? 'border-error' : 'border-border',
    disabled ? 'opacity-60 cursor-not-allowed' : '',
  ]
    .filter(Boolean)
    .join(' ');

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const toast = useToast();

  // useAuthQuery: token-aware fetch that re-runs when the user logs in
  const { data: profile, isLoading } = useAuthQuery<UserDto>(
    queryKeys.profile(),
    API_ROUTES.USERS.ME,
  );

  // useAuthMutation for profile update — syncs auth store on success
  const updateProfileMutation = useAuthMutation(
    (dto: ProfileForm, token: string) =>
      apiClient.patch<UserDto>(API_ROUTES.USERS.ME, dto, { token }),
    {
      invalidateKeys: [queryKeys.profile()],
      onSuccess: (user: UserDto) => {
        const accessToken = useAuthStore.getState().accessToken;
        if (accessToken) useAuthStore.getState().setTokens(accessToken, user);
        toast.success('Profile updated');
      },
    },
  );

  // Keep existing hook for avatar upload (FormData) and password change (complex logout)
  const { changePassword, uploadAvatar } = useMutateProfile();

  // ── Avatar state ───────────────────────────────────────────────────────────
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Password visibility ────────────────────────────────────────────────────
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPwValue,  setNewPwValue]  = useState('');

  // ── Profile form ───────────────────────────────────────────────────────────
  const {
    register:     regProfile,
    handleSubmit: handleProfile,
    reset:        resetProfile,
    formState:    { errors: pErr, isDirty: pDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName:  profile?.lastName  ?? '',
      phone:     profile?.phone     ?? '',
    },
  });

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      resetProfile({
        firstName: profile.firstName,
        lastName:  profile.lastName,
        phone:     profile.phone ?? '',
      });
    }
  }, [profile?.id, resetProfile]);

  // ── Password form ──────────────────────────────────────────────────────────
  const {
    register:     regPw,
    handleSubmit: handlePw,
    reset:        resetPw,
    formState:    { errors: pwErr },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingFile(file);
  };

  const handleAvatarUpload = () => {
    if (!pendingFile) return;
    uploadAvatar.mutate(pendingFile, {
      onSuccess: () => {
        toast.success('Avatar updated');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingFile(null);
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to upload'),
    });
  };

  const onProfileSave = (data: ProfileForm) => {
    updateProfileMutation.mutate(data, {
      onError: (err: Error) =>
        toast.error(err.message || 'Failed to update profile'),
    });
  };

  const onPasswordSave = (data: PasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          toast.success('Password updated. Please log in again.');
          resetPw();
          // Redirect to login after password change
          setTimeout(() => {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
          }, 2_000);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update password'),
      },
    );
  };

  if (isLoading || !profile) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-border/30 rounded w-32" />
        <div className="h-40 bg-border/30 rounded-card" />
        <div className="h-48 bg-border/30 rounded-card" />
      </div>
    );
  }

  const strength = getStrength(newPwValue);
  const initials =
    `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const displayAvatar = previewUrl ?? profile.avatarUrl;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">
        Profile & Password
      </h1>

      {/* ── Profile section ─────────────────────────────────────────────────── */}
      <section className="border border-border rounded-card p-5 md:p-6 space-y-6">
        <h2 className="font-semibold text-secondary text-base border-b border-border pb-3">
          Profile Information
        </h2>

        {/* Avatar */}
        <div className="flex items-end gap-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt={`${profile.firstName} ${profile.lastName}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xl">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change avatar"
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="sr-only"
            aria-label="Upload avatar"
          />

          <div className="space-y-2">
            {pendingFile ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={uploadAvatar.isPending}
                  className="text-xs font-semibold text-white bg-primary hover:bg-primary-dark px-3 py-1.5 rounded-button transition-colors disabled:opacity-50"
                >
                  {uploadAvatar.isPending ? 'Uploading…' : 'Save Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setPendingFile(null);
                  }}
                  className="text-xs font-medium text-muted hover:text-error px-3 py-1.5 border border-border rounded-button transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Change photo
              </button>
            )}
            <p className="text-xs text-muted">JPG, PNG, WebP · Max 5 MB</p>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">
                First Name <span className="text-error">*</span>
              </label>
              <input {...regProfile('firstName')} className={inp(pErr.firstName?.message)} />
              {pErr.firstName && <p className="text-xs text-error mt-0.5">{pErr.firstName.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">
                Last Name <span className="text-error">*</span>
              </label>
              <input {...regProfile('lastName')} className={inp(pErr.lastName?.message)} />
              {pErr.lastName && <p className="text-xs text-error mt-0.5">{pErr.lastName.message}</p>}
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 flex items-center gap-2">
              Email
              {(profile.isEmailVerified ?? profile.emailVerified) && (
                <span className="text-[10px] font-semibold text-success bg-success/10 border border-success/20 rounded-pill px-1.5 py-0.5">
                  ✓ Verified
                </span>
              )}
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className={inp(undefined, true)}
            />
            <p className="text-xs text-muted mt-0.5">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Phone</label>
            <input {...regProfile('phone')} type="tel" className={inp()} />
          </div>

          <button
            type="submit"
            disabled={!pDirty || updateProfileMutation.isPending}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* ── Change password section ──────────────────────────────────────────── */}
      <section className="border border-border rounded-card p-5 md:p-6 space-y-5">
        <h2 className="font-semibold text-secondary text-base border-b border-border pb-3">
          Change Password
        </h2>

        <form onSubmit={handlePw(onPasswordSave)} className="space-y-4">
          {/* Current password */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Current Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                {...regPw('currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                className={inp(pwErr.currentPassword?.message) + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwErr.currentPassword && (
              <p className="text-xs text-error mt-0.5">{pwErr.currentPassword.message}</p>
            )}
          </div>

          {/* New password */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              New Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                {...regPw('newPassword')}
                type={showNew ? 'text' : 'password'}
                onChange={(e) => setNewPwValue(e.target.value)}
                className={inp(pwErr.newPassword?.message) + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {newPwValue && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1 h-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        'flex-1 rounded-full transition-all',
                        i < strength.score
                          ? STRENGTH_COLORS[strength.score]
                          : 'bg-border',
                      ].join(' ')}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${STRENGTH_TEXT[strength.score]}`}>
                  {strength.label}
                </p>
              </div>
            )}

            {pwErr.newPassword && (
              <p className="text-xs text-error mt-0.5">{pwErr.newPassword.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Confirm New Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                {...regPw('confirmPassword')}
                type={showConfirm ? 'text' : 'password'}
                className={inp(pwErr.confirmPassword?.message) + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwErr.confirmPassword && (
              <p className="text-xs text-error mt-0.5">{pwErr.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={changePassword.isPending}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
          >
            {changePassword.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}
