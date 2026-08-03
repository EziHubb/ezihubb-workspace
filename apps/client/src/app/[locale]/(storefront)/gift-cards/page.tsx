'use client';

/**
 * Gift Card purchase page.
 * Fully client-rendered for the interactive purchase flow.
 * Server-side data: none needed (amounts/copy are static).
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { Check, Gift, Search, AlertCircle, Tag } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@ezihubb/ui';
import { apiClient } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ── Config ────────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200] as const;

// ── GiftCardVisual ────────────────────────────────────────────────────────────

function GiftCardVisual({ amount }: { amount: number | null }) {
  return (
    <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl select-none bg-gradient-to-br from-primary via-[#D97706] to-[#B45309]">
      {/* Decorative circles */}
      <div aria-hidden="true" className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-sm" />
      <div aria-hidden="true" className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-black/15 blur-sm" />

      {/* Card grid lines */}
      <div aria-hidden="true" className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, white 30px, white 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, white 30px, white 31px)',
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="text-white">
            <p className="font-display font-bold text-lg md:text-xl leading-none">
              EziHubb
            </p>
            <p className="text-white/70 text-xs mt-0.5">Handmade</p>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <span className="font-display font-bold text-white text-lg md:text-xl">M</span>
          </div>
        </div>

        {/* Center decoration */}
        <div className="flex justify-center">
          <Gift className="w-8 h-8 text-white/30" />
        </div>

        {/* Amount */}
        <div>
          <p className="text-white/60 text-[11px] uppercase tracking-widest mb-0.5">
            Gift Card Value
          </p>
          <p className="font-display text-3xl md:text-5xl font-bold text-white leading-none">
            {amount ? `$${amount}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── AmountSelector ────────────────────────────────────────────────────────────

function AmountSelector({
  selectedAmount,
  customAmount,
  onSelectPreset,
  onCustomChange,
}: {
  selectedAmount: number | null;
  customAmount:   string;
  onSelectPreset: (amount: number | null) => void;
  onCustomChange: (v: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-secondary">Select Amount</p>

      {/* Preset pills */}
      <div className="grid grid-cols-3 gap-2.5">
        {PRESET_AMOUNTS.map((amount) => {
          const isActive = selectedAmount === amount && !showCustom;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => {
                onSelectPreset(amount);
                setShowCustom(false);
                onCustomChange('');
              }}
              aria-pressed={isActive}
              className={[
                'relative py-3 rounded-button border-2 text-sm font-bold transition-all',
                isActive
                  ? 'border-primary bg-primary/8 text-primary shadow-sm'
                  : 'border-border text-secondary hover:border-primary/50',
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
              ${amount}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div>
        <button
          type="button"
          onClick={() => {
            setShowCustom((s) => !s);
            if (!showCustom) onSelectPreset(null);
          }}
          className={[
            'w-full py-2.5 border-2 rounded-button text-sm font-medium transition-all text-center',
            showCustom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-dashed border-border text-muted hover:border-primary hover:text-primary',
          ].join(' ')}
        >
          {showCustom ? 'Hide custom amount' : '+ Custom amount'}
        </button>

        {showCustom && (
          <div className="mt-2 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
              $
            </span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => {
                onCustomChange(e.target.value);
                const n = Number(e.target.value);
                onSelectPreset(n > 0 ? n : null);
              }}
              min={10}
              max={500}
              placeholder="e.g. 30"
              className="w-full pl-7 pr-3 py-2.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted mt-1">Between $10 and $500</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RecipientForm ─────────────────────────────────────────────────────────────

const recipientSchema = z.object({
  recipientName:  z.string().min(1, 'Required'),
  recipientEmail: z.string().email('Enter a valid email'),
  yourName:       z.string().min(1, 'Required'),
  message:        z.string().max(200).optional(),
  sendNow:        z.boolean(),
  scheduleDate:   z.string().optional(),
});

type RecipientValues = z.infer<typeof recipientSchema>;

function RecipientForm({
  onSubmit,
  isPurchasing,
  amount,
}: {
  onSubmit:    (data: RecipientValues) => void;
  isPurchasing: boolean;
  amount:      number | null;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecipientValues>({
    resolver: zodResolver(recipientSchema),
    defaultValues: { sendNow: true },
  });

  const sendNow = watch('sendNow');
  const message = watch('message') ?? '';

  const inp = (err?: string) =>
    [
      'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
      err ? 'border-error' : 'border-border',
    ].join(' ');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <p className="text-sm font-semibold text-secondary">Recipient Details</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Recipient&apos;s Name <span className="text-error">*</span>
          </label>
          <input {...register('recipientName')} placeholder="Jane Doe" className={inp(errors.recipientName?.message)} />
          {errors.recipientName && <p className="text-xs text-error mt-0.5">{errors.recipientName.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Recipient&apos;s Email <span className="text-error">*</span>
          </label>
          <input {...register('recipientEmail')} type="email" placeholder="jane@example.com" className={inp(errors.recipientEmail?.message)} />
          {errors.recipientEmail && <p className="text-xs text-error mt-0.5">{errors.recipientEmail.message}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Your Name <span className="text-error">*</span>
        </label>
        <input {...register('yourName')} placeholder="Your name" className={inp(errors.yourName?.message)} />
        {errors.yourName && <p className="text-xs text-error mt-0.5">{errors.yourName.message}</p>}
      </div>

      {/* Message */}
      <div>
        <label className="text-xs font-medium text-muted mb-1 flex items-center justify-between">
          <span>Personal Message</span>
          <span className={`tabular-nums ${message.length > 180 ? 'text-warning' : ''}`}>
            {message.length}/200
          </span>
        </label>
        <textarea
          {...register('message')}
          rows={3}
          placeholder="Add a heartfelt message for the recipient…"
          className={inp() + ' resize-none'}
          maxLength={200}
        />
      </div>

      {/* Send timing */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Send</p>
        <div className="flex gap-3">
          <label className={[
            'flex-1 flex items-center gap-2 p-3 rounded-button border-2 cursor-pointer text-sm font-medium transition-all',
            sendNow ? 'border-primary bg-primary/5 text-primary' : 'border-border text-secondary',
          ].join(' ')}>
            <input {...register('sendNow', { setValueAs: () => true })} type="radio" value="true" defaultChecked className="accent-primary" />
            Now
          </label>
          <label className={[
            'flex-1 flex items-center gap-2 p-3 rounded-button border-2 cursor-pointer text-sm font-medium transition-all',
            !sendNow ? 'border-primary bg-primary/5 text-primary' : 'border-border text-secondary',
          ].join(' ')}>
            <input {...register('sendNow', { setValueAs: () => false })} type="radio" value="false" className="accent-primary" />
            Schedule
          </label>
        </div>

        {!sendNow && (
          <div className="mt-2">
            <input
              {...register('scheduleDate')}
              type="date"
              min={new Date().toISOString().split('T')[0]}
              className={inp(errors.scheduleDate?.message)}
            />
          </div>
        )}
      </div>

      {/* Purchase button */}
      <button
        type="submit"
        disabled={isPurchasing || !amount}
        className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide flex items-center justify-center gap-2"
      >
        <Gift className="w-4 h-4" />
        {isPurchasing
          ? 'Processing…'
          : amount
          ? `Purchase Gift Card — $${amount}`
          : 'Select an Amount First'}
      </button>
    </form>
  );
}

// ── Balance Checker ───────────────────────────────────────────────────────────

function BalanceChecker() {
  const [code,      setCode]      = useState('');
  const [result,    setResult]    = useState<{ isValid: boolean; balance?: number; code?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  const handleCheck = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await apiClient.get<{ isValid: boolean; balance?: number; code?: string }>(
        API_ROUTES.PAYMENTS.GIFT_CARD_VALIDATE_CODE(code.trim()),
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired gift card code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-card p-5 space-y-4">
      <h3 className="font-semibold text-secondary text-sm flex items-center gap-2">
        <Tag className="w-4 h-4 text-primary" />
        Check Gift Card Balance
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); setResult(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
          placeholder="Enter gift card code"
          className="flex-1 px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={!code.trim() || isLoading}
          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Search className="w-4 h-4" />
          {isLoading ? '…' : 'Check'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {result && result.isValid && (
        <div className="flex items-center justify-between p-3 bg-success/8 border border-success/20 rounded-sm">
          <div>
            <p className="text-xs font-semibold text-success">Valid Gift Card</p>
            <p className="font-mono text-xs text-muted mt-0.5">{result.code ?? code}</p>
          </div>
          <p className="font-display text-2xl font-bold text-success">
            ${result.balance?.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GiftCardsPage() {
  const locale = useLocale();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount,   setCustomAmount]   = useState('');
  const [isPurchasing,   setIsPurchasing]   = useState(false);
  const [purchaseError,  setPurchaseError]  = useState('');
  const [successModal,   setSuccessModal]   = useState<{ giftCardCode: string; recipientEmail: string } | null>(null);

  const handleSelectPreset = (amount: number | null) => setSelectedAmount(amount);

  const handleCustomChange = (v: string) => {
    setCustomAmount(v);
    const n = Number(v);
    setSelectedAmount(n >= 10 && n <= 500 ? n : null);
  };

  const handlePurchase = async (formData: RecipientValues) => {
    if (!selectedAmount) return;
    setIsPurchasing(true);
    setPurchaseError('');

    try {
      const result = await apiClient.post<{ code: string }>(
        API_ROUTES.PAYMENTS.GIFT_CARDS_PURCHASE,
        {
          amount:         selectedAmount,
          currency:       'USD',
          recipientName:  formData.recipientName,
          recipientEmail: formData.recipientEmail,
          senderName:     formData.yourName,
          message:        formData.message,
          sendAt:         formData.sendNow ? null : formData.scheduleDate,
        },
      );
      const code = result?.code ?? 'MLH-GIFT-XXXX';
      setSuccessModal({ giftCardCode: code, recipientEmail: formData.recipientEmail });
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-14">

      {/* Page header */}
      <div className="text-center mb-10 md:mb-14">
        <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-pill uppercase tracking-widest mb-3">
          Give the Gift of Choice
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
          EziHubb Gift Cards
        </h1>
        <p className="text-muted max-w-md mx-auto text-base">
          The perfect gift for any occasion — let them choose their favorite personalized creation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">

        {/* Left: visual + amounts + form */}
        <div className="space-y-8">
          {/* Card visual */}
          <GiftCardVisual amount={selectedAmount} />

          {/* Amount selector */}
          <AmountSelector
            selectedAmount={selectedAmount}
            customAmount={customAmount}
            onSelectPreset={handleSelectPreset}
            onCustomChange={handleCustomChange}
          />

          {/* Recipient form */}
          <div className="border-t border-border pt-6">
            {purchaseError && (
              <p className="text-xs text-error bg-error/5 border border-error/20 rounded-sm px-3 py-2 mb-4" role="alert">
                {purchaseError}
              </p>
            )}
            <RecipientForm
              onSubmit={handlePurchase}
              isPurchasing={isPurchasing}
              amount={selectedAmount}
            />
          </div>
        </div>

        {/* Right: info + balance checker */}
        <aside className="space-y-5">
          {/* How it works */}
          <div className="border border-border rounded-card p-5 space-y-4">
            <h2 className="font-semibold text-secondary text-base">How it works</h2>
            <ul className="space-y-3 text-sm text-secondary">
              {[
                { emoji: '💳', text: 'Choose the amount and personalize the message' },
                { emoji: '📧', text: 'We email the gift card instantly or on your schedule' },
                { emoji: '🛍️', text: 'Recipient redeems it on any order at checkout' },
                { emoji: '💰', text: 'Balance never expires — use across multiple orders' },
              ].map(({ emoji, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="text-base shrink-0" aria-hidden="true">{emoji}</span>
                  <span className="text-muted leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Order summary */}
          {selectedAmount && (
            <div className="border border-border rounded-card p-5 space-y-3">
              <h3 className="font-semibold text-secondary text-sm">Order Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Gift Card Value</span>
                <span className="font-semibold text-secondary">${selectedAmount}.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Processing Fee</span>
                <span className="text-success font-medium">FREE</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 font-bold text-secondary">
                <span>Total</span>
                <span>${selectedAmount}.00</span>
              </div>
            </div>
          )}

          {/* Balance checker */}
          <BalanceChecker />
        </aside>
      </div>

      {/* Success modal */}
      {successModal && (
        <Modal isOpen={Boolean(successModal)} onClose={() => setSuccessModal(null)} size="sm">
          <ModalHeader onClose={() => setSuccessModal(null)}>
            Gift Card Sent! 🎉
          </ModalHeader>
          <ModalBody>
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <div>
                <p className="font-semibold text-secondary text-base mb-1">
                  Purchase complete!
                </p>
                <p className="text-muted text-sm">
                  Email sent to{' '}
                  <span className="font-medium text-secondary">{successModal.recipientEmail}</span>
                </p>
              </div>
              <div className="bg-background border border-border rounded-button px-4 py-3">
                <p className="text-xs text-muted mb-1">Gift Card Code</p>
                <p className="font-mono font-bold text-secondary tracking-wider">
                  {successModal.giftCardCode}
                </p>
              </div>
              <p className="text-xs text-muted">
                A copy of the code has been emailed to both you and the recipient.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              className="flex-1 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary transition-colors"
            >
              Buy Another
            </button>
            <a
              href={`/${locale}/search`}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-bold rounded-button text-center hover:bg-primary-dark transition-colors"
            >
              Shop Now
            </a>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
