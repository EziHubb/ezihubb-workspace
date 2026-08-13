'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Plus, Trash2, ArrowRight } from 'lucide-react';
import {
  useFinancesBankAccount, useUpdateBankAccount,
  useFinancesBillingCards, useSetDefaultBillingCard, useDeleteBillingCard,
  useFinancesOverview, useUpdateAutoBilling, useUpdateCurrency,
  useFinancesTaxInfo,
} from '@ezihubb/api-client';
import { FinancesSubNav } from '../../../../../../components/seller/FinancesSubNav';
import { AddBillingCardModal } from '../../../../../../components/seller/finances/AddBillingCardModal';

const CURRENCIES = [
  'USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'DKK', 'HUF', 'IDR', 'ILS',
  'MYR', 'MAD', 'NOK', 'PHP', 'SGD', 'ZAR', 'CZK', 'HKD', 'INR', 'MXN', 'NZD', 'VND', 'SEK',
];

const PAYMENT_LOGOS = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Apple Pay', 'Google Pay', 'PayPal'];

type TabKey = 'methods' | 'currency' | 'billing' | 'address';
const TABS: TabKey[] = ['methods', 'currency', 'billing', 'address'];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

// ── Payment Methods tab ────────────────────────────────────────────────────

function PaymentMethodsTab() {
  const t = useTranslations('seller.finances.paymentSettings.methods');
  const { data: bankAccount, isLoading } = useFinancesBankAccount();
  const updateBank = useUpdateBankAccount();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    accountHolderName: '', bankName: '', accountNumber: '', country: 'VN',
    depositSchedule: 'WEEKLY' as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  });

  const startEdit = () => {
    setForm({
      accountHolderName: bankAccount?.accountHolderName ?? '',
      bankName:           bankAccount?.bankName ?? '',
      accountNumber:      '',
      country:             bankAccount?.country ?? 'VN',
      depositSchedule:    bankAccount?.depositSchedule ?? 'WEEKLY',
    });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBank.mutateAsync(form);
    setEditing(false);
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-secondary mb-1">{t('title')}</h3>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">{t('accountHolderName')}</label>
            <input
              required value={form.accountHolderName}
              onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">{t('bankName')}</label>
            <input
              required value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">{t('accountNumber')}</label>
            <input
              required value={form.accountNumber}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              placeholder={bankAccount ? t('accountNumberPlaceholderExisting', { last4: bankAccount.accountNumberLast4 }) : ''}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1">{t('depositSchedule')}</label>
            <select
              value={form.depositSchedule}
              onChange={(e) => setForm((f) => ({ ...f, depositSchedule: e.target.value as typeof f.depositSchedule }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="WEEKLY">{t('scheduleWeekly')}</option>
              <option value="BIWEEKLY">{t('scheduleBiweekly')}</option>
              <option value="MONTHLY">{t('scheduleMonthly')}</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2.5 border border-border text-secondary text-sm font-medium rounded-button hover:border-primary/40 transition-colors">
              {t('cancel')}
            </button>
            <button type="submit" disabled={updateBank.isPending}
              className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors disabled:opacity-50">
              {updateBank.isPending ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      ) : bankAccount ? (
        <div className="flex items-start justify-between gap-4 max-w-2xl">
          <div>
            <p className="text-xs font-semibold text-secondary mb-1">{t('bankDetails')}</p>
            <p className="text-sm text-secondary">{bankAccount.accountHolderName}</p>
            <p className="text-sm text-muted">{bankAccount.country} {t('accountEnding', { last4: bankAccount.accountNumberLast4 })}</p>
          </div>
          <button type="button" onClick={startEdit}
            className="px-3 py-1.5 border border-border text-secondary text-xs font-semibold rounded-full hover:border-primary/40 transition-colors shrink-0">
            {t('edit')}
          </button>
        </div>
      ) : (
        <div className="max-w-2xl">
          <p className="text-sm text-muted mb-3">{t('noBankAccount')}</p>
          <button type="button" onClick={startEdit}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors">
            {t('addBankAccount')}
          </button>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <p className="text-xs font-semibold text-secondary mb-3">{t('acceptedPaymentOptions')}</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_LOGOS.map((name) => (
            <span key={name} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-button text-xs text-secondary">
              <CreditCard className="w-3.5 h-3.5 text-muted" /> {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Currency tab ─────────────────────────────────────────────────────────

function CurrencyTab() {
  const t = useTranslations('seller.finances.paymentSettings.currency');
  const { data: overview } = useFinancesOverview();
  const updateCurrency = useUpdateCurrency();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-bold text-secondary mb-1">{t('title')}</h3>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>

      <div className="bg-background border border-border rounded-card p-4">
        <p className="text-sm text-secondary">{t('currentCurrency', { currency: overview?.currency ?? 'USD' })}</p>
        <p className="text-xs text-muted mt-2">{t('conversionNote')}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-secondary mb-2">{t('chooseCurrency')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => updateCurrency.mutate(code)}
              disabled={updateCurrency.isPending}
              className={[
                'text-left px-3 py-2 text-sm rounded-button border transition-colors disabled:opacity-50',
                overview?.currency === code
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-border text-secondary hover:border-primary/40',
              ].join(' ')}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Billing tab ──────────────────────────────────────────────────────────

function BillingTab() {
  const t = useTranslations('seller.finances.paymentSettings.billing');
  const { data: cards, isLoading } = useFinancesBillingCards();
  const { data: overview } = useFinancesOverview();
  const setDefault = useSetDefaultBillingCard();
  const deleteCard = useDeleteBillingCard();
  const updateAutoBilling = useUpdateAutoBilling();
  const [showAddModal, setShowAddModal] = useState(false);

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-secondary mb-1">{t('title')}</h3>
        <p className="text-sm text-muted">{t('description')}</p>
        <p className="text-xs text-muted mt-1">{t('defaultCardNote')}</p>
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40">
              <th className="w-10" />
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('cardType')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('expiration')}</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted text-xs">{t('cardholder')}</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(cards ?? []).map((card) => (
              <tr key={card.id}>
                <td className="pl-3">
                  <input
                    type="radio"
                    checked={card.isDefault}
                    onChange={() => setDefault.mutate(card.id)}
                    aria-label={t('setDefault')}
                  />
                </td>
                <td className="px-3 py-3 text-secondary capitalize">•••• •••• •••• {card.last4} ({card.brand})</td>
                <td className="px-3 py-3 text-muted">{String(card.expMonth).padStart(2, '0')}/{card.expYear}</td>
                <td className="px-3 py-3 text-secondary">{card.cardholderName}</td>
                <td className="px-3 py-3 text-right pr-3">
                  <button type="button" onClick={() => deleteCard.mutate(card.id)} aria-label={t('removeCard')}
                    className="text-muted hover:text-error transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(cards ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">{t('noCards')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <Plus className="w-4 h-4" /> {t('addCard')}
      </button>

      <div className="flex items-center justify-between max-w-2xl pt-4 border-t border-border">
        <span className="text-sm font-semibold text-secondary">{t('autobilling')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={overview?.autoBillingEnabled ?? false}
          onClick={() => updateAutoBilling.mutate(!(overview?.autoBillingEnabled ?? false))}
          className={`w-11 h-6 rounded-full transition-colors relative ${overview?.autoBillingEnabled ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${overview?.autoBillingEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {showAddModal && <AddBillingCardModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ── Address tab ──────────────────────────────────────────────────────────

function AddressTab() {
  const t = useTranslations('seller.finances.paymentSettings.address');
  const locale = useLocale();
  const { data: taxInfo, isLoading } = useFinancesTaxInfo();

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div className="max-w-2xl">
      <h3 className="text-base font-bold text-secondary mb-1">{t('title')}</h3>
      <p className="text-sm text-muted mb-4">{t('description')}</p>

      {taxInfo ? (
        <div className="text-sm text-secondary space-y-0.5 mb-4">
          <p>{taxInfo.fullLegalName}</p>
          <p>{taxInfo.streetAddress}</p>
          {taxInfo.flatOther && <p>{taxInfo.flatOther}</p>}
          <p>{[taxInfo.city, taxInfo.province, taxInfo.postCode].filter(Boolean).join(', ')}</p>
          <p>{taxInfo.country}</p>
        </div>
      ) : (
        <p className="text-sm text-muted mb-4">{t('noAddress')}</p>
      )}

      <Link
        href={`/${locale}/seller/finances/tax-information`}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-secondary text-sm font-semibold rounded-full hover:border-primary/40 transition-colors"
      >
        {t('editLegalInfo')} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PaymentSettingsPage() {
  const t = useTranslations('seller.finances.paymentSettings');
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>('methods');

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (requested && TABS.includes(requested as TabKey)) setTab(requested as TabKey);
  }, [searchParams]);

  return (
    <div>
      <h1 className="text-xl font-bold text-secondary mb-1">{t('title')}</h1>
      <FinancesSubNav />

      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-secondary',
            ].join(' ')}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'methods' && <PaymentMethodsTab />}
      {tab === 'currency' && <CurrencyTab />}
      {tab === 'billing' && <BillingTab />}
      {tab === 'address' && <AddressTab />}
    </div>
  );
}
