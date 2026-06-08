'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Package,
  Heart,
  MapPin,
  User,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, queryKeys } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import type { UserDto } from '@mlh/types';
import type { ConversationDto } from '@mlh/types';
import { useAuthStore } from '../../lib/store/auth.store';

interface AccountSidebarProps {
  profile:      UserDto;
  onNavigate?:  () => void;
}

export function AccountSidebar({ profile, onNavigate }: AccountSidebarProps) {
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();
  const qc       = useQueryClient();
  const token    = useAuthStore((s) => s.accessToken);

  const { data: conversations } = useQuery<ConversationDto[]>({
    queryKey: ['conversations'],
    queryFn: () =>
      apiClient.get<ConversationDto[]>('/messages/conversations', { token: token ?? undefined }),
    refetchInterval: 30_000,
    enabled: !!token,
    staleTime: 15_000,
  });

  const unreadCount = (conversations ?? []).reduce((sum, c) => sum + c.unreadByCustomer, 0);

  const handleSignOut = async () => {
    try {
      const base  = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
      await fetch(`${base}/api/v1${API_ROUTES.AUTH.LOGOUT}`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch {
      // Sign out even if the request fails
    }

    localStorage.removeItem('access_token');
    qc.setQueryData(queryKeys.profile(), null);
    qc.clear();

    router.push(`/${locale}`);
  };

  const initials =
    `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  const NAV_LINKS = [
    { href: '/account/orders',    icon: Package,         label: 'My Orders',          badge: undefined    },
    { href: '/account/wishlist',  icon: Heart,           label: 'Wishlist',            badge: undefined    },
    { href: '/account/messages',  icon: MessageCircle,   label: 'Messages',            badge: unreadCount > 0 ? unreadCount : undefined },
    { href: '/account/addresses', icon: MapPin,          label: 'Address Book',        badge: undefined    },
    { href: '/account/profile',   icon: User,            label: 'Profile & Password',  badge: undefined    },
  ] as const;

  return (
    <nav aria-label="Account navigation" className="space-y-1">
      {/* ── User card ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-primary/10">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary font-bold text-base">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-secondary text-sm truncate">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-xs text-muted truncate">{profile.email}</p>
        </div>
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────────── */}
      {NAV_LINKS.map(({ href, icon: Icon, label, badge }) => {
        const fullHref = `/${locale}${href}`;
        const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);

        return (
          <Link
            key={href}
            href={fullHref}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-muted/5 hover:text-primary',
            ].join(' ')}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}
            />
            <span className="flex-1">{label}</span>
            {badge !== undefined && (
              <span className="min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}

      {/* ── Sign out ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium text-secondary hover:bg-error/8 hover:text-error transition-colors mt-2"
      >
        <LogOut className="w-4 h-4 shrink-0 text-muted" />
        Sign Out
      </button>
    </nav>
  );
}
