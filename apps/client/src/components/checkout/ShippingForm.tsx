'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { useAddresses, useMutateAddresses, useProfile } from '@ezihubb/api-client';
import type { ShippingAddressInput } from '@ezihubb/api-client';
import { Select } from '@ezihubb/ui';

// ── Zod schema (validation messages injected at call time via a factory,
// since useTranslations can only be called inside a component/hook body) ──────

function buildSchema(t: ReturnType<typeof useTranslations<'checkout.shippingForm.validation'>>) {
  return z.object({
    email:        z.string().email(t('validEmail')).optional().or(z.literal('')),
    firstName:    z.string().min(1, t('required')),
    lastName:     z.string().min(1, t('required')),
    phone:        z.string().regex(/^\+?[\d\s\-(]{7,15}$/, t('invalidPhone')),
    addressLine1: z.string().min(5, t('fullAddress')),
    addressLine2: z.string().optional(),
    city:         z.string().min(1, t('required')),
    state:        z.string().optional(),
    postalCode:   z.string().min(3, t('required')),
    country:      z.string().length(2, t('selectCountry')),
    saveAddress:  z.boolean().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

// ── Country list — codes only; display names are localized at render time
// via Intl.DisplayNames so a shopper always sees their country in their own
// language instead of a hardcoded English list. ────────────────────────────────

const COUNTRY_CODES = [
  'US', 'CA', 'GB', 'AU', 'VN', 'SG', 'JP', 'KR', 'DE', 'FR',
  'IT', 'ES', 'NL', 'MX', 'BR', 'IN', 'CN', 'NZ',
] as const;

function useCountryNames(locale: string): (code: string) => string {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
  return (code: string) => displayNames.of(code) ?? code;
}

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
  const t = useTranslations('checkout.shippingForm');
  const tValidation = useTranslations('checkout.shippingForm.validation');
  const locale = useLocale();
  const getCountryName = useCountryNames(locale);
  const { data: addresses } = useAddresses(isLoggedIn);
  const { data: profile }   = useProfile(isLoggedIn);
  const { addAddress }      = useMutateAddresses();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(tValidation)),
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

  const onSubmit = async (data: FormValues) => {
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

    setSaveError(null);
    if (isLoggedIn && data.saveAddress) {
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const normalized = (value?: string | null) => value?.trim().toLocaleLowerCase() ?? '';
      const alreadySaved = addresses?.some((saved) =>
        normalized(saved.fullName) === normalized(fullName) &&
        normalized(saved.line1) === normalized(data.addressLine1) &&
        normalized(saved.line2) === normalized(data.addressLine2) &&
        normalized(saved.city) === normalized(data.city) &&
        normalized(saved.state) === normalized(data.state) &&
        normalized(saved.postalCode) === normalized(data.postalCode) &&
        normalized(saved.country) === normalized(data.country),
      );

      if (!alreadySaved) {
        try {
          await addAddress.mutateAsync({
            fullName,
            phone:      data.phone,
            line1:      data.addressLine1,
            line2:      data.addressLine2 || undefined,
            city:       data.city,
            state:      data.state || undefined,
            postalCode: data.postalCode,
            country:    data.country,
          });
        } catch {
          setSaveError(t('saveAddressError'));
          return;
        }
      }
    }

    onComplete(addr, data.email ?? '');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Saved address picker (logged-in only) */}
      {isLoggedIn && addresses && addresses.length > 0 && (
        <Field label={t('savedAddress')}>
          <Select
            onChange={(e) => fillFromSaved(e.target.value)}
            defaultValue=""
            placeholder={t('selectSavedAddress')}
            options={addresses.map((address) => ({
              value: address.id,
              label: `${address.firstName} ${address.lastName} · ${address.addressLine1}, ${address.city}`,
            }))}
          />
        </Field>
      )}

      {/* Guest email */}
      {!isLoggedIn && (
        <Field label={t('email')} required error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className={inputCls(errors.email?.message)}
          />
          <p className="text-xs text-muted">{t('emailHint')}</p>
        </Field>
      )}

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('firstName')} required error={errors.firstName?.message}>
          <input
            {...register('firstName')}
            autoComplete="given-name"
            className={inputCls(errors.firstName?.message)}
          />
        </Field>
        <Field label={t('lastName')} required error={errors.lastName?.message}>
          <input
            {...register('lastName')}
            autoComplete="family-name"
            className={inputCls(errors.lastName?.message)}
          />
        </Field>
      </div>

      {/* Phone */}
      <Field label={t('phone')} required error={errors.phone?.message}>
        <input
          {...register('phone')}
          type="tel"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          className={inputCls(errors.phone?.message)}
        />
      </Field>

      {/* Address Line 1 */}
      <Field label={t('address')} required error={errors.addressLine1?.message}>
        <input
          {...register('addressLine1')}
          autoComplete="address-line1"
          placeholder={t('addressPlaceholder')}
          className={inputCls(errors.addressLine1?.message)}
        />
      </Field>

      {/* Address Line 2 */}
      <Field label={t('addressLine2')}>
        <input
          {...register('addressLine2')}
          autoComplete="address-line2"
          className={inputCls()}
        />
      </Field>

      {/* City / State / ZIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={t('city')} required error={errors.city?.message}>
          <input
            {...register('city')}
            autoComplete="address-level2"
            className={inputCls(errors.city?.message)}
          />
        </Field>
        <Field label={t('state')} error={errors.state?.message}>
          <input
            {...register('state')}
            autoComplete="address-level1"
            placeholder={t('statePlaceholder')}
            className={inputCls(errors.state?.message)}
          />
        </Field>
        <Field label={t('zip')} required error={errors.postalCode?.message}>
          <input
            {...register('postalCode')}
            autoComplete="postal-code"
            className={inputCls(errors.postalCode?.message)}
          />
        </Field>
      </div>

      {/* Country */}
      <Field label={t('country')} required error={errors.country?.message}>
        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value)}
              options={COUNTRY_CODES.map((code) => ({
                value: code,
                label: getCountryName(code),
              }))}
              error={Boolean(errors.country)}
              required
            />
          )}
        />
      </Field>

      {/* Save address checkbox (logged-in only) */}
      {isLoggedIn && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('saveAddress')}
              type="checkbox"
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-secondary">{t('saveAddress')}</span>
          </label>
          {saveError && <p className="mt-1 text-xs text-error" role="alert">{saveError}</p>}
        </div>
      )}

      {/* Submit — desktop inline + mobile sticky bottom bar */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="hidden md:block w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
      >
        {t('continueToDelivery')}
      </button>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pt-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
        >
          {t('continueToDelivery')}
        </button>
      </div>
    </form>
  );
}
