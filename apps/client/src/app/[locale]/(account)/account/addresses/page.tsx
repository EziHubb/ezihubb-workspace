'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, Star, MapPin } from 'lucide-react';
import { queryKeys } from '@mlh/api-client';
import { apiClient } from '@mlh/api-client';
import { useToast } from '@mlh/ui';
import type { AddressDto } from '@mlh/types';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';

const MAX_ADDRESSES = 10;

// ── Zod schema ────────────────────────────────────────────────────────────────

const addressSchema = z.object({
  label:      z.string().optional(),
  firstName:  z.string().min(1, 'Required'),
  lastName:   z.string().min(1, 'Required'),
  phone:      z.string().optional(),
  line1:      z.string().min(5, 'Enter full street address'),
  line2:      z.string().optional(),
  city:       z.string().min(1, 'Required'),
  state:      z.string().optional(),
  postalCode: z.string().min(3, 'Required'),
  country:    z.string().length(2, 'Select country'),
  isDefault:  z.boolean().optional(),
});

type FormValues = z.infer<typeof addressSchema>;

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'AU', name: 'Australia' },
  { code: 'VN', name: 'Vietnam' }, { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
];

// ── Address modal ─────────────────────────────────────────────────────────────

function AddressModal({
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  initial?:  AddressDto;
  onClose:   () => void;
  onSave:    (data: FormValues) => void;
  isSaving:  boolean;
}) {
  const isEdit = Boolean(initial);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: initial
      ? {
          label:      initial.label,
          firstName:  initial.firstName,
          lastName:   initial.lastName,
          phone:      initial.phone,
          line1:      initial.addressLine1,
          line2:      initial.addressLine2 ?? '',
          city:       initial.city,
          state:      initial.state,
          postalCode: initial.postalCode,
          country:    initial.country,
          isDefault:  initial.isDefault,
        }
      : { country: 'US', isDefault: false },
  });

  const inp = (err?: string) =>
    [
      'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
      err ? 'border-error' : 'border-border',
    ].join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-modal shadow-modal w-full max-w-lg overflow-y-auto max-h-[90dvh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-base">
            {isEdit ? 'Edit Address' : 'Add New Address'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-secondary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="px-6 py-5 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Label (optional)
            </label>
            <input
              {...register('label')}
              placeholder="Home, Work…"
              className={inp()}
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">
                First Name <span className="text-error">*</span>
              </label>
              <input {...register('firstName')} className={inp(errors.firstName?.message)} />
              {errors.firstName && <p className="text-xs text-error mt-0.5">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">
                Last Name <span className="text-error">*</span>
              </label>
              <input {...register('lastName')} className={inp(errors.lastName?.message)} />
              {errors.lastName && <p className="text-xs text-error mt-0.5">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Phone</label>
            <input {...register('phone')} type="tel" className={inp()} />
          </div>

          {/* Address line 1 */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Address <span className="text-error">*</span>
            </label>
            <input {...register('line1')} placeholder="123 Main St" className={inp(errors.line1?.message)} />
            {errors.line1 && <p className="text-xs text-error mt-0.5">{errors.line1.message}</p>}
          </div>

          {/* Address line 2 */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Apt, suite (optional)</label>
            <input {...register('line2')} className={inp()} />
          </div>

          {/* City / State / ZIP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">City <span className="text-error">*</span></label>
              <input {...register('city')} className={inp(errors.city?.message)} />
              {errors.city && <p className="text-xs text-error mt-0.5">{errors.city.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">State</label>
              <input {...register('state')} className={inp()} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">ZIP <span className="text-error">*</span></label>
              <input {...register('postalCode')} className={inp(errors.postalCode?.message)} />
              {errors.postalCode && <p className="text-xs text-error mt-0.5">{errors.postalCode.message}</p>}
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Country <span className="text-error">*</span></label>
            <select {...register('country')} className={inp(errors.country?.message)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Default checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register('isDefault')} type="checkbox" className="w-4 h-4 accent-primary" />
            <span className="text-sm text-secondary">Set as default address</span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Address card ──────────────────────────────────────────────────────────────

function AddressCard({
  addr,
  onEdit,
  onDelete,
  onSetDefault,
  isDeletingId,
  isSettingDefaultId,
}: {
  addr:              AddressDto;
  onEdit:            (addr: AddressDto) => void;
  onDelete:          (id: string) => void;
  onSetDefault:      (id: string) => void;
  isDeletingId:      string | null;
  isSettingDefaultId: string | null;
}) {
  return (
    <div className="border border-border rounded-card p-4 space-y-3 relative hover:border-primary/40 transition-colors">
      {/* Default badge */}
      {addr.isDefault && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-pill px-2 py-0.5">
          <Star className="w-2.5 h-2.5 fill-current" />
          Default
        </span>
      )}

      {/* Label */}
      {addr.label && (
        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
          {addr.label}
        </p>
      )}

      {/* Address lines */}
      <address className="not-italic text-sm text-secondary leading-relaxed">
        {addr.firstName} {addr.lastName}<br />
        {addr.addressLine1}
        {addr.addressLine2 && <>, {addr.addressLine2}</>}<br />
        {addr.city}, {addr.state} {addr.postalCode}<br />
        {addr.country}
      </address>
      {addr.phone && <p className="text-xs text-muted">{addr.phone}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => onEdit(addr)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>

        {!addr.isDefault && (
          <button
            type="button"
            onClick={() => onSetDefault(addr.id)}
            disabled={isSettingDefaultId === addr.id}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            <Star className="w-3 h-3" />
            Set Default
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(addr.id)}
          disabled={isDeletingId === addr.id}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-error border border-error/30 rounded-button px-3 py-1.5 hover:bg-error/5 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Address mutation input (mirrors AddressInput from useCheckout hook) ───────

interface AddressPayload {
  label?:      string;
  firstName:   string;
  lastName:    string;
  phone?:      string;
  addressLine1: string;
  addressLine2?: string;
  city:        string;
  state?:      string;
  postalCode:  string;
  country:     string;
  isDefault?:  boolean;
}

export default function AddressesPage() {
  const toast = useToast();

  const { data: addresses = [], isLoading } = useAuthQuery<AddressDto[]>(
    queryKeys.addresses(),
    '/users/me/addresses',
  );

  const addAddress = useAuthMutation(
    (dto: AddressPayload, token: string) =>
      apiClient.post<AddressDto>('/users/me/addresses', dto, { token }),
    { invalidateKeys: [queryKeys.addresses()] },
  );

  const updateAddress = useAuthMutation(
    ({ id, ...dto }: AddressPayload & { id: string }, token: string) =>
      apiClient.patch<AddressDto>(`/users/me/addresses/${id}`, dto, { token }),
    { invalidateKeys: [queryKeys.addresses()] },
  );

  const deleteAddress = useAuthMutation(
    (id: string, token: string) =>
      apiClient.delete<void>(`/users/me/addresses/${id}`, { token }),
    { invalidateKeys: [queryKeys.addresses()] },
  );

  const setDefaultAddress = useAuthMutation(
    (id: string, token: string) =>
      apiClient.patch<AddressDto>(
        `/users/me/addresses/${id}`,
        { isDefault: true },
        { token },
      ),
    { invalidateKeys: [queryKeys.addresses()] },
  );

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingAddr,  setEditingAddr]  = useState<AddressDto | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);

  const atLimit = addresses.length >= MAX_ADDRESSES;

  const openAdd  = () => { setEditingAddr(null); setModalOpen(true); };
  const openEdit = (addr: AddressDto) => { setEditingAddr(addr); setModalOpen(true); };
  const closeModal = () => { setEditingAddr(null); setModalOpen(false); };

  const handleSave = (data: FormValues) => {
    const payload: AddressPayload = {
      label:        data.label,
      firstName:    data.firstName,
      lastName:     data.lastName,
      phone:        data.phone,
      addressLine1: data.line1,
      addressLine2: data.line2,
      city:         data.city,
      state:        data.state,
      postalCode:   data.postalCode,
      country:      data.country,
      isDefault:    data.isDefault,
    };

    if (editingAddr) {
      updateAddress.mutate(
        { id: editingAddr.id, ...payload },
        {
          onSuccess: () => { toast.success('Address updated'); closeModal(); },
          onError:   () => toast.error('Failed to update address'),
        },
      );
    } else {
      addAddress.mutate(payload, {
        onSuccess: () => { toast.success('Address added'); closeModal(); },
        onError:   () => toast.error('Failed to add address'),
      });
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteAddress.mutate(id, {
      onSuccess: () => { toast.info('Address removed'); setDeletingId(null); },
      onError:   () => { toast.error('Failed to remove address'); setDeletingId(null); },
    });
  };

  const handleSetDefault = (id: string) => {
    setDefaultingId(id);
    setDefaultAddress.mutate(id, {
      onSuccess: () => { toast.success('Default address updated'); setDefaultingId(null); },
      onError:   () => { toast.error('Failed to update default'); setDefaultingId(null); },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-secondary">Address Book</h1>
        <button
          type="button"
          onClick={openAdd}
          disabled={atLimit}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/50 rounded-button px-4 py-2 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {atLimit && (
        <p className="text-sm text-warning bg-warning/8 border border-warning/20 rounded-sm px-4 py-2">
          You&apos;ve reached the maximum of {MAX_ADDRESSES} addresses.
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border rounded-card p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-border/30 rounded w-16" />
              <div className="space-y-2">
                <div className="h-3 bg-border/30 rounded w-3/4" />
                <div className="h-3 bg-border/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && addresses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <MapPin className="w-12 h-12 text-muted/30" aria-hidden />
          <p className="text-secondary font-medium">No saved addresses yet</p>
          <p className="text-sm text-muted">Add an address for faster checkout.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-2 inline-flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Address
          </button>
        </div>
      )}

      {!isLoading && addresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr: AddressDto) => (
            <AddressCard
              key={addr.id}
              addr={addr}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              isDeletingId={deletingId}
              isSettingDefaultId={defaultingId}
            />
          ))}

          {/* Add new address — dashed card */}
          {!atLimit && (
            <button
              type="button"
              onClick={openAdd}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-card p-6 text-muted hover:border-primary hover:text-primary transition-colors min-h-[140px]"
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">Add New Address</span>
            </button>
          )}
        </div>
      )}

      {/* Address modal */}
      {modalOpen && (
        <AddressModal
          initial={editingAddr ?? undefined}
          onClose={closeModal}
          onSave={handleSave}
          isSaving={addAddress.isPending || updateAddress.isPending}
        />
      )}
    </div>
  );
}
