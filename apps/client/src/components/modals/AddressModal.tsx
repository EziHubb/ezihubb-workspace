'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import type { useTranslations as UseTranslations } from 'next-intl';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Select } from '@ezihubb/ui';
import { useMutateAddresses } from '@ezihubb/api-client';
import type { AddressDto } from '@ezihubb/types';

// ── Schema ────────────────────────────────────────────────────────────────────

type Translator = ReturnType<typeof UseTranslations>;

function buildSchema(tErr: Translator) {
  return z.object({
    label:       z.string().optional(),
    firstName:   z.string().min(1, tErr('required')),
    lastName:    z.string().min(1, tErr('required')),
    phone:       z.string().regex(/^\+?[\d\s\-(]{7,15}$/, tErr('invalidPhone')),
    line1:       z.string().min(5, tErr('enterFullAddress')),
    line2:       z.string().optional(),
    city:        z.string().min(1, tErr('required')),
    state:       z.string().optional(),
    postalCode:  z.string().min(3, tErr('required')),
    country:     z.string().length(2, tErr('selectCountry')),
    isDefault:   z.boolean().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

// ── Countries ─────────────────────────────────────────────────────────────────

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

const inputCls = (err?: string) =>
  [
    'w-full px-3 py-2.5 text-sm border rounded-sm bg-surface text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
    'transition-colors placeholder:text-muted/60',
    err ? 'border-error' : 'border-border',
  ].join(' ');

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AddressModalProps {
  isOpen:     boolean;
  address?:   AddressDto;
  onSave:     (saved: AddressDto) => void;
  onClose:    () => void;
  showDefault?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddressModal({
  isOpen,
  address,
  onSave,
  onClose,
  showDefault = true,
}: AddressModalProps) {
  const t = useTranslations('account.addresses');
  const tErr = useTranslations('account.addresses.errors');
  const isEditing = Boolean(address);
  const { addAddress, updateAddress } = useMutateAddresses();
  const isPending = addAddress.isPending || updateAddress.isPending;
  const schema = useMemo(() => buildSchema(tErr), [tErr]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label:      address?.label      ?? '',
      firstName:  address?.firstName  ?? '',
      lastName:   address?.lastName   ?? '',
      phone:      address?.phone      ?? '',
      line1:      address?.addressLine1 ?? '',
      line2:      address?.addressLine2 ?? '',
      city:       address?.city       ?? '',
      state:      address?.state      ?? '',
      postalCode: address?.postalCode ?? '',
      country:    address?.country    ?? 'US',
      isDefault:  address?.isDefault  ?? false,
    },
  });

  // Reset form when modal opens with new address
  useEffect(() => {
    if (isOpen) {
      reset({
        label:      address?.label      ?? '',
        firstName:  address?.firstName  ?? '',
        lastName:   address?.lastName   ?? '',
        phone:      address?.phone      ?? '',
        line1:      address?.addressLine1 ?? '',
        line2:      address?.addressLine2 ?? '',
        city:       address?.city       ?? '',
        state:      address?.state      ?? '',
        postalCode: address?.postalCode ?? '',
        country:    address?.country    ?? 'US',
        isDefault:  address?.isDefault  ?? false,
      });
    }
  }, [isOpen, address, reset]);

  const onSubmit = (data: FormValues) => {
    const payload = {
      label:      data.label ?? '',
      fullName:   `${data.firstName} ${data.lastName}`.trim(),
      phone:      data.phone,
      line1:      data.line1,
      line2:      data.line2,
      city:       data.city,
      state:      data.state,
      postalCode: data.postalCode,
      country:    data.country,
      isDefault:  data.isDefault,
    };

    if (isEditing && address) {
      updateAddress.mutate(
        { id: address.id, ...payload },
        { onSuccess: (saved) => { onSave(saved); onClose(); } },
      );
    } else {
      addAddress.mutate(payload, {
        onSuccess: (saved) => { onSave(saved); onClose(); },
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isPending ? () => undefined : onClose} size="md">
      <ModalHeader onClose={isPending ? undefined : onClose} closeLabel={t('modal.close')}>
        {isEditing ? t('modal.editTitle') : t('modal.addTitle')}
      </ModalHeader>

      <ModalBody>
        <form
          id="address-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Label */}
          <Field label={t('fields.label')} error={errors.label?.message}>
            <input
              {...register('label')}
              placeholder={t('fields.labelPlaceholder')}
              className={inputCls(errors.label?.message)}
            />
          </Field>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('fields.firstName')} required error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                autoComplete="given-name"
                className={inputCls(errors.firstName?.message)}
              />
            </Field>
            <Field label={t('fields.lastName')} required error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                autoComplete="family-name"
                className={inputCls(errors.lastName?.message)}
              />
            </Field>
          </div>

          {/* Phone */}
          <Field label={t('fields.phone')} required error={errors.phone?.message}>
            <input
              {...register('phone')}
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              className={inputCls(errors.phone?.message)}
            />
          </Field>

          {/* Address Line 1 */}
          <Field label={t('fields.address')} required error={errors.line1?.message}>
            <input
              {...register('line1')}
              autoComplete="address-line1"
              placeholder={t('fields.addressPlaceholder')}
              className={inputCls(errors.line1?.message)}
            />
          </Field>

          {/* Address Line 2 */}
          <Field label={t('fields.apt')}>
            <input
              {...register('line2')}
              autoComplete="address-line2"
              className={inputCls()}
            />
          </Field>

          {/* City / State / ZIP */}
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('fields.city')} required error={errors.city?.message}>
              <input
                {...register('city')}
                autoComplete="address-level2"
                className={inputCls(errors.city?.message)}
              />
            </Field>
            <Field label={t('fields.state')} error={errors.state?.message}>
              <input
                {...register('state')}
                autoComplete="address-level1"
                placeholder="CA"
                className={inputCls(errors.state?.message)}
              />
            </Field>
            <Field label={t('fields.zip')} required error={errors.postalCode?.message}>
              <input
                {...register('postalCode')}
                autoComplete="postal-code"
                className={inputCls(errors.postalCode?.message)}
              />
            </Field>
          </div>

          {/* Country */}
          <Field label={t('fields.country')} required error={errors.country?.message}>
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
                  options={COUNTRIES.map((country) => ({
                    value: country.code,
                    label: country.name,
                  }))}
                  error={Boolean(errors.country)}
                  required
                />
              )}
            />
          </Field>

          {/* Default checkbox */}
          {showDefault && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('isDefault')}
                type="checkbox"
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-secondary">{t('fields.setDefault')}</span>
            </label>
          )}

          {/* Mutation errors */}
          {(addAddress.error || updateAddress.error) && (
            <p className="text-xs text-error" role="alert">
              {(addAddress.error ?? updateAddress.error)?.message ??
                tErr('failedToSave')}
            </p>
          )}
        </form>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="address-form"
          variant="primary"
          loading={isPending}
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
