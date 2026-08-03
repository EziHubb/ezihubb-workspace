'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAddresses, useProfile } from '@ezihubb/api-client';
import type { ShippingAddressInput } from '@ezihubb/api-client';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  email:        z.string().email('Valid email required').optional().or(z.literal('')),
  firstName:    z.string().min(1, 'Required'),
  lastName:     z.string().min(1, 'Required'),
  phone:        z.string().regex(/^\+?[\d\s\-(]{7,15}$/, 'Invalid phone number'),
  addressLine1: z.string().min(5, 'Enter a full street address'),
  addressLine2: z.string().optional(),
  city:         z.string().min(1, 'Required'),
  state:        z.string().optional(),
  postalCode:   z.string().min(3, 'Required'),
  country:      z.string().length(2, 'Select a country'),
  saveAddress:  z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Country list ──────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' },
  { code: 'NZ', name: 'New Zealand' },
] as const;

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  children,
}: {
  label:    string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-secondary">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-error" role="alert">{error}</p>
      )}
    </div>
  );
}

const inputCls = (error?: string) =>
  [
    'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
    error ? 'border-error' : 'border-border',
  ].join(' ');

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShippingFormProps {
  initialValues?: Partial<ShippingAddressInput & { email: string }>;
  isLoggedIn:     boolean;
  onComplete:     (data: ShippingAddressInput, email: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShippingForm({
  initialValues,
  isLoggedIn,
  onComplete,
}: ShippingFormProps) {
  const { data: addresses } = useAddresses(isLoggedIn);
  const { data: profile }   = useProfile(isLoggedIn);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email:        initialValues?.email ?? '',
      firstName:    initialValues?.firstName ?? '',
      lastName:     initialValues?.lastName  ?? '',
      phone:        initialValues?.phone     ?? '',
      addressLine1: initialValues?.addressLine1 ?? '',
      addressLine2: initialValues?.addressLine2 ?? '',
      city:         initialValues?.city       ?? '',
      state:        initialValues?.state      ?? '',
      postalCode:   initialValues?.postalCode ?? '',
      country:      initialValues?.country    ?? 'US',
      saveAddress:  false,
    },
  });

  // Pre-fill email for logged-in users
  useEffect(() => {
    if (profile?.email) setValue('email', profile.email);
  }, [profile?.email, setValue]);

  const fillFromSaved = (id: string) => {
    const addr = addresses?.find((a) => a.id === id);
    if (!addr) return;
    setValue('firstName',    addr.firstName);
    setValue('lastName',     addr.lastName);
    setValue('phone',        addr.phone ?? '');
    setValue('addressLine1', addr.addressLine1);
    setValue('addressLine2', addr.addressLine2 ?? '');
    setValue('city',         addr.city);
    setValue('state',        addr.state ?? '');
    setValue('postalCode',   addr.postalCode);
    setValue('country',      addr.country);
  };

  const onSubmit = (data: FormValues) => {
    const addr: ShippingAddressInput = {
      firstName:    data.firstName,
      lastName:     data.lastName,
      phone:        data.phone,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city:         data.city,
      state:        data.state,
      postalCode:   data.postalCode,
      country:      data.country,
    };
    onComplete(addr, data.email ?? '');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Saved address picker (logged-in only) */}
      {isLoggedIn && addresses && addresses.length > 0 && (
        <Field label="Use a saved address">
          <select
            onChange={(e) => fillFromSaved(e.target.value)}
            defaultValue=""
            className={inputCls()}
          >
            <option value="">— Select a saved address —</option>
            {addresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.firstName} {addr.lastName} · {addr.addressLine1}, {addr.city}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Guest email */}
      {!isLoggedIn && (
        <Field label="Email" required error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            className={inputCls(errors.email?.message)}
          />
          <p className="text-xs text-muted">Order confirmation will be sent here</p>
        </Field>
      )}

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name" required error={errors.firstName?.message}>
          <input
            {...register('firstName')}
            autoComplete="given-name"
            className={inputCls(errors.firstName?.message)}
          />
        </Field>
        <Field label="Last Name" required error={errors.lastName?.message}>
          <input
            {...register('lastName')}
            autoComplete="family-name"
            className={inputCls(errors.lastName?.message)}
          />
        </Field>
      </div>

      {/* Phone */}
      <Field label="Phone" required error={errors.phone?.message}>
        <input
          {...register('phone')}
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 000 0000"
          className={inputCls(errors.phone?.message)}
        />
      </Field>

      {/* Address Line 1 */}
      <Field label="Address" required error={errors.addressLine1?.message}>
        <input
          {...register('addressLine1')}
          autoComplete="address-line1"
          placeholder="123 Main St"
          className={inputCls(errors.addressLine1?.message)}
        />
      </Field>

      {/* Address Line 2 */}
      <Field label="Apt, suite, etc. (optional)">
        <input
          {...register('addressLine2')}
          autoComplete="address-line2"
          className={inputCls()}
        />
      </Field>

      {/* City / State / ZIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="City" required error={errors.city?.message}>
          <input
            {...register('city')}
            autoComplete="address-level2"
            className={inputCls(errors.city?.message)}
          />
        </Field>
        <Field label="State / Province" error={errors.state?.message}>
          <input
            {...register('state')}
            autoComplete="address-level1"
            placeholder="CA"
            className={inputCls(errors.state?.message)}
          />
        </Field>
        <Field label="ZIP / Postal Code" required error={errors.postalCode?.message}>
          <input
            {...register('postalCode')}
            autoComplete="postal-code"
            className={inputCls(errors.postalCode?.message)}
          />
        </Field>
      </div>

      {/* Country */}
      <Field label="Country" required error={errors.country?.message}>
        <select
          {...register('country')}
          autoComplete="country"
          className={inputCls(errors.country?.message)}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Save address checkbox (logged-in only) */}
      {isLoggedIn && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            {...register('saveAddress')}
            type="checkbox"
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm text-secondary">Save this address for future orders</span>
        </label>
      )}

      {/* Submit — desktop inline + mobile sticky bottom bar */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="hidden md:block w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
      >
        Continue to Delivery →
      </button>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          Continue to Delivery →
        </button>
      </div>
    </form>
  );
}
