'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Modal, ModalHeader, ModalBody, Button } from '@ezihubb/ui';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';
import type { ConversationDto } from '@ezihubb/types';
import { GuestMessageVerification } from './GuestMessageVerification';

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  context?: {
    orderId?:      string;
    orderNumber?:  string;
    productName?:  string;
    /**
     * The shop being written to, when no order names one.
     *
     * Without it the API had nothing to key the thread on: the conversation
     * was created with a null store, which the shop's own inbox filters out
     * entirely — so the message reached nobody — and started a fresh thread
     * every time, because the one-thread-per-buyer index only binds rows that
     * have a store.
     */
    storeId?:      string;
  };
}

interface FormValues {
  guestEmail: string;
  guestName:  string;
  subject:    string;
  message:    string;
}

export function MessageShopModal({ isOpen, onClose, context }: Props) {
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  const defaultSubject = context?.productName
    ? `Question about: ${context.productName}`
    : context?.orderNumber
    ? `Help with order #${context.orderNumber}`
    : '';

  const { register, handleSubmit, watch, reset, formState: { isSubmitting, errors } } =
    useForm<FormValues>({
      defaultValues: { guestEmail: '', guestName: '', subject: defaultSubject, message: '' },
    });

  const [sent, setSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const guestEmail = watch('guestEmail').trim().toLowerCase();

  const onSubmit = async (data: FormValues) => {
    if (!user && verifiedEmail !== guestEmail) return;
    setSendError('');
    try {
      await apiClient.post<ConversationDto>(API_ROUTES.MESSAGES.CONVERSATIONS, {
      orderId:    context?.orderId,
      storeId:    context?.storeId,
      subject:    data.subject || undefined,
      body:       data.message,
      guestEmail: user ? undefined : guestEmail,
      guestName:  user ? undefined : data.guestName  || undefined,
    }, { token: token ?? undefined });
      setSent(true);
    } catch (err) {
      if ((err as { code?: string }).code === 'ERR_GUEST_VERIFICATION_REQUIRED') setVerifiedEmail(null);
      setSendError('Unable to send your message. Please check your email verification and try again.');
    }
  };

  const handleClose = () => {
    setSent(false);
    setVerifiedEmail(null); setSendError('');
    reset({ guestEmail: '', guestName: '', subject: defaultSubject, message: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalHeader onClose={handleClose} closeLabel={tCommon('close')}>
        {sent ? 'Message sent!' : 'Message EziHubb'}
      </ModalHeader>
      <ModalBody>
        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-secondary mb-2">Message sent!</h3>
            <p className="text-sm text-muted mb-6">
              We typically respond within 2 hours during business hours.{' '}
              {user ? (
                <>
                  Check your{' '}
                  <Link href={`/${locale}/account/messages`} className="text-primary hover:underline" onClick={handleClose}>
                    message inbox
                  </Link>{' '}
                  for our reply.
                </>
              ) : (
                <Link href={`/${locale}/messages/guest`} className="text-primary hover:underline" onClick={handleClose}>Open your guest message inbox</Link>
              )}
            </p>
            <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Shop header */}
            <div className="flex items-center gap-3 p-3 bg-[#FAFAF8] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                ML
              </div>
              <div>
                <p className="text-sm font-medium">EziHubb</p>
                <p className="text-xs text-muted">Usually responds within 2 hours</p>
              </div>
            </div>

            {/* Order context badge */}
            {context?.orderNumber && (
              <div className="flex items-center gap-2 text-xs text-muted bg-blue-50 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm-9 9H7m2-4H7m10 0h-4" />
                </svg>
                Regarding order{' '}
                <span className="font-mono font-medium">{context.orderNumber}</span>
              </div>
            )}

            {/* Guest fields */}
            {!user && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Your name *</label>
                  <input
                    {...register('guestName', { required: 'Required' })}
                    placeholder="John Smith"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.guestName && <p className="text-xs text-red-500 mt-0.5">{errors.guestName.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Your email *</label>
                  <input
                    {...register('guestEmail', { required: 'Required' })}
                    type="email"
                    placeholder="john@email.com"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.guestEmail && <p className="text-xs text-red-500 mt-0.5">{errors.guestEmail.message}</p>}
                </div>
              </div>
            )}

            {!user && (verifiedEmail === guestEmail
              ? <p role="status" className="text-sm text-secondary">Email verified: {verifiedEmail}</p>
              : <GuestMessageVerification email={guestEmail} onVerified={setVerifiedEmail} />)}
            {sendError && <p role="alert" className="text-sm text-error">{sendError}</p>}

            {/* Subject */}
            <div>
              <label className="text-xs font-medium block mb-1">Subject</label>
              <input
                {...register('subject')}
                placeholder="What is your question about?"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium block mb-1">Message *</label>
              <textarea
                {...register('message', {
                  required: 'Message is required',
                  minLength: { value: 5, message: 'Message too short' },
                })}
                rows={4}
                placeholder="Describe your question or concern..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex justify-between mt-1">
                {errors.message ? (
                  <p className="text-xs text-red-500">{errors.message.message}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-muted">{(watch('message') ?? '').length}/5000</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting} disabled={!user && verifiedEmail !== guestEmail}>
                Send message
              </Button>
            </div>
          </form>
        )}
      </ModalBody>
    </Modal>
  );
}
