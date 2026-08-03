import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { UserDto, AddressDto } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

// ── Profile ───────────────────────────────────────────────────────────────────

/** Currently authenticated user's profile. */
export function useProfile(enabled = false) {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn:  () => api.get<UserDto>(API_ROUTES.USERS.ME),
    staleTime: 5 * 60_000,
    retry:    false,
    enabled,
  });
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?:  string;
  phone?:     string;
}

export function useMutateProfile() {
  const qc = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api.patch<UserDto>(API_ROUTES.USERS.ME, input),
    onSuccess: (user) => qc.setQueryData(queryKeys.profile(), user),
  });

  const changePassword = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.patch<void>(API_ROUTES.USERS.PASSWORD, input),
  });

  /**
   * Upload a new avatar image.
   * Uses raw fetch (not api.post) to send multipart/form-data.
   */
  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const form  = new FormData();
      form.append('avatar', file);

      const base  = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null;

      const res = await fetch(`${base}/api/v1${API_ROUTES.USERS.AVATAR}`, {
        method:      'POST',
        credentials: 'include',
        headers:     token ? { Authorization: `Bearer ${token}` } : {},
        body:        form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Failed to upload avatar');
      }

      const body = await res.json();
      return (body.data ?? body) as UserDto;
    },
    onSuccess: (user) => qc.setQueryData(queryKeys.profile(), user),
  });

  return { updateProfile, changePassword, uploadAvatar };
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export function useAddresses(enabled = false) {
  return useQuery({
    queryKey: queryKeys.addresses(),
    queryFn:  () => api.get<AddressDto[]>(API_ROUTES.USERS.ADDRESSES),
    staleTime: 5 * 60_000,
    retry:    false,
    enabled,
  });
}

export interface AddressInput {
  label?:       string;
  firstName:    string;
  lastName:     string;
  line1:        string;
  line2?:       string;
  city:         string;
  state?:       string;
  postalCode:   string;
  country:      string;
  phone?:       string;
  isDefault?:   boolean;
}

export function useMutateAddresses() {
  const qc         = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.addresses() });

  const addAddress = useMutation({
    mutationFn: (input: AddressInput) =>
      api.post<AddressDto>(API_ROUTES.USERS.ADDRESSES, input),
    onSuccess: invalidate,
  });

  const updateAddress = useMutation({
    mutationFn: ({ id, ...body }: AddressInput & { id: string }) =>
      api.patch<AddressDto>(API_ROUTES.USERS.ADDRESS(id), body),
    onSuccess: invalidate,
  });

  const deleteAddress = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ROUTES.USERS.ADDRESS(id)),
    onSuccess: invalidate,
  });

  /** Set an address as the default. */
  const setDefaultAddress = useMutation({
    mutationFn: (id: string) =>
      api.patch<AddressDto>(API_ROUTES.USERS.ADDRESS(id), { isDefault: true }),
    onSuccess: invalidate,
  });

  return { addAddress, updateAddress, deleteAddress, setDefaultAddress };
}
