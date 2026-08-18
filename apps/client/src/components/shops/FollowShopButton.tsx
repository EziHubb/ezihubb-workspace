'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES, type ShopColorTheme } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface FollowShopButtonProps {
  slug: string;
  initialFollowerCount: number;
  /** Ezihubb Plus colour theme, or null for the default app styling (free store, or no theme selected). */
  theme?: ShopColorTheme | null;
}

interface FollowState {
  following: boolean;
  followerCount: number;
}

/** This component is rendered twice per page (separate desktop/mobile
 *  layouts, toggled with CSS `hidden`/`flex` — both stay mounted at once).
 *  State lives in the React Query cache keyed by `slug`, not local
 *  useState, so both instances share one source of truth: following from
 *  either button updates both immediately, and a viewport resize across the
 *  md breakpoint never reveals a stale copy. */
export function FollowShopButton({ slug, initialFollowerCount, theme }: FollowShopButtonProps) {
  const t = useTranslations('shops');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  const isLoggedIn  = Boolean(useAuthStore((s) => s.user));
  const isAuthReady = useAuthStore((s) => s.isAuthReady);

  const queryKey = ['store-follow', slug];

  const { data } = useQuery<FollowState>({
    queryKey,
    queryFn: async () => {
      if (!isLoggedIn) return { following: false, followerCount: initialFollowerCount };
      const res = await apiClient.get<{ following: boolean }>(API_ROUTES.STORES.FOLLOW_STATUS(slug));
      return { following: res.following, followerCount: initialFollowerCount };
    },
    enabled:      isAuthReady,
    initialData:  { following: false, followerCount: initialFollowerCount },
    staleTime:    60_000,
  });
  const { following: isFollowing, followerCount } = data ?? { following: false, followerCount: initialFollowerCount };

  const mutation = useMutation({
    mutationFn: (nextFollowing: boolean) =>
      nextFollowing
        ? apiClient.post<{ following: boolean; followerCount: number }>(API_ROUTES.STORES.FOLLOW(slug))
        : apiClient.delete<{ following: boolean; followerCount: number }>(API_ROUTES.STORES.FOLLOW(slug)),
    onMutate: async (nextFollowing) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<FollowState>(queryKey);
      qc.setQueryData<FollowState>(queryKey, (old) => ({
        following:     nextFollowing,
        followerCount: Math.max(0, (old?.followerCount ?? initialFollowerCount) + (nextFollowing ? 1 : -1)),
      }));
      return { previous };
    },
    onSuccess: (res) => {
      qc.setQueryData<FollowState>(queryKey, { following: res.following, followerCount: res.followerCount });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
    },
  });

  const handleClick = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate(!isFollowing);
  };

  // textSafeHex (not the raw swatch hex) — this color is used AS text/border
  // here, on the page's light background, not as a solid fill. Using the
  // raw hex would make 6 of the 12 themes fail AA text contrast (as low as
  // 1.46:1 for cream) — see SHOP_COLOR_THEMES' doc comment for the real
  // contrast math. When a theme is set, the hover-color-shift the default
  // (untheme'd) button has is intentionally dropped for simplicity — the
  // themed button keeps one fixed accent color rather than adding local
  // hover state just for a cosmetic shift.
  const themedStyle = theme
    ? isFollowing
      ? { backgroundColor: `${theme.textSafeHex}1A`, borderColor: `${theme.textSafeHex}4D`, color: theme.textSafeHex }
      : { borderColor: 'var(--color-border)', color: theme.textSafeHex }
    : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-pressed={isFollowing}
      style={themedStyle}
      className={[
        'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors disabled:opacity-60',
        theme
          ? ''
          : isFollowing
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'border-border text-secondary hover:border-primary/40 hover:text-primary',
      ].join(' ')}
    >
      <Heart className="w-3.5 h-3.5" style={isFollowing ? { fill: theme ? theme.textSafeHex : 'var(--color-primary)' } : undefined} />
      {isFollowing ? t('storePage.following') : t('storePage.follow')}
      {followerCount > 0 && (
        <span className="text-muted font-normal">· {followerCount.toLocaleString()}</span>
      )}
    </button>
  );
}
